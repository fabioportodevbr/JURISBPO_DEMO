-- =============================================================
-- JurisBPO DEMO — Setup Completo
-- Ordem: schema base → migrations → seed de demonstração
-- Execute UMA VEZ no SQL Editor do projeto Supabase DEMO.
-- =============================================================

-- ===================================================================
-- PARTE 1: SCHEMA BASE (tabelas, funções e RLS principais)
-- ===================================================================
-- ============================================================
-- JURISBPO v2 - Schema limpo multi-escritorio com RLS
-- Execute em um projeto Supabase novo ou apos reset controlado.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- LIMPEZA OPCIONAL
-- Em projeto novo, pode executar como esta.
-- Em projeto com dados, FACA BACKUP antes.
-- ============================================================
DROP TABLE IF EXISTS public.mensagens_anexos CASCADE;
DROP TABLE IF EXISTS public.mensagens CASCADE;
DROP TABLE IF EXISTS public.documentos CASCADE;
DROP TABLE IF EXISTS public.financeiro_processos CASCADE;
DROP TABLE IF EXISTS public.compliance_conflito_interesse_analises CASCADE;
DROP TABLE IF EXISTS public.atividade_atribuicoes CASCADE;
DROP TABLE IF EXISTS public.atividades CASCADE;
DROP TABLE IF EXISTS public.contratos CASCADE;
DROP TABLE IF EXISTS public.processos CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.oficios_controle_log CASCADE;
DROP TABLE IF EXISTS public.oficios_controle_ano CASCADE;
DROP TABLE IF EXISTS public.oficios_anexos CASCADE;
DROP TABLE IF EXISTS public.oficios_auditoria CASCADE;
DROP TABLE IF EXISTS public.oficios_destinatarios CASCADE;
DROP TABLE IF EXISTS public.oficios CASCADE;
DROP TABLE IF EXISTS public.oficios_empresas CASCADE;
DROP TABLE IF EXISTS public.partes_crm CASCADE;
DROP TABLE IF EXISTS public.usuarios_escritorios CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.escritorios CASCADE;

-- ============================================================
-- TABELAS PRINCIPAIS
-- ============================================================

CREATE TABLE public.escritorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  slug TEXT UNIQUE,
  plano TEXT NOT NULL DEFAULT 'free',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nome TEXT,
  telefone TEXT,
  cargo TEXT,
  oab TEXT,
  cor TEXT DEFAULT '#c9a227',
  avatar_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.usuarios_escritorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'advogado',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_escritorios_unique UNIQUE (usuario_id, escritorio_id),
  CONSTRAINT usuarios_escritorios_papel_check CHECK (papel IN ('gerente','advogado','assistente','cliente','visitante'))
);

ALTER TABLE public.usuarios_escritorios
DROP CONSTRAINT IF EXISTS usuarios_escritorios_usuario_profile_fkey;

ALTER TABLE public.usuarios_escritorios
ADD CONSTRAINT usuarios_escritorios_usuario_profile_fkey
FOREIGN KEY (usuario_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'pessoa_fisica',
  documento TEXT,
  email TEXT,
  telefone TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clientes_tipo_check CHECK (tipo IN ('pessoa_fisica','pessoa_juridica','outro'))
);

CREATE TABLE public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero TEXT,
  titulo TEXT NOT NULL,
  parte_contraria TEXT,
  partes_contrarias JSONB NOT NULL DEFAULT '[]'::jsonb,
  tribunal TEXT,
  orgao TEXT,
  data_ajuizamento DATE,
  valor_acao NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'ativo',
  fase TEXT NOT NULL DEFAULT 'conhecimento',
  responsavel_id UUID REFERENCES auth.users(id),
  numero_controle TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT processos_status_check CHECK (status IN ('ativo','arquivo_temporario','encerrado')),
  CONSTRAINT processos_fase_check CHECK (fase IN ('conhecimento','recurso','execucao_provisoria','execucao_sentenca','arquivo_definitivo')),
  CONSTRAINT processos_partes_contrarias_array_check CHECK (jsonb_typeof(partes_contrarias) = 'array'),
  CONSTRAINT processos_encerrado_fase_check CHECK (status <> 'encerrado' OR fase = 'arquivo_definitivo')
);

CREATE TABLE public.processo_apensamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  processo_apensado_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT processo_apensamentos_processos_diferentes_check CHECK (processo_id <> processo_apensado_id)
);

CREATE TABLE public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  parte TEXT,
  tipo TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  data_inicio DATE,
  data_fim DATE,
  responsavel_id UUID REFERENCES auth.users(id),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contratos_status_check CHECK (status IN ('ativo','a_vencer','encerrado','arquivo_temporario'))
);

CREATE TABLE public.atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'tarefa',
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'a_fazer',
  prioridade TEXT NOT NULL DEFAULT 'media',
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES auth.users(id),
  criado_por UUID REFERENCES auth.users(id),
  prazo DATE,
  horario TIME,
  local TEXT,
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT atividades_tipo_check CHECK (tipo IN ('tarefa','prazo_processual','audiencia','reuniao')),
  CONSTRAINT atividades_status_check CHECK (status IN ('a_fazer','em_andamento','concluida','cancelada')),
  CONSTRAINT atividades_prioridade_check CHECK (prioridade IN ('baixa','media','alta','urgente')),
  CONSTRAINT atividades_prazo_audiencia_processo_check CHECK (
    tipo NOT IN ('prazo_processual','audiencia') OR processo_id IS NOT NULL
  )
);

CREATE TABLE public.compliance_conflito_interesse_analises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  arquivo_tipo TEXT,
  arquivo_tamanho_bytes BIGINT,
  storage_bucket TEXT NOT NULL DEFAULT 'compliance-anexos',
  storage_path TEXT,
  colaborador_nome TEXT,
  colaborador_documento TEXT,
  colaborador_matricula TEXT,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  nivel_risco TEXT NOT NULL,
  flag TEXT NOT NULL,
  status TEXT NOT NULL,
  recomendacao TEXT,
  metodo_extracao TEXT,
  confianca_extracao NUMERIC(5,4),
  texto_extraido TEXT,
  atividade_id UUID REFERENCES public.atividades(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id),
  criado_por_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT compliance_conflitos_nivel_check CHECK (nivel_risco IN ('BAIXO','MEDIO','ALTO')),
  CONSTRAINT compliance_conflitos_flag_check CHECK (flag IN ('VERDE','AMARELA','VERMELHA')),
  CONSTRAINT compliance_conflitos_status_check CHECK (status IN ('analisado_sem_conflito','pendente_revisao','alerta_critico'))
);

CREATE TABLE public.atividade_atribuicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade_id UUID NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
  usuario_anterior_id UUID REFERENCES auth.users(id),
  usuario_novo_id UUID REFERENCES auth.users(id),
  atribuido_por UUID REFERENCES auth.users(id),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  atividade_id UUID REFERENCES public.atividades(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'documentos',
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documentos_vinculo_check CHECK (
    processo_id IS NOT NULL OR contrato_id IS NOT NULL OR atividade_id IS NOT NULL
  )
);

-- Futuro: biblioteca de modelos/minutas sem vinculo obrigatorio
CREATE TABLE public.modelos_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id UUID NOT NULL REFERENCES public.escritorios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  categoria TEXT,
  descricao TEXT,
  storage_bucket TEXT DEFAULT 'modelos',
  storage_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FUNCOES AUXILIARES
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.usuario_tem_escritorio(p_escritorio_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_escritorios ue
    WHERE ue.escritorio_id = p_escritorio_id
      AND ue.usuario_id = auth.uid()
      AND ue.ativo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.usuario_eh_gerente(p_escritorio_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_escritorios ue
    WHERE ue.escritorio_id = p_escritorio_id
      AND ue.usuario_id = auth.uid()
      AND ue.ativo = true
      AND ue.papel = 'gerente'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.usuario_pode_escrever(p_escritorio_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_escritorios ue
    WHERE ue.escritorio_id = p_escritorio_id
      AND ue.usuario_id = auth.uid()
      AND ue.ativo = true
      AND ue.papel <> 'visitante'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.usuario_pode_editar_proprio_profile()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_escritorios ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.ativo = true
      AND ue.papel <> 'visitante'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.usuario_tem_escritorio_storage(p_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.usuario_tem_escritorio(split_part(p_name, '/', 1)::uuid)
    ELSE false
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.usuario_pode_escrever_storage(p_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN public.usuario_pode_escrever(split_part(p_name, '/', 1)::uuid)
    ELSE false
  END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

CREATE TRIGGER trg_escritorios_updated_at BEFORE UPDATE ON public.escritorios
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_usuarios_escritorios_updated_at BEFORE UPDATE ON public.usuarios_escritorios
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_processos_updated_at BEFORE UPDATE ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_contratos_updated_at BEFORE UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_atividades_updated_at BEFORE UPDATE ON public.atividades
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_documentos_updated_at BEFORE UPDATE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_modelos_documentos_updated_at BEFORE UPDATE ON public.modelos_documentos
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX idx_usuarios_escritorios_usuario ON public.usuarios_escritorios(usuario_id);
CREATE INDEX idx_usuarios_escritorios_escritorio ON public.usuarios_escritorios(escritorio_id);
CREATE INDEX idx_clientes_escritorio ON public.clientes(escritorio_id);
CREATE INDEX idx_processos_escritorio ON public.processos(escritorio_id);
CREATE INDEX idx_processos_status ON public.processos(status);
CREATE INDEX idx_processos_busca ON public.processos(numero, titulo, tribunal, orgao);
CREATE INDEX idx_processos_partes_contrarias ON public.processos USING gin (partes_contrarias);
CREATE INDEX idx_processo_apensamentos_escritorio ON public.processo_apensamentos(escritorio_id);
CREATE INDEX idx_processo_apensamentos_processo ON public.processo_apensamentos(processo_id);
CREATE INDEX idx_processo_apensamentos_apensado ON public.processo_apensamentos(processo_apensado_id);
CREATE UNIQUE INDEX idx_processo_apensamentos_unico ON public.processo_apensamentos(
  escritorio_id,
  least(processo_id, processo_apensado_id),
  greatest(processo_id, processo_apensado_id)
);
CREATE INDEX idx_contratos_escritorio ON public.contratos(escritorio_id);
CREATE INDEX idx_atividades_escritorio ON public.atividades(escritorio_id);
CREATE INDEX idx_atividades_tipo ON public.atividades(tipo);
CREATE INDEX idx_atividades_prazo ON public.atividades(prazo);
CREATE INDEX idx_atividades_processo ON public.atividades(processo_id);
CREATE INDEX idx_atividades_contrato ON public.atividades(contrato_id);
CREATE INDEX idx_compliance_conflitos_escritorio ON public.compliance_conflito_interesse_analises(escritorio_id, criado_em DESC);
CREATE INDEX idx_compliance_conflitos_risco ON public.compliance_conflito_interesse_analises(escritorio_id, nivel_risco, status);
CREATE INDEX idx_documentos_escritorio ON public.documentos(escritorio_id);
CREATE INDEX idx_documentos_processo ON public.documentos(processo_id);
CREATE INDEX idx_documentos_contrato ON public.documentos(contrato_id);
CREATE INDEX idx_modelos_documentos_escritorio ON public.modelos_documentos(escritorio_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_apensamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_conflito_interesse_analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_documentos ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid() AND public.usuario_pode_editar_proprio_profile()) WITH CHECK (id = auth.uid() AND public.usuario_pode_editar_proprio_profile());
CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- escritorios
CREATE POLICY escritorios_select_member ON public.escritorios
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(id));
CREATE POLICY escritorios_update_manager ON public.escritorios
FOR UPDATE TO authenticated USING (public.usuario_eh_gerente(id)) WITH CHECK (public.usuario_eh_gerente(id));

-- usuarios_escritorios
CREATE POLICY usuarios_escritorios_select_member ON public.usuarios_escritorios
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY usuarios_escritorios_insert_manager ON public.usuarios_escritorios
FOR INSERT TO authenticated WITH CHECK (public.usuario_eh_gerente(escritorio_id));
CREATE POLICY usuarios_escritorios_update_manager ON public.usuarios_escritorios
FOR UPDATE TO authenticated USING (public.usuario_eh_gerente(escritorio_id)) WITH CHECK (public.usuario_eh_gerente(escritorio_id));
CREATE POLICY usuarios_escritorios_delete_manager ON public.usuarios_escritorios
FOR DELETE TO authenticated USING (public.usuario_eh_gerente(escritorio_id));

-- entidades por escritorio
CREATE POLICY clientes_select_member ON public.clientes
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY clientes_write_non_visitor ON public.clientes
FOR ALL TO authenticated USING (public.usuario_pode_escrever(escritorio_id)) WITH CHECK (public.usuario_pode_escrever(escritorio_id));

CREATE POLICY processos_select_member ON public.processos
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY processos_write_non_visitor ON public.processos
FOR ALL TO authenticated USING (public.usuario_pode_escrever(escritorio_id)) WITH CHECK (public.usuario_pode_escrever(escritorio_id));

CREATE POLICY processo_apensamentos_select_member ON public.processo_apensamentos
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY processo_apensamentos_write_non_visitor ON public.processo_apensamentos
FOR ALL TO authenticated USING (public.usuario_pode_escrever(escritorio_id)) WITH CHECK (public.usuario_pode_escrever(escritorio_id));

CREATE POLICY contratos_select_member ON public.contratos
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY contratos_write_non_visitor ON public.contratos
FOR ALL TO authenticated USING (public.usuario_pode_escrever(escritorio_id)) WITH CHECK (public.usuario_pode_escrever(escritorio_id));

CREATE POLICY atividades_select_member ON public.atividades
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY atividades_write_non_visitor ON public.atividades
FOR ALL TO authenticated USING (public.usuario_pode_escrever(escritorio_id)) WITH CHECK (public.usuario_pode_escrever(escritorio_id));

CREATE POLICY compliance_conflitos_gerente_rls ON public.compliance_conflito_interesse_analises
FOR ALL TO authenticated USING (public.usuario_eh_gerente(escritorio_id)) WITH CHECK (public.usuario_eh_gerente(escritorio_id));

CREATE POLICY documentos_select_member ON public.documentos
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY documentos_write_non_visitor ON public.documentos
FOR ALL TO authenticated USING (public.usuario_pode_escrever(escritorio_id)) WITH CHECK (public.usuario_pode_escrever(escritorio_id));

CREATE POLICY modelos_documentos_select_member ON public.modelos_documentos
FOR SELECT TO authenticated USING (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY modelos_documentos_write_non_visitor ON public.modelos_documentos
FOR ALL TO authenticated USING (public.usuario_pode_escrever(escritorio_id)) WITH CHECK (public.usuario_pode_escrever(escritorio_id));

-- historico de atribuicoes: acessa se pertence ao escritorio da atividade
CREATE POLICY atividade_atribuicoes_select_member ON public.atividade_atribuicoes
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.atividades a
    WHERE a.id = atividade_id AND public.usuario_tem_escritorio(a.escritorio_id)
  )
);
CREATE POLICY atividade_atribuicoes_insert_member ON public.atividade_atribuicoes
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.atividades a
    WHERE a.id = atividade_id AND public.usuario_pode_escrever(a.escritorio_id)
  )
);

-- ============================================================
-- DATA API GRANTS
-- Supabase 2026: public schema objects are not automatically
-- exposed to the Data API in new projects. Keep grants explicit.
-- RLS policies above still control row-level access.
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

DO $$
DECLARE
  obj_name TEXT;
  proc_sig TEXT;
  api_tables TEXT[] := ARRAY[
    'acervo_modelos',
    'andamentos_processuais_push',
    'andamentos_processuais_push_arquivo',
    'atividade_atribuicoes',
    'atividade_historico',
    'atividades',
    'chat_mensagens',
    'chat_salas',
    'clientes',
    'compliance_anexos',
    'compliance_config',
    'compliance_conflito_interesse_analises',
    'compliance_denuncias',
    'compliance_mensagens',
    'contratos',
    'documentos',
    'escritorios',
    'financeiro_lancamentos',
    'financeiro_processos',
    'google_calendar_config',
    'mensagens',
    'mensagens_anexos',
    'modelos_documentos',
    'mural_recados',
    'notificacoes',
    'oficios',
    'oficios_anexos',
    'oficios_auditoria',
    'oficios_controle_ano',
    'oficios_controle_log',
    'oficios_destinatarios',
    'oficios_empresas',
    'partes_crm',
    'processo_apensamentos',
    'processos',
    'profiles',
    'push_email_config',
    'rotinas',
    'tarefas',
    'usuarios_escritorios'
  ];
  api_views TEXT[] := ARRAY[
    'financeiro_resumo_escritorio'
  ];
  api_routines TEXT[] := ARRAY[
    'marcar_chat_lido',
    'usuario_eh_gerente',
    'usuario_pode_editar_proprio_profile',
    'usuario_pode_escrever',
    'usuario_pode_escrever_storage',
    'usuario_tem_escritorio',
    'usuario_tem_escritorio_storage'
  ];
BEGIN
  FOREACH obj_name IN ARRAY api_tables LOOP
    IF to_regclass(format('public.%I', obj_name)) IS NOT NULL THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated, service_role',
        obj_name
      );
    END IF;
  END LOOP;

  FOREACH obj_name IN ARRAY api_views LOOP
    IF to_regclass(format('public.%I', obj_name)) IS NOT NULL THEN
      EXECUTE format(
        'GRANT SELECT ON TABLE public.%I TO authenticated, service_role',
        obj_name
      );
    END IF;
  END LOOP;

  FOR proc_sig IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(api_routines)
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
      proc_sig
    );
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ============================================================
-- STORAGE
-- Cria buckets se a tabela storage.buckets estiver acessivel.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('modelos', 'modelos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets AS b (id, name, public, file_size_limit)
VALUES ('compliance-anexos', 'compliance-anexos', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = greatest(coalesce(b.file_size_limit, 0), excluded.file_size_limit);

DROP POLICY IF EXISTS documentos_storage_select ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_update ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_delete ON storage.objects;
DROP POLICY IF EXISTS compliance_anexos_storage_select ON storage.objects;
DROP POLICY IF EXISTS compliance_anexos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS compliance_anexos_storage_update ON storage.objects;
DROP POLICY IF EXISTS compliance_anexos_storage_delete ON storage.objects;

CREATE POLICY documentos_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id IN ('documentos','modelos') AND public.usuario_tem_escritorio_storage(name));

CREATE POLICY documentos_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('documentos','modelos') AND public.usuario_pode_escrever_storage(name));

