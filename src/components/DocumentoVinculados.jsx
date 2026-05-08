import { useEffect, useRef, useState } from 'react'
import { supabase, can } from '../lib/supabase.js'
import { Upload, Trash2, Eye, AlertCircle, File } from 'lucide-react'

const C = { white:'#fff', text:'#0f172a', muted:'#64748b', border:'#e5e7eb', red:'#dc2626', redBg:'#fee2e2', purple:'#10b981', grayBg:'#f1f5f9' }
const fmb = (b=0) => b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'
const fdt = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—'
const icon = (name='') => name.match(/\.pdf$/i)?'📄':name.match(/\.docx?$/i)?'📝':name.match(/\.(jpg|jpeg|png|gif|webp)$/i)?'🖼️':name.match(/\.txt$/i)?'📃':'📎'

export default function DocumentosVinculados({ profile, processoId = null, contratoId = null, atividadeId = null, title = 'Documentos vinculados' }) {
  const [docs, setDocs] = useState([])
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef(null)
  const canUpload = can(profile, 'docs.upload')
  const canDelete = can(profile, 'docs.excluir')

  useEffect(() => { fetchDocs() }, [processoId, contratoId, atividadeId])

  const fetchDocs = async () => {
    if (!processoId && !contratoId && !atividadeId) { setDocs([]); return }
    let q = supabase.from('documentos').select('*').order('created_at', { ascending:false })
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
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
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

  return <div style={{ marginTop:18, borderTop:'1px solid '+C.border, paddingTop:16 }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
      <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:C.text }}>{title}</h3>
      <span style={{ fontSize:12, color:C.muted }}>{docs.length} arquivo(s)</span>
    </div>
    {erro && <div style={{ display:'flex', gap:8, alignItems:'flex-start', padding:10, borderRadius:8, background:C.redBg, color:C.red, fontSize:13, marginBottom:10 }}><AlertCircle size={16}/><span>{erro}</span></div>}
    {canUpload&&<div onDragEnter={e=>{e.preventDefault();setDrag(true)}} onDragOver={e=>e.preventDefault()} onDragLeave={e=>{e.preventDefault();setDrag(false)}} onDrop={e=>{e.preventDefault();handleFiles(e.dataTransfer.files)}} onClick={()=>fileRef.current?.click()}
      style={{ border:'2px dashed '+(drag?C.purple:C.border), background:drag?'#faf5ff':C.white, borderRadius:10, padding:'18px 16px', textAlign:'center', cursor:uploading?'wait':'pointer', marginBottom:12 }}>
      <input ref={fileRef} type="file" multiple style={{ display:'none' }} onChange={e=>handleFiles(e.target.files)} />
      <Upload size={24} color={C.muted} />
      <div style={{ fontSize:13, fontWeight:700, color:C.text, marginTop:6 }}>{uploading ? 'Enviando...' : 'Clique ou arraste documentos aqui'}</div>
      <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>PDF, DOCX, TXT e imagens</div>
    </div>}
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {docs.map(doc => <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:'1px solid '+C.border, borderRadius:9, background:C.white }}>
        <div style={{ fontSize:20 }}>{icon(doc.nome)}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{doc.nome}</div>
          <div style={{ fontSize:11, color:C.muted }}>{fmb(doc.tamanho_bytes || doc.tamanho || 0)} · {fdt(doc.created_at)}</div>
        </div>
        <button onClick={()=>view(doc)} style={{ border:'none', background:C.grayBg, borderRadius:7, padding:7, cursor:'pointer', display:'flex' }}><Eye size={14}/></button>
        {canDelete&&<button onClick={()=>remove(doc)} style={{ border:'none', background:C.redBg, color:C.red, borderRadius:7, padding:7, cursor:'pointer', display:'flex' }}><Trash2 size={14}/></button>}
      </div>)}
      {docs.length === 0 && <div style={{ textAlign:'center', padding:20, color:C.muted, border:'1px dashed '+C.border, borderRadius:10 }}><File size={22}/><div style={{ fontSize:13, marginTop:6 }}>Nenhum documento vinculado ainda.</div></div>}
    </div>
  </div>
}
