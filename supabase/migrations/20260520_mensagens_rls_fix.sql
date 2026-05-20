-- Remove política que bloqueia TODOS os usuários (inclusive gerentes)
-- de inserir mensagens. A política mensagens_insert (criada em
-- 20260520_mensagens_rls.sql) já cuida corretamente de quem pode inserir.
DROP POLICY IF EXISTS visitante_no_insert_mensagens ON public.mensagens;
DROP POLICY IF EXISTS "visitante_no_insert_mensagens" ON public.mensagens;
