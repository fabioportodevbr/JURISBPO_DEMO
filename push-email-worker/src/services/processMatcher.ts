import { supabase } from '../db/supabase.js'
import { ProcessoMatch } from '../types.js'
import { config } from '../config.js'

function soDigitos(n: string): string {
  return n.replace(/\D/g, '')
}

export async function findProcessByNumber(numeroProcesso?: string): Promise<ProcessoMatch | null> {
  if (!numeroProcesso) return null

  // Tenta correspondência exata primeiro
  const { data, error } = await supabase
    .from('processos')
    .select('id, cliente_id, escritorio_id, numero, responsavel_id')
    .eq('numero', numeroProcesso)
    .maybeSingle()

  if (error) throw error
  if (data) return data as ProcessoMatch

  // Fallback: compara apenas os dígitos (normaliza formatação)
  const digits = soDigitos(numeroProcesso)
  if (!digits) return null

  const { data: all, error: err2 } = await supabase
    .from('processos')
    .select('id, cliente_id, escritorio_id, numero, responsavel_id')
    .ilike('numero', `%${digits.slice(-10)}%`)  // usa os últimos 10 dígitos como filtro seletivo
    .limit(20)

  if (err2) throw err2
  const match = (all ?? []).find((p) => soDigitos(p.numero ?? '') === digits)
  return (match as ProcessoMatch) ?? null
}

export function resolveEscritorioId(match: ProcessoMatch | null): string | undefined {
  return match?.escritorio_id ?? config.DEFAULT_ESCRITORIO_ID
}
