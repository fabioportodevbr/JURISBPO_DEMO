-- Processos: suporte a multiplas reclamadas mantendo compatibilidade com parte_contraria.

alter table public.processos
  add column if not exists partes_contrarias jsonb not null default '[]'::jsonb;

alter table public.processos
  drop constraint if exists processos_partes_contrarias_array_check;

alter table public.processos
  add constraint processos_partes_contrarias_array_check
  check (jsonb_typeof(partes_contrarias) = 'array');

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'processos'
      and column_name = 'parte_contraria_id'
  ) then
    execute $sql$
      update public.processos
      set partes_contrarias = jsonb_build_array(
        jsonb_strip_nulls(
          jsonb_build_object(
            'id', parte_contraria_id,
            'nome', nullif(trim(coalesce(parte_contraria, '')), '')
          )
        )
      )
      where partes_contrarias = '[]'::jsonb
        and (
          parte_contraria_id is not null
          or nullif(trim(coalesce(parte_contraria, '')), '') is not null
        )
    $sql$;
  else
    update public.processos
    set partes_contrarias = jsonb_build_array(
      jsonb_build_object('nome', nullif(trim(coalesce(parte_contraria, '')), ''))
    )
    where partes_contrarias = '[]'::jsonb
      and nullif(trim(coalesce(parte_contraria, '')), '') is not null;
  end if;
end $$;

create index if not exists idx_processos_partes_contrarias
  on public.processos using gin (partes_contrarias);

notify pgrst, 'reload schema';
