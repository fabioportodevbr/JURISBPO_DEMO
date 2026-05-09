import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  RefreshCw,
  Mail,
  Link2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Eye,
  RotateCcw,
  Search,
  Inbox,
  Filter,
} from 'lucide-react'

import { C } from '../lib/theme'
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:10,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}


function decodeQuotedPrintableText(value=''){
  const normalized=String(value||'').replace(/=\r?\n/g,'')
  if(!/=([0-9A-F]{2})/i.test(normalized))return normalized
  const binary=normalized.replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
  try{return decodeURIComponent(binary.split('').map(ch=>'%'+('00'+ch.charCodeAt(0).toString(16)).slice(-2)).join(''))}catch{return binary}
}
function stripHtmlText(value=''){
  return String(value||'')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
}
function cleanEmailDisplay(value=''){
  const decoded=decodeQuotedPrintableText(value)
  return stripHtmlText(decoded)
    .replace(/^--[^\n]+--?$/gm,'')
    .replace(/^Content-Type:.*$/gim,'')
    .replace(/^Content-Transfer-Encoding:.*$/gim,'')
    .replace(/^Content-Disposition:.*$/gim,'')
    .replace(/^MIME-Version:.*$/gim,'')
    .replace(/\r/g,'')
    .replace(/[ \t]+\n/g,'\n')
    .replace(/\n[ \t]+/g,'\n')
    .replace(/[ \t]{2,}/g,' ')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
}
function shortText(value='',limit=260){
  const text=cleanEmailDisplay(value)
  if(!text)return ''
  return text.length>limit?text.slice(0,limit).trim()+'...':text
}

function dateBR(d){
  if(!d)return 'Sem data'
  const iso=String(d).slice(0,10)
  return new Date(iso+'T12:00:00').toLocaleDateString('pt-BR')
}
function datetimeBR(d){return d?new Date(d).toLocaleString('pt-BR'):'—'}
function cleanProcessNumber(v=''){return String(v||'').replace(/\D/g,'')}
function statusStyle(status){
  if(status==='associado')return {bg:C.greenBg,color:C.green,label:'Associado',icon:<CheckCircle2 size={12}/>}
  if(status==='ignorado')return {bg:C.redBg,color:C.red,label:'Ignorado',icon:<EyeOff size={12}/>}
  return {bg:C.amberBg,color:C.amber,label:'Pendente',icon:<AlertCircle size={12}/>}
}
function btnStyle(kind='default'){
  const base={border:'1px solid '+C.border,background:C.white,color:C.text,borderRadius:9,padding:'7px 10px',fontSize:12,fontWeight:800,display:'inline-flex',gap:6,alignItems:'center',cursor:'pointer'}
  if(kind==='blue')return {...base,border:'1px solid '+C.blue,background:C.blueBg,color:C.blue}
  if(kind==='red')return {...base,border:'1px solid '+C.red,background:C.redBg,color:C.red}
  if(kind==='green')return {...base,border:'1px solid '+C.green,background:C.greenBg,color:C.green}
  return base
}

