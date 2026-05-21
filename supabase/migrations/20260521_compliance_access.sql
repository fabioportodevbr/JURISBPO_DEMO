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
