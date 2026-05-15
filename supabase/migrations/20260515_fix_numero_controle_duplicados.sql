-- Migração corretiva: numero_controle duplicados
-- 2026-05-15
-- Problema: o DO block da migração anterior gerou o mesmo CTL para linhas
-- duplicadas porque o Supabase/PostgreSQL não enxergou os UPDATEs anteriores
-- dentro da mesma transação em tempo de execução do cursor.
-- Solução: identificar todas as linhas que não são a "primeira" do grupo
-- (por created_at + id) e reatribuir CTLs únicos a elas.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REMOVER A CONSTRAINT UNIQUE (pode já não existir — IF EXISTS é seguro)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  DROP CONSTRAINT IF EXISTS processos_numero_controle_unique;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GARANTIR QUE A FUNÇÃO DE GERAÇÃO EXISTE
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
-- 3. REATRIBUIR CTL PARA:
--    a) linhas com numero_controle NULL
--    b) linhas duplicadas (todas exceto a primeira de cada grupo de CTL igual)
--    A "primeira" de cada grupo é preservada; as demais recebem novo CTL.
--    Cada UPDATE é feito individualmente em loop para garantir unicidade.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  ctrl TEXT;
  i INT;
  attempts INT;
BEGIN
  -- Seleciona linhas que precisam de novo CTL:
  -- rn > 1 = não é a primeira do grupo (duplicata de CTL)
  -- numero_controle IS NULL = não teve CTL atribuído
  FOR rec IN
    SELECT id FROM (
      SELECT id,
             numero_controle,
             ROW_NUMBER() OVER (
               PARTITION BY COALESCE(numero_controle, gen_random_uuid()::text)
               ORDER BY created_at, id
             ) AS rn
      FROM public.processos
    ) t
    WHERE rn > 1 OR numero_controle IS NULL
    ORDER BY created_at, id
  LOOP
    attempts := 0;
    LOOP
      ctrl := 'CTL-';
      FOR i IN 1..8 LOOP
        ctrl := ctrl || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      -- Verifica unicidade considerando os UPDATEs já feitos nesta sessão
      -- (usa PERFORM + SELECT para forçar re-leitura)
      PERFORM pg_sleep(0); -- força flush do snapshot interno
      IF NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_controle = ctrl) THEN
        UPDATE public.processos SET numero_controle = ctrl WHERE id = rec.id;
        RAISE NOTICE 'CTL % atribuído ao processo id=%', ctrl, rec.id;
        EXIT;
      END IF;
      attempts := attempts + 1;
      IF attempts > 500 THEN
        RAISE EXCEPTION 'Falha ao gerar CTL único para id=%', rec.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. GARANTIR NOT NULL em todos os registros restantes
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.processos
SET numero_controle = public.generate_numero_controle()
WHERE numero_controle IS NULL OR numero_controle = '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. APLICAR NOT NULL + UNIQUE (agora com dados limpos)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.processos
  ALTER COLUMN numero_controle SET NOT NULL;

ALTER TABLE public.processos
  ADD CONSTRAINT processos_numero_controle_unique UNIQUE (numero_controle);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RECRIAR O TRIGGER (garante que novos inserts sem CTL recebam um)
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
-- 7. ÍNDICE (recria se necessário)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_processos_numero_controle
  ON public.processos (numero_controle);
