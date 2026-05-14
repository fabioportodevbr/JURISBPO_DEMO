import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { X, ExternalLink, Settings, Search } from 'lucide-react'

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

function eventColor(e) {
  return e.origem === 'google' ? colorsGoogle : (colorsSystem[e.type] || C.blue)
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function collectSearchValues(value, seen = new WeakSet()) {
  if (value == null) return []
  if (['string', 'number', 'boolean'].includes(typeof value)) return [String(value)]
  if (typeof value !== 'object') return []
  if (seen.has(value)) return []
  seen.add(value)
  if (Array.isArray(value)) return value.flatMap(item => collectSearchValues(item, seen))
  return Object.values(value).flatMap(item => collectSearchValues(item, seen))
}

function eventSearchText(event) {
  return [
    labels[event.type],
    event.origem,
    fmt(event.date),
    ...collectSearchValues(event),
  ].join(' ')
}

function matchesSearch(event, query) {
  const q = normalizeSearch(query)
  if (!q) return true
  const text = normalizeSearch(eventSearchText(event))
  const qDigits = q.replace(/\D/g, '')
  const textDigits = text.replace(/\D/g, '')
  return text.includes(q) || (qDigits.length >= 3 && textDigits.includes(qDigits))
}

function EventCard({ event, onClick, compact = false }) {
  return (
    <button
      onClick={onClick}
      style={{ textAlign: 'left', background: C.white, border: '1px solid ' + C.border, borderLeft: `5px solid ${eventColor(event)}`, borderRadius: 10, padding: compact ? 10 : 12, cursor: 'pointer', color: C.text }}
    >
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 800 }}>
        {fmt(event.date)} · {event.origem === 'google' ? 'Google Calendar' : labels[event.type]}
        {event.data?.horario ? ` · ${event.data.horario}` : ''}
      </div>
      <b style={{ display: 'block', marginTop: 2 }}>{event.label}</b>
      {event.data?.processos && (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Processo: {event.data.processos.numero || event.data.processos.titulo}
        </div>
      )}
      {event.data?.responsavel_nome && (
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          Responsavel: {event.data.responsavel_nome}
        </div>
      )}
    </button>
  )
}

