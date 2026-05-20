-- Adiciona campos de alerta às atividades
ALTER TABLE public.atividades
  ADD COLUMN IF NOT EXISTS alerta_antecedencia INTEGER,
  ADD COLUMN IF NOT EXISTS alerta_unidade TEXT CHECK (alerta_unidade IN ('minutos','horas','dias'));

-- Garante que alerta_unidade só exista quando alerta_antecedencia for preenchido
ALTER TABLE public.atividades
  ADD CONSTRAINT atividades_alerta_consistente
    CHECK (
      (alerta_antecedencia IS NULL AND alerta_unidade IS NULL) OR
      (alerta_antecedencia IS NOT NULL AND alerta_unidade IS NOT NULL AND alerta_antecedencia > 0)
    );

-- Índice para buscar atividades com alerta configurado
CREATE INDEX IF NOT EXISTS idx_atividades_alerta
  ON public.atividades(escritorio_id, prazo)
  WHERE alerta_antecedencia IS NOT NULL AND status NOT IN ('concluida','cancelada');
