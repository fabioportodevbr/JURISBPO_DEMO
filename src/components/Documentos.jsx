import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'
import { Upload, Trash2, Eye, File, AlertCircle } from 'lucide-react'

const C = { navy:'#022c22', white:'#fff', text:'#0f172a', muted:'#64748b', border:'#e5e7eb', red:'#dc2626', redBg:'#fee2e2', purple:'#10b981', purpleBg:'#ede9fe', grayBg:'#f1f5f9', green:'#16a34a', greenBg:'#dcfce7' }
const INP = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid '+C.border, fontSize:14, color:C.text, background:C.white, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }
const fmb = (b) => b<1024?b+' B':b<1048576?(b/1024).toFixed(1)+' KB':(b/1048576).toFixed(1)+' MB'
const fdt = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—'
const icon = (name) => name?.endsWith('.pdf')?'📄':name?.endsWith('.docx')||name?.endsWith('.doc')?'📝':name?.match(/\.(jpg|jpeg|png|gif|webp)$/i)?'🖼️':name?.endsWith('.txt')?'📃':'📎'

export default function Documentos({ profile }) {
  const [docs, setDocs]       = useState([])
  const [proc, setProc]       = useState([])
  const [tar, setTar]         = useState([])
  const [filterBy, setFilterBy] = useState('Todos')
  const [linkProc, setLinkProc] = useState('')
  const [linkTask, setLinkTask] = useState('')
  const [drag, setDrag]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState('')
  const fileRef = useRef()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [{ data: d, error: dErr }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('documentos').select('*').order('created_at', { ascending:false }),
      supabase.from('processos').select('id, parte, tipo').order('created_at', { ascending:false }),
      supabase.from('tarefas').select('id, titulo').order('created_at', { ascending:false }),
    ])
    if (dErr) setErro('Erro ao carregar documentos: ' + dErr.message)
    setDocs(d||[]); setProc(p||[]); setTar(t||[])
  }

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length || uploading) return

    setErro('')
    setUploading(true)

    try {
      for (const file of files) {
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${profile.id}/${Date.now()}_${safeName}`

        const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })
        if (upErr) throw new Error(`Falha ao enviar "${file.name}" para o Storage: ${upErr.message}`)

        const { error: dbErr } = await supabase.from('documentos').insert({
          nome: file.name,
          tipo: file.type || 'application/octet-stream',
          tamanho: file.size,
          storage_path: path,
          processo_id: linkProc ? Number(linkProc) : null,
          tarefa_id:   linkTask ? Number(linkTask)  : null,
          uploaded_by: profile.id,
          uploader_nome: profile.nome,
        })
        if (dbErr) throw new Error(`Arquivo enviado, mas falhou ao registrar no banco: ${dbErr.message}`)
      }
      if (fileRef.current) fileRef.current.value = ''
      await fetchAll()
    } catch (e) {
      console.error(e)
      setErro(e.message || 'Erro inesperado ao enviar documento.')
    } finally {
      setUploading(false)
    }
  }

  const del = async (doc) => {
    if (!window.confirm('Excluir documento?')) return
    setErro('')
    const { error: stErr } = await supabase.storage.from('documentos').remove([doc.storage_path])
    if (stErr) setErro('Erro ao remover arquivo do Storage: ' + stErr.message)
    const { error: dbErr } = await supabase.from('documentos').delete().eq('id', doc.id)
    if (dbErr) setErro('Erro ao excluir registro do banco: ' + dbErr.message)
    fetchAll()
  }

  const openFile = async (doc) => {
    setErro('')
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(doc.storage_path, 300)
    if (error) return setErro('Erro ao abrir arquivo: ' + error.message)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }
  const filtered = filterBy === 'Todos' ? docs : docs.filter(d => d.uploaded_by === filterBy)

  return (
    <div style={{ padding:24 }}>
      <h1 style={{ fontSize:20, fontWeight:800, color:C.text, margin:'0 0 22px' }}>Documentos</h1>

      {erro && <div style={{ background:C.redBg, color:C.red, border:'1px solid #fecaca', borderRadius:10, padding:12, marginBottom:14, fontSize:13, display:'flex', gap:8, alignItems:'flex-start' }}><AlertCircle size={16} style={{ flexShrink:0, marginTop:1 }}/><div>{erro}</div></div>}

      <div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20, marginBottom:20 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}><Upload size={16} color={C.purple}/>Carregar documentos</div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:14 }}>
          <div style={{ flex:'1 1 320px' }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Vincular a Processo</label>
            <select style={INP} value={linkProc} onChange={e=>setLinkProc(e.target.value)}>
              <option value="">Nenhum</option>
              {proc.map(p=><option key={p.id} value={p.id}>{p.parte} – {p.tipo}</option>)}
            </select>
          </div>
          <div style={{ flex:'1 1 320px' }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Vincular a Tarefa</label>
            <select style={INP} value={linkTask} onChange={e=>setLinkTask(e.target.value)}>
              <option value="">Nenhuma</option>
              {tar.map(t=><option key={t.id} value={t.id}>{t.titulo}</option>)}
            </select>
          </div>
        </div>
        <div onDrop={onDrop} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onClick={()=>!uploading && fileRef.current.click()}
          style={{ border:'2px dashed '+(drag?C.purple:C.border), borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:uploading?'wait':'pointer', background:drag?C.purpleBg:'transparent', transition:'all 0.15s', opacity:uploading?0.75:1 }}>
          <Upload size={28} style={{ display:'block', margin:'0 auto 10px', color:drag?C.purple:C.muted }}/>
          <div style={{ fontSize:14, fontWeight:600, color:drag?C.purple:C.muted }}>{uploading?'Enviando...' : 'Arraste arquivos aqui ou clique para selecionar'}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>PDF, DOCX, TXT, imagens — múltiplos arquivos aceitos</div>
          <input ref={fileRef} type="file" multiple style={{ display:'none' }} disabled={uploading} onChange={e=>handleFiles(e.target.files)}/>
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:10 }}>
        <span style={{ fontSize:13, color:C.muted }}>{filtered.length} documento{filtered.length!==1?'s':''}</span>
      </div>

      {filtered.length === 0
        ? <div style={{ textAlign:'center', padding:48, color:C.muted, background:C.white, borderRadius:12, border:'1px solid '+C.border }}><File size={36} style={{ display:'block', margin:'0 auto 12px', opacity:0.3 }}/><p style={{ fontSize:14 }}>Nenhum documento ainda</p></div>
        : <div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, overflow:'hidden' }}>
            {filtered.map((d,i)=>(
              <div key={d.id} style={{ padding:'14px 18px', borderBottom:i<filtered.length-1?'1px solid '+C.border:'none', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                <span style={{ fontSize:24, flexShrink:0 }}>{icon(d.nome)}</span>
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:2 }}>{d.nome}</div>
                  <div style={{ fontSize:11, color:C.muted, display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span>{fmb(d.tamanho||0)}</span>
                    <span>Por: {d.uploader_nome}</span>
                    <span>{fdt(d.created_at)}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={()=>openFile(d)} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, padding:'6px 12px', border:'1px solid '+C.border, borderRadius:7, background:C.white, cursor:'pointer', color:C.purple, fontWeight:600 }}><Eye size={12}/>Abrir</button>
                  <button onClick={()=>del(d)} style={{ border:'none', background:'none', cursor:'pointer', color:C.red, padding:6, display:'flex' }}><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
