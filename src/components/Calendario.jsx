import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { X, ExternalLink, Settings } from 'lucide-react'

import { C as GlobalC } from '../lib/theme'
const C = {
  ...GlobalC,
}

const colorsSystem = {
  tarefa: C.blue,
  prazo_processual: C.red,
  audiencia: C.purple,
  reuniao: C.green,
}

const colorsGoogle = '#6366f1' // roxo para eventos do Google

const labels = {
  tarefa: 'Tarefa',
  prazo_processual: 'Prazo processual',
  audiencia: 'Audiência',
  reuniao: 'Reunião',
  google: 'Google Calendar',
}

function fmt(d) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}

function EventPill({ e, onClick }) {
  const bg = e.origem === 'google' ? colorsGoogle : (colorsSystem[e.type] || C.blue)
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', textAlign: 'left', border: 0, borderRadius: 5, padding: '3px 5px', background: bg, color: 'white', fontSize: 11, fontWeight: 700, marginTop: 3, cursor: 'pointer', whiteSpace: 'normal', lineHeight: 1.2, overflowWrap: 'anywhere' }}
    >
      {e.origem === 'google' ? '📅 ' : ''}{e.label}
    </button>
  )
}

function Modal({ event, onClose }) {
  if (!event) return null
  const proc = event.data?.processos
  const cont = event.data?.contrato
  const isGoogle = event.origem === 'google'

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: C.white, borderRadius: 14, width: '100%', maxWidth: 560, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid ' + C.border, paddingBottom: 12, marginBottom: 12 }}>
          <b>{event.label}</b>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer' }}><X /></button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
          <div><b>Tipo:</b> {isGoogle ? 'Evento Google Calendar' : (labels[event.type] || event.type)}</div>
          <div><b>Data:</b> {fmt(event.date)}</div>
          {event.data?.horario && <div><b>Horário:</b> {event.data.horario}{event.data?.horario_fim ? ` — ${event.data.horario_fim}` : ''}</div>}
          {event.data?.local && <div><b>Local:</b> {event.data.local}</div>}
          {event.data?.descricao && <div style={{ marginTop: 6 }}><b>Descrição:</b> {event.data.descricao}</div>}
          {isGoogle && event.data?.link && (
            <div style={{ marginTop: 10 }}>
              <a href={event.data.link} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
                <ExternalLink size={13} /> Abrir no Google Calendar
              </a>
            </div>
          )}
          {proc && (
            <div style={{ marginTop: 6, padding: '8px 10px', border: '1px solid ' + C.border, borderRadius: 8, background: C.bg }}>
              <b>Processo vinculado:</b><br />
              {proc.numero ? `${proc.numero} — ` : ''}{proc.titulo || 'Processo sem título'}
              {proc.tribunal ? <><br /><span>{proc.tribunal}</span></> : null}
            </div>
          )}
          {cont && (
            <div style={{ marginTop: 6, padding: '8px 10px', border: '1px solid ' + C.border, borderRadius: 8, background: C.bg }}>
              <b>Contrato vinculado:</b><br />
              {cont.numero ? `${cont.numero} — ` : ''}{cont.titulo || 'Contrato sem título'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Calendario({ profile }) {
  const [searchParams] = useSearchParams()
  const [events, setEvents] = useState([])
  const [googleEvents, setGoogleEvents] = useState([])
  const [googleConectado, setGoogleConectado] = useState(false)
  const [month, setMonth] = useState(new Date())
  const [mode, setMode] = useState('mes')
  const [mobile, setMobile] = useState(false)
  const [sel, setSel] = useState(null)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Detecta mobile
  useEffect(() => {
    const chk = () => { const m = window.innerWidth < 768; setMobile(m); if (m) setMode('agenda') }
    chk()
    window.addEventListener('resize', chk)
    return () => window.removeEventListener('resize', chk)
  }, [])

  // Verifica retorno do OAuth
  useEffect(() => {
    if (searchParams.get('calendar_connected') === 'true') {
      setSuccessMsg('Google Calendar conectado com sucesso!')
      setGoogleConectado(true)
      setTimeout(() => setSuccessMsg(''), 5000)
    }
    if (searchParams.get('calendar_error')) {
      const err = searchParams.get('calendar_error')
      setGoogleError(`Erro ao conectar Google Calendar: ${err}`)
      setTimeout(() => setGoogleError(''), 6000)
    }
  }, [searchParams])

  // Carrega atividades do sistema
  useEffect(() => {
    (async () => {
      const eid = profile.escritorio_id
      let atividadesQuery
      if (profile.role === 'gerente') {
        const r = await supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal)').eq('escritorio_id', eid).not('prazo', 'is', null).neq('status','concluida').order('prazo', { ascending: true })
        atividadesQuery = r
      } else {
        const [privadas, compartilhadas] = await Promise.all([
          supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal)').eq('escritorio_id', eid).not('prazo', 'is', null).neq('status','concluida').in('tipo', ['tarefa', 'prazo_processual']).eq('responsavel_id', profile.id).order('prazo', { ascending: true }),
          supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal)').eq('escritorio_id', eid).not('prazo', 'is', null).neq('status','concluida').in('tipo', ['audiencia', 'reuniao']).order('prazo', { ascending: true }),
        ])
        const mapa = new Map()
        ;[...(privadas.data || []), ...(compartilhadas.data || [])].forEach(x => mapa.set(x.id, x))
        atividadesQuery = { data: Array.from(mapa.values()).sort((a, b) => String(a.prazo || '').localeCompare(String(b.prazo || ''))) }
      }

      const { data: contratosData } = await supabase.from('contratos').select('id,numero,titulo,contratante,contratada').eq('escritorio_id', eid)
      const contratosMap = Object.fromEntries((contratosData || []).map(c => [c.id, c]))

      setEvents(
        (atividadesQuery.data || []).map(x => ({
          id: x.id,
          date: x.prazo,
          label: x.titulo,
          type: x.tipo,
          origem: 'sistema',
          data: { ...x, contrato: x.contrato_id ? contratosMap[x.contrato_id] : null },
        })).sort((a, b) => String(a.date).localeCompare(String(b.date)))
      )
    })()
  }, [profile.escritorio_id, profile.id, profile.role])

  // Carrega eventos do Google Calendar
  useEffect(() => {
    loadGoogleEvents()
  }, [profile.escritorio_id, month])

  async function loadGoogleEvents() {
    if (!profile?.escritorio_id) return
    setLoadingGoogle(true)
    setGoogleError('')
    try {
      const y = month.getFullYear()
      const m = month.getMonth() + 1
      const res = await fetch(`/api/google/calendar?escritorio_id=${profile.escritorio_id}&mes=${m}&ano=${y}`)
      const data = await res.json()

      if (data.conectado === false) {
        setGoogleConectado(false)
        setGoogleEvents([])
      } else if (data.error) {
        setGoogleError(data.error)
        setGoogleEvents([])
      } else {
        setGoogleConectado(true)
        setGoogleEvents(
          (data.eventos || []).map(e => ({
            id: 'g_' + e.id,
            date: e.data,
            label: e.titulo,
            type: 'google',
            origem: 'google',
            data: { horario: e.horario, horario_fim: e.horario_fim, local: e.local, descricao: e.descricao, link: e.link },
          }))
        )
      }
    } catch {
      setGoogleError('Não foi possível carregar eventos do Google Calendar.')
    } finally {
      setLoadingGoogle(false)
    }
  }

  const allEvents = useMemo(() => {
    return [...events, ...googleEvents].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [events, googleEvents])

  const y = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(y, m, 1)
  const days = new Date(y, m + 1, 0).getDate()
  const start = first.getDay()
  const cells = Array.from({ length: start + days }, (_, i) => i < start ? null : i - start + 1)

  const byDate = useMemo(() => allEvents.reduce((acc, e) => {
    ;(acc[e.date] ||= []).push(e)
    return acc
  }, {}), [allEvents])

  const agenda = allEvents.filter(e => {
    const d = new Date(e.date + 'T12:00:00')
    return d.getFullYear() === y && d.getMonth() === m
  })

  const next = (n) => setMonth(new Date(y, m + n, 1))

  const colorsLegend = {
    ...colorsSystem,
    google: colorsGoogle,
  }
  const labelsLegend = { ...labels }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Calendário</h1>
          <p style={{ color: C.muted }}>Atividades do sistema{googleConectado ? ' + Google Calendar' : ''}.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {profile?.role === 'gerente' && (
            <a
              href="/configuracao-calendario"
              style={{ border: '1px solid ' + C.border, background: C.white, borderRadius: 8, padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.text, fontWeight: 700, textDecoration: 'none' }}
            >
              <Settings size={14} />
              {googleConectado ? 'Google Calendar ✓' : 'Conectar Google Calendar'}
            </a>
          )}
          <button onClick={() => setMode('agenda')} style={{ border: '1px solid ' + C.border, borderRadius: 8, padding: '8px 12px', background: mode === 'agenda' ? C.navy : C.white, color: mode === 'agenda' ? 'white' : C.text }}>Agenda</button>
          <button onClick={() => setMode('mes')} style={{ border: '1px solid ' + C.border, borderRadius: 8, padding: '8px 12px', background: mode === 'mes' ? C.navy : C.white, color: mode === 'mes' ? 'white' : C.text }}>Mês</button>
        </div>
      </div>

      {successMsg && (
        <div style={{ background: C.greenBg, border: '1px solid '+C.green, borderRadius: 8, padding: '10px 14px', marginTop: 12, color: C.green, fontWeight: 700 }}>
          ✓ {successMsg}
        </div>
      )}
      {googleError && (
        <div style={{ background: C.redBg, border: '1px solid '+C.red, borderRadius: 8, padding: '10px 14px', marginTop: 12, color: C.red }}>
          {googleError}
        </div>
      )}

      <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, marginTop: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid ' + C.border }}>
          <button onClick={() => next(-1)} style={{ border: 0, background: 'none', fontSize: 22, cursor: 'pointer' }}>‹</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <b>{month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b>
            {loadingGoogle && <span style={{ fontSize: 11, color: C.muted }}>🔄 Google...</span>}
          </div>
          <button onClick={() => next(1)} style={{ border: 0, background: 'none', fontSize: 22, cursor: 'pointer' }}>›</button>
        </div>

        {mode === 'mes' && !mobile ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid ' + C.border }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} style={{ padding: 10, fontSize: 11, fontWeight: 800, color: C.muted, textAlign: 'center' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {cells.map((day, i) => {
                const date = day ? `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
                return (
                  <div key={i} style={{ minHeight: 96, padding: 8, borderRight: '1px solid ' + C.border, borderBottom: '1px solid ' + C.border, background: day ? C.white : C.bg }}>
                    {day && (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{day}</div>
                        {(byDate[date] || []).map(e => (
                          <EventPill key={e.type + e.id} e={e} onClick={() => setSel(e)} />
                        ))}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            {agenda.map(e => (
              <button
                key={e.type + e.id}
                onClick={() => setSel(e)}
                style={{ textAlign: 'left', background: C.white, border: '1px solid ' + C.border, borderLeft: `5px solid ${e.origem === 'google' ? colorsGoogle : (colorsSystem[e.type] || C.blue)}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 800 }}>
                  {fmt(e.date)} · {e.origem === 'google' ? '📅 Google Calendar' : labels[e.type]}
                </div>
                <b>{e.label}</b>
                {e.data?.processos && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    Processo: {e.data.processos.numero || e.data.processos.titulo}
                  </div>
                )}
              </button>
            ))}
            {!agenda.length && <div style={{ padding: 30, textAlign: 'center', color: C.muted }}>Nenhum evento neste mês.</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: C.muted, marginTop: 12 }}>
        {Object.entries(colorsLegend).map(([k, color]) => (
          <span key={k}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, background: color, marginRight: 5 }} />{labelsLegend[k]}</span>
        ))}
      </div>

      <Modal event={sel} onClose={() => setSel(null)} />
    </div>
  )
}
