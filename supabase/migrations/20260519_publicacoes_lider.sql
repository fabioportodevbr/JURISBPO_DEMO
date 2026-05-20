-- JurisBPO - Publicações do Diário da Justiça via WebService Lider
-- Seguro para aplicar sobre banco existente.

create table if not exists public.publicacoes_lider (
  id                     uuid        primary key default gen_random_uuid(),

  -- chave única fornecida pelo WS Lider (deduplicação + setPublicacoes)
  cod_publicacao         bigint      not null unique,

  -- vínculo com entidades do sistema
  escritorio_id          uuid        null references public.escritorios(id) on delete set null,
  cliente_id             uuid        null references public.clientes(id) on delete set null,
  processo_id            uuid        null references public.processos(id) on delete set null,
  status_associacao      text        not null default 'pendente'
                                     check (status_associacao in ('associado','pendente')),

  -- campos do objeto publicacao v5
  ano_publicacao         int         null,
  edicao_diario          int         null,
  descricao_diario       text        null,
  pagina_inicial         int         null,
  pagina_final           int         null,
  data_publicacao        date        null,
  data_divulgacao        date        null,
  data_cadastro_lider    timestamptz null,
  numero_processo        text        null,
  uf_publicacao          text        null,
  cidade_publicacao      text        null,
  orgao_descricao        text        null,
  vara_descricao         text        null,
  despacho_publicacao    text        null,
  processo_publicacao    text        null,
  publicacao_corrigida   int         not null default 0,
  cod_vinculo            int         null,
  nome_vinculo           text        null,
  oab_numero             int         null,
  oab_estado             text        null,
  identificacao_cadastro text        null,
  cod_integracao         text        null,
  natureza               text        null,
  complemento1           text        null,
  orgao_descricao_comp   text        null,
  diario_sigla_wj        text        null,
  publicacao_exportada   int         not null default 0,
  cod_grupo              int         null,
  anexo                  text        null,

  -- controle de exportação no WS Lider
  marcado_exportado_em   timestamptz null,

  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

create index if not exists idx_publicacoes_lider_processo_id
  on public.publicacoes_lider(processo_id);
create index if not exists idx_publicacoes_lider_numero
  on public.publicacoes_lider(numero_processo);
create index if not exists idx_publicacoes_lider_escritorio
  on public.publicacoes_lider(escritorio_id);
create index if not exists idx_publicacoes_lider_data
  on public.publicacoes_lider(data_publicacao desc, criado_em desc);

create or replace function public.touch_publicacoes_lider_updated_at()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_publicacoes_lider_updated_at on public.publicacoes_lider;
create trigger trg_publicacoes_lider_updated_at
before update on public.publicacoes_lider
for each row execute function public.touch_publicacoes_lider_updated_at();

alter table public.publicacoes_lider enable row level security;

drop policy if exists publicacoes_lider_select_member on public.publicacoes_lider;
create policy publicacoes_lider_select_member
  on public.publicacoes_lider for select
  to authenticated
  using (public.usuario_tem_escritorio(escritorio_id));

-- Inserts/updates feitos pelo worker com SUPABASE_SERVICE_ROLE_KEY.
-- Sem policy de insert/update pública para evitar manipulação no frontend.
