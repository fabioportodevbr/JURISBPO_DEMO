import { useEffect, useMemo, useState } from 'react'
import { supabase, can } from '../lib/supabase.js'
import { Plus, Edit2, Trash2, X, FileText, Eye, Search } from 'lucide-react'

const C={navy:'#050505',white:'#fff',text:'#0f172a',muted:'#64748b',border:'#e5e7eb',blue:'#1d4ed8',blueBg:'#dbeafe',red:'#dc2626',redBg:'#fee2e2',green:'#16a34a',greenBg:'#dcfce7',amber:'#b45309',amberBg:'#fef3c7',bg:'#f8fafc',grayBg:'#f1f5f9'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const TIPOS=[['peticao','Petição'],['contrato','Contrato'],['autorizacao','Autorização'],['oficio','Ofício'],['checklist','Checklist'],['outro','Outro']]
const AREAS=[['judicial','Judicial'],['administrativo','Administrativo'],['ambos','Judicial e Administrativo']]

function label(arr,v){return arr.find(x=>x[0]===v)?.[1]||v||'—'}
function brDateTime(d){return d?new Date(d).toLocaleString('pt-BR'):'—'}
function F({label,children}){return <div style={{marginBottom:12,flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>{children}</div>}
function Modal({title,onClose,children,width=920}){return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:width,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border}}><b>{title}</b><button onClick={onClose} style={{border:0,background:'none',cursor:'pointer'}}><X/></button></div><div style={{padding:18,overflow:'auto'}}>{children}</div></div></div>}
function Badge({children,color=C.blue,bg=C.blueBg}){return <span style={{fontSize:11,fontWeight:900,padding:'4px 8px',borderRadius:20,background:bg,color,whiteSpace:'nowrap'}}>{children}</span>}
function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=reject;r.readAsDataURL(file)})}
function nomeArquivoModelo(m={}){return m.arquivo_nome||m.anexo_nome||''}
function tipoArquivoModelo(m={}){return m.arquivo_tipo||m.anexo_tipo||''}
function storageKey(profile){return `jurisbpo_acervo_modelos_${profile?.escritorio_id||'local'}`}

