-- JurisBPO - Honorarios e custos no financeiro processual

alter table public.financeiro_processos
  add column if not exists honorarios_e_custos numeric(14,2) not null default 0;

comment on column public.financeiro_processos.honorarios_e_custos is
  'Honorarios e custos vinculados ao registro financeiro do processo.';

notify pgrst, 'reload schema';
