-- JurisBPO - Historico de arquivamento/conclusao de atividades

alter table public.atividade_atribuicoes
  add column if not exists tipo_evento text not null default 'atribuicao',
  add column if not exists motivo text;

comment on column public.atividade_atribuicoes.tipo_evento is
  'Tipo do evento registrado no historico da atividade: atribuicao, redistribuicao, aceite, devolucao, arquivamento, conclusao_arquivamento ou reabertura.';

comment on column public.atividade_atribuicoes.motivo is
  'Motivo ou detalhe complementar do evento registrado.';

notify pgrst, 'reload schema';
