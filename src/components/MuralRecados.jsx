import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import AvatarUsuario from './common/AvatarUsuario.jsx'
import { MessageSquare, PenLine, Send, Trash2, Edit2, Check, X } from 'lucide-react'

const Y = {
  bg: '#fefce8', mid: '#fef9c3', header: '#fef08a',
  border: '#fde047', dark: '#92400e', btn: '#78350f',
}
const C = { text: '#0f172a', muted: '#64748b', red: '#dc2626' }

const INP = {
  width: '100%', padding: '8px 10px', border: '1px solid ' + Y.border,
  borderRadius: 8, fontSize: 13, resize: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', color: C.text, outline: 'none', background: '#fffde7', lineHeight: 1.45,
}

function fullDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function MuralRecados({ profile }) {
  const [recados, setRecados] = useState([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const textareaRef = useRef(null)
  const isGerente = profile?.role === 'gerente'

  const load = async () => {
    const { data } = await supabase
      .from('mural_recados')
      .select('*')
      .eq('escritorio_id', profile.escritorio_id)
      .eq('status', 'ativo')
      .order('criado_em', { ascending: false })

    const list = data || []
    const ids = [...new Set(list.map(r => r.criado_por).filter(Boolean))]
    let profileMap = {}
    if (ids.length) {
      const { data: pData } = await supabase
        .from('profiles')
        .select('id,nome,avatar_url,foto_url,cor')
        .in('id', ids)
      profileMap = Object.fromEntries((pData || []).map(p => [p.id, p]))
    }
    setRecados(list.map(r => ({ ...r, _profile: profileMap[r.criado_por] || { nome: r.criado_por_nome } })))
  }

  useEffect(() => { load() }, [profile.escritorio_id])

  useEffect(() => {
    const ch = supabase
      .channel('mural_' + profile.escritorio_id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mural_recados',
        filter: `escritorio_id=eq.${profile.escritorio_id}`,
      }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
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
    setShowInput(false)
    await load()
  }

  const excluir = async (r) => {
    if (!confirm('Excluir este recado definitivamente? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase
      .from('mural_recados')
      .update({
        status: 'excluido',
        excluido_por: profile.id,
        excluido_por_nome: profile.nome || profile.email,
        excluido_em: new Date().toISOString(),
      })
      .eq('id', r.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    setRecados(prev => prev.filter(x => x.id !== r.id))
  }

  const salvarEdicao = async (r) => {
    if (!editText.trim()) return
    await supabase.from('mural_recados').update({ texto: editText.trim() }).eq('id', r.id)
    setEditingId(null)
    setEditText('')
    await load()
  }

  const podeEditar  = (r) => r.criado_por === profile.id
  const podeExcluir = (r) => isGerente || r.criado_por === profile.id

  return (
    <div style={{
      background: Y.bg, border: '2px solid ' + Y.border,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '10px 16px', background: Y.header,
        borderBottom: '1px solid ' + Y.border,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <MessageSquare size={15} color={Y.dark} />
        <b style={{ fontSize: 14, color: Y.btn, flex: 1 }}>Mural de Recados</b>
        {recados.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 900, background: Y.dark,
            color: 'white', borderRadius: 999, padding: '1px 8px',
          }}>
            {recados.length}
          </span>
        )}
        <button
          onClick={() => { setShowInput(v => !v); setTimeout(() => textareaRef.current?.focus(), 80) }}
          title={showInput ? 'Fechar' : 'Novo recado'}
          style={{
            border: '1px solid ' + (showInput ? Y.dark : Y.border),
            background: showInput ? Y.dark : 'transparent',
            color: showInput ? 'white' : Y.dark,
            borderRadius: 7, padding: '4px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 700, marginLeft: 6,
            transition: 'all .15s',
          }}>
          {showInput ? <X size={12} /> : <PenLine size={13} />}
          {showInput ? 'Cancelar' : 'Novo recado'}
        </button>
      </div>

      {/* ── Input (hidden by default) ── */}
      {showInput && (
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid ' + Y.border,
          background: Y.mid,
        }}>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) publicar() }}
            placeholder="Escreva um recado para a equipe… (Ctrl+Enter para publicar)"
            rows={3}
            style={INP}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => { setShowInput(false); setTexto('') }}
              style={{
                border: '1px solid ' + Y.border, background: 'transparent',
                color: Y.dark, borderRadius: 8, padding: '6px 14px',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
              Cancelar
            </button>
            <button
              onClick={publicar}
              disabled={sending || !texto.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                background: texto.trim() ? Y.btn : '#d6d3d1',
                color: 'white', border: 0, borderRadius: 8,
                fontWeight: 700, fontSize: 12,
                cursor: texto.trim() ? 'pointer' : 'default',
              }}>
              <Send size={12} />{sending ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Recados list ── */}
      {recados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '14px 0', color: Y.dark, opacity: 0.5 }}>
          <p style={{ margin: 0, fontSize: 13 }}>Nenhum recado no mural.</p>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10,
          padding: '12px 16px', maxHeight: 260, overflowY: 'auto',
        }}>
          {recados.map(r => (
            <div key={r.id} style={{
              background: '#fffff7', border: '1px solid ' + Y.border,
              borderRadius: 10, padding: '10px 12px',
              flex: '1 1 240px', minWidth: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AvatarUsuario profile={r._profile} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>

                  {/* Author row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{r.criado_por_nome}</span>
                      <div style={{ fontSize: 11, color: Y.dark, marginTop: 1, opacity: 0.8 }}>{fullDate(r.criado_em)}</div>
                    </div>
                    {editingId !== r.id && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {podeEditar(r) && (
                          <button
                            onClick={() => { setEditingId(r.id); setEditText(r.texto) }}
                            title="Editar recado"
                            style={{
                              border: '1px solid ' + Y.border, background: Y.mid,
                              borderRadius: 6, padding: '3px 6px', cursor: 'pointer',
                              color: Y.dark, display: 'flex', alignItems: 'center',
                            }}>
                            <Edit2 size={11} />
                          </button>
                        )}
                        {podeExcluir(r) && (
                          <button
                            onClick={() => excluir(r)}
                            title="Excluir definitivamente"
                            style={{
                              border: '1px solid #fca5a5', background: '#fee2e2',
                              borderRadius: 6, padding: '3px 6px', cursor: 'pointer',
                              color: C.red, display: 'flex', alignItems: 'center',
                            }}>
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content / edit mode */}
                  {editingId === r.id ? (
                    <div>
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        style={INP}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => { setEditingId(null); setEditText('') }}
                          style={{
                            border: '1px solid ' + Y.border, background: 'transparent',
                            color: Y.dark, borderRadius: 6, padding: '4px 10px',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>
                          Cancelar
                        </button>
                        <button
                          onClick={() => salvarEdicao(r)}
                          disabled={!editText.trim()}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            border: 0, background: Y.btn, color: 'white',
                            borderRadius: 6, padding: '4px 12px',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>
                          <Check size={12} /> Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{
                      margin: 0, fontSize: 13, color: C.text,
                      lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {r.texto}
                    </p>
                  )}

                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
