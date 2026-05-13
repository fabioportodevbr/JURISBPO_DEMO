-- JurisBPO - explicit Data API grants for Supabase 2026 opt-in behavior.
-- Supabase will stop auto-exposing new public schema objects to the Data API.
-- RLS remains responsible for row-level access; these grants only allow the
-- authenticated/service_role roles to reach the intended objects.

grant usage on schema public to authenticated, service_role;

do $$
declare
  obj_name text;
  proc_sig text;
  api_tables text[] := array[
    'acervo_modelos',
    'andamentos_processuais_push',
    'andamentos_processuais_push_arquivo',
    'atividade_atribuicoes',
    'atividade_historico',
    'atividades',
    'chat_mensagens',
    'chat_salas',
    'clientes',
    'compliance_anexos',
    'compliance_config',
    'compliance_conflito_interesse_analises',
    'compliance_denuncias',
    'compliance_mensagens',
    'contratos',
    'documentos',
    'escritorios',
    'financeiro_lancamentos',
    'financeiro_processos',
    'google_calendar_config',
    'mensagens',
    'mensagens_anexos',
    'modelos_documentos',
    'mural_recados',
    'notificacoes',
    'oficios',
    'oficios_anexos',
    'oficios_auditoria',
    'oficios_controle_ano',
    'oficios_controle_log',
    'oficios_destinatarios',
    'oficios_empresas',
    'partes_crm',
    'processo_apensamentos',
    'processos',
    'profiles',
    'push_email_config',
    'rotinas',
    'tarefas',
    'usuarios_escritorios'
  ];
  api_views text[] := array[
    'financeiro_resumo_escritorio'
  ];
  api_routines text[] := array[
    'marcar_chat_lido',
    'usuario_eh_gerente',
    'usuario_pode_editar_proprio_profile',
    'usuario_pode_escrever',
    'usuario_pode_escrever_storage',
    'usuario_tem_escritorio',
    'usuario_tem_escritorio_storage'
  ];
begin
  foreach obj_name in array api_tables loop
    if to_regclass(format('public.%I', obj_name)) is not null then
      execute format(
        'grant select, insert, update, delete on table public.%I to authenticated, service_role',
        obj_name
      );
    end if;
  end loop;

  foreach obj_name in array api_views loop
    if to_regclass(format('public.%I', obj_name)) is not null then
      execute format(
        'grant select on table public.%I to authenticated, service_role',
        obj_name
      );
    end if;
  end loop;

  for proc_sig in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(api_routines)
  loop
    execute format(
      'grant execute on function %s to authenticated, service_role',
      proc_sig
    );
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated, service_role;

notify pgrst, 'reload schema';
