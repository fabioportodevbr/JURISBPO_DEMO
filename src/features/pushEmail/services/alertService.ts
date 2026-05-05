import type { PushEmailConfig } from '../config'
import type { ParsedAndamento, ProcessoMatch } from '../types'

export async function sendAlerts(
  config: PushEmailConfig,
  andamento: ParsedAndamento,
  match: ProcessoMatch | null,
) {
  if (!config.ALERT_WEBHOOK_URL) return

  await fetch(config.ALERT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'novo_andamento_processual',
      numero_processo: andamento.numeroProcesso,
      movimento: andamento.movimento,
      tribunal: andamento.tribunal,
      data_movimento: andamento.dataMovimento,
      processo_id: match?.id ?? null,
      cliente_id: match?.cliente_id ?? null,
      resumo: andamento.corpoResumo,
    }),
  })
}
