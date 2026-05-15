import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { CheckCircle, AlertCircle, Calendar, RefreshCw, Trash2 } from 'lucide-react'

const C = {
  white: '#fff', text: '#0f172a', muted: '#64748b',
  border: '#e5e7eb', blue: '#1d4ed8', blueBg: '#dbeafe',
  green: '#16a34a', greenBg: '#dcfce7',
  red: '#dc2626', redBg: '#fee2e2',
  bg: '#f8fafc',
}

export default function ConfiguracaoCalendario({ profile }) {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [desconectando, setDesconectando] = useState(false)

  const isGerente = profile?.role === 'gerente'

  useEffect(() => {
    loadConfig()
  }, [profile?.escritorio_id])

  async function loadConfig() {
    if (!profile?.escritorio_id) return
    setLoading(true)
    const { data } = await supabase
      .from('google_calendar_config')
      .select('id, calendar_id, updated_at, conectado_por')
      .eq('escritorio_id', profile.escritorio_id)
      .maybeSingle()
    setConfig(data)
    setLoading(false)
  }

  function conectar() {
    const state = btoa(JSON.stringify({
      escritorio_id: profile.escritorio_id,
      usuario_id: profile.id,
    }))

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent',
      state,
    })

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  async function desconectar() {
    if (!confirm('Tem certeza? O Google Calendar será desvinculado do escritório.')) return
    setDesconectando(true)
    await supabase
      .from('google_calendar_config')
      .delete()
      .eq('escritorio_id', profile.escritorio_id)
    setConfig(null)
    setDesconectando(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0 }}>Google Calendar</h1>
      <p style={{ color: C.muted, marginTop: 6, marginBottom: 24 }}>
        Integre o calendário do escritório com o Google Calendar para sincronizar atividades automaticamente.
      </p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Carregando...</div>
      ) : config ? (
        <div style={{ background: C.greenBg, border: '1px solid #86efac', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <CheckCircle size={20} color={C.green} />
            <b style={{ color: C.green }}>Google Calendar conectado!</b>
          </div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8 }}>
            <div><b>Calendário:</b> {config.calendar_id || 'principal'}</div>
            <div><b>Última atualização:</b> {config.updated_at ? new Date(config.updated_at).toLocaleString('pt-BR') : '—'}</div>
          </div>
          {isGerente && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                onClick={conectar}
                style={{ border: '1px solid ' + C.green, background: C.white, color: C.green, borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} /> Reconectar
              </button>
              <button
                onClick={desconectar}
                disabled={desconectando}
                style={{ border: '1px solid #fca5a5', background: C.redBg, color: C.red, borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={14} /> {desconectando ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertCircle size={20} color={C.muted} />
            <b style={{ color: C.muted }}>Google Calendar não conectado</b>
          </div>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
            Conecte a conta Google do escritório para que as atividades (audiências, reuniões, prazos e tarefas)
            sejam exibidas junto com os eventos do Google Calendar na seção Calendário.
          </p>
          {isGerente ? (
            <button
              onClick={conectar}
              style={{ background: C.blue, color: C.white, border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: 18, height: 18 }} />
              Conectar Google Calendar
            </button>
          ) : (
            <div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>
              Apenas o gerente pode conectar o Google Calendar.
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, background: C.bg, border: '1px solid ' + C.border, borderRadius: 12, padding: 16 }}>
        <b style={{ fontSize: 13 }}>Como funciona?</b>
        <ul style={{ fontSize: 13, color: C.muted, marginTop: 8, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>O gerente conecta a conta Google do escritório uma única vez</li>
          <li>Todos os usuários passam a ver os eventos do Google Calendar na seção Calendário</li>
          <li>As atividades do JurisBPO aparecem integradas com os eventos do Google</li>
          <li>Eventos criados no Google Calendar também aparecem no sistema</li>
        </ul>
      </div>
    </div>
  )
}
