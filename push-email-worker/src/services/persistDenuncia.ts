/**
 * persistDenuncia.ts
 * Salva a denúncia em compliance_denuncias (idempotente via raw_text_hash)
 * e enfileira as mensagens iniciais:
 *   1. 'recebida'      — cópia do e-mail original (para registro interno)
 *   2. 'auto_resposta' — protocolo de confirmação para o denunciante (status_envio='pendente')
 */
import { supabase } from '../db/supabase.js'
import { ParsedDenuncia } from '../types.js'

export type PersistResult =
  | { isNew: false }
  | { isNew: true; denunciaId: string; mensagemRecebidaId: string }

export async function persistDenuncia(d: ParsedDenuncia): Promise<PersistResult> {
  // --- 1. Deduplicação: verifica se já existe pelo hash -------------------------
  const { data: existing } = await supabase
    .from('compliance_denuncias')
    .select('id, numero, data_protocolo')
    .eq('raw_text_hash', d.rawTextHash)
    .maybeSingle()

  if (existing) {
    console.log(`[compliance] Denúncia duplicada ignorada (hash já existe, id=${existing.id})`)
    return { isNew: false }
  }

  // --- 2. Insere a denúncia (trigger gera o número DEN-YYYY-NNN) ---------------
  const { data: inserted, error: errIns } = await supabase
    .from('compliance_denuncias')
    .insert({
      escritorio_id:  d.escritorioId,
      remetente_email: d.remetenteEmail,
      remetente_nome:  d.remetenteNome  ?? null,
      assunto:         d.assuntoEmail   ?? null,
      corpo_original:  d.corpoOriginal,
      corpo_resumo:    d.corpoResumo,
      raw_text_hash:   d.rawTextHash,
      status:          'recebido',
      categoria:       'nao_classificado',
      competencia:     'compliance',
    })
    .select('id, numero, data_protocolo')
    .single()

  if (errIns || !inserted) {
    console.error('[compliance] Erro ao inserir denúncia:', errIns)
    throw errIns ?? new Error('Insert retornou vazio')
  }

  console.log(`[compliance] Denúncia registrada: ${inserted.numero} (id=${inserted.id})`)

  // --- 3. Mensagem 'recebida' (interna, para histórico) -------------------------
  const msgRecebida = {
    denuncia_id:   inserted.id,
    escritorio_id: d.escritorioId,
    tipo:          'recebida',
    para_email:    null,
    para_exibicao: 'Denunciante [identidade protegida]',
    assunto:       d.assuntoEmail ?? null,
    corpo:         d.corpoOriginal,
    status_envio:  'nao_aplicavel',
  }

  // --- 4. Mensagem 'auto_resposta' (pendente → worker de outbox dispara) --------
  const dataProtocoloFmt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(inserted.data_protocolo))

  const msgAutoResposta = {
    denuncia_id:   inserted.id,
    escritorio_id: d.escritorioId,
    tipo:          'auto_resposta',
    para_email:    d.remetenteEmail,   // lido apenas pelo worker (SERVICE_ROLE)
    para_exibicao: 'Denunciante [identidade protegida]',
    assunto:       `Protocolo recebido — ${inserted.numero}`,
    corpo:         `Número de protocolo: ${inserted.numero}\nData: ${dataProtocoloFmt}`,
    status_envio:  'pendente',
    // meta auxiliar para o outbox construir o HTML
  }

  // Insere separadamente para capturar o ID da mensagem 'recebida'
  const { data: msgRec, error: errRec } = await supabase
    .from('compliance_mensagens')
    .insert(msgRecebida)
    .select('id')
    .single()

  if (errRec) {
    console.error('[compliance] Erro ao inserir mensagem recebida:', errRec)
  }

  const { error: errAuto } = await supabase
    .from('compliance_mensagens')
    .insert(msgAutoResposta)

  if (errAuto) {
    console.error('[compliance] Erro ao inserir auto_resposta:', errAuto)
  }

  return {
    isNew:              true,
    denunciaId:         inserted.id,
    mensagemRecebidaId: msgRec?.id ?? '',
  }
}
