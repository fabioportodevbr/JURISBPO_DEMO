import type { SupabaseClient } from '@supabase/supabase-js'
import type { PushEmailConfig } from '../config'
import type { ParsedAndamento } from '../types'
import { findProcessByNumber, resolveEscritorioId } from './processMatcher'
import { sendAlerts } from './alertService'

export async function persistAndamento(
  supabase: SupabaseClient,
  config: PushEmailConfig,
  parsed: ParsedAndamento,
) {
  const match = await findProcessByNumber(supabase, parsed.numeroProcesso)
  const escritorioId = resolveEscritorioId(config, match)

  const payload = {
    escritorio_id: escritorioId ?? null,
    cliente_id: match?.cliente_id ?? null,
    processo_id: match?.id ?? null,
    numero_processo: parsed.numeroProcesso ?? null,
    tribunal: parsed.tribunal ?? null,
    movimento: parsed.movimento,
    data_movimento: parsed.dataMovimento ?? null,
    fonte: parsed.fonte,
    remetente: parsed.remetente ?? null,
    assunto_email: parsed.assuntoEmail ?? null,
    corpo_resumo: parsed.corpoResumo ?? null,
    corpo_email: parsed.corpoEmail ?? parsed.corpoResumo ?? null,
    corpo_email_limpo: parsed.corpoEmail ?? parsed.corpoResumo ?? null,
    corpo_email_resumo: parsed.corpoResumo ?? null,
    url_origem: parsed.urlOrigem ?? null,
    raw_text_hash: parsed.rawTextHash,
    status_associacao: match ? 'associado' : 'pendente',
  }

  const { data, error } = await supabase
    .from('andamentos_processuais_push')
    .upsert(payload, { onConflict: 'raw_text_hash' })
    .select('id')
    .single()

  if (error) throw error

  await sendAlerts(config, parsed, match)
  return data
}
