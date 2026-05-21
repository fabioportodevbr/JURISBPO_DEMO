import { useEffect, useRef, useState } from 'react'
import { supabase, can } from '../lib/supabase.js'
import { Upload, Trash2, Eye, AlertCircle, File, GripVertical, ArrowUpDown } from 'lucide-react'

import { C as GlobalC } from '../lib/theme'
const C = { ...GlobalC }
const fmb = (b=0) => b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'
const fdt = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—'
const icon = (name='') => name.match(/\.pdf$/i)?'📄':name.match(/\.docx?$/i)?'📝':name.match(/\.(jpg|jpeg|png|gif|webp)$/i)?'🖼️':name.match(/\.txt$/i)?'📃':'📎'

export default function DocumentosVinculados({ profile, processoId = null, contratoId = null, atividadeId = null, title = 'Documentos vinculados' }) {
  const [docs, setDocs] = useState([])
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const [reordering, setReordering] = useState(false)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const fileRef = useRef(null)
  const dragIdx = useRef(null)
  const canUpload = can(profile, 'docs.upload')
  const canDelete = can(profile, 'docs.excluir')

  useEffect(() => { fetchDocs() }, [processoId, contratoId, atividadeId])

  const fetchDocs = async () => {
    if (!processoId && !contratoId && !atividadeId) { setDocs([]); return }
    let q = supabase.from('documentos').select('*')
      .order('ordem', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (processoId) q = q.eq('processo_id', processoId)
    if (contratoId) q = q.eq('contrato_id', contratoId)
    if (atividadeId) q = q.eq('atividade_id', atividadeId)
    const { data, error } = await q
    if (error) setErro('Erro ao carregar documentos: ' + error.message)
    setDocs(data || [])
  }

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!canUpload) return setErro('Visitante possui acesso somente leitura.')
    if (!files.length || uploading) return
    setErro('')
    setUploading(true)
    try {
      for (const file of files) {
        const safeName = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
        const folder = processoId ? `processos/${processoId}` : contratoId ? `contratos/${contratoId}` : `atividades/${atividadeId}`
        const path = `${profile.escritorio_id}/${folder}/${Date.now()}_${safeName}`
        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { cacheControl:'3600', upsert:false })
        if (upErr) throw new Error(`Falha ao enviar "${file.name}": ${upErr.message}`)
        const { error: dbErr } = await supabase.from('documentos').insert({
          escritorio_id: profile.escritorio_id,
          nome: file.name,
          mime_type: file.type || 'application/octet-stream',
          tamanho_bytes: file.size,
          storage_bucket: 'documentos',
          storage_path: path,
          processo_id: processoId || null,
          contrato_id: contratoId || null,
          atividade_id: atividadeId || null,
          uploaded_by: profile.id,
        })
        if (dbErr) throw new Error(`Arquivo enviado, mas não foi registrado no banco: ${dbErr.message}`)
      }
      if (fileRef.current) fileRef.current.value = ''
      await fetchDocs()
    } catch (e) { setErro(e.message || String(e)) }
    finally { setUploading(false); setDrag(false) }
  }

  const remove = async (doc) => {
    if (!window.confirm('Excluir este documento?')) return
    setErro('')
    const { error: stErr } = await supabase.storage.from(doc.storage_bucket || 'documentos').remove([doc.storage_path])
    if (stErr) { setErro('Erro ao remover arquivo do Storage: ' + stErr.message); return }
    const { error: dbErr } = await supabase.from('documentos').delete().eq('id', doc.id)
    if (dbErr) { setErro('Erro ao remover registro do banco: ' + dbErr.message); return }
    fetchDocs()
  }

  const view = async (doc) => {
    const { data, error } = await supabase.storage.from(doc.storage_bucket || 'documentos').createSignedUrl(doc.storage_path, 300)
    if (error) { setErro('Erro ao gerar link: ' + error.message); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const saveOrder = async (ordered) => {
    await Promise.all(
      ordered.map((d, i) => supabase.from('documentos').update({ ordem: i + 1 }).eq('id', d.id))
    )
  }

  const onDragStart = (i) => { dragIdx.current = i }

  const onDragOver = (e, i) => {
    e.preventDefault()
    setDragOverIdx(i)
  }

  const onDrop = async (e, toIdx) => {
    e.preventDefault()
    setDragOverIdx(null)
    const fromIdx = dragIdx.current
    dragIdx.current = null
    if (fromIdx === null || fromIdx === toIdx) return
    const newDocs = [...docs]
    const [item] = newDocs.splice(fromIdx, 1)
    newDocs.splice(toIdx, 0, item)
    setDocs(newDocs)
    await saveOrder(newDocs)
  }

  const onDragEnd = () => {
    dragIdx.current = null
    setDragOverIdx(null)
  }

  return (
    <div style={{ marginTop: 18, borderTop: '1px solid ' + C.border, paddingTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{title}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {docs.length > 1 && (
            <button
              onClick={() => setReordering(r => !r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                border: '1px solid ' + (reordering ? C.purple : C.border),
                background: reordering ? C.purpleBg : 'transparent',
                color: reordering ? C.purple : C.muted,
                borderRadius: 7, padding: '4px 10px',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              <ArrowUpDown size={12} />
              {reordering ? 'Concluído' : 'Reorganizar'}
            </button>
          )}
          <span style={{ fontSize: 12, color: C.muted }}>{docs.length} arquivo(s)</span>
        </div>
      </div>

      {reordering && (
        <div style={{ fontSize: 12, color: C.purple, background: C.purpleBg, borderRadius: 8, padding: '7px 12px', marginBottom: 10 }}>
          Arraste os documentos para reordenar. A numeração é atualizada automaticamente.
        </div>
      )}

      {erro && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 8, background: C.redBg, color: C.red, fontSize: 13, marginBottom: 10 }}>
          <AlertCircle size={16} /><span>{erro}</span>
        </div>
      )}

      {canUpload && !reordering && (
        <div
          onDragEnter={e => { e.preventDefault(); setDrag(true) }}
          onDragOver={e => e.preventDefault()}
          onDragLeave={e => { e.preventDefault(); setDrag(false) }}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          style={{ border: '2px dashed ' + (drag ? C.purple : C.border), background: drag ? C.purpleBg : C.white, borderRadius: 10, padding: '18px 16px', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', marginBottom: 12 }}
        >
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <Upload size={24} color={C.muted} />
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 6 }}>{uploading ? 'Enviando...' : 'Clique ou arraste documentos aqui'}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>PDF, DOCX, TXT e imagens</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map((doc, i) => {
          const isOver = dragOverIdx === i
          return (
            <div
              key={doc.id}
              draggable={reordering}
              onDragStart={() => onDragStart(i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={e => onDrop(e, i)}
              onDragEnd={onDragEnd}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                border: '1px solid ' + (isOver ? C.purple : C.border),
                borderRadius: 9,
                background: isOver ? C.purpleBg : C.white,
                cursor: reordering ? 'grab' : 'default',
                transition: 'border-color 0.12s, background 0.12s',
                userSelect: reordering ? 'none' : 'auto',
              }}
            >
              {/* Número sequencial */}
              <div style={{
                minWidth: 22, height: 22, borderRadius: 6,
                background: reordering ? C.purpleBg : C.soft,
                color: reordering ? C.purple : C.muted,
                border: reordering ? '1px solid ' + C.purple : 'none',
                fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s',
              }}>
                {i + 1}
              </div>

              {/* Handle de arrastar */}
              {reordering && (
                <GripVertical size={15} color={C.purple} style={{ flexShrink: 0, cursor: 'grab' }} />
              )}

              <div style={{ fontSize: 20, flexShrink: 0 }}>{icon(doc.nome)}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.nome}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{fmb(doc.tamanho_bytes || doc.tamanho || 0)} · {fdt(doc.created_at)}</div>
              </div>

              {!reordering && (
                <>
                  <button onClick={() => view(doc)} style={{ border: 'none', background: C.grayBg, borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                    <Eye size={14} />
                  </button>
                  {canDelete && (
                    <button onClick={() => remove(doc)} style={{ border: 'none', background: C.redBg, color: C.red, borderRadius: 7, padding: 7, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}

        {docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: C.muted, border: '1px dashed ' + C.border, borderRadius: 10 }}>
            <File size={22} />
            <div style={{ fontSize: 13, marginTop: 6 }}>Nenhum documento vinculado ainda.</div>
          </div>
        )}
      </div>
    </div>
  )
}
