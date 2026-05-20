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
