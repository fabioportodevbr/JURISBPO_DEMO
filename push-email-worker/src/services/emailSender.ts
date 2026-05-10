import nodemailer from 'nodemailer'
import { config } from '../config.js'

let _transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD) {
      throw new Error(
        '[compliance-smtp] SMTP não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASSWORD no .env.'
      )
    }
    _transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false, // compatibilidade com certificados self-signed em Exchange
      },
    })
  }
  return _transporter
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<void> {
  const t = getTransporter()
  await t.sendMail({
    from: `"${config.SMTP_FROM_NAME}" <${config.SMTP_FROM_EMAIL}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo ?? config.SMTP_FROM_EMAIL,
  })
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