CREATE POLICY documentos_storage_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id IN ('documentos','modelos') AND public.usuario_pode_escrever_storage(name))
WITH CHECK (bucket_id IN ('documentos','modelos') AND public.usuario_pode_escrever_storage(name));

CREATE POLICY documentos_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id IN ('documentos','modelos') AND public.usuario_pode_escrever_storage(name));

CREATE POLICY compliance_anexos_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'compliance-anexos' AND public.usuario_tem_escritorio_storage(name));

CREATE POLICY compliance_anexos_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'compliance-anexos' AND public.usuario_pode_escrever_storage(name));

CREATE POLICY compliance_anexos_storage_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'compliance-anexos' AND public.usuario_pode_escrever_storage(name))
WITH CHECK (bucket_id = 'compliance-anexos' AND public.usuario_pode_escrever_storage(name));

CREATE POLICY compliance_anexos_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'compliance-anexos' AND public.usuario_pode_escrever_storage(name));

-- ============================================================
-- BOOTSTRAP: criar escritorio/profile/vinculo para usuario atual
-- Rode este bloco depois de criar o usuario no Auth.
-- Substitua o email se necessario.
-- ============================================================
-- INSERT INTO public.escritorios (nome, slug, plano)
-- VALUES ('Empresa Principal', 'empresa-principal', 'free')
-- ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
-- RETURNING id;
--
-- INSERT INTO public.profiles (id, email, nome, ativo)
-- SELECT id, email, 'Fábio Porto', true
-- FROM auth.users
-- WHERE email = 'fabioporto@gmail.com'
-- ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, nome = EXCLUDED.nome, ativo = true;
--
-- INSERT INTO public.usuarios_escritorios (usuario_id, escritorio_id, papel, ativo)
-- SELECT u.id, e.id, 'gerente', true
-- FROM auth.users u
-- CROSS JOIN public.escritorios e
-- WHERE u.email = 'fabioporto@gmail.com'
--   AND e.slug = 'meu-escritorio'
-- ON CONFLICT (usuario_id, escritorio_id)
-- DO UPDATE SET papel = 'gerente', ativo = true;

NOTIFY pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 001_financeiro_lancamentos.sql
-- ===================================================================
-- JurisBPO - Seção Financeiro
-- Migration: financeiro_lancamentos com RLS por escritorio_id

