import { supabase } from '../db/supabase.js'
import { ProcessoMatch } from '../types.js'
import { config } from '../config.js'

export async function findProcessByNumber(numeroProcesso?: string): Promise<ProcessoMatch | null> {
  if (!numeroProcesso) return null

  const { data, error } = await supabase
    .from('processos')
    .select('id, cliente_id, escritorio_id, numero, responsavel_id')
    .eq('numero', numeroProcesso)
    .maybeSingle()

  if (error) throw error
  return data as ProcessoMatch | null
}

export function resolveEscritorioId(match: ProcessoMatch | null): string | undefined {
  return match?.escritorio_id ?? config.DEFAULT_ESCRITORIO_ID
}
