-- =============================================================================
-- MÓDULO DE COMPLIANCE — JurisBPO
-- Gerado em: 2026-05-10
-- Executar no SQL Editor do Supabase (projeto de produção)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela principal: compliance_denuncias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_denuncias (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          text        UNIQUE,                       -- DEN-YYYY-NNN (gerado por trigger)
  escritorio_id   uuid        NOT NULL REFERENCES escritorios(id) ON DELETE CASCADE,

  -- Remetente — armazenado no servidor, NUNCA exposto ao frontend
  remetente_email text,
  remetente_nome  text,

  -- Conteúdo
  assunto         text,
  corpo_original  text,
  corpo_resumo    text,

  -- Classificação
  categoria       text NOT NULL DEFAULT 'nao_classificado'
    CHECK (categoria IN (
      'nao_classificado','assedio_moral','assedio_sexual','discriminacao',
      'corrupcao','fraude_financeira','desvio_conduta','violacao_lgpd',
      'conflito_interesses','concorrencia_desleal','outro','encaminhar'
    )),
  competencia     text NOT NULL DEFAULT 'compliance'
    CHECK (competencia IN ('compliance','reencaminhar')),
  setor_destino   text,                                     -- preenchido quando competencia = 'reencaminhar'

  -- Workflow
  status          text NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido','em_investigacao','em_diligencia','concluido','arquivado')),
  responsavel_id  uuid REFERENCES auth.users(id),
  prazo_resposta  date,
  parecer         text,                                     -- conclusão/parecer final

  -- Deduplicação
  raw_text_hash   text UNIQUE,

  data_protocolo  timestamptz NOT NULL DEFAULT now(),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN compliance_denuncias.remetente_email IS
  'E-mail real do denunciante. Nunca expor no frontend — acesso apenas pelo worker (SERVICE_ROLE).';
COMMENT ON COLUMN compliance_denuncias.remetente_nome IS
  'Nome do remetente. Nunca expor no frontend.';

-- ---------------------------------------------------------------------------
-- 2. Tabela de mensagens: thread de cada denúncia
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_mensagens (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id     uuid    NOT NULL REFERENCES compliance_denuncias(id) ON DELETE CASCADE,
  escritorio_id   uuid    NOT NULL,

  -- Tipo de mensagem
  tipo            text NOT NULL
    CHECK (tipo IN ('recebida','auto_resposta','officer_reply','diligencia','interna')),
  -- recebida      : e-mail original recebido do denunciante
  -- auto_resposta : protocolo automático enviado ao denunciante pelo worker
  -- officer_reply : resposta manual do compliance officer ao denunciante
  -- diligencia    : solicitação de documentos/provas a setor interno
  -- interna       : nota interna, não é enviada por e-mail

  para_email      text,             -- destinatário real (para envio); null para notas internas
  para_exibicao   text,             -- como exibir na UI (ex: "Denunciante [anonimizado]")
  assunto         text,
  corpo           text NOT NULL,

  setor_acionado  text,             -- para tipo = 'diligencia'

  enviado_por_nome text,            -- nome do officer (para tipos enviados)
  enviado_por_id   uuid,

  -- Controle de envio (processado pelo worker)
  status_envio    text NOT NULL DEFAULT 'nao_aplicavel'
    CHECK (status_envio IN ('pendente','enviado','falha','nao_aplicavel')),
  enviado_em      timestamptz,
  erro_envio      text,

  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Trigger: numeração sequencial DEN-YYYY-NNN por escritório/ano
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_numero_denuncia()
RETURNS TRIGGER AS $$
DECLARE
  v_ano int;
  v_seq int;
BEGIN
  v_ano := EXTRACT(YEAR FROM COALESCE(NEW.data_protocolo, now()))::int;

  -- Lock por escritório+ano para evitar race condition em inserções simultâneas
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(md5(NEW.escritorio_id::text || v_ano::text), 1, 15))::bit(60)::bigint
  );

  SELECT COUNT(*) + 1 INTO v_seq
  FROM compliance_denuncias
  WHERE escritorio_id = NEW.escritorio_id
    AND EXTRACT(YEAR FROM data_protocolo) = v_ano;

  NEW.numero := 'DEN-' || v_ano::text || '-' || LPAD(v_seq::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_numero_denuncia
  BEFORE INSERT ON compliance_denuncias
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION fn_set_numero_denuncia();

-- ---------------------------------------------------------------------------
-- 4. Trigger: atualiza_em automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_compliance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_compliance_updated_at
  BEFORE UPDATE ON compliance_denuncias
  FOR EACH ROW EXECUTE FUNCTION fn_compliance_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Índices
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_compliance_escritorio
  ON compliance_denuncias(escritorio_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status
  ON compliance_denuncias(status, data_protocolo DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_numero
  ON compliance_denuncias(numero);
CREATE INDEX IF NOT EXISTS idx_compliance_hash
  ON compliance_denuncias(raw_text_hash) WHERE raw_text_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compliance_msgs_denuncia
  ON compliance_mensagens(denuncia_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_compliance_outbox
  ON compliance_mensagens(status_envio, criado_em)
  WHERE status_envio = 'pendente';

-- ---------------------------------------------------------------------------
-- 6. Row Level Security — acesso exclusivo para gerentes do escritório
-- ---------------------------------------------------------------------------
ALTER TABLE compliance_denuncias ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_mensagens ENABLE ROW LEVEL SECURITY;

-- Política para denúncias
DROP POLICY IF EXISTS "compliance_gerente_rls" ON compliance_denuncias;
CREATE POLICY "compliance_gerente_rls" ON compliance_denuncias
  FOR ALL USING (
    escritorio_id IN (
      SELECT ue.escritorio_id
      FROM usuarios_escritorios ue
      WHERE ue.usuario_id = auth.uid()
        AND ue.ativo = true
        AND ue.papel = 'gerente'
    )
  );

-- Política para mensagens
DROP POLICY IF EXISTS "compliance_msgs_gerente_rls" ON compliance_mensagens;
CREATE POLICY "compliance_msgs_gerente_rls" ON compliance_mensagens
  FOR ALL USING (
    escritorio_id IN (
      SELECT ue.escritorio_id
      FROM usuarios_escritorios ue
      WHERE ue.usuario_id = auth.uid()
        AND ue.ativo = true
        AND ue.papel = 'gerente'
    )
  );

-- NOTA IMPORTANTE:
-- O worker usa SERVICE_ROLE_KEY, que bypassa o RLS.
-- Isso é intencional: o worker precisa ler remetente_email para enviar respostas.
-- O frontend NUNCA deve incluir remetente_email nas suas queries SELECT.
