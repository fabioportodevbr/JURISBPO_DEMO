import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Bell, X, Calendar, Clock } from 'lucide-react'
import { C } from '../lib/theme'

const STORAGE_KEY = 'jurisbpo:alertas_dispensados'
const CHECK_INTERVAL_MS = 60_000

const TIPO_LABEL = {
  tarefa: 'Tarefa',
  prazo_processual: 'Prazo Processual',
  audiencia: 'Audiência',
  reuniao: 'Reunião',
}
const TIPO_COLOR = {
  tarefa: C.blue,
  prazo_processual: C.red,
  audiencia: C.purple,
  reuniao: C.green,
}

function dateBR(d) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : ''
}

function calcAlertDatetime(atividade) {
  if (!atividade.alerta_antecedencia || !atividade.prazo) return null
  const prazoStr = atividade.horario
    ? `${atividade.prazo}T${atividade.horario}`
    : `${atividade.prazo}T23:59:00`
  const prazoMs = new Date(prazoStr).getTime()
  if (isNaN(prazoMs)) return null
  const factorMs = { minutos: 60_000, horas: 3_600_000, dias: 86_400_000 }
  const antecipacaoMs = atividade.alerta_antecedencia * (factorMs[atividade.alerta_unidade] ?? 60_000)
  return new Date(prazoMs - antecipacaoMs)
}

function getDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Set() }
}

function dismiss(id) {
  const s = getDismissed()
  s.add(id)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...s])) } catch {}
}

export default function AlertaAtividadePopup({ profile }) {
  const [queue, setQueue] = useState([])
  const timerRef = useRef(null)

  const check = async () => {
    if (!profile?.escritorio_id) return
    const { data } = await supabase
      .from('atividades')
      .select('id,tipo,titulo,prazo,horario,alerta_antecedencia,alerta_unidade,processos(numero,titulo)')
      .eq('escritorio_id', profile.escritorio_id)
      .not('alerta_antecedencia', 'is', null)
      .not('prazo', 'is', null)
      .in('status', ['a_fazer', 'em_andamento'])

    if (!data?.length) return
    const dismissed = getDismissed()
    const now = Date.now()
    const pending = data.filter(a => {
      if (dismissed.has(a.id)) return false
      const alertAt = calcAlertDatetime(a)
      return alertAt && alertAt.getTime() <= now
    })
    if (pending.length) setQueue(prev => {
      const existingIds = new Set(prev.map(x => x.id))
      return [...prev, ...pending.filter(a => !existingIds.has(a.id))]
    })
  }

  useEffect(() => {
    check()
    timerRef.current = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [profile?.escritorio_id])

  const dispense = (id) => {
    dismiss(id)
    setQueue(prev => prev.filter(a => a.id !== id))
  }

  const dispenseTodos = () => {
    queue.forEach(a => dismiss(a.id))
    setQueue([])
  }

  if (!queue.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 360, width: '100%',
    }}>
      {queue.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={dispenseTodos}
            style={{
              fontSize: 12, color: C.muted, background: 'transparent',
              border: 'none', cursor: 'pointer', fontWeight: 700, padding: '2px 4px',
            }}
          >
            Dispensar todos ({queue.length})
          </button>
        </div>
      )}
      {queue.map(a => (
        <AlertaCard key={a.id} atividade={a} onDismiss={() => dispense(a.id)} />
      ))}
    </div>
  )
}

function AlertaCard({ atividade: a, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30)
    return () => clearTimeout(t)
  }, [])

  const close = () => {
    setExiting(true)
    setTimeout(onDismiss, 280)
  }

  const color = TIPO_COLOR[a.tipo] || C.blue
  const unidade = { minutos: 'min', horas: a.alerta_antecedencia === 1 ? 'hora' : 'horas', dias: a.alerta_antecedencia === 1 ? 'dia' : 'dias' }[a.alerta_unidade] ?? ''

  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${color}`,
      borderRadius: 12,
      padding: '14px 14px 12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
      transform: visible && !exiting ? 'translateX(0) scale(1)' : 'translateX(120%) scale(0.95)',
      opacity: visible && !exiting ? 1 : 0,
      transition: 'transform 0.28s cubic-bezier(.22,1,.36,1), opacity 0.28s ease',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bell size={16} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              color, background: `${color}18`, borderRadius: 20, padding: '2px 8px',
            }}>
              {TIPO_LABEL[a.tipo] || a.tipo}
            </span>
          </div>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 700, color: C.text,
            lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {a.titulo}
          </p>
        </div>
        <button onClick={close} style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: 2,
          color: C.muted, flexShrink: 0, display: 'flex', marginTop: -2,
        }}>
          <X size={15} />
        </button>
      </div>

      {/* Detalhes */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {a.prazo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted }}>
            <Calendar size={12} />
            <span>{dateBR(a.prazo)}{a.horario ? ` às ${a.horario}` : ''}</span>
          </div>
        )}
        {a.processos && (
          <div style={{ fontSize: 12, color: C.blue, fontWeight: 600 }}>
            {a.processos.numero || a.processos.titulo}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div style={{
        marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted }}>
          <Clock size={11} />
          <span>Alerta: {a.alerta_antecedencia} {unidade} antes do prazo</span>
        </div>
        <button onClick={close} style={{
          fontSize: 12, fontWeight: 700, color: color,
          background: `${color}14`, border: `1px solid ${color}40`,
          borderRadius: 7, padding: '4px 12px', cursor: 'pointer',
        }}>
          OK, entendi
        </button>
      </div>
    </div>
  )
}
