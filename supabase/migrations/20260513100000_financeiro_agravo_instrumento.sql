-- JurisBPO - Agravo de instrumento no financeiro processual

alter table public.financeiro_processos
  add column if not exists agravo_instrumento numeric(14,2) not null default 0;

comment on column public.financeiro_processos.agravo_instrumento is
  'Valor vinculado a agravo de instrumento no registro financeiro do processo.';

comment on column public.financeiro_processos.valor_restituido_origens is
  'Origens informadas para o valor restituido/devolvido: deposito_ro, deposito_rr, deposito_embargos, agravo_instrumento ou apolice_seguro_garantia.';

notify pgrst, 'reload schema';
