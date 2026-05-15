-- Migration: numero_controle para processos
-- Gerado em: 2026-05-15
-- Objetivo: adicionar número de controle único, aleatório e não sequencial
--           para cada processo, além de proteger contra duplicatas futuras.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ADICIONAR COLUNA (nullable primeiro para popular dados existentes)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS numero_controle TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNÇÃO AUXILIAR: gera código aleatório no formato CTL-XXXXXXXX
--    Usa alfabeto sem caracteres ambíguos (sem 0/O, 1/I/L)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_numero_controle()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    result := 'CTL-';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_controle = result) THEN
      RETURN result;
    END IF;
    attempts := attempts + 1;
    IF attempts > 1000 THEN
      RAISE EXCEPTION 'Impossível gerar numero_controle único após 1000 tentativas';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. POPULAR REGISTROS EXISTENTES (incluindo duplicatas — cada entrada recebe
--    seu próprio número de controle individual para identificação manual)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  ctrl TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  attempts INT;
BEGIN
  FOR rec IN SELECT id FROM public.processos WHERE numero_controle IS NULL ORDER BY created_at LOOP
    attempts := 0;
    LOOP
      ctrl := 'CTL-';
      FOR i IN 1..8 LOOP
        ctrl := ctrl || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_controle = ctrl) THEN
        UPDATE public.processos SET numero_controle = ctrl WHERE id = rec.id;
        EXIT;
      END IF;
      attempts := attempts + 1;
      IF attempts > 200 THEN
        RAISE EXCEPTION 'Falha ao gerar numero_controle único para o processo %', rec.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CONSTRAINTS: NOT NULL + UNIQUE
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  ALTER COLUMN numero_controle SET NOT NULL;

ALTER TABLE public.processos
  ADD CONSTRAINT processos_numero_controle_unique UNIQUE (numero_controle);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. TRIGGER: atribui numero_controle automaticamente em novos inserts
--    (fallback caso o frontend não envie)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_assign_numero_controle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_controle IS NULL OR NEW.numero_controle = '' THEN
    NEW.numero_controle := public.generate_numero_controle();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_processos_numero_controle ON public.processos;
CREATE TRIGGER trg_processos_numero_controle
  BEFORE INSERT ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.trg_assign_numero_controle();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ÍNDICE para buscas por numero_controle
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processos_numero_controle ON public.processos (numero_controle);
