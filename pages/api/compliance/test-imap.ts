import type { NextApiRequest, NextApiResponse } from 'next'
import dns from 'dns'
import { createClient } from '@supabase/supabase-js'
import { ImapFlow } from 'imapflow'

dns.setDefaultResultOrder('ipv4first')

type ApiResponse =
  | { ok: true; mensagens: number; naolidas: number }
  | { ok: false; erro: string }

function getSupabaseEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !serviceRole || !anonKey) {
    throw new Error('Configuração Supabase incompleta no servidor.')
  }

  return { supabaseUrl, serviceRole, anonKey }
}

function getBearerToken(req: NextApiRequest) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length).trim()
}

function friendlyImapError(error: unknown, host: string, port: number) {
  const imapError = error as Error & {
    code?: string
    responseStatus?: string
    responseText?: string
    serverResponseCode?: string
  }
  const message = imapError?.message || String(error)
  const detail = imapError?.responseText || imapError?.serverResponseCode || imapError?.code || ''
  const fullMessage = [message, detail].filter(Boolean).join(' — ')

  if (/ECONNREFUSED|connection refused/i.test(fullMessage)) {
    return `Conexão recusada em ${host}:${port}. Verifique host, porta e SSL/TLS.`
  }
  if (/ENOTFOUND|getaddrinfo/i.test(fullMessage)) {
    return `Servidor "${host}" não encontrado. Verifique o endereço IMAP.`
  }
  if (/ETIMEDOUT|timed out|timeout/i.test(fullMessage)) {
    return `Tempo limite excedido ao conectar em ${host}:${port}. Verifique host, porta e firewall.`
  }
  if (/AUTHENTICATIONFAILED|LOGIN failed|Invalid credentials|Bad credentials|Application-specific password required/i.test(fullMessage)) {
    return 'Falha de autenticação IMAP. Confira o e-mail da caixa e gere uma nova senha de app do Gmail.'
  }
  if (/web browser|accounts\/answer\/78754|less secure|imap.*disabled/i.test(fullMessage)) {
    return 'O Gmail bloqueou o acesso IMAP. Confirme se o IMAP está ativado na conta e gere uma nova senha de app.'
  }
  if (/Mailbox doesn't exist|Nonexistent|not found|does not exist/i.test(fullMessage)) {
    return `A pasta/label IMAP não foi encontrada. Confira se "${host}" está correto e se o label configurado existe com o nome exato.`
  }

  return fullMessage
}

async function assertGerente(req: NextApiRequest, escritorioId: string, supabaseUrl: string, anonKey: string) {
  const token = getBearerToken(req)
  if (!token) return false

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) return false

  const { data: link, error: linkError } = await userClient
    .from('usuarios_escritorios')
    .select('papel')
    .eq('usuario_id', userData.user.id)
    .eq('escritorio_id', escritorioId)
    .eq('ativo', true)
    .maybeSingle()

  if (linkError) return false
  return link?.papel === 'gerente'
}

async function testImapConnection(cfg: {
  imap_host: string
  imap_port: number | null
  imap_secure: boolean | null
  imap_user: string
  imap_password: string
  imap_mailbox: string | null
}) {
  const host = cfg.imap_host
  const secure = cfg.imap_secure ?? true
  const port = Number(cfg.imap_port || (secure ? 993 : 143))
  const mailbox = cfg.imap_mailbox?.trim() || 'INBOX'

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user: cfg.imap_user,
      pass: /gmail/i.test(host) ? cfg.imap_password.replace(/\s+/g, '') : cfg.imap_password,
    },
    tls: { rejectUnauthorized: false },
    logger: false,
  })

  try {
    await client.connect()
    const opened = await client.mailboxOpen(mailbox)
    const unseen = await client.search({ seen: false }, { uid: true })
    return {
      mensagens: Number(opened.exists || 0),
      naolidas: Array.isArray(unseen) ? unseen.length : 0,
    }
  } finally {
    await Promise.race([
      client.logout().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ])
    try { client.close() } catch {}
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, erro: 'Método não permitido.' })
  }

  let escritorioId = ''
  let imapHost = 'servidor IMAP'
  let imapPort = 993

  try {
    const { supabaseUrl, serviceRole, anonKey } = getSupabaseEnv()
    escritorioId = String(req.body?.escritorio_id || '')
    if (!escritorioId) return res.status(400).json({ ok: false, erro: 'escritorio_id é obrigatório.' })

    if (!(await assertGerente(req, escritorioId, supabaseUrl, anonKey))) {
      return res.status(403).json({ ok: false, erro: 'Acesso restrito a gerentes.' })
    }

    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
    const { data: cfg, error } = await admin
      .from('compliance_config')
      .select('imap_host, imap_port, imap_secure, imap_user, imap_password, imap_mailbox')
      .eq('escritorio_id', escritorioId)
      .maybeSingle()

    if (error) throw error
    if (!cfg?.imap_host || !cfg?.imap_user || !cfg?.imap_password) {
      return res.status(200).json({ ok: false, erro: 'Preencha e salve o servidor IMAP, usuário e senha antes de testar.' })
    }
    imapHost = cfg.imap_host
    imapPort = Number(cfg.imap_port || ((cfg.imap_secure ?? true) ? 993 : 143))

    const result = await testImapConnection(cfg)

    await admin
      .from('compliance_config')
      .update({ conn_status: 'ok', conn_erro: '', conn_ultima_vez: new Date().toISOString() })
      .eq('escritorio_id', escritorioId)

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    const { supabaseUrl, serviceRole } = getSupabaseEnv()
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })
    const imapError = error as Error & { responseText?: string; responseStatus?: string; code?: string }
    console.error('[compliance-test-imap] Falha no teste IMAP:', {
      message: imapError?.message || String(error),
      responseText: imapError?.responseText,
      responseStatus: imapError?.responseStatus,
      code: imapError?.code,
    })
    const message = friendlyImapError(error, imapHost, imapPort)

    if (escritorioId) {
      await admin
        .from('compliance_config')
        .update({ conn_status: 'erro', conn_erro: message, conn_ultima_vez: new Date().toISOString() })
        .eq('escritorio_id', escritorioId)
    }

    return res.status(200).json({ ok: false, erro: message })
  }
}
