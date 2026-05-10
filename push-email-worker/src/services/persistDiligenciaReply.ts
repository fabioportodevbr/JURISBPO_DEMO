/**
 * persistDiligenciaReply.ts
 * Salva a resposta de um setor a uma diligência como mensagem do tipo
 * 'resposta_diligencia' vinculada à denúncia correta.
 */
import { supabase } from '../db/supabase.js'

export type DiligenciaReplyResult =
  | { saved: false }
  | { saved: true; denunciaId: string; mensagemId: string }

export async function persistDiligenciaReply(opts: {
  denunciaNumero: string
  escritorioId: string
  remetenteEmail: string
  remetenteNome: string | undefined
  assunto: string | undefined
  corpo: string
  rawTextHash: string
}): Promise<DiligenciaReplyResult> {
  // 1. Encontra a denúncia pelo número dentro do escritório
  const { data: denuncia } = await supabase
    .from('compliance_denuncias')
    .select('id')
    .eq('numero', opts.denunciaNumero)
    .eq('escritorio_id', opts.escritorioId)
    .maybeSingle()

  if (!denuncia) {
    console.warn(`[compliance-reply] Denúncia ${opts.denunciaNumero} não encontrada para escritório ${opts.escritorioId}`)
    return { saved: false }
  }

  // 2. Deduplicação: evita salvar a mesma resposta duas vezes
  const { data: existing } = await supabase
    .from('compliance_mensagens')
    .select('id')
    .eq('denuncia_id', denuncia.id)
    .eq('tipo', 'resposta_diligencia')
    .ilike('corpo', opts.corpo.slice(0, 100) + '%')
    .maybeSingle()

  if (existing) {
    console.log(`[compliance-reply] Resposta já registrada para ${opts.denunciaNumero} — ignorado.`)
    return { saved: false }
  }

  // 3. Salva como mensagem de resposta_diligencia
  const nomeExibicao = opts.remetenteNome
    ? `${opts.remetenteNome} <${opts.remetenteEmail}>`
    : opts.remetenteEmail

  const { data: msg, error } = await supabase
    .from('compliance_mensagens')
    .insert({
      denuncia_id:   denuncia.id,
      escritorio_id: opts.escritorioId,
      tipo:          'resposta_diligencia',
      para_email:    null,
      para_exibicao: `Resposta do setor: ${nomeExibicao}`,
      assunto:       opts.assunto ?? null,
      corpo:         opts.corpo,
      status_envio:  'nao_aplicavel',
    })
    .select('id')
    .single()

  if (error || !msg) {
    console.error('[compliance-reply] Erro ao salvar resposta de diligência:', error)
    return { saved: false }
  }

  console.log(`[compliance-reply] ✓ Resposta de diligência salva para ${opts.denunciaNumero} de ${opts.remetenteEmail}`)
  return { saved: true, denunciaId: denuncia.id, mensagemId: msg.id }
}
