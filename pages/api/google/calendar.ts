import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (data.error) {
    console.error('Google refresh token error:', data.error, data.error_description)
  }
  return data.access_token || null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { escritorio_id, mes, ano } = req.query

  if (!escritorio_id) return res.status(400).json({ error: 'escritorio_id obrigatório' })

  try {
    // Busca config do Google Calendar do escritório
    const { data: config, error: configError } = await supabaseAdmin
      .from('google_calendar_config')
      .select('*')
      .eq('escritorio_id', escritorio_id)
      .single()

    if (configError || !config) {
      return res.status(404).json({ error: 'Google Calendar não configurado', conectado: false })
    }

    // Verifica se precisa renovar o token
    let accessToken = config.access_token
    const expiry = config.token_expiry ? new Date(config.token_expiry) : null
    const needsRefresh = !expiry || expiry <= new Date(Date.now() + 60000)

    if (needsRefresh) {
      const newToken = await refreshAccessToken(config.refresh_token)
      if (!newToken) return res.status(401).json({ error: 'Token expirado, reconecte o Google Calendar' })

      accessToken = newToken
      const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString()

      await supabaseAdmin
        .from('google_calendar_config')
        .update({ access_token: newToken, token_expiry: newExpiry, updated_at: new Date().toISOString() })
        .eq('escritorio_id', escritorio_id)
    }

    // Define o intervalo do mês
    const y = Number(ano) || new Date().getFullYear()
    const m = Number(mes) || new Date().getMonth() + 1
    const timeMin = new Date(y, m - 1, 1).toISOString()
    const timeMax = new Date(y, m, 0, 23, 59, 59).toISOString()

    // Busca eventos no Google Calendar
    const calendarRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar_id || 'primary')}/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      }),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!calendarRes.ok) {
      const err = await calendarRes.json()
      return res.status(calendarRes.status).json({ error: err.error?.message || 'Erro ao buscar eventos' })
    }

    const calendarData = await calendarRes.json()

    // Formata os eventos para o frontend
    const eventos = (calendarData.items || []).map((item: any) => ({
      id: item.id,
      titulo: item.summary || '(sem título)',
      descricao: item.description || '',
      data: item.start?.date || item.start?.dateTime?.slice(0, 10),
      horario: item.start?.dateTime ? item.start.dateTime.slice(11, 16) : null,
      horario_fim: item.end?.dateTime ? item.end.dateTime.slice(11, 16) : null,
      local: item.location || '',
      link: item.htmlLink || '',
      origem: 'google',
      cor: item.colorId || null,
    }))

    return res.status(200).json({ eventos, conectado: true })
  } catch (err) {
    console.error('Erro ao buscar Google Calendar:', err)
    return res.status(500).json({ error: 'Erro interno' })
  }
}
