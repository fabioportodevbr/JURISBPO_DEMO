-- Backfill seguro: associa ofícios (e destinatários) legados às empresas do grupo no CRM.
-- Rode primeiro os SELECTs de verificação (comentados ao final) se quiser inspecionar o pareamento.
--
-- Regra de pareamento (na ordem):
--   1) nome da oficios_empresas = nome ou nome_fantasia da partes_crm (trim + lower)
--   2) mesmo comparando só caracteres alfanuméricos (ignora espaços e pontuação)
--
-- IMPORTANTE: se duas linhas de partes_crm casarem com a mesma oficios_empresas, o UPDATE pode ficar
-- ambíguo. Nesse caso, ajuste nomes no CRM ou crie um UPDATE manual por empresa_id.

-- ── Ofícios ───────────────────────────────────────────────────────────────
UPDATE public.oficios AS o
SET
  parte_grupo_id = m.id_parte,
  escritorio_id = m.escritorio_id
FROM (
  SELECT DISTINCT ON (oe.id)
    oe.id AS empresa_legacy_id,
    pc.id AS id_parte,
    pc.escritorio_id
  FROM public.oficios_empresas oe
  INNER JOIN public.partes_crm pc
    ON pc.tipo = 'empresa_grupo'
    AND pc.status = 'ativo'
    AND (
      lower(trim(oe.nome)) IN (
        lower(trim(pc.nome)),
        lower(trim(coalesce(pc.nome_fantasia, '')))
      )
      OR regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g') <> ''
         AND regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g')
           IN (
             regexp_replace(lower(trim(pc.nome)), '[^a-z0-9]', '', 'g'),
             regexp_replace(lower(trim(coalesce(pc.nome_fantasia, ''))), '[^a-z0-9]', '', 'g')
           )
    )
  ORDER BY oe.id, pc.id
) AS m
WHERE o.empresa_id = m.empresa_legacy_id
  AND (o.parte_grupo_id IS NULL OR o.escritorio_id IS NULL);

-- ── Destinatários ───────────────────────────────────────────────────────────
UPDATE public.oficios_destinatarios AS d
SET
  parte_grupo_id = m.id_parte,
  escritorio_id = m.escritorio_id
FROM (
  SELECT DISTINCT ON (oe.id)
    oe.id AS empresa_legacy_id,
    pc.id AS id_parte,
    pc.escritorio_id
  FROM public.oficios_empresas oe
  INNER JOIN public.partes_crm pc
    ON pc.tipo = 'empresa_grupo'
    AND pc.status = 'ativo'
    AND (
      lower(trim(oe.nome)) IN (
        lower(trim(pc.nome)),
        lower(trim(coalesce(pc.nome_fantasia, '')))
      )
      OR regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g') <> ''
         AND regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g')
           IN (
             regexp_replace(lower(trim(pc.nome)), '[^a-z0-9]', '', 'g'),
             regexp_replace(lower(trim(coalesce(pc.nome_fantasia, ''))), '[^a-z0-9]', '', 'g')
           )
    )
  ORDER BY oe.id, pc.id
) AS m
WHERE d.empresa_id = m.empresa_legacy_id
  AND (d.parte_grupo_id IS NULL OR d.escritorio_id IS NULL);

-- ── Auditoria dos ofícios (alinhar ao ofício já backfilled) ────────────────
UPDATE public.oficios_auditoria AS a
SET
  parte_grupo_id = o.parte_grupo_id,
  escritorio_id = o.escritorio_id
FROM public.oficios o
WHERE a.oficio_id = o.id
  AND o.parte_grupo_id IS NOT NULL
  AND o.escritorio_id IS NOT NULL
  AND (a.parte_grupo_id IS NULL OR a.escritorio_id IS NULL);

-- ── Verificações úteis (rode manualmente antes ou depois) ─────────────────
-- Ofícios ainda sem CRM após o backfill:
-- SELECT o.id, o.numero, o.ano, o.empresa_id, oe.nome
-- FROM public.oficios o
-- LEFT JOIN public.oficios_empresas oe ON oe.id = o.empresa_id
-- WHERE o.parte_grupo_id IS NULL OR o.escritorio_id IS NULL;

-- Pareamento sugerido antes de atualizar (preview):
-- SELECT oe.id, oe.nome AS nome_legacy, pc.id AS parte_grupo_id, pc.nome, pc.nome_fantasia, pc.escritorio_id
-- FROM public.oficios_empresas oe
-- JOIN public.partes_crm pc ON pc.tipo = 'empresa_grupo' AND pc.status = 'ativo'
--   AND regexp_replace(lower(trim(oe.nome)), '[^a-z0-9]', '', 'g')
--     IN (
--       regexp_replace(lower(trim(pc.nome)), '[^a-z0-9]', '', 'g'),
--       regexp_replace(lower(trim(coalesce(pc.nome_fantasia,''))), '[^a-z0-9]', '', 'g')
--     );
