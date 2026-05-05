import type { SupabaseClient } from '@supabase/supabase-js'
import type { PushEmailConfig } from '../config'
import type { ProcessoMatch } from '../types'

export async function findProcessByNumber(
  supabase: SupabaseClient,
  numeroProcesso?: string,
): Promise<ProcessoMatch | null> {
  if (!numeroProcesso) return null

  const { data, error } = await supabase
    .from('processos')
    .select('id, cliente_id, escritorio_id, numero, responsavel_id')
    .eq('numero', numeroProcesso)
    .maybeSingle()

  if (error) throw error
  return data as ProcessoMatch | null
}

export function resolveEscritorioId(config: PushEmailConfig, match: ProcessoMatch | null): string | undefined {
  return match?.escritorio_id ?? config.DEFAULT_ESCRITORIO_ID
}
