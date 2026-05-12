-- JurisBPO - Configuracao do push processual e arquivo de desconsideracoes

create table if not exists public.push_email_config (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null unique references public.escritorios(id) on delete cascade,
  imap_host text not null default 'imap.gmail.com',
  imap_port integer not null default 993,
  imap_secure boolean not null default true,
  imap_user text not null default 'juridicocallbrbpo@gmail.com',
  imap_mailbox text not null default 'INBOX',
  enabled boolean not null default true,
  updated_by uuid null,
  updated_by_nome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_email_config_escritorio
  on public.push_email_config(escritorio_id);

create or replace function public.touch_push_email_config_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_push_email_config_updated_at on public.push_email_config;
create trigger trg_push_email_config_updated_at
before update on public.push_email_config
for each row execute function public.touch_push_email_config_updated_at();

alter table public.push_email_config enable row level security;

drop policy if exists push_email_config_select_member on public.push_email_config;
create policy push_email_config_select_member
on public.push_email_config
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists push_email_config_write_gerente on public.push_email_config;
create policy push_email_config_write_gerente
on public.push_email_config
for all
to authenticated
using (
  exists (
    select 1 from public.usuarios_escritorios ue
    where ue.escritorio_id = push_email_config.escritorio_id
      and ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
)
with check (
  exists (
    select 1 from public.usuarios_escritorios ue
    where ue.escritorio_id = push_email_config.escritorio_id
      and ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
);

create table if not exists public.andamentos_processuais_push_arquivo (
  id uuid primary key default gen_random_uuid(),
  andamento_id uuid not null references public.andamentos_processuais_push(id) on delete cascade,
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  usuario_id uuid null,
  usuario_nome text null,
  arquivado_em timestamptz not null default now(),
  motivo text null,
  snapshot jsonb not null default '{}'::jsonb
);

create index if not exists idx_andamentos_push_arquivo_escritorio
  on public.andamentos_processuais_push_arquivo(escritorio_id, arquivado_em desc);

create index if not exists idx_andamentos_push_arquivo_andamento
  on public.andamentos_processuais_push_arquivo(andamento_id);

create or replace function public.cleanup_old_andamentos_push_arquivo()
returns trigger as $$
begin
  delete from public.andamentos_processuais_push_arquivo
  where arquivado_em < now() - interval '30 days';
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_cleanup_old_andamentos_push_arquivo on public.andamentos_processuais_push_arquivo;
create trigger trg_cleanup_old_andamentos_push_arquivo
after insert on public.andamentos_processuais_push_arquivo
for each statement execute function public.cleanup_old_andamentos_push_arquivo();

alter table public.andamentos_processuais_push_arquivo enable row level security;

drop policy if exists andamentos_push_arquivo_select_member on public.andamentos_processuais_push_arquivo;
create policy andamentos_push_arquivo_select_member
on public.andamentos_processuais_push_arquivo
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists andamentos_push_arquivo_insert_member on public.andamentos_processuais_push_arquivo;
create policy andamentos_push_arquivo_insert_member
on public.andamentos_processuais_push_arquivo
for insert
to authenticated
with check (public.usuario_tem_escritorio(escritorio_id));

insert into public.andamentos_processuais_push_arquivo (
  andamento_id,
  escritorio_id,
  usuario_id,
  usuario_nome,
  arquivado_em,
  motivo,
  snapshot
)
select
  p.id,
  p.escritorio_id,
  null,
  'Registro legado',
  coalesce(p.ignorado_em, p.atualizado_em, p.criado_em),
  coalesce(p.motivo_ignorado, 'Desconsiderado antes da criação do arquivo próprio.'),
  to_jsonb(p)
from public.andamentos_processuais_push p
where p.status_associacao = 'ignorado'
  and p.escritorio_id is not null
  and not exists (
    select 1
    from public.andamentos_processuais_push_arquivo a
    where a.andamento_id = p.id
  );

delete from public.andamentos_processuais_push_arquivo
where arquivado_em < now() - interval '30 days';