export default function Acervo({profile}){
  const [items,setItems]=useState([]),[q,setQ]=useState(''),[advOpen,setAdvOpen]=useState(false),[tipo,setTipo]=useState('todos'),[area,setArea]=useState('todas'),[categoria,setCategoria]=useState('')
  const [modal,setModal]=useState(false),[form,setForm]=useState({}),[preview,setPreview]=useState(null),[loading,setLoading]=useState(true),[fallback,setFallback]=useState(false)
  const canEdit = can(profile, 'docs.upload')

  const load=async()=>{
    setLoading(true)
    const {data,error}=await supabase.from('acervo_modelos').select('*').eq('escritorio_id',profile.escritorio_id).order('updated_at',{ascending:false})
    if(error){
      setFallback(true)
      try{setItems(JSON.parse(localStorage.getItem(storageKey(profile))||'[]'))}catch{setItems([])}
    }else{
      setFallback(false)
      setItems(data||[])
    }
    setLoading(false)
  }
  useEffect(()=>{load()},[profile.escritorio_id])

  const filtered=useMemo(()=>{const term=q.trim().toLowerCase();return items.filter(m=>{
    if(tipo!=='todos'&&m.tipo!==tipo)return false
    if(area!=='todas'&&m.area!==area)return false
    if(categoria.trim()&&!String(m.categoria||'').toLowerCase().includes(categoria.trim().toLowerCase()))return false
    if(term&&![
      m.nome,m.tipo,m.area,m.categoria,m.descricao,nomeArquivoModelo(m)
    ].some(v=>String(v||'').toLowerCase().includes(term)))return false
    return true
  })},[items,q,tipo,area,categoria])

  const open=(m=null)=>{if(!canEdit)return alert('Visitante possui acesso somente leitura.');setForm(m?{...m}:{nome:'',tipo:'peticao',area:'judicial',categoria:'',descricao:''});setModal(true)}
  const persistLocal=(arr)=>{localStorage.setItem(storageKey(profile),JSON.stringify(arr));setItems(arr)}
  const save=async()=>{if(!canEdit)return alert('Visitante possui acesso somente leitura.');
    if(!form.nome)return alert('Informe o nome do modelo.')
    if(!nomeArquivoModelo(form)||!form.arquivo_base64)return alert('Anexe o arquivo editável do modelo.')
    const payload={...form,escritorio_id:profile.escritorio_id,created_by:form.created_by||profile.id,updated_at:new Date().toISOString()}
    delete payload.conteudo
    delete payload.variaveis
    if(fallback){
      const arr=form.id?items.map(x=>x.id===form.id?{...payload,id:form.id,created_at:form.created_at||new Date().toISOString()}:x):[{...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()},...items]
      persistLocal(arr);setModal(false);return
    }
    const {error}=payload.id?await supabase.from('acervo_modelos').update(payload).eq('id',payload.id):await supabase.from('acervo_modelos').insert(payload)
    if(error){
      alert(error.message)
      return
    }
    setModal(false);load()
  }
  const del=async(m)=>{if(!canEdit)return alert('Visitante possui acesso somente leitura.');
    if(!confirm('Excluir este modelo do acervo?'))return
    if(fallback){persistLocal(items.filter(x=>x.id!==m.id));return}
    const {error}=await supabase.from('acervo_modelos').delete().eq('id',m.id)
    if(error)return alert(error.message)
    load()
  }


  return <div style={{padding:24}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><h1 style={{margin:0,fontSize:22}}>Acervo</h1><p style={{color:C.muted}}>Modelos de documentos editáveis armazenados como arquivos anexos.</p></div>
      {canEdit&&<button onClick={()=>open()} style={{background:C.navy,color:'white',border:0,borderRadius:10,padding:'11px 16px',fontWeight:900,display:'flex',alignItems:'center',gap:8}}><Plus size={16}/>Novo modelo</button>}
    </div>

    {fallback&&<div style={{marginTop:12,background:C.amberBg,color:C.amber,border:'1px solid #fde68a',borderRadius:10,padding:12,fontSize:13,fontWeight:700}}>Tabela acervo_modelos não encontrada ou indisponível. Os modelos estão sendo salvos localmente neste navegador até a tabela ser criada no banco.</div>}

    <div style={{display:'flex',gap:10,margin:'18px 0 8px',flexWrap:'wrap'}}>
      <div style={{position:'relative',flex:1,minWidth:260}}><Search size={15} style={{position:'absolute',left:10,top:13,color:C.muted}}/><input style={{...INP,paddingLeft:34}} placeholder="Buscar por nome, tipo, área, categoria ou arquivo" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <button onClick={()=>setAdvOpen(v=>!v)} style={{background:advOpen?C.navy:C.white,color:advOpen?'white':C.navy,border:'1px solid '+C.border,borderRadius:8,padding:'10px 14px',fontWeight:900,cursor:'pointer'}}>Busca avançada</button>
    </div>
    {advOpen&&<section style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:14,marginBottom:16}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
        <F label="Tipo"><select style={INP} value={tipo} onChange={e=>setTipo(e.target.value)}><option value="todos">Todos</option>{TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Área"><select style={INP} value={area} onChange={e=>setArea(e.target.value)}><option value="todas">Todas</option>{AREAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Categoria"><input style={INP} value={categoria} onChange={e=>setCategoria(e.target.value)} placeholder="Ex.: trabalhista, AP, contrato"/></F>
      </div>
    </section>}

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
      {filtered.map(m=><div key={m.id} style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:14,display:'grid',gap:10}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10}}>
          <div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:6}}><Badge>{label(TIPOS,m.tipo)}</Badge><Badge color={C.green} bg={C.greenBg}>{label(AREAS,m.area)}</Badge>{m.categoria&&<Badge color={C.muted} bg={C.grayBg}>{m.categoria}</Badge>}</div><b style={{fontSize:16}}>{m.nome}</b></div>
          <div style={{display:'flex',gap:2}}>{canEdit&&<button onClick={()=>open(m)} style={{border:0,background:'none',color:C.blue,cursor:'pointer'}}><Edit2 size={16}/></button>}{canEdit&&<button onClick={()=>del(m)} style={{border:0,background:'none',color:C.red,cursor:'pointer'}}><Trash2 size={16}/></button>}</div>
        </div>
        <div style={{fontSize:13,color:C.muted,minHeight:34}}>{m.descricao||'Sem descrição.'}</div>
        {nomeArquivoModelo(m)&&<div style={{fontSize:12,color:C.muted}}><b>Anexo:</b> {nomeArquivoModelo(m)}</div>}
        <div style={{fontSize:12,color:C.muted}}>Atualizado em {brDateTime(m.updated_at||m.created_at)}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>setPreview(m)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><Eye size={14}/>Visualizar</button>{m.arquivo_base64&&<button onClick={()=>{const a=document.createElement('a');a.href=m.arquivo_base64;a.download=nomeArquivoModelo(m)||'modelo';a.click()}} style={{border:0,background:C.navy,color:'white',borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}><FileText size={14}/>Baixar modelo</button>}</div>
      </div>)}
    </div>
    {!loading&&!filtered.length&&<div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:30,textAlign:'center',color:C.muted,marginTop:14}}>Nenhum modelo encontrado.</div>}

    {modal&&<Modal title={form.id?'Editar modelo':'Novo modelo'} onClose={()=>setModal(false)}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}><F label="Nome do modelo"><input style={INP} value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}/></F><F label="Tipo"><select style={INP} value={form.tipo||'peticao'} onChange={e=>setForm({...form,tipo:e.target.value})}>{TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Área"><select style={INP} value={form.area||'judicial'} onChange={e=>setForm({...form,area:e.target.value})}>{AREAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Categoria"><input style={INP} value={form.categoria||''} onChange={e=>setForm({...form,categoria:e.target.value})}/></F></div>
      <F label="Descrição"><textarea style={{...INP,minHeight:70}} value={form.descricao||''} onChange={e=>setForm({...form,descricao:e.target.value})}/></F>
      <div style={{border:'1px solid '+C.border,borderRadius:10,padding:12,marginBottom:12,background:C.white}}>
        <b style={{fontSize:13}}>Arquivo editável do modelo</b>
        <p style={{fontSize:12,color:C.muted,margin:'6px 0 10px'}}>Anexe o arquivo editável do modelo, como DOCX, DOC, ODT, RTF, TXT, HTML ou MD. O acervo armazenará o arquivo para consulta e download.</p>
        <input type="file" accept=".doc,.docx,.odt,.rtf,.txt,.html,.htm,.md,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*" style={INP} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const base64=await fileToBase64(file);setForm({...form,arquivo_nome:file.name,arquivo_tipo:file.type||'application/octet-stream',arquivo_tamanho:file.size,arquivo_base64:base64})}}/>
        {nomeArquivoModelo(form)&&<div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginTop:10,fontSize:12,color:C.muted}}><span><b>Arquivo anexado:</b> {nomeArquivoModelo(form)}{form.arquivo_tamanho?` · ${(Number(form.arquivo_tamanho)/1024).toFixed(1)} KB`:''}</span><button type="button" onClick={()=>setForm({...form,arquivo_nome:'',arquivo_tipo:'',arquivo_tamanho:0,arquivo_base64:''})} style={{border:'1px solid '+C.red,background:C.redBg,color:C.red,borderRadius:8,padding:'6px 9px',fontWeight:800,cursor:'pointer'}}>Remover anexo</button></div>}
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10}}><button onClick={()=>setModal(false)} style={{background:C.white,border:'1px solid '+C.border,borderRadius:8,padding:'10px 14px',fontWeight:800}}>Cancelar</button><button onClick={save} style={{background:C.navy,color:'white',border:0,borderRadius:8,padding:'10px 14px',fontWeight:800}}>Salvar modelo</button></div>
    </Modal>}

    {preview&&<Modal title={`Visualizar modelo — ${preview.nome}`} onClose={()=>setPreview(null)}><div style={{border:'1px solid '+C.border,borderRadius:10,padding:12,marginBottom:12,background:C.bg}}><b>Arquivo anexado:</b> {nomeArquivoModelo(preview)||'—'}<div style={{fontSize:12,color:C.muted,marginTop:4}}>{tipoArquivoModelo(preview)||'tipo não informado'}</div>{preview.arquivo_base64&&<button onClick={()=>{const a=document.createElement('a');a.href=preview.arquivo_base64;a.download=nomeArquivoModelo(preview)||'modelo';a.click()}} style={{marginTop:10,border:0,background:C.navy,color:'white',borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer'}}>Baixar modelo</button>}</div><p style={{fontSize:13,color:C.muted}}>Este item do acervo é mantido exclusivamente como arquivo editável anexado.</p></Modal>}

  </div>
}
