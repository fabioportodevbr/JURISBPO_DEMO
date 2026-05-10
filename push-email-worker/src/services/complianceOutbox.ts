/**
 * complianceOutbox.ts
 * Processa mensagens com status_envio='pendente' (auto_resposta, officer_reply, diligencia).
 * Lê o remetente_email da denúncia (SERVICE_ROLE, nunca exposto ao frontend)
 * e envia via SMTP (nodemailer).
 *
 * Roda via cron a cada minuto.
 */
import { supabase } from '../db/supabase.js'
import { sendEmail, buildAutoReplyHtml, buildOfficerMessageHtml } from './emailSender.js'

const BATCH_SIZE = 10   // mensagens por ciclo para não sobrecarregar o SMTP

type PendingMsg = {
  id: string
  denuncia_id: string
  tipo: string
  para_email: string | null
  assunto: string | null
  corpo: string
  setor_acionado: string | null
  enviado_por_nome: string | null
  // campos da denúncia pai (join)
  compliance_denuncias: {
    numero: string
    remetente_email: string
    data_protocolo: string
  } | null
}

export async function processComplianceOutbox(): Promise<void> {
  // Busca mensagens pendentes com join na denúncia para obter remetente_email
  const { data: rows, error } = await supabase
    .from('compliance_mensagens')
    .select(`
      id, denuncia_id, tipo, para_email, assunto, corpo, setor_acionado, enviado_por_nome,
      compliance_denuncias ( numero, remetente_email, data_protocolo )
    `)
    .eq('status_envio', 'pendente')
    .order('criado_em', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[compliance-outbox] Erro ao buscar pendentes:', error)
    return
  }

  if (!rows || rows.length === 0) return

  console.log(`[compliance-outbox] Processando ${rows.length} mensagem(ns) pendente(s)...`)

  for (const row of rows as unknown as PendingMsg[]) {
    try {
      const denuncia = row.compliance_denuncias
      if (!denuncia) {
        await markFailed(row.id, 'Denúncia pai não encontrada')
        continue
      }

      // Resolve o destinatário real:
      // - auto_resposta → vai para o denunciante (remetente_email da denúncia)
      // - officer_reply → também vai para o denunciante
      // - diligencia    → vai para para_email (e-mail do setor acionado), fornecido pelo officer
      let toEmail: string | null = null

      if (row.tipo === 'auto_resposta' || row.tipo === 'officer_reply') {
        toEmail = denuncia.remetente_email
      } else if (row.tipo === 'diligencia') {
        toEmail = row.para_email   // preenchido pelo officer no frontend
      }

      if (!toEmail) {
        await markFailed(row.id, `Destinatário não resolvido para tipo=${row.tipo}`)
        continue
      }

      // Monta o HTML conforme o tipo
      let html: string
      let subject: string

      if (row.tipo === 'auto_resposta') {
        const dataFmt = new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: 'America/Sao_Paulo',
        }).format(new Date(denuncia.data_protocolo))

        html    = buildAutoReplyHtml(denuncia.numero, dataFmt)
        subject = row.assunto ?? `Protocolo recebido — ${denuncia.numero}`
      } else {
        // officer_reply ou diligencia
        html = buildOfficerMessageHtml({
          corpo:          row.corpo,
          officerNome:    row.enviado_por_nome ?? 'Compliance Officer',
          numeroDenuncia: denuncia.numero,
          isDigligencia:  row.tipo === 'diligencia',
          setorAcionado:  row.setor_acionado ?? undefined,
        })
        subject = row.assunto ?? (
          row.tipo === 'diligencia'
            ? `Solicitação de Diligência — ${denuncia.numero}`
            : `Atualização da denúncia ${denuncia.numero}`
        )
      }

      await sendEmail({ to: toEmail, subject, html })

      // Marca como enviado
      await supabase
        .from('compliance_mensagens')
        .update({ status_envio: 'enviado', enviado_em: new Date().toISOString(), erro_envio: null })
        .eq('id', row.id)

      console.log(`[compliance-outbox] ✓ Mensagem ${row.id} (${row.tipo}) enviada para ${toEmail}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[compliance-outbox] ✗ Falha na mensagem ${row.id}:`, msg)
      await markFailed(row.id, msg)
    }
  }
}

async function markFailed(id: string, reason: string): Promise<void> {
  await supabase
    .from('compliance_mensagens')
    .update({ status_envio: 'falha', erro_envio: reason })
    .eq('id', id)
}
