-- JurisBPO - Acompanhamento processual via push por e-mail
-- Seguro para aplicar sobre banco existente: cria apenas a tabela nova, indices e policies do módulo.

create table if not exists public.andamentos_processuais_push (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid null references public.escritorios(id) on delete cascade,
  cliente_id uuid null references public.clientes(id) on delete set null,
  processo_id uuid null references public.processos(id) on delete cascade,
  numero_processo text null,
  tribunal text null,
  movimento text not null,
  data_movimento date null,
  fonte text not null default 'email',
  remetente text null,
  assunto_email text null,
  corpo_resumo text null,
  url_origem text null,
  raw_text_hash text not null unique,
  status_associacao text not null default 'pendente' check (status_associacao in ('associado','pendente')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_andamentos_push_processo_id on public.andamentos_processuais_push(processo_id);
create index if not exists idx_andamentos_push_numero on public.andamentos_processuais_push(numero_processo);
create index if not exists idx_andamentos_push_escritorio on public.andamentos_processuais_push(escritorio_id);
create index if not exists idx_andamentos_push_data on public.andamentos_processuais_push(data_movimento desc, criado_em desc);

create or replace function public.touch_andamentos_push_updated_at()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_andamentos_push_updated_at on public.andamentos_processuais_push;
create trigger trg_andamentos_push_updated_at
before update on public.andamentos_processuais_push
for each row execute function public.touch_andamentos_push_updated_at();

alter table public.andamentos_processuais_push enable row level security;

drop policy if exists andamentos_push_select_member on public.andamentos_processuais_push;
create policy andamentos_push_select_member
on public.andamentos_processuais_push
for select
to authenticated
using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists andamentos_push_update_member on public.andamentos_processuais_push;
create policy andamentos_push_update_member
on public.andamentos_processuais_push
for update
to authenticated
using (public.usuario_tem_escritorio(escritorio_id))
with check (public.usuario_tem_escritorio(escritorio_id));

-- Inserts do monitor de e-mail devem ser feitos pelo worker com SUPABASE_SERVICE_ROLE_KEY.
-- Não há policy de insert pública para evitar que usuários criem andamentos falsos no frontend.
