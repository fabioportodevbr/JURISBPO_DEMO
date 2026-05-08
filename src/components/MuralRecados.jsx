import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { MessageSquare, Send, Trash2 } from 'lucide-react'

const C = {
  text: '#0f172a', muted: '#64748b', border: '#e5e7eb', white: '#fff',
  red: '#dc2626', redBg: '#fee2e2',
  yellow: '#eab308', yellowLight: '#fefce8', yellowMid: '#fef9c3',
  yellowBorder: '#fde047', yellowDark: '#92400e', yellowBtn: '#78350f',
  grayBg: '#f1f5f9',
}

function fullDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Avatar({ nome, size = 28 }) {
  const initials = (nome || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  const hue = [...(nome || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},55%,38%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontSize: size * 0.38, fontWeight: 800, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

export default function MuralRecados({ profile }) {
  const [recados, setRecados] = useState([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef(null)
  const isGerente = profile?.role === 'gerente'

  const load = async () => {
    const { data } = await supabase
      .from('mural_recados')
      .select('*')
      .eq('escritorio_id', profile.escritorio_id)
      .eq('status', 'ativo')
      .order('criado_em', { ascending: false })
    setRecados(data || [])
  }

  useEffect(() => { load() }, [profile.escritorio_id])

  useEffect(() => {
    const channel = supabase
      .channel('mural_recados_' + profile.escritorio_id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mural_recados',
        filter: `escritorio_id=eq.${profile.escritorio_id}`,
      }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile.escritorio_id])

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

  const excluir = async (r) => {
    if (!confirm('Excluir este recado definitivamente? Esta ação não pode ser desfeita.')) return
    await supabase.from('mural_recados').delete().eq('id', r.id)
    setRecados(prev => prev.filter(x => x.id !== r.id))
  }

  const podeExcluir = (r) => isGerente || r.criado_por === profile.id

  return (
    <div style={{
      background: C.yellowLight,
      border: '2px solid ' + C.yellowBorder,
      borderRadius: 14,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid ' + C.yellowBorder,
        background: '#fef08a',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <MessageSquare size={16} color={C.yellowDark} />
        <b style={{ fontSize: 14, color: C.yellowBtn, flex: 1 }}>Mural de Recados</b>
        {recados.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 900,
            background: C.yellowDark, color: 'white',
            borderRadius: 999, padding: '1px 8px',
          }}>
            {recados.length}
          </span>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid ' + C.yellowBorder,
        background: C.yellowMid,
      }}>
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) publicar() }}
          placeholder="Escreva um recado para a equipe... (Ctrl+Enter para publicar)"
          rows={2}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid ' + C.yellowBorder,
            borderRadius: 8,
            fontSize: 13,
            resize: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            color: C.text,
            outline: 'none',
            background: '#fffde7',
            lineHeight: 1.4,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            onClick={publicar}
            disabled={sending || !texto.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              background: texto.trim() ? C.yellowBtn : '#d6d3d1',
              color: 'white',
              border: 0, borderRadius: 8,
              fontWeight: 700, fontSize: 12,
              cursor: texto.trim() ? 'pointer' : 'default',
              transition: 'background .15s',
            }}>
            <Send size={12} />
            {sending ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* Recados list */}
      <div style={{
        overflowY: 'auto',
        maxHeight: 320,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {recados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: C.yellowDark, opacity: 0.5 }}>
            <MessageSquare size={22} style={{ display: 'block', margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: 13 }}>Nenhum recado no mural.</p>
          </div>
        ) : recados.map(r => (
          <div key={r.id} style={{
            background: '#fffff7',
            border: '1px solid ' + C.yellowBorder,
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Avatar nome={r.criado_por_nome} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 3 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{r.criado_por_nome}</span>
                    <div style={{ fontSize: 11, color: C.yellowDark, marginTop: 1, opacity: 0.85 }}>
                      {fullDate(r.criado_em)}
                    </div>
                  </div>
                  {podeExcluir(r) && (
                    <button
                      onClick={() => excluir(r)}
                      title="Excluir definitivamente"
                      style={{
                        border: '1px solid #fca5a5',
                        background: '#fee2e2',
                        borderRadius: 6,
                        padding: '3px 6px',
                        cursor: 'pointer',
                        color: C.red,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p style={{
                  margin: 0,
                  fontSize: 13,
                  color: C.text,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {r.texto}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
