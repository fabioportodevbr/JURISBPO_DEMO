-- Acervo: ofícios vinculados a empresas do grupo (partes_crm), ano vigente e arquivamento anual.

alter table public.oficios add column if not exists parte_grupo_id uuid references public.partes_crm(id) on delete cascade;
alter table public.oficios add column if not exists escritorio_id uuid references public.escritorios(id) on delete cascade;
alter table public.oficios add column if not exists controle_arquivado boolean not null default false;

-- Permite gravar só parte_grupo_id (CRM); empresa_id legado (oficios_empresas) fica opcional.
alter table public.oficios alter column empresa_id drop not null;

create index if not exists idx_oficios_parte_esc_ano_arq on public.oficios (parte_grupo_id, escritorio_id, ano, controle_arquivado);

alter table public.oficios_destinatarios add column if not exists parte_grupo_id uuid references public.partes_crm(id) on delete cascade;
alter table public.oficios_destinatarios add column if not exists escritorio_id uuid references public.escritorios(id) on delete cascade;

create index if not exists idx_oficios_dest_parte_esc on public.oficios_destinatarios (parte_grupo_id, escritorio_id);

alter table public.oficios_auditoria add column if not exists parte_grupo_id uuid references public.partes_crm(id) on delete set null;
alter table public.oficios_auditoria add column if not exists escritorio_id uuid references public.escritorios(id) on delete cascade;

create table if not exists public.oficios_controle_ano (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  parte_grupo_id uuid not null references public.partes_crm(id) on delete cascade,
  ano_vigente int not null,
  updated_at timestamptz not null default now(),
  unique (escritorio_id, parte_grupo_id)
);

create index if not exists idx_oficios_controle_ano_esc on public.oficios_controle_ano (escritorio_id);

alter table public.oficios_controle_ano enable row level security;

drop policy if exists oficios_controle_ano_select on public.oficios_controle_ano;
create policy oficios_controle_ano_select on public.oficios_controle_ano
for select to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists oficios_controle_ano_write on public.oficios_controle_ano;
create policy oficios_controle_ano_write on public.oficios_controle_ano
for all to authenticated
using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

-- Gatilho visitante só em oficios_controle_ano (sempre tem escritorio_id).
-- Tabelas oficios / oficios_destinatarios podem ter linhas legadas sem escritorio_id.

do $$
begin
  if to_regclass('public.oficios_controle_ano') is not null then
    drop trigger if exists trg_bloquear_visitante_escrita on public.oficios_controle_ano;
    create trigger trg_bloquear_visitante_escrita
      before insert or update or delete on public.oficios_controle_ano
      for each row execute function public.bloquear_visitante_escrita();
  end if;
end $$;
