import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { MessageSquare, X, Send, Archive, Trash2, Clock, ChevronDown } from 'lucide-react'

const C = {
  navy: '#022c22', white: '#fff', text: '#0f172a', muted: '#64748b',
  border: '#e5e7eb', green: '#10b981', greenBg: '#dcfce7',
  red: '#dc2626', redBg: '#fee2e2', amber: '#b45309', amberBg: '#fef3c7',
  grayBg: '#f1f5f9',
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fullDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Pill({ children, color, bg }) {
  return <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: bg, color, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{children}</span>
}

function Avatar({ nome, size = 32 }) {
  const initials = (nome || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  const hue = [...(nome || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `hsl(${hue},55%,42%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: size * 0.38, fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

export default function MuralRecados({ profile }) {
  const [open, setOpen] = useState(false)
  const [recados, setRecados] = useState([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [showArquivados, setShowArquivados] = useState(false)
  const panelRef = useRef(null)
  const textareaRef = useRef(null)
  const isGerente = profile?.role === 'gerente'

  const load = async () => {
    const { data } = await supabase
      .from('mural_recados')
      .select('*')
      .eq('escritorio_id', profile.escritorio_id)
      .order('criado_em', { ascending: false })
    setRecados(data || [])
  }

  useEffect(() => { load() }, [profile.escritorio_id])

  useEffect(() => {
    const channel = supabase
      .channel('mural_recados_' + profile.escritorio_id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mural_recados', filter: `escritorio_id=eq.${profile.escritorio_id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile.escritorio_id])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false) }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const ativos = recados.filter(r => r.status === 'ativo')
  const arquivados = recados.filter(r => r.status === 'arquivado')
  const excluidos = recados.filter(r => r.status === 'excluido')

  const publicar = async () => {
    if (!texto.trim()) return
    setSending(true)
    await supabase.from('mural_recados').insert({
      escritorio_id: profile.escritorio_id,
      texto: texto.trim(),
      criado_por: profile.id,
      criado_por_nome: profile.nome || profile.email || 'Usuário',
      status: 'ativo',
    })
    setTexto('')
    setSending(false)
    await load()
  }

  const dispensar = async (r) => {
    await supabase.from('mural_recados').update({
      status: 'arquivado',
      arquivado_por: profile.id,
      arquivado_por_nome: profile.nome || profile.email,
      arquivado_em: new Date().toISOString(),
    }).eq('id', r.id)
    await load()
  }

  const excluir = async (r) => {
    if (!confirm('Excluir este recado? Ele ficará oculto para outros usuários.')) return
    await supabase.from('mural_recados').update({
      status: 'excluido',
      excluido_por: profile.id,
      excluido_por_nome: profile.nome || profile.email,
      excluido_em: new Date().toISOString(),
    }).eq('id', r.id)
    await load()
  }

  const podeAgir = (r) => isGerente || r.criado_por === profile.id

  const CardRecado = ({ r, variant = 'ativo' }) => (
    <div style={{ background: variant === 'excluido' ? '#fafafa' : C.white, border: '1px solid ' + (variant === 'excluido' ? '#e5e7eb' : C.border), borderRadius: 12, padding: '12px 14px', opacity: variant === 'excluido' ? 0.7 : 1 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Avatar nome={r.criado_por_nome} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.criado_por_nome}</span>
            <span style={{ fontSize: 11, color: C.muted }} title={fullDate(r.criado_em)}><Clock size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{timeAgo(r.criado_em)}</span>
            {variant === 'arquivado' && <Pill color={C.amber} bg={C.amberBg}>Arquivado</Pill>}
            {variant === 'excluido' && <Pill color={C.red} bg={C.redBg}>Excluído</Pill>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.texto}</p>
          {variant === 'arquivado' && r.arquivado_por_nome && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: C.muted }}>Dispensado por {r.arquivado_por_nome} · {fullDate(r.arquivado_em)}</p>
          )}
          {variant === 'excluido' && r.excluido_por_nome && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: C.red }}>Excluído por {r.excluido_por_nome} · {fullDate(r.excluido_em)}</p>
          )}
        </div>
        {variant === 'ativo' && podeAgir(r) && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => dispensar(r)} title="Dispensar (arquivar)" style={{ border: '1px solid ' + C.border, background: C.white, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: C.amber, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
              <Archive size={13} />
            </button>
            <button onClick={() => excluir(r)} title="Excluir" style={{ border: '1px solid ' + C.border, background: C.white, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: C.red, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Trigger button */}
      <button onClick={() => { setOpen(v => !v); setTimeout(() => textareaRef.current?.focus(), 100) }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: open ? C.navy : C.white, color: open ? 'white' : C.text, border: '1px solid ' + C.border, borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s', position: 'relative' }}>
        <MessageSquare size={15} />
        Mural de Recados
        {ativos.length > 0 && (
          <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: C.green, color: 'white', fontSize: 11, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
            {ativos.length > 99 ? '99+' : ativos.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 400, maxHeight: '80vh', background: C.white, border: '1px solid ' + C.border, borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', zIndex: 200, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <b style={{ fontSize: 15 }}>Mural de Recados</b>
              <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{ativos.length} recado{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setOpen(false)} style={{ border: 0, background: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}><X size={18} /></button>
          </div>

          {/* New message */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid ' + C.border, flexShrink: 0 }}>
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) publicar() }}
              placeholder="Escreva um recado para a equipe..."
              style={{ width: '100%', minHeight: 72, padding: '10px 12px', border: '1px solid ' + C.border, borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: C.text, outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Ctrl+Enter para publicar</span>
              <button onClick={publicar} disabled={sending || !texto.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: texto.trim() ? C.navy : C.grayBg, color: texto.trim() ? 'white' : C.muted, border: 0, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: texto.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                <Send size={13} />{sending ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ativos.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.muted }}>
                <MessageSquare size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
                <p style={{ margin: 0, fontSize: 13 }}>Nenhum recado no mural.</p>
              </div>
            )}
            {ativos.map(r => <CardRecado key={r.id} r={r} variant="ativo" />)}

            {/* Arquivados */}
            {arquivados.length > 0 && (
              <div>
                <button onClick={() => setShowArquivados(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 12, fontWeight: 700, padding: '4px 0', width: '100%' }}>
                  <ChevronDown size={14} style={{ transform: showArquivados ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  {arquivados.length} arquivado{arquivados.length !== 1 ? 's' : ''}
                </button>
                {showArquivados && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>{arquivados.map(r => <CardRecado key={r.id} r={r} variant="arquivado" />)}</div>}
              </div>
            )}

            {/* Excluídos — só gerente */}
            {isGerente && excluidos.length > 0 && (
              <div style={{ borderTop: '1px dashed ' + C.border, paddingTop: 10, marginTop: 4 }}>
                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: C.red, textTransform: 'uppercase' }}>Excluídos (visível só para gerentes)</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {excluidos.map(r => <CardRecado key={r.id} r={r} variant="excluido" />)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
