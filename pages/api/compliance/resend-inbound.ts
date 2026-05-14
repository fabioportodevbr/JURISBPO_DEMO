import type { NextApiRequest, NextApiResponse } from 'next'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const BUCKET = 'compliance-anexos'
const MAX_ATTACHMENT_BYTES = 10 * 1_048_576
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60

type ApiResponse =
  | { ok: true; saved: boolean; denuncia_id?: string; attachments?: number; ignored?: string }
  | { ok: false; error: string }

type ResendWebhookEvent = {
  type?: string
  data?: {
    email_id?: string
    id?: string
  }
}

type ResendReceivedEmail = {
  id: string
  from?: string
  to?: string[]
  subject?: string | null
  html?: string | null
  text?: string | null
  headers?: Record<string, string>
  message_id?: string | null
  created_at?: string
  attachments?: Array<{
    id: string
    filename?: string
    content_type?: string
    size?: number
  }>
}

function getSupabaseEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRole) {
    throw new Error('Configuracao Supabase incompleta no servidor.')
  }

  return { supabaseUrl, serviceRole }
}

function getHeader(req: NextApiRequest, name: string) {
  const value = req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function readRawBody(req: NextApiRequest) {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function getSvixSecretBytes(secret: string) {
  const rawSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  return Buffer.from(rawSecret, 'base64')
}

function verifyResendSignature(req: NextApiRequest, payload: string) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_WEBHOOK_SECRET nao configurado no servidor.')
    }
    return
  }

  const svixId = getHeader(req, 'svix-id')
  const svixTimestamp = getHeader(req, 'svix-timestamp')
  const svixSignature = getHeader(req, 'svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Assinatura do webhook ausente.')
  }

  const timestamp = Number(svixTimestamp)
  if (!Number.isFinite(timestamp)) {
    throw new Error('Timestamp do webhook invalido.')
  }

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error('Timestamp do webhook fora da janela aceita.')
  }

  const expected = createHmac('sha256', getSvixSecretBytes(secret))
    .update(`${svixId}.${svixTimestamp}.${payload}`)
    .digest('base64')

  const valid = svixSignature
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .some(part => {
      const signature = part.startsWith('v1,') ? part.slice(3) : part
      const expectedBuffer = Buffer.from(expected)
      const signatureBuffer = Buffer.from(signature)
      return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer)
    })

  if (!valid) {
    throw new Error('Assinatura do webhook invalida.')
  }
}

