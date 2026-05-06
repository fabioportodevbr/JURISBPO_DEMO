-- Perfil visitante: acesso de leitura com bloqueio de escrita no banco.

alter table public.usuarios_escritorios
drop constraint if exists usuarios_escritorios_papel_check;

alter table public.usuarios_escritorios
add constraint usuarios_escritorios_papel_check
check (papel in ('gerente','advogado','assistente','cliente','visitante'));

create or replace function public.usuario_pode_escrever(p_escritorio_id uuid)
returns boolean as $$
  select exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.escritorio_id = p_escritorio_id
      and ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel <> 'visitante'
  );
$$ language sql security definer stable;

create or replace function public.usuario_pode_editar_proprio_profile()
returns boolean as $$
  select exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.papel <> 'visitante'
  );
$$ language sql security definer stable;

create or replace function public.usuario_tem_escritorio_storage(p_name text)
returns boolean as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.usuario_tem_escritorio(split_part(p_name, '/', 1)::uuid)
    else false
  end;
$$ language sql security definer stable;

create or replace function public.usuario_pode_escrever_storage(p_name text)
returns boolean as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.usuario_pode_escrever(split_part(p_name, '/', 1)::uuid)
    else false
  end;
$$ language sql security definer stable;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = auth.uid() and public.usuario_pode_editar_proprio_profile())
with check (id = auth.uid() and public.usuario_pode_editar_proprio_profile());

drop policy if exists clientes_all_member on public.clientes;
drop policy if exists clientes_select_member on public.clientes;
drop policy if exists clientes_write_non_visitor on public.clientes;
create policy clientes_select_member on public.clientes
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy clientes_write_non_visitor on public.clientes
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists processos_all_member on public.processos;
drop policy if exists processos_select_member on public.processos;
drop policy if exists processos_write_non_visitor on public.processos;
create policy processos_select_member on public.processos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy processos_write_non_visitor on public.processos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists contratos_all_member on public.contratos;
drop policy if exists contratos_select_member on public.contratos;
drop policy if exists contratos_write_non_visitor on public.contratos;
create policy contratos_select_member on public.contratos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy contratos_write_non_visitor on public.contratos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists atividades_all_member on public.atividades;
drop policy if exists atividades_select_member on public.atividades;
drop policy if exists atividades_write_non_visitor on public.atividades;
create policy atividades_select_member on public.atividades
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy atividades_write_non_visitor on public.atividades
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists documentos_all_member on public.documentos;
drop policy if exists documentos_select_member on public.documentos;
drop policy if exists documentos_write_non_visitor on public.documentos;
create policy documentos_select_member on public.documentos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy documentos_write_non_visitor on public.documentos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists modelos_documentos_all_member on public.modelos_documentos;
drop policy if exists modelos_documentos_select_member on public.modelos_documentos;
drop policy if exists modelos_documentos_write_non_visitor on public.modelos_documentos;
create policy modelos_documentos_select_member on public.modelos_documentos
for select to authenticated using (public.usuario_tem_escritorio(escritorio_id));
create policy modelos_documentos_write_non_visitor on public.modelos_documentos
for all to authenticated using (public.usuario_pode_escrever(escritorio_id))
with check (public.usuario_pode_escrever(escritorio_id));

drop policy if exists atividade_atribuicoes_insert_member on public.atividade_atribuicoes;
create policy atividade_atribuicoes_insert_member on public.atividade_atribuicoes
for insert to authenticated
with check (
  exists (
    select 1 from public.atividades a
    where a.id = atividade_id and public.usuario_pode_escrever(a.escritorio_id)
  )
);

create or replace function public.bloquear_visitante_escrita()
returns trigger as $$
declare
  v_escritorio_id uuid;
begin
  if current_setting('role', true) = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_escritorio_id := old.escritorio_id;
  else
    v_escritorio_id := new.escritorio_id;
  end if;

  if v_escritorio_id is null or not public.usuario_pode_escrever(v_escritorio_id) then
    raise exception 'Visitante possui acesso somente leitura.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$ language plpgsql security definer;

do $$
declare
  t text;
  tables text[] := array[
    'clientes',
    'processos',
    'contratos',
    'atividades',
    'documentos',
    'modelos_documentos',
    'partes_crm',
    'financeiro_processos',
    'financeiro_lancamentos',
    'acervo_modelos',
    'andamentos_processuais_push',
    'notificacoes',
    'mensagens',
    'mensagens_anexos'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'escritorio_id'
    ) then
      execute format('drop trigger if exists trg_bloquear_visitante_escrita on public.%I', t);
      execute format(
        'create trigger trg_bloquear_visitante_escrita before insert or update or delete on public.%I for each row execute function public.bloquear_visitante_escrita()',
        t
      );
    end if;
  end loop;
end $$;

drop policy if exists documentos_storage_select on storage.objects;
drop policy if exists documentos_storage_insert on storage.objects;
drop policy if exists documentos_storage_update on storage.objects;
drop policy if exists documentos_storage_delete on storage.objects;

create policy documentos_storage_select on storage.objects
for select to authenticated
using (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_tem_escritorio_storage(name));

create policy documentos_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name));

create policy documentos_storage_update on storage.objects
for update to authenticated
using (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name))
with check (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name));

create policy documentos_storage_delete on storage.objects
for delete to authenticated
using (bucket_id in ('documentos','modelos','mensagens','avatars') and public.usuario_pode_escrever_storage(name));

notify pgrst, 'reload schema';
