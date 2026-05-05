-- JurisBPO - Patch do módulo PUSH processual
-- Adiciona armazenamento do corpo completo do e-mail recebido.
-- Seguro para rodar mais de uma vez.

alter table public.andamentos_processuais_push
add column if not exists corpo_email text;

comment on column public.andamentos_processuais_push.corpo_email is
'Corpo completo do e-mail processual recebido pelo worker IMAP/Gmail. Usado para exibição expandida no JurisBPO.';
