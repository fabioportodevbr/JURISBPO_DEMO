-- JurisBPO - Valores restituidos no financeiro processual
-- Valores como depositos recursais devolvidos devem abater o valor efetivamente gasto.

alter table public.financeiro_processos
  add column if not exists valor_restituido numeric(14,2) not null default 0;

comment on column public.financeiro_processos.valor_restituido is
  'Valor restituido/devolvido no processo, usado para abater o valor efetivamente gasto.';

notify pgrst, 'reload schema';
