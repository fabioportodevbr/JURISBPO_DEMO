import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query

  if (!code || typeof code !== 'string') {
    return res.redirect('/?calendar_error=no_code')
  }

  try {
    // Troca o code pelo access_token e refresh_token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokens.refresh_token) {
      return res.redirect('/calendario?calendar_error=no_refresh_token')
    }

    // Decodifica o state para pegar escritorio_id e usuario_id
    const { escritorio_id, usuario_id } = JSON.parse(
      Buffer.from(state as string, 'base64').toString()
    )

    // Calcula a expiração do token
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString()

    // Salva ou atualiza no banco
    const { error } = await supabaseAdmin
      .from('google_calendar_config')
      .upsert({
        escritorio_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: tokenExpiry,
        calendar_id: 'primary',
        conectado_por: usuario_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'escritorio_id' })

    if (error) {
      console.error('Erro ao salvar tokens:', error)
      return res.redirect('/calendario?calendar_error=db_error')
    }

    return res.redirect('/calendario?calendar_connected=true')
  } catch (err) {
    console.error('Erro no callback Google:', err)
    return res.redirect('/calendario?calendar_error=unknown')
  }
}
