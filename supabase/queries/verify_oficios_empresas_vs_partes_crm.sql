-- Diagnóstico: oficios_empresas vs Partes/CRM (empresa do grupo, ativo).
-- Rode no SQL Editor do Supabase (não é migration automática).
--
-- Mesma lógica do backfill em 20260511_backfill_oficios_parte_grupo.sql:
--   igualdade em lower(trim) com nome ou nome_fantasia
--   OU igualdade só em caracteres alfanuméricos

WITH crm_grupo AS (
  SELECT
    id,
    escritorio_id,
    nome,
    nome_fantasia,
    regexp_replace(lower(trim(nome)), '[^a-z0-9]', '', 'g') AS nome_compact,
    regexp_replace(lower(trim(coalesce(nome_fantasia, ''))), '[^a-z0-9]', '', 'g') AS fant_compact
  FROM public.partes_crm
  WHERE tipo = 'empresa_grupo'
    AND status = 'ativo'
),
legacy AS (
  SELECT
    oe.id,
    oe.nome,
    regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g') AS nome_compact
  FROM public.oficios_empresas oe
),
pareamento AS (
  SELECT
    l.id AS legacy_id,
    l.nome AS nome_legacy,
    c.id AS parte_grupo_id,
    c.nome AS crm_nome,
    c.nome_fantasia AS crm_fantasia,
    c.escritorio_id
  FROM legacy l
  INNER JOIN crm_grupo c
    ON (
      lower(trim(l.nome)) IN (lower(trim(c.nome)), lower(trim(coalesce(c.nome_fantasia, ''))))
      OR (
        l.nome_compact <> ''
        AND l.nome_compact IN (c.nome_compact, c.fant_compact)
      )
    )
),
por_legacy AS (
  SELECT legacy_id, nome_legacy, count(*) AS qtd_crm_matches
  FROM pareamento
  GROUP BY legacy_id, nome_legacy
)

-- 1) Empresas em oficios_empresas SEM nenhuma empresa do grupo correspondente no CRM
SELECT
  'SEM_MATCH_NO_CRM' AS situacao,
  l.id AS oficios_empresas_id,
  l.nome AS nome_em_oficios_empresas,
  (SELECT count(*)::bigint FROM public.oficios o WHERE o.empresa_id = l.id) AS qtd_oficios_vinculados
FROM legacy l
WHERE NOT EXISTS (
  SELECT 1 FROM pareamento p WHERE p.legacy_id = l.id
)
ORDER BY nome_em_oficios_empresas;

-- 2) Empresas legadas com MAIS DE UM candidato no CRM (ambiguidade no DISTINCT ON do backfill)
SELECT
  'MATCH_AMBIGUO' AS situacao,
  pl.legacy_id AS oficios_empresas_id,
  pl.nome_legacy,
  pl.qtd_crm_matches,
  string_agg(p.parte_grupo_id::text, ', ' ORDER BY p.parte_grupo_id::text) AS ids_crm_candidatos
FROM por_legacy pl
JOIN pareamento p ON p.legacy_id = pl.legacy_id
WHERE pl.qtd_crm_matches > 1
GROUP BY pl.legacy_id, pl.nome_legacy, pl.qtd_crm_matches
ORDER BY pl.nome_legacy;

-- 3) Resumo rápido (uma linha)
SELECT
  (SELECT count(*) FROM legacy) AS total_oficios_empresas,
  (SELECT count(*) FROM por_legacy WHERE qtd_crm_matches = 1) AS com_match_unico,
  (SELECT count(*) FROM por_legacy WHERE qtd_crm_matches > 1) AS com_match_ambiguo,
  (SELECT count(*) FROM legacy l WHERE NOT EXISTS (SELECT 1 FROM pareamento p WHERE p.legacy_id = l.id)) AS sem_match;
