import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import AvatarUsuario from './common/AvatarUsuario.jsx'
import { MessageSquare, PenLine, Send, Trash2, Edit2, Check, X } from 'lucide-react'

const Y = {
  bg: '#fefce8', mid: '#fef9c3', header: '#fef08a',
  border: '#fde047', dark: '#92400e', btn: '#78350f',
}
const C = { text: '#0f172a', muted: '#64748b', red: '#dc2626' }

function fullDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ── Barra de formatação ── */
function RichToolbar({ editorRef }) {
  const [active, setActive] = useState({ bold: false, italic: false, underline: false })

  const updateActive = () => {
    setActive({
      bold:      document.queryCommandState('bold'),
      italic:    document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    })
  }

  const format = (cmd) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, null)
    updateActive()
  }

  const BTNS = [
    { cmd: 'bold',      label: 'N', title: 'Negrito (Ctrl+B)',     s: { fontWeight: 900 } },
    { cmd: 'italic',    label: 'I', title: 'Itálico (Ctrl+I)',     s: { fontStyle: 'italic' } },
    { cmd: 'underline', label: 'S', title: 'Sublinhado (Ctrl+U)',  s: { textDecoration: 'underline' } },
  ]

  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
      {BTNS.map(b => (
        <button
          key={b.cmd}
          type="button"
          onMouseDown={e => { e.preventDefault(); format(b.cmd) }}
          title={b.title}
          style={{
            border: '1px solid ' + Y.border,
            background: active[b.cmd] ? '#fde047' : Y.mid,
            color: Y.dark,
            borderRadius: 5,
            padding: '3px 10px',
            cursor: 'pointer',
            fontSize: 13,
            minWidth: 30,
            textAlign: 'center',
            transition: 'background .1s',
            ...b.s,
          }}>
          {b.label}
        </button>
      ))}
      <span style={{ fontSize: 11, color: Y.dark, opacity: 0.55, alignSelf: 'center', marginLeft: 6 }}>
        Ctrl+Enter para publicar
      </span>
    </div>
  )
}

/* ── Editor contentEditable ── */
function RichEditor({ editorRef, placeholder, onKeyDown, minHeight = 80 }) {
  const [empty, setEmpty] = useState(true)
  return (
    <div style={{ position: 'relative' }}>
      {empty && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          padding: '9px 12px', color: Y.dark,
          opacity: 0.45, fontSize: 13, pointerEvents: 'none', lineHeight: 1.5,
        }}>
          {placeholder}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={e => setEmpty(!e.currentTarget.innerText.trim())}
        onKeyDown={onKeyDown}
        style={{
          minHeight,
          padding: '9px 12px',
          border: '1px solid ' + Y.border,
          borderRadius: 8,
          fontSize: 13,
          outline: 'none',
          background: '#fffde7',
          lineHeight: 1.5,
          wordBreak: 'break-word',
          color: C.text,
        }}
      />
    </div>
  )
}

