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