function DayMarker({ events, onClick }) {
  const visible = events.slice(0, 4)
  return (
    <button
      onClick={onClick}
      title={`${events.length} evento(s) neste dia`}
      style={{ width: '100%', minHeight: 28, border: '1px solid ' + C.border, borderRadius: 8, padding: '5px 6px', background: C.bg, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, cursor: 'pointer' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {visible.map((e, idx) => <span key={e.type + e.id + idx} style={{ width: 7, height: 7, borderRadius: 999, background: eventColor(e), flexShrink: 0 }} />)}
        {events.length > visible.length && <span style={{ fontSize: 10, color: C.muted, fontWeight: 900, lineHeight: 1 }}>+{events.length - visible.length}</span>}
      </span>
      <span style={{ fontSize: 11, color: C.text, fontWeight: 900, lineHeight: 1 }}>{events.length}</span>
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
      onMouseDown={e => e.target === e.currentTarget && (e.currentTarget._md = 1)} onClick={e => e.target === e.currentTarget && e.currentTarget._md && (delete e.currentTarget._md, onClose())}
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

function DayEventsModal({ day, onClose, onOpenEvent }) {
  if (!day) return null
  return (
    <div
      onMouseDown={e => e.target === e.currentTarget && (e.currentTarget._md = 1)} onClick={e => e.target === e.currentTarget && e.currentTarget._md && (delete e.currentTarget._md, onClose())}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 590, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ background: C.white, borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid ' + C.border, padding: 16, alignItems: 'center' }}>
          <div>
            <b style={{ color: C.text }}>{fmt(day.date)}</b>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{day.events.length} evento(s)</div>
          </div>
          <button onClick={onClose} style={{ border: 0, background: 'none', cursor: 'pointer', color: C.text, display: 'flex', padding: 4 }}><X /></button>
        </div>
        <div style={{ padding: 14, overflow: 'auto', display: 'grid', gap: 8 }}>
          {day.events.map(e => (
            <button
              key={e.type + e.id}
              onClick={() => onOpenEvent(e)}
              style={{ textAlign: 'left', border: '1px solid ' + C.border, borderLeft: `5px solid ${eventColor(e)}`, borderRadius: 10, padding: 12, background: C.white, color: C.text, cursor: 'pointer' }}
            >
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 800, marginBottom: 4 }}>
                {e.data?.horario ? `${e.data.horario}${e.data?.horario_fim ? ` - ${e.data.horario_fim}` : ''}` : (e.origem === 'google' ? 'Google Calendar' : labels[e.type])}
              </div>
              <b style={{ fontSize: 14 }}>{e.label}</b>
            </button>
          ))}
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
  const [dayModal, setDayModal] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
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
        const r = await supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal,parte_contraria,responsavel_id)').eq('escritorio_id', eid).not('prazo', 'is', null).neq('status','concluida').order('prazo', { ascending: true })
        atividadesQuery = r
      } else {
        const [privadas, compartilhadas] = await Promise.all([
          supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal,parte_contraria,responsavel_id)').eq('escritorio_id', eid).not('prazo', 'is', null).neq('status','concluida').in('tipo', ['tarefa', 'prazo_processual']).eq('responsavel_id', profile.id).order('prazo', { ascending: true }),
          supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal,parte_contraria,responsavel_id)').eq('escritorio_id', eid).not('prazo', 'is', null).neq('status','concluida').in('tipo', ['audiencia', 'reuniao']).order('prazo', { ascending: true }),
        ])
        const mapa = new Map()
        ;[...(privadas.data || []), ...(compartilhadas.data || [])].forEach(x => mapa.set(x.id, x))
        atividadesQuery = { data: Array.from(mapa.values()).sort((a, b) => String(a.prazo || '').localeCompare(String(b.prazo || ''))) }
      }

      const [{ data: contratosData }, { data: membrosData }] = await Promise.all([
        supabase.from('contratos').select('id,numero,titulo,contratante,contratada').eq('escritorio_id', eid),
        supabase.from('usuarios_escritorios').select('usuario_id,profiles(id,nome,email)').eq('escritorio_id', eid).eq('ativo', true),
      ])
      const contratosMap = Object.fromEntries((contratosData || []).map(c => [c.id, c]))
      const teamMap = Object.fromEntries((membrosData || []).map(m => [m.usuario_id, m.profiles?.nome || m.profiles?.email || m.usuario_id]))

      setEvents(
        (atividadesQuery.data || []).map(x => {
          const processo = x.processos ? { ...x.processos, responsavel_nome: teamMap[x.processos.responsavel_id] || '' } : null
          return ({
          id: x.id,
          date: x.prazo,
          label: x.titulo,
          type: x.tipo,
          origem: 'sistema',
          data: { ...x, processos: processo, contrato: x.contrato_id ? contratosMap[x.contrato_id] : null, responsavel_nome: teamMap[x.responsavel_id] || '', criado_por_nome: teamMap[x.criado_por] || '' },
        })}).sort((a, b) => String(a.date).localeCompare(String(b.date)))
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
  const searchQuery = searchTerm.trim()
  const filteredEvents = useMemo(() => {
    return searchQuery ? allEvents.filter(e => matchesSearch(e, searchQuery)) : allEvents
  }, [allEvents, searchQuery])
  const visibleEvents = searchQuery ? filteredEvents : allEvents

  const y = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(y, m, 1)
  const days = new Date(y, m + 1, 0).getDate()
  const start = first.getDay()
  const cells = Array.from({ length: start + days }, (_, i) => i < start ? null : i - start + 1)

  const byDate = useMemo(() => visibleEvents.reduce((acc, e) => {
    ;(acc[e.date] ||= []).push(e)
    return acc
  }, {}), [visibleEvents])

  const agenda = visibleEvents.filter(e => {
    if (searchQuery) return true
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

      <div style={{ marginTop: 18, background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color={C.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar na agenda"
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid ' + C.border, borderRadius: 9, background: C.bg, color: C.text, padding: '10px 42px 10px 36px', fontSize: 14, outline: 'none' }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              title="Limpar busca"
              style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', padding: 6 }}
            >
              <X size={15} />
            </button>
          )}
        </div>
        {searchQuery && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8, color: C.muted, fontSize: 12, fontWeight: 800 }}>
              <span>{filteredEvents.length} resultado(s)</span>
              <span>{googleConectado ? 'Sistema + Google do mes exibido' : 'Sistema'}</span>
            </div>
            {filteredEvents.length ? (
              <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto' }}>
                {filteredEvents.map(e => <EventCard key={e.type + e.id} event={e} compact onClick={() => setSel(e)} />)}
              </div>
            ) : (
              <div style={{ padding: 18, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 10 }}>Nenhum evento encontrado.</div>
            )}
          </div>
        )}
      </div>

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
                const dayEvents = day ? (byDate[date] || []) : []
                return (
                  <div key={i} style={{ height: 96, padding: 8, borderRight: '1px solid ' + C.border, borderBottom: '1px solid ' + C.border, background: day ? C.white : C.bg, boxSizing: 'border-box', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {day && (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{day}</div>
                        {dayEvents.length > 0 && (
                          <DayMarker events={dayEvents} onClick={() => setDayModal({ date, events: dayEvents })} />
                        )}
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
                style={{ textAlign: 'left', background: C.white, border: '1px solid ' + C.border, borderLeft: `5px solid ${eventColor(e)}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}
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

      <DayEventsModal day={dayModal} onClose={() => setDayModal(null)} onOpenEvent={(event) => { setDayModal(null); setSel(event) }} />
      <Modal event={sel} onClose={() => setSel(null)} />
    </div>
  )
}