create table if not exists public.financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null,
  cliente_id uuid null,
  processo_id uuid null,
  contrato_id uuid null,
  criado_por uuid null references auth.users(id) on delete set null,

  tipo text not null check (
    tipo in ('receita', 'despesa', 'honorario', 'acordo', 'custas', 'reembolso', 'outro')
  ),

  categoria text,
  descricao text not null,

  valor_bruto numeric(14,2) not null default 0,
  valor_liquido numeric(14,2),

  data_vencimento date,
  data_pagamento date,

  forma_pagamento text check (
    forma_pagamento is null or forma_pagamento in ('pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'outro')
  ),

  status text not null default 'pendente' check (
    status in ('pendente', 'pago', 'atrasado', 'cancelado', 'parcial')
  ),

  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financeiro_lancamentos_escritorio_id
  on public.financeiro_lancamentos (escritorio_id);

create index if not exists idx_financeiro_lancamentos_cliente_id
  on public.financeiro_lancamentos (cliente_id);

create index if not exists idx_financeiro_lancamentos_processo_id
  on public.financeiro_lancamentos (processo_id);

create index if not exists idx_financeiro_lancamentos_status
  on public.financeiro_lancamentos (status);

create index if not exists idx_financeiro_lancamentos_tipo
  on public.financeiro_lancamentos (tipo);

create index if not exists idx_financeiro_lancamentos_vencimento
  on public.financeiro_lancamentos (data_vencimento);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_financeiro_lancamentos_updated_at on public.financeiro_lancamentos;
create trigger trg_financeiro_lancamentos_updated_at
before update on public.financeiro_lancamentos
for each row execute function public.set_updated_at();

alter table public.financeiro_lancamentos enable row level security;

-- Remove policies antigas com os mesmos nomes, caso a migration seja reaplicada.
drop policy if exists financeiro_select_mesmo_escritorio on public.financeiro_lancamentos;
drop policy if exists financeiro_insert_mesmo_escritorio on public.financeiro_lancamentos;
drop policy if exists financeiro_update_mesmo_escritorio on public.financeiro_lancamentos;
drop policy if exists financeiro_delete_mesmo_escritorio on public.financeiro_lancamentos;

-- ATENCAO:
-- As policies abaixo assumem que public.profiles possui:
--   id = auth.users.id
--   escritorio_id = uuid do escritorio do usuario
-- Se no seu schema o campo do usuario tiver outro nome, ajuste p.id = auth.uid().

create policy financeiro_select_mesmo_escritorio
on public.financeiro_lancamentos
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

create policy financeiro_insert_mesmo_escritorio
on public.financeiro_lancamentos
for insert
to authenticated
with check (public.usuario_pode_escrever(escritorio_id));

create policy financeiro_update_mesmo_escritorio
on public.financeiro_lancamentos
for update
to authenticated
using  (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

create policy financeiro_delete_mesmo_escritorio
on public.financeiro_lancamentos
for delete
to authenticated
using (public.usuario_pode_escrever(escritorio_id));

-- View opcional para resumos por escritorio.
create or replace view public.financeiro_resumo_escritorio as
select
  escritorio_id,
  coalesce(sum(case when tipo in ('receita', 'honorario', 'acordo', 'reembolso') and status in ('pendente', 'parcial', 'atrasado') then valor_bruto else 0 end), 0) as receita_prevista,
  coalesce(sum(case when tipo in ('receita', 'honorario', 'acordo', 'reembolso') and status = 'pago' then coalesce(valor_liquido, valor_bruto) else 0 end), 0) as receita_recebida,
  coalesce(sum(case when status in ('pendente', 'parcial', 'atrasado') then valor_bruto else 0 end), 0) as valores_pendentes,
  coalesce(sum(case when tipo in ('despesa', 'custas') then valor_bruto else 0 end), 0) as despesas,
  coalesce(sum(case when tipo = 'acordo' and status in ('pendente', 'parcial', 'atrasado') then valor_bruto else 0 end), 0) as acordos_em_aberto,
  coalesce(sum(case when tipo in ('receita', 'honorario', 'acordo', 'reembolso') and status = 'pago' then coalesce(valor_liquido, valor_bruto) else 0 end), 0)
  - coalesce(sum(case when tipo in ('despesa', 'custas') and status = 'pago' then coalesce(valor_liquido, valor_bruto) else 0 end), 0) as saldo_periodo
from public.financeiro_lancamentos
group by escritorio_id;


-- ===================================================================
-- MIGRATION: 20260505_acompanhamento_push_email.sql
-- ===================================================================
-- JurisBPO - Acompanhamento processual via push por e-mail
-- Seguro para aplicar sobre banco existente: cria apenas a tabela nova, indices e policies do módulo.

create table if not exists public.andamentos_processuais_push (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid null references public.escritorios(id) on delete cascade,
  cliente_id uuid null references public.clientes(id) on delete set null,
  processo_id uuid null references public.processos(id) on delete cascade,
  numero_processo text null,
  tribunal text null,
  movimento text not null,
  data_movimento date null,
  fonte text not null default 'email',
  remetente text null,
  assunto_email text null,
  corpo_resumo text null,
  url_origem text null,
  raw_text_hash text not null unique,
  status_associacao text not null default 'pendente' check (status_associacao in ('associado','pendente')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_andamentos_push_processo_id on public.andamentos_processuais_push(processo_id);
create index if not exists idx_andamentos_push_numero on public.andamentos_processuais_push(numero_processo);
create index if not exists idx_andamentos_push_escritorio on public.andamentos_processuais_push(escritorio_id);
create index if not exists idx_andamentos_push_data on public.andamentos_processuais_push(data_movimento desc, criado_em desc);

create or replace function public.touch_andamentos_push_updated_at()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_andamentos_push_updated_at on public.andamentos_processuais_push;
create trigger trg_andamentos_push_updated_at
before update on public.andamentos_processuais_push
for each row execute function public.touch_andamentos_push_updated_at();

alter table public.andamentos_processuais_push enable row level security;

drop policy if exists andamentos_push_select_member on public.andamentos_processuais_push;
create policy andamentos_push_select_member
on public.andamentos_processuais_push
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists andamentos_push_update_member on public.andamentos_processuais_push;
create policy andamentos_push_update_member
on public.andamentos_processuais_push
for update
to authenticated
using (public.usuario_tem_escritorio(escritorio_id))
with check (public.usuario_tem_escritorio(escritorio_id));

-- Inserts do monitor de e-mail devem ser feitos pelo worker com SUPABASE_SERVICE_ROLE_KEY.
-- Não há policy de insert pública para evitar que usuários criem andamentos falsos no frontend.


-- ===================================================================
-- MIGRATION: 20260505_push_corpo_email.sql
-- ===================================================================
-- JurisBPO - Patch do módulo PUSH processual
-- Adiciona armazenamento do corpo completo do e-mail recebido.
-- Seguro para rodar mais de uma vez.

alter table public.andamentos_processuais_push
add column if not exists corpo_email text;

comment on column public.andamentos_processuais_push.corpo_email is
'Corpo completo do e-mail processual recebido pelo worker IMAP/Gmail. Usado para exibição expandida no JurisBPO.';


-- ===================================================================
-- MIGRATION: 20260505_push_status_ignorado.sql
-- ===================================================================
-- JurisBPO - Refinamento do módulo de acompanhamento processual via push
-- Permite desconsiderar andamentos sem apagar o histórico.

alter table public.andamentos_processuais_push
  drop constraint if exists andamentos_processuais_push_status_associacao_check;

alter table public.andamentos_processuais_push
  add constraint andamentos_processuais_push_status_associacao_check
  check (status_associacao in ('associado', 'pendente', 'ignorado'));

alter table public.andamentos_processuais_push
  add column if not exists ignorado_em timestamptz;

alter table public.andamentos_processuais_push
  add column if not exists motivo_ignorado text;

create index if not exists idx_andamentos_push_status
  on public.andamentos_processuais_push(status_associacao, criado_em desc);


-- ===================================================================
-- MIGRATION: 20260506_visitante_somente_leitura.sql
-- ===================================================================
-- Perfil visitante: acesso de leitura com bloqueio de escrita no banco.

alter table public.usuarios_escritorios
drop constraint if exists usuarios_escritorios_papel_check;

alter table public.usuarios_escritorios
add constraint usuarios_escritorios_papel_check
check (papel in ('gerente','advogado','assistente','cliente','visitante'));

create or replace function public.usuario_pode_escrever(p_escritorio_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.escritorio_id = p_escritorio_id
      and ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel <> 'visitante'
  );
$$ language sql security definer stable;

create or replace function public.usuario_pode_editar_proprio_profile()
returns boolean as $$
  select exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel <> 'visitante'
  );
$$ language sql security definer stable;

create or replace function public.usuario_tem_escritorio_storage(p_name text)
returns boolean as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.usuario_tem_escritorio(split_part(p_name, '/', 1)::uuid)
    else false
  end;
$$ language sql security definer stable;

create or replace function public.usuario_pode_escrever_storage(p_name text)
returns boolean as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.usuario_pode_escrever(split_part(p_name, '/', 1)::uuid)
    else false
  end;
$$ language sql security definer stable;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid() and public.usuario_pode_editar_proprio_profile())
with check (id = auth.uid() and public.usuario_pode_editar_proprio_profile());

drop policy if exists clientes_all_member on public.clientes;
drop policy if exists clientes_select_member on public.clientes;
drop policy if exists clientes_write_non_visitor on public.clientes;
create policy clientes_select_member on public.clientes
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy clientes_write_non_visitor on public.clientes
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists processos_all_member on public.processos;
drop policy if exists processos_select_member on public.processos;
drop policy if exists processos_write_non_visitor on public.processos;
create policy processos_select_member on public.processos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy processos_write_non_visitor on public.processos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists contratos_all_member on public.contratos;
drop policy if exists contratos_select_member on public.contratos;
drop policy if exists contratos_write_non_visitor on public.contratos;
create policy contratos_select_member on public.contratos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy contratos_write_non_visitor on public.contratos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists atividades_all_member on public.atividades;
drop policy if exists atividades_select_member on public.atividades;
drop policy if exists atividades_write_non_visitor on public.atividades;
create policy atividades_select_member on public.atividades
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy atividades_write_non_visitor on public.atividades
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists documentos_all_member on public.documentos;
drop policy if exists documentos_select_member on public.documentos;
drop policy if exists documentos_write_non_visitor on public.documentos;
create policy documentos_select_member on public.documentos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy documentos_write_non_visitor on public.documentos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists modelos_documentos_all_member on public.modelos_documentos;
drop policy if exists modelos_documentos_select_member on public.modelos_documentos;
drop policy if exists modelos_documentos_write_non_visitor on public.modelos_documentos;
create policy modelos_documentos_select_member on public.modelos_documentos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy modelos_documentos_write_non_visitor on public.modelos_documentos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists atividade_atribuicoes_insert_member on public.atividade_atribuicoes;
create policy atividade_atribuicoes_insert_member on public.atividade_atribuicoes
for insert to authenticated
with check (
  exists (
    select 1 from public.atividades a
    where a.id = atividade_id and public.usuario_pode_escrever(a.escritorio_id)
  )
);

create or replace function public.bloquear_visitante_escrita()
returns trigger as $$
declare
  v_escritorio_id uuid;
begin
  if current_setting('role', true) = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_escritorio_id := old.escritorio_id;
  else
    v_escritorio_id := new.escritorio_id;
  end if;

  if v_escritorio_id is null or not public.usuario_pode_escrever(v_escritorio_id) then
    raise exception 'Visitante possui acesso somente leitura.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$ language plpgsql security definer;

do $$
declare
  t text;
  tables text[] := array[
    'clientes',
    'processos',
    'contratos',
    'atividades',
    'documentos',
    'modelos_documentos',
    'partes_crm',
    'financeiro_processos',
    'financeiro_lancamentos',
    'acervo_modelos',
    'andamentos_processuais_push',
    'notificacoes',
    'mensagens',
    'mensagens_anexos'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'escritorio_id'
    ) then
      execute format('drop trigger if exists trg_bloquear_visitante_escrita on public.%I', t);
      execute format(
        'create trigger trg_bloquear_visitante_escrita before insert or update or delete on public.%I for each row execute function public.bloquear_visitante_escrita()',
        t
      );
    end if;
  end loop;
end $$;

drop policy if exists documentos_storage_select on storage.objects;
drop policy if exists documentos_storage_insert on storage.objects;
drop policy if exists documentos_storage_update on storage.objects;
drop policy if exists documentos_storage_delete on storage.objects;

create policy documentos_storage_select on storage.objects
for select to authenticated
using (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_tem_escritorio_storage(name));

create policy documentos_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name));

create policy documentos_storage_update on storage.objects
for update to authenticated
using (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name))
with check (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name));

create policy documentos_storage_delete on storage.objects
for delete to authenticated
using (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name));

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260507_acervo_modelos_anexos.sql
-- ===================================================================
-- JurisBPO - Anexos na aba Modelos do Acervo

alter table if exists public.modelos
  add column if not exists arquivo_url text,
  add column if not exists storage_bucket text default 'modelos',
  add column if not exists storage_path text,
  add column if not exists escritorio_id uuid,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz default now();

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260507_atividades_arquivo_historico.sql
-- ===================================================================
-- JurisBPO - Historico de arquivamento/conclusao de atividades

alter table public.atividade_atribuicoes
  add column if not exists tipo_evento text not null default 'atribuicao',
  add column if not exists motivo text;

comment on column public.atividade_atribuicoes.tipo_evento is
  'Tipo do evento registrado no historico da atividade: atribuicao, redistribuicao, aceite, devolucao, arquivamento, conclusao_arquivamento ou reabertura.';

comment on column public.atividade_atribuicoes.motivo is
  'Motivo ou detalhe complementar do evento registrado.';

notify pgrst, 'reload schema';


-- ===================================================================
-- TABELA: financeiro_processos
-- (criada originalmente via interface Supabase; recriada aqui para demo)
-- ===================================================================
create table if not exists public.financeiro_processos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  processo_id uuid references public.processos(id) on delete set null,
  criado_por uuid references auth.users(id) on delete set null,

  natureza text,
  status_pagamento text default 'pendente',

  valor_bruto numeric(14,2) not null default 0,
  deposito_ro numeric(14,2) not null default 0,
  deposito_rr numeric(14,2) not null default 0,
  deposito_embargos numeric(14,2) not null default 0,
  agravo_instrumento numeric(14,2) not null default 0,
  custas numeric(14,2) not null default 0,
  fgts numeric(14,2) not null default 0,
  honorarios_sucumbenciais numeric(14,2) not null default 0,
  honorarios_periciais numeric(14,2) not null default 0,
  honorarios_e_custos numeric(14,2) not null default 0,
  inss_reclamante numeric(14,2) not null default 0,
  inss_reclamada numeric(14,2) not null default 0,
  multa_inadimplemento numeric(14,2) not null default 0,

  seguro_garantia boolean not null default false,
  apolice_numero text,
  apolice_inicio date,
  apolice_fim date,
  valor_assegurado numeric(14,2) not null default 0,
  seguro_premio numeric(14,2) not null default 0,

  forma_pagamento text,
  numero_parcelas integer not null default 1,
  primeiro_vencimento date,
  data_referencia date,

  valor_restituido numeric(14,2) not null default 0,
  valor_restituido_origens text[] not null default '{}',

  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financeiro_processos_escritorio_id
  on public.financeiro_processos (escritorio_id);

create index if not exists idx_financeiro_processos_processo_id
  on public.financeiro_processos (processo_id);

alter table public.financeiro_processos enable row level security;

drop policy if exists financeiro_processos_select on public.financeiro_processos;
drop policy if exists financeiro_processos_write on public.financeiro_processos;

create policy financeiro_processos_select
on public.financeiro_processos
for select to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

create policy financeiro_processos_write
on public.financeiro_processos
for all to authenticated
using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop trigger if exists trg_financeiro_processos_updated_at on public.financeiro_processos;
create trigger trg_financeiro_processos_updated_at
before update on public.financeiro_processos
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260507_financeiro_origens_restituicao.sql
-- ===================================================================
-- JurisBPO - Origem dos valores restituidos no financeiro processual

alter table public.financeiro_processos
  add column if not exists valor_restituido_origens text[] not null default '{}';

comment on column public.financeiro_processos.valor_restituido_origens is
  'Origens informadas para o valor restituido/devolvido: deposito_ro, deposito_rr, deposito_embargos ou apolice_seguro_garantia.';

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260507_financeiro_valor_restituido.sql
-- ===================================================================
-- JurisBPO - Valores restituidos no financeiro processual
-- Valores como depositos recursais devolvidos devem abater o valor efetivamente gasto.

alter table public.financeiro_processos
  add column if not exists valor_restituido numeric(14,2) not null default 0;

comment on column public.financeiro_processos.valor_restituido is
  'Valor restituido/devolvido no processo, usado para abater o valor efetivamente gasto.';

notify pgrst, 'reload schema';


-- ===================================================================
-- TABELAS: partes_crm, oficios_empresas, oficios e relacionadas
-- (criadas originalmente via interface Supabase; recriadas aqui para demo)
-- ===================================================================

create table if not exists public.partes_crm (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  nome text not null,
  nome_fantasia text,
  cnpj text,
  tipo text not null default 'parte_contraria',
  status text not null default 'ativo',
  grupo_economico text,
  email text,
  telefone text,
  contato_principal text,
  endereco text,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partes_crm_tipo_check check (tipo in ('empresa_grupo','cliente','fornecedor','parte_contraria','terceiro','escritorio_advocacia')),
  constraint partes_crm_status_check check (status in ('ativo','inativo'))
);

create index if not exists idx_partes_crm_escritorio_id on public.partes_crm (escritorio_id);
create index if not exists idx_partes_crm_tipo on public.partes_crm (tipo);

alter table public.partes_crm enable row level security;

drop policy if exists partes_crm_select on public.partes_crm;
drop policy if exists partes_crm_write on public.partes_crm;

create policy partes_crm_select on public.partes_crm
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));

create policy partes_crm_write on public.partes_crm
for all to authenticated
using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

