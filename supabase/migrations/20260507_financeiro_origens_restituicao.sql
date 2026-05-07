-- JurisBPO - Origem dos valores restituidos no financeiro processual

alter table public.financeiro_processos
  add column if not exists valor_restituido_origens text[] not null default '{}';

comment on column public.financeiro_processos.valor_restituido_origens is
  'Origens informadas para o valor restituido/devolvido: deposito_ro, deposito_rr, deposito_embargos ou apolice_seguro_garantia.';

notify pgrst, 'reload schema';
