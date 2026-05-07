-- JurisBPO - Anexos na aba Modelos do Acervo

alter table if exists public.modelos
  add column if not exists arquivo_url text,
  add column if not exists storage_bucket text default 'modelos',
  add column if not exists storage_path text,
  add column if not exists escritorio_id uuid,
  add column if not exists created_by uuid,
  add column if not exists updated_at timestamptz default now();

notify pgrst, 'reload schema';