-- Tabela legada de empresas para módulo de ofícios
create table if not exists public.oficios_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.oficios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.oficios_empresas(id) on delete set null,
  parte_grupo_id uuid references public.partes_crm(id) on delete set null,
  escritorio_id uuid references public.escritorios(id) on delete cascade,
  numero text,
  departamento text,
  responsavel text,
  data date,
  destinatario text,
  referencia text,
  remetente text,
  forma_envio text,
  arquivado text,
  observacoes text,
  ano int,
  controle_arquivado boolean not null default false,
  updated_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_nome text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_nome text,
  created_at timestamptz not null default now()
);

create index if not exists idx_oficios_escritorio_id on public.oficios (escritorio_id);
create index if not exists idx_oficios_parte_grupo_id on public.oficios (parte_grupo_id);

create table if not exists public.oficios_destinatarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.oficios_empresas(id) on delete set null,
  parte_grupo_id uuid references public.partes_crm(id) on delete set null,
  escritorio_id uuid references public.escritorios(id) on delete cascade,
  nome text,
  created_at timestamptz not null default now()
);

create table if not exists public.oficios_auditoria (
  id uuid primary key default gen_random_uuid(),
  oficio_id uuid references public.oficios(id) on delete set null,
  empresa_id uuid references public.oficios_empresas(id) on delete set null,
  parte_grupo_id uuid references public.partes_crm(id) on delete set null,
  escritorio_id uuid references public.escritorios(id) on delete cascade,
  numero_oficio text,
  acao text,
  usuario_id uuid,
  usuario_nome text,
  dados_json jsonb,
  timestamp timestamptz not null default now()
);

create index if not exists idx_oficios_auditoria_escritorio on public.oficios_auditoria (escritorio_id);

create table if not exists public.oficios_anexos (
  id uuid primary key default gen_random_uuid(),
  oficio_id uuid not null references public.oficios(id) on delete cascade,
  nome_arquivo text,
  arquivo_base64 text,
  arquivo_tipo text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_nome text,
  created_at timestamptz not null default now()
);

create index if not exists idx_oficios_anexos_oficio_id on public.oficios_anexos (oficio_id);

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260510_acervo_oficios_crm_arquivo.sql
-- ===================================================================
-- Acervo: ofícios vinculados a empresas do grupo (partes_crm), ano vigente e arquivamento anual.

alter table public.oficios add column if not exists parte_grupo_id uuid references public.partes_crm(id) on delete cascade;
alter table public.oficios add column if not exists escritorio_id uuid references public.escritorios(id) on delete cascade;
alter table public.oficios add column if not exists controle_arquivado boolean not null default false;

-- Permite gravar só parte_grupo_id (CRM); empresa_id legado (oficios_empresas) fica opcional.
alter table public.oficios alter column empresa_id drop not null;

create index if not exists idx_oficios_parte_esc_ano_arq on public.oficios (parte_grupo_id, escritorio_id, ano, controle_arquivado);

alter table public.oficios_destinatarios add column if not exists parte_grupo_id uuid references public.partes_crm(id) on delete cascade;
alter table public.oficios_destinatarios add column if not exists escritorio_id uuid references public.escritorios(id) on delete cascade;

create index if not exists idx_oficios_dest_parte_esc on public.oficios_destinatarios (parte_grupo_id, escritorio_id);

alter table public.oficios_auditoria add column if not exists parte_grupo_id uuid references public.partes_crm(id) on delete set null;
alter table public.oficios_auditoria add column if not exists escritorio_id uuid references public.escritorios(id) on delete cascade;

create table if not exists public.oficios_controle_ano (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  parte_grupo_id uuid not null references public.partes_crm(id) on delete cascade,
  ano_vigente int not null,
  updated_at timestamptz not null default now(),
  unique (escritorio_id, parte_grupo_id)
);

create index if not exists idx_oficios_controle_ano_esc on public.oficios_controle_ano (escritorio_id);

alter table public.oficios_controle_ano enable row level security;

drop policy if exists oficios_controle_ano_select on public.oficios_controle_ano;
create policy oficios_controle_ano_select on public.oficios_controle_ano
for select to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists oficios_controle_ano_write on public.oficios_controle_ano;
create policy oficios_controle_ano_write on public.oficios_controle_ano
for all to authenticated
using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

-- Gatilho visitante só em oficios_controle_ano (sempre tem escritorio_id).
-- Tabelas oficios / oficios_destinatarios podem ter linhas legadas sem escritorio_id.

do $$
begin
  if to_regclass('public.oficios_controle_ano') is not null then
    drop trigger if exists trg_bloquear_visitante_escrita on public.oficios_controle_ano;
    create trigger trg_bloquear_visitante_escrita
      before insert or update or delete on public.oficios_controle_ano
      for each row execute function public.bloquear_visitante_escrita();
  end if;
end $$;


-- ===================================================================
-- MIGRATION: 20260510_compliance_config.sql
-- ===================================================================
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


-- ===================================================================
-- MIGRATION: 20260510_compliance_module.sql
-- ===================================================================
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


-- ===================================================================
-- MIGRATION: 20260510_compliance_reply_tipo.sql
-- ===================================================================
-- Adiciona tipo resposta_diligencia à tabela compliance_mensagens
ALTER TABLE compliance_mensagens
  DROP CONSTRAINT IF EXISTS compliance_mensagens_tipo_check;

ALTER TABLE compliance_mensagens
  ADD CONSTRAINT compliance_mensagens_tipo_check
  CHECK (tipo IN ('recebida','auto_resposta','officer_reply','diligencia','interna','resposta_diligencia'));


-- ===================================================================
-- MIGRATION: 20260510_oficios_controle_log_e_validacao.sql
-- ===================================================================
-- Tabela de log de controle anual de ofícios (arquivamento / reabertura)
-- e trigger que impede arquivar o ano em curso.

-- ── 1. Tabela de log ──────────────────────────────────────────────────────
create table if not exists public.oficios_controle_log (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  parte_grupo_id  uuid references public.partes_crm(id) on delete set null,
  oficio_id       uuid references public.oficios(id) on delete set null,
  ano             int,
  acao            text not null,   -- 'controle_arquivado' | 'controle_desarquivado'
  usuario_id      uuid,
  usuario_nome    text,
  criado_em       timestamptz not null default now(),
  detalhes        jsonb
);

create index if not exists idx_ocl_esc_ts    on public.oficios_controle_log (escritorio_id, criado_em desc);
create index if not exists idx_ocl_parte_ano on public.oficios_controle_log (parte_grupo_id, ano, criado_em desc);

alter table public.oficios_controle_log enable row level security;

drop policy if exists oficios_controle_log_select on public.oficios_controle_log;
create policy oficios_controle_log_select on public.oficios_controle_log
  for select to authenticated
  using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists oficios_controle_log_insert on public.oficios_controle_log;
create policy oficios_controle_log_insert on public.oficios_controle_log
  for insert to authenticated
  with check (public.usuario_pode_escrever(escritorio_id));

-- ── 2. Trigger: impede arquivar o ano em curso ────────────────────────────
-- Um ofício do ano X só pode ter controle_arquivado = true
-- a partir de 1º de janeiro de X+1.
create or replace function public.validar_arquivamento_oficio()
returns trigger language plpgsql as $$
begin
  if new.controle_arquivado = true
     and (old.controle_arquivado is null or old.controle_arquivado = false)
  then
    if new.ano is not null and new.ano >= extract(year from current_date)::int then
      raise exception
        'O controle de ofícios de % só pode ser arquivado a partir de 1º de janeiro de %. Tente novamente após esta data.',
        new.ano, (new.ano + 1);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_arquivamento_oficio on public.oficios;
create trigger trg_validar_arquivamento_oficio
  before update on public.oficios
  for each row execute function public.validar_arquivamento_oficio();


-- ===================================================================
-- MIGRATION: 20260511_backfill_oficios_parte_grupo.sql
-- ===================================================================
-- Backfill seguro: associa ofícios (e destinatários) legados às empresas do grupo no CRM.
-- Rode primeiro os SELECTs de verificação (comentados ao final) se quiser inspecionar o pareamento.
--
-- Regra de pareamento (na ordem):
--   1) nome da oficios_empresas = nome ou nome_fantasia da partes_crm (trim + lower)
--   2) mesmo comparando só caracteres alfanuméricos (ignora espaços e pontuação)
--
-- IMPORTANTE: se duas linhas de partes_crm casarem com a mesma oficios_empresas, o UPDATE pode ficar
-- ambíguo. Nesse caso, ajuste nomes no CRM ou crie um UPDATE manual por empresa_id.

-- ── Ofícios ───────────────────────────────────────────────────────────────
UPDATE public.oficios AS o
SET
  parte_grupo_id = m.id_parte,
  escritorio_id = m.escritorio_id
FROM (
  SELECT DISTINCT ON (oe.id)
    oe.id AS empresa_legacy_id,
    pc.id AS id_parte,
    pc.escritorio_id
  FROM public.oficios_empresas oe
  INNER JOIN public.partes_crm pc
    ON pc.tipo = 'empresa_grupo'
    AND pc.status = 'ativo'
    AND (
      lower(trim(oe.nome)) IN (
        lower(trim(pc.nome)),
        lower(trim(coalesce(pc.nome_fantasia, '')))
      )
      OR regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g') <> ''
         AND regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g')
           IN (
             regexp_replace(lower(trim(pc.nome)), '[^a-z0-9]', '', 'g'),
             regexp_replace(lower(trim(coalesce(pc.nome_fantasia, ''))), '[^a-z0-9]', '', 'g')
           )
    )
  ORDER BY oe.id, pc.id
) AS m
WHERE o.empresa_id = m.empresa_legacy_id
  AND (o.parte_grupo_id IS NULL OR o.escritorio_id IS NULL);

-- ── Destinatários ───────────────────────────────────────────────────────────
UPDATE public.oficios_destinatarios AS d
SET
  parte_grupo_id = m.id_parte,
  escritorio_id = m.escritorio_id
FROM (
  SELECT DISTINCT ON (oe.id)
    oe.id AS empresa_legacy_id,
    pc.id AS id_parte,
    pc.escritorio_id
  FROM public.oficios_empresas oe
  INNER JOIN public.partes_crm pc
    ON pc.tipo = 'empresa_grupo'
    AND pc.status = 'ativo'
    AND (
      lower(trim(oe.nome)) IN (
        lower(trim(pc.nome)),
        lower(trim(coalesce(pc.nome_fantasia, '')))
      )
      OR regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g') <> ''
         AND regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g')
           IN (
             regexp_replace(lower(trim(pc.nome)), '[^a-z0-9]', '', 'g'),
             regexp_replace(lower(trim(coalesce(pc.nome_fantasia, ''))), '[^a-z0-9]', '', 'g')
           )
    )
  ORDER BY oe.id, pc.id
) AS m
WHERE d.empresa_id = m.empresa_legacy_id
  AND (d.parte_grupo_id IS NULL OR d.escritorio_id IS NULL);

-- ── Auditoria dos ofícios (alinhar ao ofício já backfilled) ────────────────
UPDATE public.oficios_auditoria AS a
SET
  parte_grupo_id = o.parte_grupo_id,
  escritorio_id = o.escritorio_id
FROM public.oficios o
WHERE a.oficio_id = o.id
  AND o.parte_grupo_id IS NOT NULL
  AND o.escritorio_id IS NOT NULL
  AND (a.parte_grupo_id IS NULL OR a.escritorio_id IS NULL);

-- ── Verificações úteis (rode manualmente antes ou depois) ─────────────────
-- Ofícios ainda sem CRM após o backfill:
-- SELECT o.id, o.numero, o.ano, o.empresa_id, oe.nome
-- FROM public.oficios o
-- LEFT JOIN public.oficios_empresas oe ON oe.id = o.empresa_id
-- WHERE o.parte_grupo_id IS NULL OR o.escritorio_id IS NULL;

-- Pareamento sugerido antes de atualizar (preview):
-- SELECT oe.id, oe.nome AS nome_legacy, pc.id AS parte_grupo_id, pc.nome, pc.nome_fantasia, pc.escritorio_id
-- FROM public.oficios_empresas oe
-- JOIN public.partes_crm pc ON pc.tipo = 'empresa_grupo' AND pc.status = 'ativo'
--   AND regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g')
--     IN (
--       regexp_replace(lower(trim(pc.nome)), '[^a-z0-9]', '', 'g'),
--       regexp_replace(lower(trim(coalesce(pc.nome_fantasia,''))), '[^a-z0-9]', '', 'g')
--     );


-- ===================================================================
-- MIGRATION: 20260512120000_financeiro_honorarios_e_custos.sql
-- ===================================================================
-- JurisBPO - Honorarios e custos no financeiro processual

alter table public.financeiro_processos
  add column if not exists honorarios_e_custos numeric(14,2) not null default 0;

comment on column public.financeiro_processos.honorarios_e_custos is
  'Honorarios e custos vinculados ao registro financeiro do processo.';

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260512133000_processos_apensamentos.sql
-- ===================================================================
-- JurisBPO - Apensamento de processos e fase de execucao provisoria

