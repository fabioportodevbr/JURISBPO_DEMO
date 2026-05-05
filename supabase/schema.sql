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
DROP TABLE IF EXISTS public.documentos CASCADE;
DROP TABLE IF EXISTS public.atividade_atribuicoes CASCADE;
DROP TABLE IF EXISTS public.atividades CASCADE;
DROP TABLE IF EXISTS public.contratos CASCADE;
DROP TABLE IF EXISTS public.processos CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
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
  CONSTRAINT usuarios_escritorios_papel_check CHECK (papel IN ('gerente','advogado','assistente','cliente'))
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
  tribunal TEXT,
  orgao TEXT,
  data_ajuizamento DATE,
  valor_acao NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'ativo',
  fase TEXT NOT NULL DEFAULT 'conhecimento',
  responsavel_id UUID REFERENCES auth.users(id),
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT processos_status_check CHECK (status IN ('ativo','arquivo_temporario','encerrado')),
  CONSTRAINT processos_fase_check CHECK (fase IN ('conhecimento','recurso','execucao_sentenca','arquivo_definitivo')),
  CONSTRAINT processos_encerrado_fase_check CHECK (status <> 'encerrado' OR fase = 'arquivo_definitivo')
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
CREATE INDEX idx_contratos_escritorio ON public.contratos(escritorio_id);
CREATE INDEX idx_atividades_escritorio ON public.atividades(escritorio_id);
CREATE INDEX idx_atividades_tipo ON public.atividades(tipo);
CREATE INDEX idx_atividades_prazo ON public.atividades(prazo);
CREATE INDEX idx_atividades_processo ON public.atividades(processo_id);
CREATE INDEX idx_atividades_contrato ON public.atividades(contrato_id);
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
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividade_atribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modelos_documentos ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
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
CREATE POLICY clientes_all_member ON public.clientes
FOR ALL TO authenticated USING (public.usuario_tem_escritorio(escritorio_id)) WITH CHECK (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY processos_all_member ON public.processos
FOR ALL TO authenticated USING (public.usuario_tem_escritorio(escritorio_id)) WITH CHECK (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY contratos_all_member ON public.contratos
FOR ALL TO authenticated USING (public.usuario_tem_escritorio(escritorio_id)) WITH CHECK (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY atividades_all_member ON public.atividades
FOR ALL TO authenticated USING (public.usuario_tem_escritorio(escritorio_id)) WITH CHECK (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY documentos_all_member ON public.documentos
FOR ALL TO authenticated USING (public.usuario_tem_escritorio(escritorio_id)) WITH CHECK (public.usuario_tem_escritorio(escritorio_id));
CREATE POLICY modelos_documentos_all_member ON public.modelos_documentos
FOR ALL TO authenticated USING (public.usuario_tem_escritorio(escritorio_id)) WITH CHECK (public.usuario_tem_escritorio(escritorio_id));

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
    WHERE a.id = atividade_id AND public.usuario_tem_escritorio(a.escritorio_id)
  )
);

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

DROP POLICY IF EXISTS documentos_storage_select ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_update ON storage.objects;
DROP POLICY IF EXISTS documentos_storage_delete ON storage.objects;

CREATE POLICY documentos_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id IN ('documentos','modelos'));

CREATE POLICY documentos_storage_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('documentos','modelos'));

CREATE POLICY documentos_storage_update ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id IN ('documentos','modelos'))
WITH CHECK (bucket_id IN ('documentos','modelos'));

CREATE POLICY documentos_storage_delete ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id IN ('documentos','modelos'));

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