export default function AndamentosProcessuaisPush({profile, processo=null, compact=false, limit=10}){
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [savingId,setSavingId]=useState(null)
  const [q,setQ]=useState('')
  const [status,setStatus]=useState('ativos')
  const [onlyUnlinked,setOnlyUnlinked]=useState(false)
  const [openBodies,setOpenBodies]=useState({})
  const [runningIngest,setRunningIngest]=useState(false)

  const load=async()=>{
    setLoading(true)
    let query=supabase.from('andamentos_processuais_push').select('*').eq('escritorio_id',profile.escritorio_id).order('criado_em',{ascending:false}).limit(processo?.id?200:(compact?limit:80))
    const {data,error}=await query
    if(error){console.error('Erro ao carregar andamentos push:',error);setItems([])} else setItems(data||[])
    setLoading(false)
  }

  useEffect(()=>{load()},[profile.escritorio_id,processo?.id])

  const executarIngestao=async()=>{
    setRunningIngest(true)
    try{
      const {data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/push-email/run',{
        method:'POST',
        headers:session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{}
      })
      const json=await res.json().catch(()=>({ok:false,error:'Resposta invalida da funcao.'}))
      if(!res.ok||!json.ok)throw new Error(json.error||'Erro ao buscar e-mails.')
      alert(`Busca concluida. Processados: ${json.processed}; salvos: ${json.saved}; ignorados: ${json.ignored}; falhas: ${json.failed}.`)
      await load()
    }catch(err){
      alert(err?.message||'Erro ao executar busca de e-mails.')
    }finally{
      setRunningIngest(false)
    }
  }

  const counts=useMemo(()=>({
    ativos:(items||[]).filter(a=>a.status_associacao!=='ignorado').length,
    associado:(items||[]).filter(a=>a.status_associacao==='associado').length,
    pendente:(items||[]).filter(a=>a.status_associacao==='pendente').length,
    ignorado:(items||[]).filter(a=>a.status_associacao==='ignorado').length,
  }),[items])

  const filtered=useMemo(()=>{
    const term=q.trim().toLowerCase()
    const numeroAtual=cleanProcessNumber(processo?.numero)
    return (items||[]).filter(a=>{
      if(status==='ativos'&&a.status_associacao==='ignorado')return false
      if(status!=='ativos'&&status!=='todos'&&a.status_associacao!==status)return false
      if(onlyUnlinked&&a.processo_id)return false
      if(processo?.id){
        const associado=a.processo_id===processo.id
        const pendenteMesmoNumero=!a.processo_id&&numeroAtual&&cleanProcessNumber(a.numero_processo)===numeroAtual
        if(!associado&&!pendenteMesmoNumero)return false
      }
      if(term&&![a.numero_processo,a.tribunal,a.movimento,a.assunto_email,a.corpo_email_resumo,a.corpo_resumo,a.corpo_email_limpo,a.corpo_email,a.remetente].some(v=>String(v||'').toLowerCase().includes(term)))return false
      return true
    })
  },[items,q,status,onlyUnlinked,processo])

  const updateItem=async(id,patch)=>{
    setSavingId(id)
    const {error}=await supabase.from('andamentos_processuais_push').update(patch).eq('id',id)
    setSavingId(null)
    if(error){alert(error.message);return false}
    load();return true
  }

  const ignorar=async(a)=>{
    const ok=window.confirm('Desconsiderar este andamento? Ele ficará oculto na lista principal, mas poderá ser visto no filtro Ignorados.')
    if(!ok)return
    await updateItem(a.id,{status_associacao:'ignorado',ignorado_em:new Date().toISOString(),motivo_ignorado:'Desconsiderado manualmente no JurisBPO'})
  }
  const restaurar=async(a)=>{
    await updateItem(a.id,{status_associacao:a.processo_id?'associado':'pendente',ignorado_em:null,motivo_ignorado:null})
  }

  const toggleBody=(id)=>{
    setOpenBodies(prev=>({...prev,[id]:!prev[id]}))
  }

  const vincular=async(a)=>{
    if(!processo?.id)return
    setSavingId(a.id)
    const {error}=await supabase.from('andamentos_processuais_push').update({processo_id:processo.id,cliente_id:processo.cliente_id||null,escritorio_id:profile.escritorio_id,status_associacao:'associado'}).eq('id',a.id)
    setSavingId(null)
    if(error)return alert(error.message)
    await supabase.from('notificacoes').insert({
      escritorio_id:profile.escritorio_id,
      usuario_id:processo.responsavel_id||profile.id,
      tipo:'andamento_processual',
      titulo:'Andamento vinculado ao processo',
      descricao:`${a.movimento || 'Novo andamento'} — ${processo.numero || processo.titulo}`,
      origem_tipo:'processo',
      origem_id:String(processo.id)
    })
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    load()
  }

  const headerTitle=processo?'Acompanhamentos processuais via push':'Acompanhamento processual via push'
  const sub=processo?'Andamentos recebidos por e-mail e associados a este processo.':'Últimos andamentos recebidos por e-mail dos tribunais.'
  const tabs=[['ativos','Ativos',counts.ativos],['pendente','Pendentes',counts.pendente],['associado','Associados',counts.associado],['ignorado','Ignorados',counts.ignorado],['todos','Todos',items.length]]

  return <section style={{background:C.white,border:'1px solid '+C.border,borderRadius:16,padding:compact?12:16,marginBottom:16,boxShadow:'0 8px 22px rgba(15,23,42,.04)'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div>
        <h3 style={{margin:'0 0 4px',fontSize:compact?15:18,display:'flex',gap:8,alignItems:'center'}}><Mail size={18}/> {headerTitle}</h3>
        <div style={{fontSize:12,color:C.muted}}>Caixa monitorada: <b>juridicocallbrbpo@gmail.com</b> · {sub}</div>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {profile?.role==='gerente'&&<button onClick={executarIngestao} disabled={runningIngest||loading} style={btnStyle('blue')}><Mail size={14}/> {runningIngest?'Buscando...':'Buscar e-mails'}</button>}
        <button onClick={load} disabled={loading} style={btnStyle()}><RefreshCw size={14}/> Atualizar</button>
      </div>
    </div>

    {!compact&&<>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>{tabs.map(([key,label,count])=><button key={key} onClick={()=>setStatus(key)} style={{border:'1px solid '+(status===key?C.blue:C.border),background:status===key?C.blueBg:C.white,color:status===key?C.blue:C.text,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900,cursor:'pointer'}}>{label} <span style={{opacity:.72}}>({count})</span></button>)}</div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(220px,1fr) 160px',gap:10,marginTop:12}}>
        <label style={{position:'relative'}}><Search size={15} style={{position:'absolute',left:11,top:12,color:C.muted}}/><input style={{...INP,paddingLeft:34}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por processo, tribunal, assunto, remetente ou resumo"/></label>
        <button onClick={()=>setOnlyUnlinked(v=>!v)} style={{border:'1px solid '+(onlyUnlinked?C.amber:C.border),background:onlyUnlinked?C.amberBg:C.white,color:onlyUnlinked?C.amber:C.text,borderRadius:10,padding:'8px 10px',fontWeight:900,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6}}><Filter size={14}/> Só sem vínculo</button>
      </div>
    </>}

    {loading?<div style={{padding:16,color:C.muted}}>Carregando andamentos...</div>:filtered.length===0?<div style={{padding:18,marginTop:12,border:'1px dashed '+C.border,borderRadius:12,color:C.muted,display:'flex',gap:8,alignItems:'center'}}><Inbox size={18}/> Nenhum andamento push encontrado{processo?' para este processo':''}.</div>:<div style={{display:'grid',gap:10,marginTop:14}}>{(compact?filtered.slice(0,limit):filtered).map(a=>{
      const st=statusStyle(a.status_associacao)
      const podeVincular=processo?.id&&!a.processo_id&&cleanProcessNumber(a.numero_processo)===cleanProcessNumber(processo.numero)
      const ignored=a.status_associacao==='ignorado'
      const corpoLimpo=cleanEmailDisplay(a.corpo_email_limpo || a.corpo_email || '')
      const resumo=shortText(a.corpo_email_resumo || a.corpo_resumo || corpoLimpo, 260)
      const temCorpo=Boolean(corpoLimpo)
      return <article key={a.id} style={{border:'1px solid '+(ignored?C.redBg:C.border),borderRadius:14,padding:12,background:ignored?C.redBg:C.grayBg,opacity:ignored?.78:1}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{minWidth:0}}>
            <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><b style={{fontSize:14}}>{a.movimento||'Andamento recebido'}</b><span style={{fontSize:11,fontWeight:900,borderRadius:999,padding:'3px 8px',background:st.bg,color:st.color,display:'inline-flex',gap:4,alignItems:'center'}}>{st.icon} {st.label}</span></div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>{a.numero_processo||'Processo não identificado'}{a.tribunal?` · ${a.tribunal}`:''} · movimento em {dateBR(a.data_movimento)} · recebido em {datetimeBR(a.criado_em)}</div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {a.url_origem&&<a href={a.url_origem} target="_blank" rel="noreferrer" style={{...btnStyle(),textDecoration:'none'}}><ExternalLink size={13}/> Abrir origem</a>}
            {temCorpo&&<button type="button" onClick={()=>toggleBody(a.id)} style={btnStyle()}><Eye size={13}/> {openBodies[a.id]?'Ocultar e-mail':'Ver corpo do e-mail'}</button>}
            {podeVincular&&<button disabled={savingId===a.id} onClick={()=>vincular(a)} style={btnStyle('blue')}><Link2 size={13}/> Vincular</button>}
            {!ignored&&<button disabled={savingId===a.id} onClick={()=>ignorar(a)} style={btnStyle('red')}><EyeOff size={13}/> Desconsiderar</button>}
            {ignored&&<button disabled={savingId===a.id} onClick={()=>restaurar(a)} style={btnStyle('green')}><RotateCcw size={13}/> Restaurar</button>}
          </div>
        </div>
        {(a.assunto_email||a.remetente)&&<div style={{fontSize:12,color:C.muted,marginTop:8}}>E-mail: {a.assunto_email||'Sem assunto'}{a.remetente?` · ${a.remetente}`:''}</div>}
        {resumo&&<p style={{fontSize:13,color:C.text,lineHeight:1.45,margin:'8px 0 0',whiteSpace:'pre-wrap'}}>{resumo}</p>}
        {temCorpo&&openBodies[a.id]&&<div style={{marginTop:10,border:'1px solid '+C.border,borderRadius:12,background:C.white,padding:12}}>
          <div style={{fontSize:12,fontWeight:900,color:C.text,marginBottom:6}}>Corpo do e-mail recebido</div>
          <pre style={{fontFamily:'inherit',fontSize:13,lineHeight:1.45,color:C.text,whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,maxHeight:260,overflow:'auto'}}>{corpoLimpo}</pre>
        </div>}
        {ignored&&a.motivo_ignorado&&<div style={{fontSize:12,color:C.red,marginTop:8}}>Motivo: {a.motivo_ignorado}</div>}
      </article>
    })}</div>}
  </section>
}