/* ── Componente principal ── */
export default function MuralRecados({ profile }) {
  const [recados, setRecados]     = useState([])
  const [sending, setSending]     = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const newEditorRef  = useRef(null)
  const editEditorRef = useRef(null)
  const isGerente = profile?.role === 'gerente'

  /* carrega recados + avatares */
  const load = async () => {
    const { data } = await supabase
      .from('mural_recados')
      .select('*')
      .eq('escritorio_id', profile.escritorio_id)
      .eq('status', 'ativo')
      .order('criado_em', { ascending: false })

    const list = data || []
    const ids  = [...new Set(list.map(r => r.criado_por).filter(Boolean))]
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

  /* realtime */
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

  /* popula editor de edição quando abre */
  useEffect(() => {
    if (!editingId || !editEditorRef.current) return
    const r = recados.find(x => x.id === editingId)
    if (r) {
      editEditorRef.current.innerHTML = r.texto || ''
      editEditorRef.current.focus()
    }
  }, [editingId])

  /* ── Ações ── */
  const publicar = async () => {
    const html = newEditorRef.current?.innerHTML?.trim() || ''
    const text = newEditorRef.current?.innerText?.trim() || ''
    if (!text) return
    setSending(true)
    await supabase.from('mural_recados').insert({
      escritorio_id:   profile.escritorio_id,
      texto:           html,
      criado_por:      profile.id,
      criado_por_nome: profile.nome || profile.email || 'Usuário',
      status:          'ativo',
    })
    if (newEditorRef.current) newEditorRef.current.innerHTML = ''
    setSending(false)
    setShowInput(false)
    await load()
  }

  const salvarEdicao = async (r) => {
    const html = editEditorRef.current?.innerHTML?.trim() || ''
    const text = editEditorRef.current?.innerText?.trim() || ''
    if (!text) return
    await supabase.from('mural_recados').update({ texto: html }).eq('id', r.id)
    setEditingId(null)
    await load()
  }

  const excluir = async (r) => {
    if (!confirm('Excluir este recado definitivamente? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase
      .from('mural_recados')
      .update({
        status:           'excluido',
        excluido_por:     profile.id,
        excluido_por_nome: profile.nome || profile.email,
        excluido_em:      new Date().toISOString(),
      })
      .eq('id', r.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    setRecados(prev => prev.filter(x => x.id !== r.id))
  }

  const podeEditar  = (r) => r.criado_por === profile.id
  const podeExcluir = (r) => isGerente || r.criado_por === profile.id

  /* ── Render ── */
  return (
    <div style={{
      background: Y.bg,
      border: '2px solid ' + Y.border,
      borderRadius: 14,
      overflow: 'hidden',
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
            fontSize: 11, fontWeight: 900,
            background: Y.dark, color: 'white',
            borderRadius: 999, padding: '1px 8px',
          }}>
            {recados.length}
          </span>
        )}
        <button
          onClick={() => {
            setShowInput(v => {
              if (!v) setTimeout(() => newEditorRef.current?.focus(), 80)
              return !v
            })
          }}
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

      {/* ── Área de novo recado ── */}
      {showInput && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid ' + Y.border,
          background: Y.mid,
        }}>
          <RichToolbar editorRef={newEditorRef} />
          <RichEditor
            editorRef={newEditorRef}
            placeholder="Escreva um recado para a equipe…"
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) publicar() }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => { setShowInput(false); if (newEditorRef.current) newEditorRef.current.innerHTML = '' }}
              style={{
                border: '1px solid ' + Y.border, background: 'transparent',
                color: Y.dark, borderRadius: 8, padding: '6px 14px',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
              Cancelar
            </button>
            <button
              onClick={publicar}
              disabled={sending}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px',
                background: Y.btn, color: 'white',
                border: 0, borderRadius: 8,
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
                opacity: sending ? 0.6 : 1,
              }}>
              <Send size={12} />{sending ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de recados ── */}
      {recados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '14px 0', color: Y.dark, opacity: 0.5 }}>
          <p style={{ margin: 0, fontSize: 13 }}>Nenhum recado no mural.</p>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 10,
          padding: '12px 16px', maxHeight: 280, overflowY: 'auto',
        }}>
          {recados.map(r => (
            <div key={r.id} style={{
              background: '#fffff7',
              border: '1px solid ' + (editingId === r.id ? Y.dark : Y.border),
              borderRadius: 10,
              padding: '10px 12px',
              flex: '1 1 240px', minWidth: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'border-color .15s',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AvatarUsuario profile={r._profile} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>

                  {/* Cabeçalho do recado */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 6, marginBottom: 4,
                  }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{r.criado_por_nome}</span>
                      <div style={{ fontSize: 11, color: Y.dark, marginTop: 1, opacity: 0.8 }}>{fullDate(r.criado_em)}</div>
                    </div>
                    {editingId !== r.id && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {podeEditar(r) && (
                          <button
                            onClick={() => setEditingId(r.id)}
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

                  {/* Texto ou editor de edição */}
                  {editingId === r.id ? (
                    <div>
                      <RichToolbar editorRef={editEditorRef} />
                      <RichEditor
                        editorRef={editEditorRef}
                        placeholder="Edite o recado…"
                        minHeight={64}
                        onKeyDown={e => { if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            border: '1px solid ' + Y.border, background: 'transparent',
                            color: Y.dark, borderRadius: 6, padding: '4px 10px',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>
                          Cancelar
                        </button>
                        <button
                          onClick={() => salvarEdicao(r)}
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
                    <div
                      style={{ fontSize: 13, color: C.text, lineHeight: 1.5, wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: r.texto }}
                    />
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
