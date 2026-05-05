import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getPushEmailConfig, type PushEmailConfig } from '@/features/pushEmail/config'
import { createPushEmailSupabase } from '@/features/pushEmail/db/supabaseServer'
import { ingestUnreadEmails } from '@/features/pushEmail/services/emailIngestor'

type ApiResponse =
  | { ok: true; processed: number; saved: number; ignored: number; failed: number }
  | { ok: false; error: string }

function getBearerToken(req: NextApiRequest) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice('Bearer '.length).trim()
}

function getProvidedSecret(req: NextApiRequest) {
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret : undefined
  const headerSecret = typeof req.headers['x-cron-secret'] === 'string' ? req.headers['x-cron-secret'] : undefined
  const bearer = getBearerToken(req)
  return querySecret || headerSecret || bearer
}

async function isGerenteRequest(req: NextApiRequest, config: PushEmailConfig) {
  const token = getBearerToken(req)
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !anonKey) return false

  const authClient = createClient(config.SUPABASE_URL, anonKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) return false

  const admin = createPushEmailSupabase(config)
  const { data, error } = await admin
    .from('usuarios_escritorios')
    .select('id')
    .eq('usuario_id', userData.user.id)
    .eq('ativo', true)
    .eq('papel', 'gerente')
    .limit(1)

  if (error) {
    console.error('[push-email] Erro ao validar gerente:', error)
    return false
  }

  return Boolean(data?.length)
}

async function isAuthorized(req: NextApiRequest, config: PushEmailConfig) {
  const configuredSecret = config.PUSH_EMAIL_CRON_SECRET || config.CRON_SECRET
  const providedSecret = getProvidedSecret(req)

  if (configuredSecret && providedSecret === configuredSecret) return true
  if (await isGerenteRequest(req, config)) return true

  return !configuredSecret && process.env.NODE_ENV !== 'production'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'Metodo nao permitido.' })
  }

  let config: PushEmailConfig
  try {
    config = getPushEmailConfig()
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Configuracao invalida.' })
  }

  if (!(await isAuthorized(req, config))) {
    return res.status(401).json({ ok: false, error: 'Nao autorizado.' })
  }

  try {
    const result = await ingestUnreadEmails()
    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    console.error('[push-email] Erro ao executar ingestao:', err)
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Erro ao processar e-mails.' })
  }
}
