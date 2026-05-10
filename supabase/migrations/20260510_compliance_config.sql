-- =============================================================================
-- CONFIGURAÇÃO DO CANAL DE COMPLIANCE — JurisBPO
-- Gerado em: 2026-05-10
-- Uma linha por escritório (UNIQUE). Gerenciada pelo próprio gerente via UI.
-- =============================================================================

CREATE TABLE IF NOT EXISTS compliance_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id   uuid        UNIQUE NOT NULL REFERENCES escritorios(id) ON DELETE CASCADE,

  -- Ativação
  enabled         boolean     NOT NULL DEFAULT false,

  -- IMAP (caixa de recebimento das denúncias — Exchange ou outro servidor)
  imap_host       text        NOT NULL DEFAULT '',
  imap_port       int         NOT NULL DEFAULT 993,
  imap_secure     boolean     NOT NULL DEFAULT true,
  imap_user       text        NOT NULL DEFAULT '',
  imap_password   text        NOT NULL DEFAULT '',
  -- NOTA DE SEGURANÇA: senha armazenada em plaintext, protegida por RLS.
  -- Apenas o SERVICE_ROLE do worker e o próprio gerente têm acesso.
  -- Para produção crítica considere usar Supabase Vault.

  -- SMTP (envio de auto-respostas e mensagens do officer)
  smtp_host       text        NOT NULL DEFAULT '',
  smtp_port       int         NOT NULL DEFAULT 587,
  smtp_secure     boolean     NOT NULL DEFAULT false,  -- false = STARTTLS 587 / true = SSL 465
  smtp_user       text        NOT NULL DEFAULT '',
  smtp_password   text        NOT NULL DEFAULT '',
  smtp_from_name  text        NOT NULL DEFAULT 'Canal de Compliance',
  smtp_from_email text        NOT NULL DEFAULT '',

  -- Timestamps
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE compliance_config IS
  'Configuração IMAP/SMTP por escritório para o Canal de Compliance. Uma linha por escritório.';
COMMENT ON COLUMN compliance_config.imap_password IS
  'Senha da caixa de compliance. Acesso exclusivo via SERVICE_ROLE (worker) e gerente do escritório.';
COMMENT ON COLUMN compliance_config.smtp_password IS
  'Senha SMTP. Acesso exclusivo via SERVICE_ROLE (worker) e gerente do escritório.';

-- ---------------------------------------------------------------------------
-- Trigger: atualizado_em automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_compliance_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_compliance_config_updated_at
  BEFORE UPDATE ON compliance_config
  FOR EACH ROW EXECUTE FUNCTION fn_compliance_config_updated_at();

-- ---------------------------------------------------------------------------
-- Índice
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_compliance_config_enabled
  ON compliance_config(escritorio_id) WHERE enabled = true;

-- ---------------------------------------------------------------------------
-- Row Level Security — apenas gerentes do escritório
-- ---------------------------------------------------------------------------
ALTER TABLE compliance_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compliance_config_gerente_rls" ON compliance_config;
CREATE POLICY "compliance_config_gerente_rls" ON compliance_config
  FOR ALL USING (
    escritorio_id IN (
      SELECT ue.escritorio_id
      FROM usuarios_escritorios ue
      WHERE ue.usuario_id = auth.uid()
        AND ue.ativo = true
        AND ue.papel = 'gerente'
    )
  );

-- O worker usa SERVICE_ROLE_KEY e bypassa o RLS para ler imap_password e smtp_password.
-- O frontend NUNCA deve exibir os campos de senha — use máscaras ou flags de "configurado".