alter table public.processos
  drop constraint if exists processos_fase_check;

alter table public.processos
  add constraint processos_fase_check
  check (fase in ('conhecimento','recurso','execucao_provisoria','execucao_sentenca','arquivo_definitivo'));

create table if not exists public.processo_apensamentos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete cascade,
  processo_apensado_id uuid not null references public.processos(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint processo_apensamentos_processos_diferentes_check check (processo_id <> processo_apensado_id)
);

create index if not exists idx_processo_apensamentos_escritorio
  on public.processo_apensamentos (escritorio_id);

create index if not exists idx_processo_apensamentos_processo
  on public.processo_apensamentos (processo_id);

create index if not exists idx_processo_apensamentos_apensado
  on public.processo_apensamentos (processo_apensado_id);

create unique index if not exists idx_processo_apensamentos_unico
  on public.processo_apensamentos (
    escritorio_id,
    least(processo_id, processo_apensado_id),
    greatest(processo_id, processo_apensado_id)
  );

alter table public.processo_apensamentos enable row level security;

drop policy if exists processo_apensamentos_select_member on public.processo_apensamentos;
drop policy if exists processo_apensamentos_write_non_visitor on public.processo_apensamentos;

create policy processo_apensamentos_select_member
on public.processo_apensamentos
for select to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

create policy processo_apensamentos_write_non_visitor
on public.processo_apensamentos
for all to authenticated
using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260512170000_compliance_conflitos_interesse.sql
-- ===================================================================
-- JurisBPO - Analise de conflitos de interesse no modulo de Compliance

create table if not exists public.compliance_conflito_interesse_analises (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  arquivo_nome text not null,
  arquivo_tipo text,
  arquivo_tamanho_bytes bigint,
  storage_bucket text not null default 'compliance-anexos',
  storage_path text,
  colaborador_nome text,
  colaborador_documento text,
  colaborador_matricula text,
  respostas jsonb not null default '{}'::jsonb,
  nivel_risco text not null check (nivel_risco in ('BAIXO','MEDIO','ALTO')),
  flag text not null check (flag in ('VERDE','AMARELA','VERMELHA')),
  status text not null check (status in ('analisado_sem_conflito','pendente_revisao','alerta_critico')),
  recomendacao text,
  metodo_extracao text,
  confianca_extracao numeric(5,4),
  texto_extraido text,
  atividade_id uuid references public.atividades(id) on delete set null,
  criado_por uuid references auth.users(id),
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_compliance_conflitos_escritorio
  on public.compliance_conflito_interesse_analises (escritorio_id, criado_em desc);

create index if not exists idx_compliance_conflitos_risco
  on public.compliance_conflito_interesse_analises (escritorio_id, nivel_risco, status);

insert into storage.buckets as b (id, name, public, file_size_limit)
values ('compliance-anexos', 'compliance-anexos', false, 52428800)
on conflict (id) do update
set file_size_limit = greatest(coalesce(b.file_size_limit, 0), excluded.file_size_limit);

alter table public.compliance_conflito_interesse_analises enable row level security;

drop policy if exists compliance_conflitos_gerente_rls on public.compliance_conflito_interesse_analises;

create policy compliance_conflitos_gerente_rls
on public.compliance_conflito_interesse_analises
for all to authenticated
using (
  exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.usuario_id = auth.uid()
      and ue.escritorio_id = compliance_conflito_interesse_analises.escritorio_id
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
)
with check (
  exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.usuario_id = auth.uid()
      and ue.escritorio_id = compliance_conflito_interesse_analises.escritorio_id
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
);

drop policy if exists compliance_anexos_storage_select on storage.objects;
drop policy if exists compliance_anexos_storage_insert on storage.objects;
drop policy if exists compliance_anexos_storage_update on storage.objects;
drop policy if exists compliance_anexos_storage_delete on storage.objects;

create policy compliance_anexos_storage_select on storage.objects
for select to authenticated
using (bucket_id = 'compliance-anexos' and public.usuario_tem_escritorio_storage(name));

create policy compliance_anexos_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name));

create policy compliance_anexos_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name))
with check (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name));

create policy compliance_anexos_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name));

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260512174500_compliance_anexos_file_size_limit.sql
-- ===================================================================
-- Aumenta o limite de upload do bucket usado pelos anexos de Compliance.
-- Formularios de conflito de interesse escaneados costumam passar de 10 MB.

insert into storage.buckets as b (id, name, public, file_size_limit)
values ('compliance-anexos', 'compliance-anexos', false, 52428800)
on conflict (id) do update
set file_size_limit = greatest(coalesce(b.file_size_limit, 0), excluded.file_size_limit);

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260512_push_email_config_arquivo.sql
-- ===================================================================
-- JurisBPO - Configuracao do push processual e arquivo de desconsideracoes

create table if not exists public.push_email_config (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null unique references public.escritorios(id) on delete cascade,
  imap_host text not null default 'imap.gmail.com',
  imap_port integer not null default 993,
  imap_secure boolean not null default true,
  imap_user text not null default 'juridicocallbrbpo@gmail.com',
  imap_mailbox text not null default 'INBOX',
  enabled boolean not null default true,
  updated_by uuid null,
  updated_by_nome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_email_config_escritorio
  on public.push_email_config(escritorio_id);

create or replace function public.touch_push_email_config_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_push_email_config_updated_at on public.push_email_config;
create trigger trg_push_email_config_updated_at
before update on public.push_email_config
for each row execute function public.touch_push_email_config_updated_at();

alter table public.push_email_config enable row level security;

drop policy if exists push_email_config_select_member on public.push_email_config;
create policy push_email_config_select_member
on public.push_email_config
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists push_email_config_write_gerente on public.push_email_config;
create policy push_email_config_write_gerente
on public.push_email_config
for all
to authenticated
using (
  exists (
    select 1 from public.usuarios_escritorios ue
    where ue.escritorio_id = push_email_config.escritorio_id
      and ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
)
with check (
  exists (
    select 1 from public.usuarios_escritorios ue
    where ue.escritorio_id = push_email_config.escritorio_id
      and ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
);

create table if not exists public.andamentos_processuais_push_arquivo (
  id uuid primary key default gen_random_uuid(),
  andamento_id uuid not null references public.andamentos_processuais_push(id) on delete cascade,
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  usuario_id uuid null,
  usuario_nome text null,
  arquivado_em timestamptz not null default now(),
  motivo text null,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists idx_andamentos_push_arquivo_escritorio
  on public.andamentos_processuais_push_arquivo(escritorio_id, arquivado_em desc);

create index if not exists idx_andamentos_push_arquivo_andamento
  on public.andamentos_processuais_push_arquivo(andamento_id);

create or replace function public.cleanup_old_andamentos_push_arquivo()
returns trigger as $$
begin
  delete from public.andamentos_processuais_push_arquivo
  where arquivado_em < now() - interval '30 days';
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_cleanup_old_andamentos_push_arquivo on public.andamentos_processuais_push_arquivo;
create trigger trg_cleanup_old_andamentos_push_arquivo
after insert on public.andamentos_processuais_push_arquivo
for each statement execute function public.cleanup_old_andamentos_push_arquivo();

alter table public.andamentos_processuais_push_arquivo enable row level security;

drop policy if exists andamentos_push_arquivo_select_member on public.andamentos_processuais_push_arquivo;
create policy andamentos_push_arquivo_select_member
on public.andamentos_processuais_push_arquivo
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists andamentos_push_arquivo_insert_member on public.andamentos_processuais_push_arquivo;
create policy andamentos_push_arquivo_insert_member
on public.andamentos_processuais_push_arquivo
for insert
to authenticated
with check (public.usuario_tem_escritorio(escritorio_id));

insert into public.andamentos_processuais_push_arquivo (
  andamento_id,
  escritorio_id,
  usuario_id,
  usuario_nome,
  arquivado_em,
  motivo,
  snapshot
)
select
  p.id,
  p.escritorio_id,
  null,
  'Registro legado',
  coalesce(p.ignorado_em, p.atualizado_em, p.criado_em),
  coalesce(p.motivo_ignorado, 'Desconsiderado antes da criação do arquivo próprio.'),
  to_jsonb(p)
from public.andamentos_processuais_push p
where p.status_associacao = 'ignorado'
  and p.escritorio_id is not null
  and not exists (
    select 1
    from public.andamentos_processuais_push_arquivo a
    where a.andamento_id = p.id
  );

delete from public.andamentos_processuais_push_arquivo
where arquivado_em < now() - interval '30 days';


-- ===================================================================
-- MIGRATION: 20260513100000_financeiro_agravo_instrumento.sql
-- ===================================================================
-- JurisBPO - Agravo de instrumento no financeiro processual

alter table public.financeiro_processos
  add column if not exists agravo_instrumento numeric(14,2) not null default 0;

comment on column public.financeiro_processos.agravo_instrumento is
  'Valor vinculado a agravo de instrumento no registro financeiro do processo.';

comment on column public.financeiro_processos.valor_restituido_origens is
  'Origens informadas para o valor restituido/devolvido: deposito_ro, deposito_rr, deposito_embargos, agravo_instrumento ou apolice_seguro_garantia.';

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260513170000_processos_multiplas_reclamadas.sql
-- ===================================================================
-- Processos: suporte a multiplas reclamadas mantendo compatibilidade com parte_contraria.

alter table public.processos
  add column if not exists partes_contrarias jsonb not null default '[]'::jsonb;

alter table public.processos
  drop constraint if exists processos_partes_contrarias_array_check;

alter table public.processos
  add constraint processos_partes_contrarias_array_check
  check (jsonb_typeof(partes_contrarias) = 'array');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'processos'
      and column_name = 'parte_contraria_id'
  ) then
    execute $sql$
      update public.processos
      set partes_contrarias = jsonb_build_array(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', parte_contraria_id,
            'nome', nullif(trim(coalesce(parte_contraria, '')), '')
          )
        )
      )
      where partes_contrarias = '[]'::jsonb
        and (
          parte_contraria_id is not null
          or nullif(trim(coalesce(parte_contraria, '')), '') is not null
        )
    $sql$;
  else
    update public.processos
    set partes_contrarias = jsonb_build_array(
      jsonb_build_object('nome', nullif(trim(coalesce(parte_contraria, '')), ''))
    )
    where partes_contrarias = '[]'::jsonb
      and nullif(trim(coalesce(parte_contraria, '')), '') is not null;
  end if;
end $$;

create index if not exists idx_processos_partes_contrarias
  on public.processos using gin (partes_contrarias);

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260513183000_data_api_explicit_grants.sql
-- ===================================================================
-- JurisBPO - explicit Data API grants for Supabase 2026 opt-in behavior.
-- Supabase will stop auto-exposing new public schema objects to the Data API.
-- RLS remains responsible for row-level access; these grants only allow the
-- authenticated/service_role roles to reach the intended objects.

grant usage on schema public to authenticated, service_role;

do $$
declare
  obj_name text;
  proc_sig text;
  api_tables text[] := array[
    'acervo_modelos',
    'andamentos_processuais_push',
    'andamentos_processuais_push_arquivo',
    'atividade_atribuicoes',
    'atividade_historico',
    'atividades',
    'chat_mensagens',
    'chat_salas',
    'clientes',
    'compliance_anexos',
    'compliance_config',
    'compliance_conflito_interesse_analises',
    'compliance_denuncias',
    'compliance_mensagens',
    'contratos',
    'documentos',
    'escritorios',
    'financeiro_lancamentos',
    'financeiro_processos',
    'google_calendar_config',
    'mensagens',
    'mensagens_anexos',
    'modelos_documentos',
    'mural_recados',
    'notificacoes',
    'oficios',
    'oficios_anexos',
    'oficios_auditoria',
    'oficios_controle_ano',
    'oficios_controle_log',
    'oficios_destinatarios',
    'oficios_empresas',
    'partes_crm',
    'processo_apensamentos',
    'processos',
    'profiles',
    'push_email_config',
    'rotinas',
    'tarefas',
    'usuarios_escritorios'
  ];
  api_views text[] := array[
    'financeiro_resumo_escritorio'
  ];
  api_routines text[] := array[
    'marcar_chat_lido',
    'usuario_eh_gerente',
    'usuario_pode_editar_proprio_profile',
    'usuario_pode_escrever',
    'usuario_pode_escrever_storage',
    'usuario_tem_escritorio',
    'usuario_tem_escritorio_storage'
  ];
begin
  foreach obj_name in array api_tables loop
    if to_regclass(format('public.%I', obj_name)) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated, service_role',
        obj_name
      );
    end if;
  end loop;

  foreach obj_name in array api_views loop
    if to_regclass(format('public.%I', obj_name)) is not null then
      execute format(
        'grant select on table public.%I to authenticated, service_role',
        obj_name
      );
    end if;
  end loop;

  for proc_sig in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(api_routines)
  loop
    execute format(
      'grant execute on function %s to authenticated, service_role',
      proc_sig
    );
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated, service_role;

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260514033000_repair_processos_financeiro_schema.sql
-- ===================================================================
-- Repara colunas esperadas pelo app em producao.
-- Idempotente: pode ser executada mais de uma vez sem perda de dados.

