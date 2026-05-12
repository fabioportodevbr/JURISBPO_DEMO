-- JurisBPO - Analise de conflitos de interesse no modulo de Compliance

create table if not exists public.compliance_conflito_interesse_analises (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios(id) on delete cascade,
  arquivo_nome text not null,
  arquivo_tipo text,
  arquivo_tamanho_bytes bigint,
  storage_bucket text not null default 'compliance-anexos',
  storage_path text,
  colaborador_nome text,
  colaborador_documento text,
  colaborador_matricula text,
  respostas jsonb not null default '{}'::jsonb,
  nivel_risco text not null check (nivel_risco in ('BAIXO','MEDIO','ALTO')),
  flag text not null check (flag in ('VERDE','AMARELA','VERMELHA')),
  status text not null check (status in ('analisado_sem_conflito','pendente_revisao','alerta_critico')),
  recomendacao text,
  metodo_extracao text,
  confianca_extracao numeric(5,4),
  texto_extraido text,
  atividade_id uuid references public.atividades(id) on delete set null,
  criado_por uuid references auth.users(id),
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_compliance_conflitos_escritorio
  on public.compliance_conflito_interesse_analises (escritorio_id, criado_em desc);

create index if not exists idx_compliance_conflitos_risco
  on public.compliance_conflito_interesse_analises (escritorio_id, nivel_risco, status);

insert into storage.buckets (id, name, public)
values ('compliance-anexos', 'compliance-anexos', false)
on conflict (id) do nothing;

alter table public.compliance_conflito_interesse_analises enable row level security;

drop policy if exists compliance_conflitos_gerente_rls on public.compliance_conflito_interesse_analises;

create policy compliance_conflitos_gerente_rls
on public.compliance_conflito_interesse_analises
for all to authenticated
using (
  exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.usuario_id = auth.uid()
      and ue.escritorio_id = compliance_conflito_interesse_analises.escritorio_id
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
)
with check (
  exists (
    select 1
    from public.usuarios_escritorios ue
    where ue.usuario_id = auth.uid()
      and ue.escritorio_id = compliance_conflito_interesse_analises.escritorio_id
      and ue.ativo = true
      and ue.papel = 'gerente'
  )
);

drop policy if exists compliance_anexos_storage_select on storage.objects;
drop policy if exists compliance_anexos_storage_insert on storage.objects;
drop policy if exists compliance_anexos_storage_update on storage.objects;
drop policy if exists compliance_anexos_storage_delete on storage.objects;

create policy compliance_anexos_storage_select on storage.objects
for select to authenticated
using (bucket_id = 'compliance-anexos' and public.usuario_tem_escritorio_storage(name));

create policy compliance_anexos_storage_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name));

create policy compliance_anexos_storage_update on storage.objects
for update to authenticated
using (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name))
with check (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name));

create policy compliance_anexos_storage_delete on storage.objects
for delete to authenticated
using (bucket_id = 'compliance-anexos' and public.usuario_pode_escrever_storage(name));

notify pgrst, 'reload schema';
