import nodemailer from 'nodemailer'
import dns from 'dns/promises'
import { ComplianceDbConfig } from '../types.js'

// ---------------------------------------------------------------------------
// Envio via Resend (HTTP API — funciona em Railway, sem SMTP bloqueado)
// Configurar a variável de ambiente RESEND_API_KEY no Railway.
// Docs: https://resend.com/docs/api-reference/emails/send-email
// ---------------------------------------------------------------------------

export interface EmailAttachment {
  filename:    string
  content:     string   // base64
  contentType: string
}

async function sendViaResend(
  opts: { to: string; subject: string; html: string; replyTo?: string; attachments?: EmailAttachment[] },
  cfg: ComplianceDbConfig,
  apiKey: string
): Promise<void> {
  const from = cfg.smtpFromName
    ? `${cfg.smtpFromName} <${cfg.smtpFromEmail}>`
    : cfg.smtpFromEmail

  const body: Record<string, unknown> = {
    from,
    to:       [opts.to],
    subject:  opts.subject,
    html:     opts.html,
    reply_to: opts.replyTo ?? cfg.smtpFromEmail,
  }

  if (opts.attachments?.length) {
    body.attachments = opts.attachments.map(a => ({
      filename: a.filename,
      content:  a.content,
    }))
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`Resend API ${res.status}: ${detail}`)
  }
}

// ---------------------------------------------------------------------------
// Fallback: SMTP via nodemailer (pode não funcionar em Railway)
// ---------------------------------------------------------------------------

async function resolveToIPv4(host: string): Promise<string> {
  try {
    const addresses = await dns.resolve4(host)
    if (addresses.length > 0) return addresses[0]
  } catch { /* usa hostname direto */ }
  return host
}

async function createSmtpTransporter(cfg: ComplianceDbConfig): Promise<nodemailer.Transporter> {
  if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPassword) {
    throw new Error('[compliance-smtp] SMTP não configurado para o escritório ' + cfg.escritorioId)
  }
  const resolvedHost = await resolveToIPv4(cfg.smtpHost)
  return nodemailer.createTransport({
    host:   resolvedHost,
    port:   cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth:   { user: cfg.smtpUser, pass: cfg.smtpPassword },
    tls:    { rejectUnauthorized: false, servername: cfg.smtpHost },
  })
}

// ---------------------------------------------------------------------------
// Função principal: usa Resend se RESEND_API_KEY estiver definido,
// caso contrário tenta SMTP direto.
// ---------------------------------------------------------------------------

export async function sendEmail(
  opts: { to: string; subject: string; html: string; replyTo?: string; attachments?: EmailAttachment[] },
  cfg: ComplianceDbConfig
): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY?.trim()

  if (resendKey) {
    await sendViaResend(opts, cfg, resendKey)
  } else {
    const t = await createSmtpTransporter(cfg)
    await t.sendMail({
      from:        `"${cfg.smtpFromName}" <${cfg.smtpFromEmail}>`,
      to:          opts.to,
      subject:     opts.subject,
      html:        opts.html,
      replyTo:     opts.replyTo ?? cfg.smtpFromEmail,
      attachments: opts.attachments?.map(a => ({
        filename: a.filename,
        content:  Buffer.from(a.content, 'base64'),
        contentType: a.contentType,
      })),
    })
  }
}

/** HTML da auto-resposta de protocolo enviada ao denunciante */
export function buildAutoReplyHtml(numero: string, dataProtocolo: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:0">
  <div style="background:#064e3b;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:white;margin:0;font-size:17px;font-weight:700">Canal de Compliance</h1>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px">Protocolo de recebimento</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <p style="margin:0 0 16px">Sua comunicação foi recebida e registrada em nosso sistema de gestão de compliance.</p>
    <div style="background:#f8fafc;border:1px solid #e5e7eb;border-left:4px solid #064e3b;border-radius:6px;padding:16px;margin:16px 0">
      <p style="margin:0 0 6px;font-size:13px"><strong>Número de protocolo:</strong>&nbsp; <span style="font-size:16px;font-weight:900;color:#064e3b">${numero}</span></p>
      <p style="margin:0;font-size:13px"><strong>Data e hora do protocolo:</strong>&nbsp; ${dataProtocolo}</p>
    </div>
    <p style="margin:16px 0">Guarde este número — ele é necessário para acompanhar o andamento da apuração.</p>
    <p style="margin:0 0 16px;font-size:13px;color:#64748b">
      Seu sigilo é garantido. Nenhum dado de identificação pessoal será divulgado durante o processo de apuração.
      O prazo padrão para análise inicial é de <strong>até 5 dias úteis</strong>.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="font-size:11px;color:#94a3b8;margin:0">
      <strong>Canal de Compliance — JurisBPO</strong><br>
      Esta mensagem foi gerada automaticamente. Não responda a este e-mail.<br>
      Para enviar informações adicionais sobre sua denúncia, utilize o mesmo canal pelo qual entrou em contato.
    </p>
  </div>
</body></html>`
}

/** HTML para mensagens do Compliance Officer (officer_reply ou diligência) */
export function buildOfficerMessageHtml(opts: {
  corpo: string
  officerNome: string
  numeroDenuncia: string
  isDigligencia: boolean
  setorAcionado?: string
}): string {
  const header = opts.isDigligencia
    ? `Solicitação de Diligência — ${opts.numeroDenuncia}`
    : `Atualização da denúncia ${opts.numeroDenuncia}`

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#111827;max-width:600px;margin:0 auto;padding:0">
  <div style="background:#064e3b;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:white;margin:0;font-size:16px;font-weight:700">Canal de Compliance</h1>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px">${header}</p>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    ${opts.isDigligencia && opts.setorAcionado
      ? `<p style="font-size:12px;font-weight:700;color:#64748b;margin:0 0 12px;text-transform:uppercase">Para o setor: ${opts.setorAcionado}</p>`
      : ''}
    <div style="white-space:pre-wrap;line-height:1.6">${opts.corpo.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
    <p style="font-size:12px;color:#64748b;margin:0">
      <strong>Compliance Officer:</strong> ${opts.officerNome}<br>
      <strong>Ref. denúncia:</strong> ${opts.numeroDenuncia}<br>
      <em>Esta mensagem foi enviada pelo sistema JurisBPO — Canal de Compliance.</em>
    </p>
  </div>
</body></html>`
}