async function fetchResendJson<T>(path: string): Promise<T> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) throw new Error('RESEND_API_KEY nao configurada no servidor.')

  const response = await fetch(`https://api.resend.com${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new Error(`Resend API ${response.status}: ${detail}`)
  }

  return response.json() as Promise<T>
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanBody(email: ResendReceivedEmail) {
  const body = email.text?.trim() || stripHtml(email.html || '')
  return body || '(sem conteudo)'
}

function parseAddress(value: string | undefined) {
  const raw = value || ''
  const match = raw.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/)
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2]?.trim() || '',
    }
  }
  return {
    name: undefined,
    email: raw.trim(),
  }
}

function extractComplianceFormContact(body: string, fallback: { name?: string; email: string }) {
  const emails = Array.from(body.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))
    .map(match => match[0].trim())
    .filter(email => !/^(nao?respond|no-?reply)/i.test(email.split('@')[0]))
    .filter(email => !/@(brbpo\.com\.br|resend\.app)$/i.test(email))

  const email = emails[0] || fallback.email
  if (email === fallback.email) return fallback

  const lines = body
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const emailLineIndex = lines.findIndex(line => line.includes(email))
  const nameParts = emailLineIndex > 0
    ? lines
        .slice(Math.max(0, emailLineIndex - 4), emailLineIndex)
        .filter(line => !/@/.test(line))
        .filter(line => !/^\d[\d\s().-]{5,}$/.test(line))
        .filter(line => !/^on$/i.test(line))
        .slice(-2)
    : []

  return {
    email,
    name: nameParts.join(' ').trim() || fallback.name,
  }
}

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-() ]/g, '_').replace(/_{2,}/g, '_').slice(0, 200) || 'anexo.bin'
}

function formatProtocolDate(value: string | undefined) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(value ? new Date(value) : new Date())
}

async function resolveEscritorioId(
  admin: SupabaseClient,
  req: NextApiRequest
) {
  const queryId = firstQueryValue(req.query.escritorio_id)?.trim()
  if (queryId) return queryId

  const envId = process.env.COMPLIANCE_RESEND_ESCRITORIO_ID?.trim()
    || process.env.COMPLIANCE_DEFAULT_ESCRITORIO_ID?.trim()
    || process.env.DEFAULT_ESCRITORIO_ID?.trim()
  if (envId) return envId

  const { data, error } = await admin
    .from('compliance_config')
    .select('escritorio_id')
    .eq('enabled', true)

  if (error) throw error
  if (data?.length === 1) return data[0].escritorio_id

  throw new Error('Informe escritorio_id na URL do webhook ou configure COMPLIANCE_RESEND_ESCRITORIO_ID.')
}

async function persistDenuncia(
  admin: SupabaseClient,
  opts: {
    escritorioId: string
    remetenteEmail: string
    remetenteNome?: string
    assunto?: string | null
    corpo: string
    rawTextHash: string
    dataProtocolo?: string
  }
) {
  const { data: existing } = await admin
    .from('compliance_denuncias')
    .select('id')
    .eq('raw_text_hash', opts.rawTextHash)
    .maybeSingle()

  if (existing) return { isNew: false as const, denunciaId: existing.id, mensagemRecebidaId: '' }

  const { data: denuncia, error: denunciaError } = await admin
    .from('compliance_denuncias')
    .insert({
      escritorio_id: opts.escritorioId,
      remetente_email: opts.remetenteEmail,
      remetente_nome: opts.remetenteNome ?? null,
      assunto: opts.assunto ?? null,
      corpo_original: opts.corpo,
      corpo_resumo: opts.corpo.slice(0, 800),
      raw_text_hash: opts.rawTextHash,
      status: 'recebido',
      categoria: 'nao_classificado',
      competencia: 'compliance',
      data_protocolo: opts.dataProtocolo ?? new Date().toISOString(),
    })
    .select('id, numero, data_protocolo')
    .single()

  if (denunciaError || !denuncia) throw denunciaError ?? new Error('Insert de denuncia retornou vazio.')

  const { data: msgRecebida, error: msgError } = await admin
    .from('compliance_mensagens')
    .insert({
      denuncia_id: denuncia.id,
      escritorio_id: opts.escritorioId,
      tipo: 'recebida',
      para_email: null,
      para_exibicao: 'Denunciante [identidade protegida]',
      assunto: opts.assunto ?? null,
      corpo: opts.corpo,
      status_envio: 'nao_aplicavel',
    })
    .select('id')
    .single()

  if (msgError || !msgRecebida) throw msgError ?? new Error('Insert de mensagem recebida retornou vazio.')

  const { error: autoError } = await admin
    .from('compliance_mensagens')
    .insert({
      denuncia_id: denuncia.id,
      escritorio_id: opts.escritorioId,
      tipo: 'auto_resposta',
      para_email: opts.remetenteEmail,
      para_exibicao: 'Denunciante [identidade protegida]',
      assunto: `Protocolo recebido - ${denuncia.numero}`,
      corpo: `Numero de protocolo: ${denuncia.numero}\nData: ${formatProtocolDate(denuncia.data_protocolo)}`,
      status_envio: 'pendente',
    })

  if (autoError) throw autoError

  return {
    isNew: true as const,
    denunciaId: denuncia.id as string,
    mensagemRecebidaId: msgRecebida.id as string,
  }
}

async function saveResendAttachments(
  admin: SupabaseClient,
  email: ResendReceivedEmail,
  opts: {
    escritorioId: string
    denunciaId: string
    mensagemId: string
  }
) {
  let saved = 0
  const attachments = email.attachments || []

  for (const att of attachments) {
    if (!att.id) continue
    if (att.size && att.size > MAX_ATTACHMENT_BYTES) {
      console.warn(`[compliance-resend] Anexo ignorado por tamanho: ${att.filename || att.id}`)
      continue
    }

    try {
      const detail = await fetchResendJson<{
        filename?: string
        content_type?: string
        size?: number
        download_url?: string
      }>(`/emails/receiving/${encodeURIComponent(email.id)}/attachments/${encodeURIComponent(att.id)}`)

      if (!detail.download_url) continue
      if (detail.size && detail.size > MAX_ATTACHMENT_BYTES) {
        console.warn(`[compliance-resend] Anexo ignorado por tamanho: ${detail.filename || att.id}`)
        continue
      }

      const fileResponse = await fetch(detail.download_url)
      if (!fileResponse.ok) {
        console.warn(`[compliance-resend] Falha ao baixar anexo ${att.id}: ${fileResponse.status}`)
        continue
      }

      const arrayBuffer = await fileResponse.arrayBuffer()
      if (arrayBuffer.byteLength > MAX_ATTACHMENT_BYTES) {
        console.warn(`[compliance-resend] Anexo ignorado por tamanho real: ${detail.filename || att.id}`)
        continue
      }

      const filename = sanitizeName(detail.filename || att.filename || 'anexo.bin')
      const ext = filename.includes('.') ? filename.split('.').pop() : 'bin'
      const path = `${opts.escritorioId}/${opts.denunciaId}/${opts.mensagemId}/${randomUUID()}.${ext}`
      const contentType = detail.content_type || att.content_type || 'application/octet-stream'

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, Buffer.from(arrayBuffer), { contentType, upsert: false })

      if (uploadError) {
        console.warn(`[compliance-resend] Upload falhou para ${filename}:`, uploadError.message)
        continue
      }

      const { error: metaError } = await admin.from('compliance_anexos').insert({
        denuncia_id: opts.denunciaId,
        mensagem_id: opts.mensagemId,
        escritorio_id: opts.escritorioId,
        nome_arquivo: filename,
        storage_path: path,
        tamanho_bytes: arrayBuffer.byteLength,
        content_type: contentType,
        direcao: 'recebido',
      })

      if (metaError) {
        console.warn(`[compliance-resend] Metadado falhou para ${filename}:`, metaError.message)
      } else {
        saved++
      }
    } catch (error) {
      console.warn(`[compliance-resend] Erro ao processar anexo ${att.filename || att.id}:`, error)
    }
  }

  return saved
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Metodo nao permitido.' })
  }

  try {
    const rawBody = await readRawBody(req)
    verifyResendSignature(req, rawBody)

    const event = JSON.parse(rawBody) as ResendWebhookEvent
    if (event.type !== 'email.received') {
      return res.status(200).json({ ok: true, saved: false, ignored: event.type || 'evento_sem_tipo' })
    }

    const emailId = event.data?.email_id || event.data?.id
    if (!emailId) {
      return res.status(400).json({ ok: false, error: 'Evento sem email_id.' })
    }

    const { supabaseUrl, serviceRole } = getSupabaseEnv()
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
    const escritorioId = await resolveEscritorioId(admin, req)
    const email = await fetchResendJson<ResendReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}`)
    const remetenteTecnico = parseAddress(email.headers?.from || email.from)
    const corpo = cleanBody(email)
    const remetente = extractComplianceFormContact(corpo, remetenteTecnico)

    if (!remetente.email) {
      return res.status(400).json({ ok: false, error: 'E-mail recebido sem remetente.' })
    }

    const rawTextHash = createHash('sha256')
      .update(['resend', email.id, email.message_id || '', remetente.email, corpo].join('\n'))
      .digest('hex')

    const persisted = await persistDenuncia(admin, {
      escritorioId,
      remetenteEmail: remetente.email,
      remetenteNome: remetente.name,
      assunto: email.subject,
      corpo,
      rawTextHash,
      dataProtocolo: email.created_at,
    })

    let attachments = 0
    if (persisted.isNew && persisted.mensagemRecebidaId) {
      attachments = await saveResendAttachments(admin, email, {
        escritorioId,
        denunciaId: persisted.denunciaId,
        mensagemId: persisted.mensagemRecebidaId,
      })
    }

    await admin
      .from('compliance_config')
      .update({
        conn_status: 'ok',
        conn_erro: 'Recebimento via Resend Inbound ativo.',
        conn_ultima_vez: new Date().toISOString(),
      })
      .eq('escritorio_id', escritorioId)

    return res.status(200).json({
      ok: true,
      saved: persisted.isNew,
      denuncia_id: persisted.denunciaId,
      attachments,
    })
  } catch (error) {
    console.error('[compliance-resend] Falha no webhook inbound:', error)
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Erro ao processar webhook do Resend.',
    })
  }
}
