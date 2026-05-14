-- Repara colunas esperadas pelo app em producao.
-- Idempotente: pode ser executada mais de uma vez sem perda de dados.

alter table public.processos
  add column if not exists partes_contrarias jsonb not null default '[]'::jsonb;

alter table public.processos
  drop constraint if exists processos_partes_contrarias_array_check;

alter table public.processos
  add constraint processos_partes_contrarias_array_check
  check (jsonb_typeof(partes_contrarias) = 'array');

update public.processos p
set partes_contrarias = jsonb_build_array(
  jsonb_strip_nulls(jsonb_build_object(
    'id', p.parte_contraria_id,
    'nome', p.parte_contraria
  ))
)
where p.partes_contrarias = '[]'::jsonb
  and nullif(trim(coalesce(p.parte_contraria, '')), '') is not null;

create index if not exists idx_processos_partes_contrarias
  on public.processos using gin (partes_contrarias);

alter table public.financeiro_processos
  add column if not exists agravo_instrumento numeric(14,2) not null default 0;

comment on column public.financeiro_processos.agravo_instrumento is
  'Valor de agravo de instrumento registrado no financeiro do processo.';

comment on column public.financeiro_processos.valor_restituido_origens is
  'Origens informadas para o valor restituido/devolvido: deposito_ro, deposito_rr, deposito_embargos, agravo_instrumento ou apolice_seguro_garantia.';

notify pgrst, 'reload schema';
