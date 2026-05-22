import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Scale, X, ExternalLink } from 'lucide-react'
import { C } from '../lib/theme'

const STORAGE_KEY = 'jurisbpo:push_notificados'
const CHECK_INTERVAL_MS = 120_000
const JANELA_HORAS = 24
const MAX_VISIBLE = 8

function getDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Set() }
}

function saveDismissed(id) {
  const s = getDismissed()
  s.add(id)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...s])) } catch {}
}

export default function PushNotificacaoPopup({ profile }) {
  const [queue, setQueue] = useState([])
  const timerRef = useRef(null)
  const navigate = useNavigate()

  const check = async () => {
    if (!profile?.escritorio_id) return
    const desde = new Date(Date.now() - JANELA_HORAS * 3_600_000).toISOString()
    const { data } = await supabase
      .from('andamentos_processuais_push')
      .select('id,numero_processo,tribunal,movimento,corpo_resumo,status_associacao,processo_id,criado_em')
      .eq('escritorio_id', profile.escritorio_id)
      .in('status_associacao', ['pendente', 'associado'])
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(20)

    if (!data?.length) return
    const dismissed = getDismissed()
    const novos = data.filter(a => !dismissed.has(a.id))
    if (!novos.length) return
    setQueue(prev => {
      const existingIds = new Set(prev.map(x => x.id))
      return [...prev, ...novos.filter(a => !existingIds.has(a.id))].slice(0, MAX_VISIBLE)
    })
  }

  useEffect(() => {
    check()
    timerRef.current = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [profile?.escritorio_id])

  const dispense = (id) => {
    saveDismissed(id)
    setQueue(prev => prev.filter(a => a.id !== id))
  }

  const dispenseTodos = () => {
    queue.forEach(a => saveDismissed(a.id))
    setQueue([])
  }

  if (!queue.length) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9998,
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
        <PushCard
          key={a.id}
          item={a}
          onDismiss={() => dispense(a.id)}
          onAbrirProcesso={a.processo_id ? () => navigate(`/processos?processo_id=${a.processo_id}`) : null}
        />
      ))}
    </div>
  )
}

function PushCard({ item: a, onDismiss, onAbrirProcesso }) {
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

  const abrirEFechar = () => {
    onAbrirProcesso()
    close()
  }

  const texto = a.movimento || a.corpo_resumo || 'Novo andamento processual recebido'

  return (
    <div style={{
      background: C.white,
      border: `1.5px solid ${C.amber}`,
      borderRadius: 12,
      padding: '14px 14px 12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
      transform: visible && !exiting ? 'translateX(0) scale(1)' : 'translateX(120%) scale(0.95)',
      opacity: visible && !exiting ? 1 : 0,
      transition: 'transform 0.28s cubic-bezier(.22,1,.36,1), opacity 0.28s ease',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: C.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Scale size={16} color={C.amber} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              color: C.amber, background: C.amberBg, borderRadius: 20, padding: '2px 8px',
            }}>
              Push Processual
            </span>
            {a.status_associacao === 'pendente' && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: C.muted, background: C.grayBg, borderRadius: 20, padding: '2px 8px',
              }}>
                Pendente
              </span>
            )}
          </div>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 700, color: C.text,
            lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {texto}
          </p>
        </div>
        <button onClick={close} style={{
          border: 'none', background: 'none', cursor: 'pointer', padding: 2,
          color: C.muted, flexShrink: 0, display: 'flex', marginTop: -2,
        }}>
          <X size={15} />
        </button>
      </div>

      {a.numero_processo && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: C.blue, fontWeight: 600 }}>
            {a.numero_processo}{a.tribunal ? ` — ${a.tribunal}` : ''}
          </div>
        </div>
      )}

      <div style={{
        marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
      }}>
        {onAbrirProcesso && (
          <button onClick={abrirEFechar} style={{
            fontSize: 12, fontWeight: 700, color: C.blue,
            background: C.blueBg, border: `1px solid ${C.blue}`,
            borderRadius: 7, padding: '4px 12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            opacity: 0.9,
          }}>
            <ExternalLink size={11} />
            Abrir processo
          </button>
        )}
        <button onClick={close} style={{
          fontSize: 12, fontWeight: 700, color: C.amber,
          background: C.amberBg, border: `1px solid ${C.amber}`,
          borderRadius: 7, padding: '4px 12px', cursor: 'pointer',
        }}>
          OK, entendi
        </button>
      </div>
    </div>
  )
}
