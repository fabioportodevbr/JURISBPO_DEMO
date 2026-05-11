-- Tabela de log de controle anual de ofícios (arquivamento / reabertura)
-- e trigger que impede arquivar o ano em curso.

-- ── 1. Tabela de log ──────────────────────────────────────────────────────
create table if not exists public.oficios_controle_log (
  id              uuid primary key default gen_random_uuid(),
  escritorio_id   uuid not null references public.escritorios(id) on delete cascade,
  parte_grupo_id  uuid references public.partes_crm(id) on delete set null,
  oficio_id       uuid references public.oficios(id) on delete set null,
  ano             int,
  acao            text not null,   -- 'controle_arquivado' | 'controle_desarquivado'
  usuario_id      uuid,
  usuario_nome    text,
  criado_em       timestamptz not null default now(),
  detalhes        jsonb
);

create index if not exists idx_ocl_esc_ts    on public.oficios_controle_log (escritorio_id, criado_em desc);
create index if not exists idx_ocl_parte_ano on public.oficios_controle_log (parte_grupo_id, ano, criado_em desc);

alter table public.oficios_controle_log enable row level security;

drop policy if exists oficios_controle_log_select on public.oficios_controle_log;
create policy oficios_controle_log_select on public.oficios_controle_log
  for select to authenticated
  using (public.usuario_tem_escritorio(escritorio_id));

drop policy if exists oficios_controle_log_insert on public.oficios_controle_log;
create policy oficios_controle_log_insert on public.oficios_controle_log
  for insert to authenticated
  with check (public.usuario_pode_escrever(escritorio_id));

-- ── 2. Trigger: impede arquivar o ano em curso ────────────────────────────
-- Um ofício do ano X só pode ter controle_arquivado = true
-- a partir de 1º de janeiro de X+1.
create or replace function public.validar_arquivamento_oficio()
returns trigger language plpgsql as $$
begin
  if new.controle_arquivado = true
     and (old.controle_arquivado is null or old.controle_arquivado = false)
  then
    if new.ano is not null and new.ano >= extract(year from current_date)::int then
      raise exception
        'O controle de ofícios de % só pode ser arquivado a partir de 1º de janeiro de %. Tente novamente após esta data.',
        new.ano, (new.ano + 1);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_arquivamento_oficio on public.oficios;
create trigger trg_validar_arquivamento_oficio
  before update on public.oficios
  for each row execute function public.validar_arquivamento_oficio();