alter table public.processos
  add column if not exists partes_contrarias jsonb not null default '[]'::jsonb;

alter table public.processos
  drop constraint if exists processos_partes_contrarias_array_check;

alter table public.processos
  add constraint processos_partes_contrarias_array_check
  check (jsonb_typeof(partes_contrarias) = 'array');

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'processos'
      and column_name = 'parte_contraria_id'
  ) then
    execute $sql$
      update public.processos p
      set partes_contrarias = jsonb_build_array(
        jsonb_strip_nulls(jsonb_build_object(
          'id', p.parte_contraria_id,
          'nome', p.parte_contraria
        ))
      )
      where p.partes_contrarias = '[]'::jsonb
        and nullif(trim(coalesce(p.parte_contraria, '')), '') is not null
    $sql$;
  end if;
end $$;

create index if not exists idx_processos_partes_contrarias
  on public.processos using gin (partes_contrarias);

alter table public.financeiro_processos
  add column if not exists agravo_instrumento numeric(14,2) not null default 0;

comment on column public.financeiro_processos.agravo_instrumento is
  'Valor de agravo de instrumento registrado no financeiro do processo.';

comment on column public.financeiro_processos.valor_restituido_origens is
  'Origens informadas para o valor restituido/devolvido: deposito_ro, deposito_rr, deposito_embargos, agravo_instrumento ou apolice_seguro_garantia.';

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260515_numero_controle_processos.sql
-- ===================================================================
-- Migration: numero_controle para processos
-- Gerado em: 2026-05-15
-- Objetivo: adicionar número de controle único, aleatório e não sequencial
--           para cada processo, além de proteger contra duplicatas futuras.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ADICIONAR COLUNA (nullable primeiro para popular dados existentes)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS numero_controle TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNÇÃO AUXILIAR: gera código aleatório no formato CTL-XXXXXXXX
--    Usa alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_numero_controle()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    result := 'CTL-';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_controle = result) THEN
      RETURN result;
    END IF;
    attempts := attempts + 1;
    IF attempts > 1000 THEN
      RAISE EXCEPTION 'Impossível gerar numero_controle único após 1000 tentativas';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POPULAR REGISTROS EXISTENTES (incluindo duplicatas — cada entrada recebe
--    seu próprio número de controle individual para identificação manual)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  ctrl TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  attempts INT;
BEGIN
  FOR rec IN SELECT id FROM public.processos WHERE numero_controle IS NULL ORDER BY created_at LOOP
    attempts := 0;
    LOOP
      ctrl := 'CTL-';
      FOR i IN 1..8 LOOP
        ctrl := ctrl || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_controle = ctrl) THEN
        UPDATE public.processos SET numero_controle = ctrl WHERE id = rec.id;
        EXIT;
      END IF;
      attempts := attempts + 1;
      IF attempts > 200 THEN
        RAISE EXCEPTION 'Falha ao gerar numero_controle único para o processo %', rec.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CONSTRAINTS: NOT NULL + UNIQUE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  ALTER COLUMN numero_controle SET NOT NULL;

ALTER TABLE public.processos
  ADD CONSTRAINT processos_numero_controle_unique UNIQUE (numero_controle);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER: atribui numero_controle automaticamente em novos inserts
--    (fallback caso o frontend não envie)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_assign_numero_controle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_controle IS NULL OR NEW.numero_controle = '' THEN
    NEW.numero_controle := public.generate_numero_controle();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_processos_numero_controle ON public.processos;
CREATE TRIGGER trg_processos_numero_controle
  BEFORE INSERT ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_numero_controle();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ÍNDICE para buscas por numero_controle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processos_numero_controle ON public.processos (numero_controle);


-- ===================================================================
-- MIGRATION: 20260515_fix_numero_controle_duplicados.sql
-- ===================================================================
-- Migração corretiva: numero_controle duplicados
-- 2026-05-15
-- Problema: o DO block da migração anterior gerou o mesmo CTL para linhas
-- duplicadas porque o Supabase/PostgreSQL não enxergou os UPDATEs anteriores
-- dentro da mesma transação em tempo de execução do cursor.
-- Solução: identificar todas as linhas que não são a "primeira" do grupo
-- (por created_at + id) e reatribuir CTLs únicos a elas.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REMOVER A CONSTRAINT UNIQUE (pode já não existir — IF EXISTS é seguro)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  DROP CONSTRAINT IF EXISTS processos_numero_controle_unique;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GARANTIR QUE A FUNÇÃO DE GERAÇÃO EXISTE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_numero_controle()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    result := 'CTL-';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_controle = result) THEN
      RETURN result;
    END IF;
    attempts := attempts + 1;
    IF attempts > 1000 THEN
      RAISE EXCEPTION 'Impossível gerar numero_controle único após 1000 tentativas';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REATRIBUIR CTL PARA:
--    a) linhas com numero_controle NULL
--    b) linhas duplicadas (todas exceto a primeira de cada grupo de CTL igual)
--    A "primeira" de cada grupo é preservada; as demais recebem novo CTL.
--    Cada UPDATE é feito individualmente em loop para garantir unicidade.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ctrl TEXT;
  i INT;
  attempts INT;
BEGIN
  -- Seleciona linhas que precisam de novo CTL:
  -- rn > 1 = não é a primeira do grupo (duplicata de CTL)
  -- numero_controle IS NULL = não teve CTL atribuído
  FOR rec IN
    SELECT id FROM (
      SELECT id,
             created_at,
             numero_controle,
             ROW_NUMBER() OVER (
               PARTITION BY COALESCE(numero_controle, 'NULL_' || id::text)
               ORDER BY id
             ) AS rn
      FROM public.processos
    ) t
    WHERE rn > 1 OR numero_controle IS NULL
    ORDER BY created_at, id
  LOOP
    attempts := 0;
    LOOP
      ctrl := 'CTL-';
      FOR i IN 1..8 LOOP
        ctrl := ctrl || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_controle = ctrl) THEN
        UPDATE public.processos SET numero_controle = ctrl WHERE id = rec.id;
        RAISE NOTICE 'CTL % atribuído ao processo id=%', ctrl, rec.id;
        EXIT;
      END IF;
      attempts := attempts + 1;
      IF attempts > 500 THEN
        RAISE EXCEPTION 'Falha ao gerar CTL único para id=%', rec.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GARANTIR NOT NULL em todos os registros restantes
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.processos
SET numero_controle = public.generate_numero_controle()
WHERE numero_controle IS NULL OR numero_controle = '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. APLICAR NOT NULL + UNIQUE (agora com dados limpos)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  ALTER COLUMN numero_controle SET NOT NULL;

ALTER TABLE public.processos
  ADD CONSTRAINT processos_numero_controle_unique UNIQUE (numero_controle);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RECRIAR O TRIGGER (garante que novos inserts sem CTL recebam um)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_assign_numero_controle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_controle IS NULL OR NEW.numero_controle = '' THEN
    NEW.numero_controle := public.generate_numero_controle();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_processos_numero_controle ON public.processos;
CREATE TRIGGER trg_processos_numero_controle
  BEFORE INSERT ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_numero_controle();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ÍNDICE (recria se necessário)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processos_numero_controle
  ON public.processos (numero_controle);


-- ===================================================================
-- MIGRATION: 20260519_publicacoes_lider.sql
-- ===================================================================
-- JurisBPO - Publicações do Diário da Justiça via WebService Lider
-- Seguro para aplicar sobre banco existente.

create table if not exists public.publicacoes_lider (
  id                     uuid        primary key default gen_random_uuid(),

  -- chave única fornecida pelo WS Lider (deduplicação + setPublicacoes)
  cod_publicacao         bigint      not null unique,

  -- vínculo com entidades do sistema
  escritorio_id          uuid        null references public.escritorios(id) on delete set null,
  cliente_id             uuid        null references public.clientes(id) on delete set null,
  processo_id            uuid        null references public.processos(id) on delete set null,
  status_associacao      text        not null default 'pendente'
                                     check (status_associacao in ('associado','pendente')),

  -- campos do objeto publicacao v5
  ano_publicacao         int         null,
  edicao_diario          int         null,
  descricao_diario       text        null,
  pagina_inicial         int         null,
  pagina_final           int         null,
  data_publicacao        date        null,
  data_divulgacao        date        null,
  data_cadastro_lider    timestamptz null,
  numero_processo        text        null,
  uf_publicacao          text        null,
  cidade_publicacao      text        null,
  orgao_descricao        text        null,
  vara_descricao         text        null,
  despacho_publicacao    text        null,
  processo_publicacao    text        null,
  publicacao_corrigida   int         not null default 0,
  cod_vinculo            int         null,
  nome_vinculo           text        null,
  oab_numero             int         null,
  oab_estado             text        null,
  identificacao_cadastro text        null,
  cod_integracao         text        null,
  natureza               text        null,
  complemento1           text        null,
  orgao_descricao_comp   text        null,
  diario_sigla_wj        text        null,
  publicacao_exportada   int         not null default 0,
  cod_grupo              int         null,
  anexo                  text        null,

  -- controle de exportação no WS Lider
  marcado_exportado_em   timestamptz null,

  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

create index if not exists idx_publicacoes_lider_processo_id
  on public.publicacoes_lider(processo_id);
create index if not exists idx_publicacoes_lider_numero
  on public.publicacoes_lider(numero_processo);
create index if not exists idx_publicacoes_lider_escritorio
  on public.publicacoes_lider(escritorio_id);
create index if not exists idx_publicacoes_lider_data
  on public.publicacoes_lider(data_publicacao desc, criado_em desc);

create or replace function public.touch_publicacoes_lider_updated_at()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_publicacoes_lider_updated_at on public.publicacoes_lider;
create trigger trg_publicacoes_lider_updated_at
before update on public.publicacoes_lider
for each row execute function public.touch_publicacoes_lider_updated_at();

alter table public.publicacoes_lider enable row level security;

drop policy if exists publicacoes_lider_select_member on public.publicacoes_lider;
create policy publicacoes_lider_select_member
  on public.publicacoes_lider for select
  to authenticated
  using (public.usuario_tem_escritorio(escritorio_id));

-- Inserts/updates feitos pelo worker com SUPABASE_SERVICE_ROLE_KEY.
-- Sem policy de insert/update pública para evitar manipulação no frontend.


-- ===================================================================
-- MIGRATION: 20260520_atividades_alerta.sql
-- ===================================================================
-- Adiciona campos de alerta às atividades
ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS alerta_antecedencia INTEGER,
  ADD COLUMN IF NOT EXISTS alerta_unidade TEXT CHECK (alerta_unidade IN ('minutos','horas','dias'));

-- Garante que alerta_unidade só exista quando alerta_antecedencia for preenchido
ALTER TABLE public.atividades
  ADD CONSTRAINT atividades_alerta_consistente
    CHECK (
      (alerta_antecedencia IS NULL AND alerta_unidade IS NULL) OR
      (alerta_antecedencia IS NOT NULL AND alerta_unidade IS NOT NULL AND alerta_antecedencia > 0)
    );

-- Índice para buscar atividades com alerta configurado
CREATE INDEX IF NOT EXISTS idx_atividades_alerta
  ON public.atividades(escritorio_id, prazo)
  WHERE alerta_antecedencia IS NOT NULL AND status NOT IN ('concluida','cancelada');


-- ===================================================================
-- TABELAS: mensagens e mensagens_anexos
-- (criadas originalmente via interface Supabase; recriadas aqui para demo)
-- ===================================================================

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid references public.escritorios(id) on delete cascade,
  remetente_id uuid references auth.users(id) on delete set null,
  destinatario_id uuid references auth.users(id) on delete set null,
  assunto text,
  corpo text,
  lida boolean not null default false,
  arquivada_por text[] not null default '{}',
  parent_id uuid references public.mensagens(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensagens_remetente on public.mensagens (remetente_id);
create index if not exists idx_mensagens_destinatario on public.mensagens (destinatario_id);
create index if not exists idx_mensagens_escritorio on public.mensagens (escritorio_id);

create table if not exists public.mensagens_anexos (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null references public.mensagens(id) on delete cascade,
  escritorio_id uuid references public.escritorios(id) on delete cascade,
  nome text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_mensagens_anexos_mensagem on public.mensagens_anexos (mensagem_id);

notify pgrst, 'reload schema';


-- ===================================================================
-- MIGRATION: 20260520_mensagens_rls.sql
-- ===================================================================
-- Garante que RLS da tabela mensagens permita:
--   - remetente e destinatário lerem a conversa
--   - apenas remetente inserir
--   - ambos atualizarem (para arquivar, marcar como lida)

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensagens_select         ON public.mensagens;
DROP POLICY IF EXISTS mensagens_insert         ON public.mensagens;
DROP POLICY IF EXISTS mensagens_update         ON public.mensagens;
DROP POLICY IF EXISTS mensagens_delete         ON public.mensagens;
DROP POLICY IF EXISTS "mensagens select"       ON public.mensagens;
DROP POLICY IF EXISTS "mensagens insert"       ON public.mensagens;
DROP POLICY IF EXISTS "mensagens update"       ON public.mensagens;

CREATE POLICY mensagens_select ON public.mensagens
  FOR SELECT TO authenticated
  USING (remetente_id = auth.uid() OR destinatario_id = auth.uid());

CREATE POLICY mensagens_insert ON public.mensagens
  FOR INSERT TO authenticated
  WITH CHECK (remetente_id = auth.uid());

CREATE POLICY mensagens_update ON public.mensagens
  FOR UPDATE TO authenticated
  USING (remetente_id = auth.uid() OR destinatario_id = auth.uid());

-- Anexos: acompanham a política da mensagem principal
ALTER TABLE public.mensagens_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensagens_anexos_select  ON public.mensagens_anexos;
DROP POLICY IF EXISTS mensagens_anexos_insert  ON public.mensagens_anexos;
DROP POLICY IF EXISTS "mensagens_anexos select" ON public.mensagens_anexos;
DROP POLICY IF EXISTS "mensagens_anexos insert" ON public.mensagens_anexos;

CREATE POLICY mensagens_anexos_select ON public.mensagens_anexos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mensagens m
      WHERE m.id = mensagem_id
        AND (m.remetente_id = auth.uid() OR m.destinatario_id = auth.uid())
    )
  );

CREATE POLICY mensagens_anexos_insert ON public.mensagens_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mensagens m
      WHERE m.id = mensagem_id
        AND m.remetente_id = auth.uid()
    )
  );


