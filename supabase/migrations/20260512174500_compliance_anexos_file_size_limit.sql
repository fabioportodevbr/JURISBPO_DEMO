-- Aumenta o limite de upload do bucket usado pelos anexos de Compliance.
-- Formularios de conflito de interesse escaneados costumam passar de 10 MB.

insert into storage.buckets as b (id, name, public, file_size_limit)
values ('compliance-anexos', 'compliance-anexos', false, 52428800)
on conflict (id) do update
set file_size_limit = greatest(coalesce(b.file_size_limit, 0), excluded.file_size_limit);

notify pgrst, 'reload schema';
