-- JurisBPO - Seção Financeiro
-- Migration: financeiro_lancamentos com RLS por escritorio_id

create table if not exists public.financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null,
  cliente_id uuid null,
  processo_id uuid null,
  contrato_id uuid null,
  criado_por uuid null references auth.users(id) on delete set null,

  tipo text not null check (
    tipo in ('receita', 'despesa', 'honorario', 'acordo', 'custas', 'reembolso', 'outro')
  ),

  categoria text,
  descricao text not null,

  valor_bruto numeric(14,2) not null default 0,
  valor_liquido numeric(14,2),

  data_vencimento date,
  data_pagamento date,

  forma_pagamento text check (
    forma_pagamento is null or forma_pagamento in ('pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'outro')
  ),

  status text not null default 'pendente' check (
    status in ('pendente', 'pago', 'atrasado', 'cancelado', 'parcial')
  ),

  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financeiro_lancamentos_escritorio_id
  on public.financeiro_lancamentos (escritorio_id);

create index if not exists idx_financeiro_lancamentos_cliente_id
  on public.financeiro_lancamentos (cliente_id);

create index if not exists idx_financeiro_lancamentos_processo_id
  on public.financeiro_lancamentos (processo_id);

create index if not exists idx_financeiro_lancamentos_status
  on public.financeiro_lancamentos (status);

create index if not exists idx_financeiro_lancamentos_tipo
  on public.financeiro_lancamentos (tipo);

create index if not exists idx_financeiro_lancamentos_vencimento
  on public.financeiro_lancamentos (data_vencimento);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_financeiro_lancamentos_updated_at on public.financeiro_lancamentos;
create trigger trg_financeiro_lancamentos_updated_at
before update on public.financeiro_lancamentos
for each row execute function public.set_updated_at();

alter table public.financeiro_lancamentos enable row level security;

-- Remove policies antigas com os mesmos nomes, caso a migration seja reaplicada.
drop policy if exists financeiro_select_mesmo_escritorio on public.financeiro_lancamentos;
drop policy if exists financeiro_insert_mesmo_escritorio on public.financeiro_lancamentos;
drop policy if exists financeiro_update_mesmo_escritorio on public.financeiro_lancamentos;
drop policy if exists financeiro_delete_mesmo_escritorio on public.financeiro_lancamentos;

-- ATENCAO:
-- As policies abaixo assumem que public.profiles possui:
--   id = auth.users.id
--   escritorio_id = uuid do escritorio do usuario
-- Se no seu schema o campo do usuario tiver outro nome, ajuste p.id = auth.uid().

create policy financeiro_select_mesmo_escritorio
on public.financeiro_lancamentos
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

create policy financeiro_insert_mesmo_escritorio
on public.financeiro_lancamentos
for insert
to authenticated
with check (public.usuario_pode_escrever(escritorio_id));

create policy financeiro_update_mesmo_escritorio
on public.financeiro_lancamentos
for update
to authenticated
using  (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

create policy financeiro_delete_mesmo_escritorio
on public.financeiro_lancamentos
for delete
to authenticated
using (public.usuario_pode_escrever(escritorio_id));

-- View opcional para resumos por escritorio.
create or replace view public.financeiro_resumo_escritorio as
select
  escritorio_id,
  coalesce(sum(case when tipo in ('receita', 'honorario', 'acordo', 'reembolso') and status in ('pendente', 'parcial', 'atrasado') then valor_bruto else 0 end), 0) as receita_prevista,
  coalesce(sum(case when tipo in ('receita', 'honorario', 'acordo', 'reembolso') and status = 'pago' then coalesce(valor_liquido, valor_bruto) else 0 end), 0) as receita_recebida,
  coalesce(sum(case when status in ('pendente', 'parcial', 'atrasado') then valor_bruto else 0 end), 0) as valores_pendentes,
  coalesce(sum(case when tipo in ('despesa', 'custas') then valor_bruto else 0 end), 0) as despesas,
  coalesce(sum(case when tipo = 'acordo' and status in ('pendente', 'parcial', 'atrasado') then valor_bruto else 0 end), 0) as acordos_em_aberto,
  coalesce(sum(case when tipo in ('receita', 'honorario', 'acordo', 'reembolso') and status = 'pago' then coalesce(valor_liquido, valor_bruto) else 0 end), 0)
  - coalesce(sum(case when tipo in ('despesa', 'custas') and status = 'pago' then coalesce(valor_liquido, valor_bruto) else 0 end), 0) as saldo_periodo
from public.financeiro_lancamentos
group by escritorio_id;