-- ===================================================================
-- MIGRATION: 20260520_mensagens_rls_fix.sql
-- ===================================================================
-- Remove política que bloqueia TODOS os usuários (inclusive gerentes)
-- de inserir mensagens. A política mensagens_insert (criada em
-- 20260520_mensagens_rls.sql) já cuida corretamente de quem pode inserir.
DROP POLICY IF EXISTS visitante_no_insert_mensagens ON public.mensagens;
DROP POLICY IF EXISTS "visitante_no_insert_mensagens" ON public.mensagens;


-- ===================================================================
-- MIGRATION: 20260521_compliance_access.sql
-- ===================================================================
-- ---------------------------------------------------------------------------
-- compliance_access: permissão individual de acesso ao módulo de compliance
-- Permite habilitar um usuário específico (não gerente) a acessar compliance.
-- ---------------------------------------------------------------------------

ALTER TABLE public.usuarios_escritorios
  ADD COLUMN IF NOT EXISTS compliance_access boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Atualiza RLS: compliance_denuncias
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "compliance_gerente_rls" ON compliance_denuncias;
CREATE POLICY "compliance_gerente_rls" ON compliance_denuncias
  FOR ALL USING (
    escritorio_id IN (
      SELECT ue.escritorio_id
      FROM usuarios_escritorios ue
      WHERE ue.usuario_id = auth.uid()
        AND ue.ativo = true
        AND (ue.papel = 'gerente' OR ue.compliance_access = true)
    )
  );

-- ---------------------------------------------------------------------------
-- Atualiza RLS: compliance_mensagens
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "compliance_msgs_gerente_rls" ON compliance_mensagens;
CREATE POLICY "compliance_msgs_gerente_rls" ON compliance_mensagens
  FOR ALL USING (
    escritorio_id IN (
      SELECT ue.escritorio_id
      FROM usuarios_escritorios ue
      WHERE ue.usuario_id = auth.uid()
        AND ue.ativo = true
        AND (ue.papel = 'gerente' OR ue.compliance_access = true)
    )
  );

-- ---------------------------------------------------------------------------
-- Atualiza RLS: compliance_config
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "compliance_config_gerente_rls" ON compliance_config;
CREATE POLICY "compliance_config_gerente_rls" ON compliance_config
  FOR ALL USING (
    escritorio_id IN (
      SELECT ue.escritorio_id
      FROM usuarios_escritorios ue
      WHERE ue.usuario_id = auth.uid()
        AND ue.ativo = true
        AND (ue.papel = 'gerente' OR ue.compliance_access = true)
    )
  );

-- ---------------------------------------------------------------------------
-- Atualiza RLS: compliance_conflito_interesse_analises
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS compliance_conflitos_gerente_rls ON public.compliance_conflito_interesse_analises;
CREATE POLICY compliance_conflitos_gerente_rls
ON public.compliance_conflito_interesse_analises
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios_escritorios ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.escritorio_id = compliance_conflito_interesse_analises.escritorio_id
      AND ue.ativo = true
      AND (ue.papel = 'gerente' OR ue.compliance_access = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios_escritorios ue
    WHERE ue.usuario_id = auth.uid()
      AND ue.escritorio_id = compliance_conflito_interesse_analises.escritorio_id
      AND ue.ativo = true
      AND (ue.papel = 'gerente' OR ue.compliance_access = true)
  )
);

NOTIFY pgrst, 'reload schema';


-- ===================================================================
-- SEED DE DEMONSTRAÇÃO
-- ===================================================================
-- =============================================================================
-- JurisBPO — Seed de Demonstração
-- =============================================================================
-- Cria um ambiente completo com dados fictícios para uso em demos e mockups.
-- NÃO execute este script no banco de produção.
--
-- Pré-requisito: todas as migrations aplicadas (supabase db push).
-- Como executar: cole no Supabase SQL Editor do projeto demo e execute.
--
-- Usuários criados:
--   gerente@jurisbpo-demo.com   /  Demo@2026!   (papel: gerente)
--   advogado@jurisbpo-demo.com  /  Demo@2026!   (papel: advogado)
--   estagiario@jurisbpo-demo.com / Demo@2026!   (papel: assistente)
-- =============================================================================

-- Limpa dados anteriores do seed (idempotente)
DO $$ BEGIN
  DELETE FROM public.andamentos_processuais_push
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.financeiro_lancamentos
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.atividades
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.contratos
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.processos
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.clientes
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.usuarios_escritorios
    WHERE escritorio_id = 'a0000000-0000-0000-0000-000000000001';
  DELETE FROM public.profiles
    WHERE id IN (
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000011',
      'a0000000-0000-0000-0000-000000000012'
    );
  DELETE FROM auth.identities
    WHERE user_id IN (
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000011',
      'a0000000-0000-0000-0000-000000000012'
    );
  DELETE FROM auth.users
    WHERE id IN (
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000011',
      'a0000000-0000-0000-0000-000000000012'
    );
  DELETE FROM public.escritorios
    WHERE id = 'a0000000-0000-0000-0000-000000000001';
END $$;


-- =============================================================================
-- 1. ESCRITÓRIO DEMO
-- =============================================================================
INSERT INTO public.escritorios (id, nome, slug, plano, ativo)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'BPO Jurídico Demo',
  'bpo-juridico-demo',
  'pro',
  true
);


-- =============================================================================
-- 2. USUÁRIOS (auth.users + identities + profiles + vínculo ao escritório)
-- =============================================================================
DO $$
DECLARE
  v_hash TEXT := crypt('Demo@2026!', gen_salt('bf', 10));
  v_meta JSONB := '{"provider":"email","providers":["email"]}'::jsonb;
BEGIN

  -- Gerente
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    'a0000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'gerente@jurisbpo-demo.com',
    v_hash, now(), v_meta, '{}', now(), now()
  );
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (
    'a0000000-0000-0000-0000-000000000010',
    'a0000000-0000-0000-0000-000000000010',
    '{"sub":"a0000000-0000-0000-0000-000000000010","email":"gerente@jurisbpo-demo.com"}'::jsonb,
    'email', now(), now()
  );

  -- Advogado
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    'a0000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'advogado@jurisbpo-demo.com',
    v_hash, now(), v_meta, '{}', now(), now()
  );
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (
    'a0000000-0000-0000-0000-000000000011',
    'a0000000-0000-0000-0000-000000000011',
    '{"sub":"a0000000-0000-0000-0000-000000000011","email":"advogado@jurisbpo-demo.com"}'::jsonb,
    'email', now(), now()
  );

  -- Estagiário
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    'a0000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'estagiario@jurisbpo-demo.com',
    v_hash, now(), v_meta, '{}', now(), now()
  );
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES (
    'a0000000-0000-0000-0000-000000000012',
    'a0000000-0000-0000-0000-000000000012',
    '{"sub":"a0000000-0000-0000-0000-000000000012","email":"estagiario@jurisbpo-demo.com"}'::jsonb,
    'email', now(), now()
  );
END $$;

INSERT INTO public.profiles (id, email, nome, cargo, oab, cor, ativo)
VALUES
  ('a0000000-0000-0000-0000-000000000010', 'gerente@jurisbpo-demo.com',
   'Ana Paula Ferreira', 'Coordenadora Jurídica', 'OAB/SP 345.678', '#c9a227', true),
  ('a0000000-0000-0000-0000-000000000011', 'advogado@jurisbpo-demo.com',
   'Carlos Eduardo Souza', 'Advogado Trabalhista', 'OAB/SP 412.990', '#3b82f6', true),
  ('a0000000-0000-0000-0000-000000000012', 'estagiario@jurisbpo-demo.com',
   'Mariana Costa', 'Estagiária', NULL, '#10b981', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.usuarios_escritorios (usuario_id, escritorio_id, papel, ativo)
VALUES
  ('a0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000001', 'gerente',    true),
  ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'advogado',   true),
  ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'assistente', true);


-- =============================================================================
-- 3. CLIENTES
-- =============================================================================
INSERT INTO public.clientes (id, escritorio_id, nome, tipo, documento, email, telefone, ativo, created_by)
VALUES
  ('a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000001',
   'Tecnologia Futura S.A.', 'pessoa_juridica', '12.345.678/0001-90',
   'juridico@tecnologiafutura.com.br', '(11) 3456-7890', true,
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000021',
   'a0000000-0000-0000-0000-000000000001',
   'Construções Horizonte Ltda.', 'pessoa_juridica', '98.765.432/0001-10',
   'adm@horizonteconstrucoes.com.br', '(11) 2345-6789', true,
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000022',
   'a0000000-0000-0000-0000-000000000001',
   'Roberto Alves Mendonça', 'pessoa_fisica', '543.210.987-65',
   'roberto.mendonca@email.com', '(21) 99876-5432', true,
   'a0000000-0000-0000-0000-000000000011');


