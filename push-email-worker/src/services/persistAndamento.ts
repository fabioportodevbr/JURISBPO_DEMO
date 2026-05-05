import { supabase } from '../db/supabase.js'
import { ParsedAndamento } from '../types.js'
import { findProcessByNumber, resolveEscritorioId } from './processMatcher.js'
import { sendAlerts } from './alertService.js'

export async function persistAndamento(parsed: ParsedAndamento) {
  const match = await findProcessByNumber(parsed.numeroProcesso)
  const escritorioId = resolveEscritorioId(match)

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
    status_associacao: match ? 'associado' : 'pendente'
  }

  const { data, error } = await supabase
    .from('andamentos_processuais_push')
    .upsert(payload, { onConflict: 'raw_text_hash' })
    .select('id')
    .single()

  if (error) throw error

  // Importante:
  // A tabela notificacoes do seu banco possui uma constraint propria para o campo tipo.
  // Para evitar falhas por incompatibilidade de schema, o worker nao cria notificacao aqui.
  // O andamento ja fica disponivel no painel de acompanhamento processual via push.
  // Se quiser reativar notificacoes depois, primeiro confirme os valores aceitos em:
  // select conname, pg_get_constraintdef(oid) from pg_constraint where conname = 'notificacoes_tipo_check';

  await sendAlerts(parsed, match)
  return data
}
