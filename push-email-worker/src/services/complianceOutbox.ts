/**
 * complianceOutbox.ts
 * Processa mensagens com status_envio='pendente' (auto_resposta, officer_reply, diligencia).
 * Lê o remetente_email da denúncia (SERVICE_ROLE, nunca exposto ao frontend)
 * e envia via Resend ou SMTP usando a configuracao lida do banco
 * (compliance_config).
 *
 * Roda via cron a cada minuto para cada escritório com compliance ativo.
 */
import { supabase } from '../db/supabase.js'
import { ComplianceDbConfig } from '../types.js'
import { sendEmail, buildAutoReplyHtml, buildOfficerMessageHtml, EmailAttachment } from './emailSender.js'

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
  compliance_denuncias: {
    numero: string
    remetente_email: string
    data_protocolo: string
  } | null
}

export async function processComplianceOutbox(cfg: ComplianceDbConfig): Promise<void> {
  // Busca mensagens pendentes do escritório com join na denúncia
  const { data: rows, error } = await supabase
    .from('compliance_mensagens')
    .select(`
      id, denuncia_id, tipo, para_email, assunto, corpo, setor_acionado, enviado_por_nome,
      compliance_denuncias ( numero, remetente_email, data_protocolo )
    `)
    .eq('status_envio', 'pendente')
    .eq('escritorio_id', cfg.escritorioId)
    .order('criado_em', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error(`[compliance-outbox][${cfg.escritorioId}] Erro ao buscar pendentes:`, error)
    return
  }

  if (!rows || rows.length === 0) return

  console.log(`[compliance-outbox][${cfg.escritorioId}] Processando ${rows.length} mensagem(ns) pendente(s)...`)

  for (const row of rows as unknown as PendingMsg[]) {
    try {
      const denuncia = row.compliance_denuncias
      if (!denuncia) {
        await markFailed(row.id, 'Denúncia pai não encontrada')
        continue
      }

      // Resolve o destinatário real:
      // - auto_resposta → remetente_email da denúncia (o denunciante)
      // - officer_reply → idem
      // - diligencia    → para_email (e-mail do setor, preenchido pelo officer)
      let toEmail: string | null = null

      if (row.tipo === 'auto_resposta' || row.tipo === 'officer_reply') {
        toEmail = denuncia.remetente_email
      } else if (row.tipo === 'diligencia') {
        toEmail = row.para_email
      }

      if (!toEmail) {
        await markFailed(row.id, `Destinatário não resolvido para tipo=${row.tipo}`)
        continue
      }

      if (!cfg.smtpFromEmail) {
        await markFailed(row.id, 'Remetente do compliance nao configurado para este escritorio')
        continue
      }

      // O Railway envia por Resend quando RESEND_API_KEY existe. SMTP e apenas
      // fallback para ambientes que ainda nao usam o provedor HTTP.
      const resendConfigured = !!process.env.RESEND_API_KEY?.trim()
      if (!resendConfigured && (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPassword)) {
        await markFailed(row.id, 'SMTP não configurado para este escritório')
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

      // Busca anexos enviados para esta mensagem (upload feito pelo officer no frontend)
      const attachments: EmailAttachment[] = []
      const { data: anexos } = await supabase
        .from('compliance_anexos')
        .select('nome_arquivo, storage_path, content_type')
        .eq('mensagem_id', row.id)
        .eq('direcao', 'enviado')

      for (const anexo of (anexos ?? [])) {
        try {
          const { data: blob } = await supabase.storage
            .from('compliance-anexos')
            .download(anexo.storage_path)
          if (blob) {
            const buf = Buffer.from(await blob.arrayBuffer())
            attachments.push({
              filename:    anexo.nome_arquivo,
              content:     buf.toString('base64'),
              contentType: anexo.content_type ?? 'application/octet-stream',
            })
          }
        } catch (e) {
          console.warn(`[compliance-outbox] Falha ao carregar anexo "${anexo.nome_arquivo}":`, e)
        }
      }

      // sendEmail usa smtpFromEmail como Reply-To por padrao. Isso mantem as
      // respostas no inbound do Resend em vez da caixa IMAP antiga.
      await sendEmail({ to: toEmail, subject, html, attachments }, cfg)

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