-- =============================================================================
-- 4. PROCESSOS
-- =============================================================================
INSERT INTO public.processos (
  id, escritorio_id, cliente_id, numero, titulo,
  partes_contrarias, tribunal, orgao,
  data_ajuizamento, valor_acao, status, fase,
  responsavel_id, created_by
)
VALUES
  -- Trabalhista ativo — reclamante vs. Tecnologia Futura
  ('a0000000-0000-0000-0000-000000000100',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0001234-56.2024.5.02.0038',
   'Alves vs. Tecnologia Futura S.A.',
   '[{"nome":"Diego Alves Pereira","tipo":"pessoa_fisica"}]',
   'TRT2', '38ª Vara do Trabalho de São Paulo',
   '2024-03-15', 45000.00, 'ativo', 'conhecimento',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Trabalhista ativo — execução
  ('a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0009821-14.2022.5.02.0301',
   'Santos vs. Tecnologia Futura S.A. — Execução',
   '[{"nome":"Fernanda Santos Lima","tipo":"pessoa_fisica"}]',
   'TRT2', '1ª Vara do Trabalho de Santo André',
   '2022-08-01', 78500.00, 'ativo', 'execucao_sentenca',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Cível cobrança — Construções Horizonte
  ('a0000000-0000-0000-0000-000000000102',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   '1023456-78.2023.8.26.0100',
   'Horizonte vs. Fornecedora ABC — Ação de Cobrança',
   '[{"nome":"Fornecedora ABC Materiais Ltda.","tipo":"pessoa_juridica"}]',
   'TJSP', '5ª Vara Cível do Foro Regional de Pinheiros',
   '2023-05-20', 132000.00, 'ativo', 'conhecimento',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Recurso ordinário — Construções Horizonte
  ('a0000000-0000-0000-0000-000000000103',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   '0003344-21.2021.5.15.0001',
   'Costa vs. Construções Horizonte Ltda. — RO',
   '[{"nome":"Paulo Costa Ribeiro","tipo":"pessoa_fisica"},{"nome":"Horizonte Serviços Gerais ME","tipo":"pessoa_juridica"}]',
   'TRT15', '1ª Vara do Trabalho de Campinas',
   '2021-11-10', 62000.00, 'ativo', 'recurso',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000010'),

  -- Processo encerrado / arquivado definitivamente
  ('a0000000-0000-0000-0000-000000000104',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0007788-33.2020.5.02.0010',
   'Rodrigues vs. Tecnologia Futura — Encerrado',
   '[{"nome":"Silvia Rodrigues","tipo":"pessoa_fisica"}]',
   'TRT2', '10ª Vara do Trabalho de São Paulo',
   '2020-04-02', 28000.00, 'encerrado', 'arquivo_definitivo',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Pessoa física — indenização
  ('a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000022',
   '0056789-12.2024.8.19.0001',
   'Roberto Mendonça vs. Seguradora Sul — Indenização',
   '[{"nome":"Seguradora Sul S.A.","tipo":"pessoa_juridica"}]',
   'TJRJ', '2ª Vara Cível do Rio de Janeiro',
   '2024-01-08', 95000.00, 'ativo', 'conhecimento',
   'a0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010'),

  -- Arquivo temporário
  ('a0000000-0000-0000-0000-000000000106',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   '0001122-55.2019.5.02.0070',
   'Ferreira vs. Horizonte — Acordo Homologado',
   '[{"nome":"Gustavo Ferreira","tipo":"pessoa_fisica"}]',
   'TRT2', '70ª Vara do Trabalho de São Paulo',
   '2019-07-15', 15000.00, 'arquivo_temporario', 'conhecimento',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011'),

  -- Execução provisória
  ('a0000000-0000-0000-0000-000000000107',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   '0004455-67.2023.5.02.0040',
   'Lima vs. Tecnologia Futura — Execução Provisória',
   '[{"nome":"Camila Lima Andrade","tipo":"pessoa_fisica"}]',
   'TRT2', '40ª Vara do Trabalho de São Paulo',
   '2023-02-28', 41000.00, 'ativo', 'execucao_provisoria',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000011');


-- =============================================================================
-- 5. CONTRATOS
-- =============================================================================
INSERT INTO public.contratos (
  id, escritorio_id, cliente_id, titulo, parte, tipo,
  status, data_inicio, data_fim, responsavel_id, created_by
)
VALUES
  ('a0000000-0000-0000-0000-000000000200',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'Contrato de Prestação de Serviços Jurídicos — Tecnologia Futura',
   'Tecnologia Futura S.A.', 'Prestação de Serviços',
   'ativo', '2024-01-01', '2024-12-31',
   'a0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000201',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021',
   'Contrato de Assessoria Trabalhista — Construções Horizonte',
   'Construções Horizonte Ltda.', 'Assessoria',
   'ativo', '2023-06-01', '2025-05-31',
   'a0000000-0000-0000-0000-000000000011',
   'a0000000-0000-0000-0000-000000000010'),

  ('a0000000-0000-0000-0000-000000000202',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000022',
   'Contrato — Ação de Indenização (Roberto Mendonça)',
   'Roberto Alves Mendonça', 'Ad exitum',
   'ativo', '2024-01-08', NULL,
   'a0000000-0000-0000-0000-000000000010',
   'a0000000-0000-0000-0000-000000000010');


-- =============================================================================
-- 6. ATIVIDADES
-- =============================================================================
INSERT INTO public.atividades (
  id, escritorio_id, tipo, titulo, descricao,
  status, prioridade, processo_id, responsavel_id, prazo, criado_por
)
VALUES
  -- Prazo processual urgente (amanhã)
  ('a0000000-0000-0000-0000-000000000300',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Contestação — Alves vs. Tecnologia Futura',
   'Prazo para apresentação de contestação. Processo 0001234-56.2024.5.02.0038',
   'a_fazer', 'urgente',
   'a0000000-0000-0000-0000-000000000100',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '1 day',
   'a0000000-0000-0000-0000-000000000010'),

  -- Audiência próxima semana
  ('a0000000-0000-0000-0000-000000000301',
   'a0000000-0000-0000-0000-000000000001',
   'audiencia', 'Audiência de Instrução — Costa vs. Horizonte',
   '1ª Vara do Trabalho de Campinas. Confirmar presença das testemunhas.',
   'a_fazer', 'alta',
   'a0000000-0000-0000-0000-000000000103',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '7 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Tarefa em andamento
  ('a0000000-0000-0000-0000-000000000302',
   'a0000000-0000-0000-0000-000000000001',
   'tarefa', 'Elaborar minuta de acordo — Santos vs. Tecnologia Futura',
   'Proposta de acordo: R$ 55.000,00 em 3x. Aguardando aprovação do cliente.',
   'em_andamento', 'alta',
   'a0000000-0000-0000-0000-000000000101',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '5 days',
   'a0000000-0000-0000-0000-000000000011'),

  -- Prazo processual — próximos 10 dias
  ('a0000000-0000-0000-0000-000000000303',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Memorial de Alegações Finais — Horizonte vs. Fornecedora ABC',
   'Prazo final para apresentação das alegações finais. Reunir documentos fiscais.',
   'a_fazer', 'alta',
   'a0000000-0000-0000-0000-000000000102',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '10 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Reunião com cliente
  ('a0000000-0000-0000-0000-000000000304',
   'a0000000-0000-0000-0000-000000000001',
   'reuniao', 'Reunião de alinhamento — Tecnologia Futura',
   'Apresentar balanço trimestral dos processos. Confirmar estratégia para 2 execuções pendentes.',
   'a_fazer', 'media',
   NULL,
   'a0000000-0000-0000-0000-000000000010',
   CURRENT_DATE + INTERVAL '3 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Tarefa concluída
  ('a0000000-0000-0000-0000-000000000305',
   'a0000000-0000-0000-0000-000000000001',
   'tarefa', 'Protocolar recursos trabalhistas — lote de maio',
   'Protocolo realizado via PJe. 3 recursos protocolados com sucesso.',
   'concluida', 'alta',
   NULL,
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE - INTERVAL '2 days',
   'a0000000-0000-0000-0000-000000000011'),

  -- Prazo de recurso
  ('a0000000-0000-0000-0000-000000000306',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Prazo para interposição de embargos — Lima vs. Tecnologia Futura',
   'Verificar viabilidade dos embargos de declaração. Decisão recebida em 15/05.',
   'a_fazer', 'urgente',
   'a0000000-0000-0000-0000-000000000107',
   'a0000000-0000-0000-0000-000000000011',
   CURRENT_DATE + INTERVAL '2 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Tarefa de baixa prioridade
  ('a0000000-0000-0000-0000-000000000307',
   'a0000000-0000-0000-0000-000000000001',
   'tarefa', 'Organizar documentos físicos — Processo Rodrigues',
   'Digitalizar e arquivar expedientes do processo encerrado.',
   'a_fazer', 'baixa',
   'a0000000-0000-0000-0000-000000000104',
   'a0000000-0000-0000-0000-000000000012',
   CURRENT_DATE + INTERVAL '30 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Audiência passada (concluída)
  ('a0000000-0000-0000-0000-000000000308',
   'a0000000-0000-0000-0000-000000000001',
   'audiencia', 'Audiência Inicial — Mendonça vs. Seguradora Sul',
   'Audiência realizada. Conciliação frustrada. Prosseguimento com instrução.',
   'concluida', 'alta',
   'a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000010',
   CURRENT_DATE - INTERVAL '15 days',
   'a0000000-0000-0000-0000-000000000010'),

  -- Prazo próximo mês
  ('a0000000-0000-0000-0000-000000000309',
   'a0000000-0000-0000-0000-000000000001',
   'prazo_processual', 'Impugnação ao laudo pericial — Mendonça vs. Seguradora Sul',
   'Prazo de 15 dias após publicação do laudo. Aguardar intimação.',
   'a_fazer', 'media',
   'a0000000-0000-0000-0000-000000000105',
   'a0000000-0000-0000-0000-000000000010',
   CURRENT_DATE + INTERVAL '20 days',
   'a0000000-0000-0000-0000-000000000010');


-- =============================================================================
-- 7. FINANCEIRO
-- =============================================================================
INSERT INTO public.financeiro_lancamentos (
  id, escritorio_id, cliente_id, processo_id, contrato_id,
  tipo, descricao, valor_bruto, data_vencimento, data_pagamento,
  forma_pagamento, status, criado_por
)
VALUES
  -- Honorário pago
  ('a0000000-0000-0000-0000-000000000400',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020', NULL,
   'a0000000-0000-0000-0000-000000000200',
   'honorario', 'Honorários mensais — maio/2026 — Tecnologia Futura',
   8500.00, '2026-05-10', '2026-05-09', 'pix', 'pago',
   'a0000000-0000-0000-0000-000000000010'),

  -- Honorário pendente
  ('a0000000-0000-0000-0000-000000000401',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000021', NULL,
   'a0000000-0000-0000-0000-000000000201',
   'honorario', 'Honorários mensais — maio/2026 — Construções Horizonte',
   6200.00, '2026-05-15', NULL, NULL, 'pendente',
   'a0000000-0000-0000-0000-000000000010'),

  -- Despesa (custas processuais)
  ('a0000000-0000-0000-0000-000000000402',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000101',
   NULL,
   'custas', 'Custas de execução — depósito judicial (Santos vs. Tecnologia Futura)',
   3200.00, '2026-05-20', NULL, NULL, 'pendente',
   'a0000000-0000-0000-0000-000000000011'),

  -- Acordo recebido
  ('a0000000-0000-0000-0000-000000000403',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000104',
   NULL,
   'acordo', 'Acordo homologado — Rodrigues vs. Tecnologia Futura',
   28000.00, '2025-11-30', '2025-11-28', 'transferencia', 'pago',
   'a0000000-0000-0000-0000-000000000011'),

  -- Honorário atrasado
  ('a0000000-0000-0000-0000-000000000404',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000022',
   NULL,
   'a0000000-0000-0000-0000-000000000202',
   'honorario', 'Honorários — Roberto Mendonça (parcela 2/3)',
   4000.00, '2026-04-30', NULL, NULL, 'atrasado',
   'a0000000-0000-0000-0000-000000000010');


-- =============================================================================
-- 8. ANDAMENTOS PROCESSUAIS PUSH (demo do módulo de monitoramento)
-- =============================================================================
INSERT INTO public.andamentos_processuais_push (
  id, escritorio_id, cliente_id, processo_id,
  numero_processo, tribunal, movimento, data_movimento,
  fonte, remetente, assunto_email, corpo_resumo,
  raw_text_hash, status_associacao, criado_em
)
VALUES
  -- Associado — vinculado ao processo TRT2
  ('a0000000-0000-0000-0000-000000000500',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000100',
   '0001234-56.2024.5.02.0038', 'TRT2',
   'Intimação eletrônica',
   '2026-05-19',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 2. UFs 2. (38.12345678)',
   'PROCESSO: 0001234-56.2024.5.02.0038 — INTIMACAO. Fica V. Sa. intimado para tomar ciencia do despacho proferido nos autos. Prazo de 5 dias para manifestacao.',
   'demo_hash_001', 'associado', now() - INTERVAL '1 day'),

  -- Associado — execução
  ('a0000000-0000-0000-0000-000000000501',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000020',
   'a0000000-0000-0000-0000-000000000101',
   '0009821-14.2022.5.02.0301', 'TRT2',
   'Publicação no Diário de Justiça',
   '2026-05-20',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 4. UFs 4. (42.90856571)',
   'PROCESSO: 0009821-14.2022.5.02.0301 — Penhora online realizada via BACENJUD. Saldo bloqueado: R$ 12.450,00. Manifestacao em 5 dias.',
   'demo_hash_002', 'associado', now() - INTERVAL '2 hours'),

  -- Pendente — processo de terceiro capturado por coincidência de nome
  ('a0000000-0000-0000-0000-000000000502',
   'a0000000-0000-0000-0000-000000000001',
   NULL, NULL,
   '0001033-02.2025.5.11.0007', 'TRT11',
   'Intimação eletrônica',
   '2026-05-19',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 4. UFs 4. (42.90856571)',
   'PROCESSO: 0001033-02.2025.5.11.0007 — POLO PASSIVO: FLEX CALL TECNOLOGIA LTDA - ME. Intimacao para apresentar nova minuta de acordo. Processo nao localizado na base do escritorio.',
   'demo_hash_003', 'pendente', now() - INTERVAL '2 hours'),

  -- Pendente — novo processo ainda não cadastrado
  ('a0000000-0000-0000-0000-000000000503',
   'a0000000-0000-0000-0000-000000000001',
   NULL, NULL,
   '0002278-91.2026.5.02.0055', 'TRT2',
   'Publicação no Diário de Justiça',
   '2026-05-21',
   'email', 'liderdiarios@liderdiarios.com.br',
   'Fwd: Public 1. UFs 1. (55.20262278)',
   'PROCESSO: 0002278-91.2026.5.02.0055 — Nova acao distribuida. RECLAMADO: TECNOLOGIA FUTURA S.A. Acao trabalhista rito sumario. Reclamante: Jose Oliveira Neto.',
   'demo_hash_004', 'pendente', now() - INTERVAL '30 minutes');


-- =============================================================================
-- Conclusão
-- =============================================================================
DO $$ BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Seed demo aplicado com sucesso.';
  RAISE NOTICE '';
  RAISE NOTICE 'Acesse com:';
  RAISE NOTICE '  gerente@jurisbpo-demo.com   /  Demo@2026!';
  RAISE NOTICE '  advogado@jurisbpo-demo.com  /  Demo@2026!';
  RAISE NOTICE '  estagiario@jurisbpo-demo.com / Demo@2026!';
  RAISE NOTICE '==============================================';
END $$;
