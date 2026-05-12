-- JurisBPO - Apensamento de processos e fase de execucao provisoria

alter table public.processos
  drop constraint if exists processos_fase_check;

alter table public.processos
  add constraint processos_fase_check
  check (fase in ('conhecimento','recurso','execucao_provisoria','execucao_sentenca','arquivo_definitivo'));

create table if not exists public.processo_apensamentos (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  processo_id uuid not null references public.processos(id) on delete cascade,
  processo_apensado_id uuid not null references public.processos(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint processo_apensamentos_processos_diferentes_check check (processo_id <> processo_apensado_id)
);

create index if not exists idx_processo_apensamentos_escritorio
  on public.processo_apensamentos (escritorio_id);

create index if not exists idx_processo_apensamentos_processo
  on public.processo_apensamentos (processo_id);

create index if not exists idx_processo_apensamentos_apensado
  on public.processo_apensamentos (processo_apensado_id);

create unique index if not exists idx_processo_apensamentos_unico
  on public.processo_apensamentos (
    escritorio_id,
    least(processo_id, processo_apensado_id),
    greatest(processo_id, processo_apensado_id)
  );

alter table public.processo_apensamentos enable row level security;

drop policy if exists processo_apensamentos_select_member on public.processo_apensamentos;
drop policy if exists processo_apensamentos_write_non_visitor on public.processo_apensamentos;

create policy processo_apensamentos_select_member
on public.processo_apensamentos
for select to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

create policy processo_apensamentos_write_non_visitor
on public.processo_apensamentos
for all to authenticated
using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

notify pgrst, 'reload schema';
