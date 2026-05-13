import { useEffect, useMemo, useState } from 'react'
import { supabase, can } from '../lib/supabase.js'
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
  Plus,
  Archive,
  Info,
} from 'lucide-react'

import { C } from '../lib/theme'
import { motivoDesconsideracaoPush, pushIgnoradoDentroDoPrazo, pushIgnoradoParaArquivo, registrarPushDesconsiderado } from '../lib/pushArquivo.js'
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:10,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const DEFAULT_PUSH_EMAIL='juridicocallbrbpo@gmail.com'
const DEFAULT_PUSH_CONFIG={imap_host:'imap.gmail.com',imap_port:993,imap_secure:true,imap_user:DEFAULT_PUSH_EMAIL,imap_mailbox:'INBOX',enabled:true}
const PUSH_EMAIL_INFO='Essa conta de e-mail está configurada no site railway.com para que ela possa rodar as buscas a cada 5 minutos, 24/7.'


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

export default function AndamentosProcessuaisPush({profile, processo=null, compact=false, limit=10, onOpenProcess=null, onCreateProcess=null}){
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [savingId,setSavingId]=useState(null)
  const [q,setQ]=useState('')
  const [status,setStatus]=useState('ativos')
  const [onlyUnlinked,setOnlyUnlinked]=useState(false)
  const [openBodies,setOpenBodies]=useState({})
  const [runningIngest,setRunningIngest]=useState(false)
  const [configModal,setConfigModal]=useState(false)
  const [configForm,setConfigForm]=useState(DEFAULT_PUSH_CONFIG)
  const [savingConfig,setSavingConfig]=useState(false)
  const [configMissing,setConfigMissing]=useState(false)
  const [arquivoModal,setArquivoModal]=useState(false)
  const [arquivoItems,setArquivoItems]=useState([])
  const [arquivoLoading,setArquivoLoading]=useState(false)
  const [arquivoQuery,setArquivoQuery]=useState('')
  const [arquivoError,setArquivoError]=useState('')
  const [openArquivo,setOpenArquivo]=useState({})
  const [infoOpen,setInfoOpen]=useState(false)

  const load=async()=>{
    setLoading(true)
    let query=supabase.from('andamentos_processuais_push').select('*').eq('escritorio_id',profile.escritorio_id).order('criado_em',{ascending:false}).limit(processo?.id?200:(compact?limit:80))
    const {data,error}=await query
    if(error){console.error('Erro ao carregar andamentos push:',error);setItems([])} else setItems((data||[]).filter(pushIgnoradoDentroDoPrazo))
    setLoading(false)
  }

  const loadConfig=async()=>{
    const {data,error}=await supabase
      .from('push_email_config')
      .select('imap_host,imap_port,imap_secure,imap_user,imap_mailbox,enabled')
      .eq('escritorio_id',profile.escritorio_id)
      .maybeSingle()
    if(error){
      setConfigMissing(true)
      setConfigForm(DEFAULT_PUSH_CONFIG)
      return
    }
    setConfigMissing(false)
    setConfigForm({...DEFAULT_PUSH_CONFIG,...(data||{})})
  }

  const loadArquivo=async()=>{
    setArquivoLoading(true)
    setArquivoError('')
    const limiteArquivo=new Date(Date.now()-30*24*60*60*1000).toISOString()
    const {data,error}=await supabase
      .from('andamentos_processuais_push_arquivo')
      .select('*')
      .eq('escritorio_id',profile.escritorio_id)
      .gte('arquivado_em',limiteArquivo)
      .order('arquivado_em',{ascending:false})
      .limit(500)
    if(error){
      console.warn('[push-email] Arquivo proprio indisponivel; usando registros ignorados:', error)
      const fallback=await supabase
        .from('andamentos_processuais_push')
        .select('*')
        .eq('escritorio_id',profile.escritorio_id)
        .eq('status_associacao','ignorado')
        .gte('ignorado_em',limiteArquivo)
        .order('ignorado_em',{ascending:false})
        .limit(500)
      if(fallback.error){
        setArquivoError('Não foi possível carregar o arquivo de pushes desconsiderados: '+fallback.error.message)
        setArquivoItems([])
      }else{
        setArquivoError('')
        setArquivoItems((fallback.data||[]).map(pushIgnoradoParaArquivo))
      }
    }else{
      setArquivoItems(data||[])
    }
    setArquivoLoading(false)
  }

  useEffect(()=>{load()},[profile.escritorio_id,processo?.id])
  useEffect(()=>{loadConfig()},[profile.escritorio_id])

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

  const salvarConfig=async()=>{
    if(profile?.role!=='gerente')return
    const email=String(configForm.imap_user||'').trim().toLowerCase()
    if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('Informe um e-mail válido para a caixa monitorada.')
    setSavingConfig(true)
    const payload={
      escritorio_id:profile.escritorio_id,
      imap_host:configForm.imap_host||'imap.gmail.com',
      imap_port:Number(configForm.imap_port||993),
      imap_secure:!!configForm.imap_secure,
      imap_user:email,
      imap_mailbox:configForm.imap_mailbox||'INBOX',
      enabled:configForm.enabled!==false,
      updated_by:profile.id,
      updated_by_nome:profile.nome||profile.email||profile.id,
    }
    const {error}=await supabase.from('push_email_config').upsert(payload,{onConflict:'escritorio_id'})
    setSavingConfig(false)
    if(error)return alert('Não foi possível salvar a configuração da caixa monitorada: '+error.message)
    setConfigMissing(false)
    setConfigForm({...DEFAULT_PUSH_CONFIG,...payload})
    setConfigModal(false)
  }

  const abrirArquivo=async()=>{
    setArquivoModal(true)
    await loadArquivo()
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

  const arquivoFiltrado=useMemo(()=>{
    const term=arquivoQuery.trim().toLowerCase()
    return (arquivoItems||[]).filter(reg=>{
      const p=reg.snapshot||{}
      if(!term)return true
      return [p.numero_processo,p.tribunal,p.movimento,p.assunto_email,p.remetente,p.corpo_email_resumo,p.corpo_resumo,p.corpo_email_limpo,p.corpo_email,reg.usuario_nome,reg.motivo,reg.arquivado_em]
        .some(v=>String(v||'').toLowerCase().includes(term))
    })
  },[arquivoItems,arquivoQuery])

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
    const motivo=motivoDesconsideracaoPush(profile)
    const arquivo=await registrarPushDesconsiderado(supabase,a,profile,motivo)
    if(!arquivo.ok)console.warn('[push-email] Push sera mantido no arquivo por fallback do filtro Ignorados.')
    await updateItem(a.id,{status_associacao:'ignorado',ignorado_em:new Date().toISOString(),motivo_ignorado:motivo})
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
        <div style={{fontSize:12,color:C.muted,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <span>Caixa monitorada: <b>{configForm.imap_user||DEFAULT_PUSH_EMAIL}</b> · {sub}</span>
          <span style={{position:'relative',display:'inline-flex'}}>
            <button
              type="button"
              aria-label="Informação sobre a caixa monitorada"
              aria-expanded={infoOpen}
              title={PUSH_EMAIL_INFO}
              onPointerEnter={e=>{if(e.pointerType==='mouse')setInfoOpen(true)}}
              onPointerLeave={e=>{if(e.pointerType==='mouse')setInfoOpen(false)}}
              onFocus={()=>setInfoOpen(true)}
              onBlur={()=>setInfoOpen(false)}
              onClick={()=>setInfoOpen(v=>!v)}
              style={{border:'1px solid '+C.border,background:C.grayBg,color:C.blue,borderRadius:999,width:22,height:22,display:'inline-flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0}}
            >
              <Info size={14}/>
            </button>
            {infoOpen&&<span role="tooltip" style={{position:'absolute',left:0,top:28,zIndex:40,width:280,maxWidth:'min(280px,78vw)',background:C.text,color:C.white,borderRadius:8,padding:'9px 10px',fontSize:12,lineHeight:1.35,boxShadow:'0 10px 24px rgba(15,23,42,.24)'}}>{PUSH_EMAIL_INFO}</span>}
          </span>
        </div>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={executarIngestao} disabled={runningIngest||loading} style={btnStyle('blue')}><Mail size={14}/> {runningIngest?'Buscando...':'Buscar e-mails'}</button>
        <button onClick={abrirArquivo} style={btnStyle()}><Archive size={14}/> Arquivo</button>
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

    {configModal&&<div onClick={e=>e.target===e.currentTarget&&setConfigModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:560,padding:18,border:'1px solid '+C.border}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',borderBottom:'1px solid '+C.border,paddingBottom:12,marginBottom:14}}>
          <div><b>Configurar caixa monitorada</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>A alteração define a conta IMAP usada para buscar acompanhamentos processuais via push.</div></div>
          <button onClick={()=>setConfigModal(false)} style={{border:0,background:'none',cursor:'pointer',color:C.text,fontSize:20,lineHeight:1}}>×</button>
        </div>
        {configMissing&&<div style={{border:'1px solid '+C.amber,background:C.amberBg,color:C.amber,borderRadius:10,padding:10,fontSize:12,fontWeight:800,marginBottom:12}}>A tabela de configuração ainda não está disponível no banco. Após aplicar a migration, este formulário salvará a caixa monitorada.</div>}
        <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>E-mail monitorado</label>
        <input type="email" style={INP} value={configForm.imap_user||''} onChange={e=>setConfigForm(f=>({...f,imap_user:e.target.value}))} placeholder="juridico@empresa.com"/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 120px',gap:10,marginTop:12}}>
          <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Servidor IMAP</label><input style={INP} value={configForm.imap_host||''} onChange={e=>setConfigForm(f=>({...f,imap_host:e.target.value}))}/></div>
          <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Porta</label><input type="number" style={INP} value={configForm.imap_port||993} onChange={e=>setConfigForm(f=>({...f,imap_port:e.target.value}))}/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
          <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Pasta / label</label><input style={INP} value={configForm.imap_mailbox||'INBOX'} onChange={e=>setConfigForm(f=>({...f,imap_mailbox:e.target.value}))}/></div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:800,color:C.text,marginTop:22}}><input type="checkbox" checked={configForm.imap_secure!==false} onChange={e=>setConfigForm(f=>({...f,imap_secure:e.target.checked}))}/> SSL/TLS</label>
        </div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.4}}>A senha continua sendo a credencial segura configurada no servidor. Ao trocar o e-mail, use uma conta compatível com a senha de app/IMAP configurada.</p>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:14}}><button onClick={()=>setConfigModal(false)} style={btnStyle()}>Cancelar</button><button onClick={salvarConfig} disabled={savingConfig} style={btnStyle('blue')}>{savingConfig?'Salvando...':'Salvar configuração'}</button></div>
      </div>
    </div>}

    {arquivoModal&&<div onClick={e=>e.target===e.currentTarget&&setArquivoModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:960,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid '+C.border}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',padding:18,borderBottom:'1px solid '+C.border}}>
          <div><b style={{display:'flex',alignItems:'center',gap:8}}><Archive size={17}/> Arquivo de pushes desconsiderados</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>Registro próprio dos pushes arquivados nos últimos 30 dias, com usuário, data e hora da desconsideração.</div></div>
          <button onClick={()=>setArquivoModal(false)} style={{border:0,background:'none',cursor:'pointer',color:C.text,fontSize:22,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:16,borderBottom:'1px solid '+C.border,display:'grid',gridTemplateColumns:'minmax(220px,1fr) auto',gap:10}}>
          <label style={{position:'relative'}}><Search size={15} style={{position:'absolute',left:11,top:12,color:C.muted}}/><input style={{...INP,paddingLeft:34}} value={arquivoQuery} onChange={e=>setArquivoQuery(e.target.value)} placeholder="Buscar no arquivo por processo, tribunal, movimento, usuário ou e-mail"/></label>
          <button onClick={loadArquivo} disabled={arquivoLoading} style={btnStyle()}><RefreshCw size={14}/> Atualizar</button>
        </div>
        <div style={{padding:16,overflow:'auto'}}>
          {arquivoLoading&&<div style={{padding:16,color:C.muted}}>Carregando arquivo...</div>}
          {arquivoError&&<div style={{border:'1px solid '+C.amber,background:C.amberBg,color:C.amber,borderRadius:10,padding:12,fontSize:13,fontWeight:800}}>{arquivoError}</div>}
          {!arquivoLoading&&!arquivoError&&!arquivoFiltrado.length&&<div style={{border:'1px dashed '+C.border,borderRadius:12,padding:24,textAlign:'center',color:C.muted}}>Nenhum push arquivado encontrado.</div>}
          {!arquivoLoading&&!arquivoError&&arquivoFiltrado.map(reg=>{
            const p=reg.snapshot||{}
            const corpoLimpo=cleanEmailDisplay(p.corpo_email_limpo||p.corpo_email||'')
            const aberto=!!openArquivo[reg.id]
            return <article key={reg.id} style={{border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:10,background:C.grayBg}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>
                <div style={{minWidth:0}}>
                  <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><b>{p.movimento||'Andamento arquivado'}</b><span style={{fontSize:11,fontWeight:900,borderRadius:999,padding:'3px 8px',background:C.redBg,color:C.red,display:'inline-flex',gap:4,alignItems:'center'}}><Archive size={12}/> Arquivado</span></div>
                  <div style={{fontSize:12,color:C.muted,marginTop:4}}>{p.numero_processo||'Processo não identificado'}{p.tribunal?` · ${p.tribunal}`:''} · arquivado em {datetimeBR(reg.arquivado_em)}{reg.usuario_nome?` · por ${reg.usuario_nome}`:''}</div>
                  {reg.motivo&&<div style={{fontSize:12,color:C.red,marginTop:6}}>{reg.motivo}</div>}
                </div>
                <button type="button" onClick={()=>setOpenArquivo(prev=>({...prev,[reg.id]:!prev[reg.id]}))} style={btnStyle()}><Eye size={13}/> {aberto?'Ocultar registro':'Ver registro'}</button>
              </div>
              {aberto&&<div style={{marginTop:10,border:'1px solid '+C.border,borderRadius:10,background:C.white,padding:12}}>
                {(p.assunto_email||p.remetente)&&<div style={{fontSize:12,color:C.muted,marginBottom:8}}>E-mail: {p.assunto_email||'Sem assunto'}{p.remetente?` · ${p.remetente}`:''}</div>}
                {corpoLimpo?<pre style={{fontFamily:'inherit',fontSize:13,lineHeight:1.45,color:C.text,whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,maxHeight:260,overflow:'auto'}}>{corpoLimpo}</pre>:<div style={{fontSize:13,color:C.muted}}>Sem corpo de e-mail armazenado neste registro.</div>}
              </div>}
            </article>
          })}
        </div>
      </div>
    </div>}

    {loading?<div style={{padding:16,color:C.muted}}>Carregando andamentos...</div>:filtered.length===0?<div style={{padding:18,marginTop:12,border:'1px dashed '+C.border,borderRadius:12,color:C.muted,display:'flex',gap:8,alignItems:'center'}}><Inbox size={18}/> Nenhum andamento push encontrado{processo?' para este processo':''}.</div>:<div style={{display:'grid',gap:10,marginTop:14}}>{(compact?filtered.slice(0,limit):filtered).map(a=>{
      const st=statusStyle(a.status_associacao)
      const podeVincular=processo?.id&&!a.processo_id&&cleanProcessNumber(a.numero_processo)===cleanProcessNumber(processo.numero)
      const ignored=a.status_associacao==='ignorado'
      const corpoLimpo=cleanEmailDisplay(a.corpo_email_limpo || a.corpo_email || '')
      const temCorpo=Boolean(corpoLimpo)
      const temDetalhe=temCorpo||a.assunto_email||a.remetente
      const expanded=!!openBodies[a.id]
      const podeAbrir=Boolean(a.processo_id&&onOpenProcess)
      const podeCriar=Boolean(!processo?.id&&!a.processo_id&&onCreateProcess&&can(profile,'processos.criar'))
      return <article key={a.id} style={{border:'1px solid '+(ignored?C.redBg:C.border),borderRadius:14,padding:12,background:ignored?C.redBg:C.grayBg,opacity:ignored?.78:1}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{minWidth:0}}>
            <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}><b style={{fontSize:14}}>{a.movimento||'Andamento recebido'}</b><span style={{fontSize:11,fontWeight:900,borderRadius:999,padding:'3px 8px',background:st.bg,color:st.color,display:'inline-flex',gap:4,alignItems:'center'}}>{st.icon} {st.label}</span></div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>{a.numero_processo||'Processo não identificado'}{a.tribunal?` · ${a.tribunal}`:''} · movimento em {dateBR(a.data_movimento)} · recebido em {datetimeBR(a.criado_em)}</div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {temDetalhe&&<button type="button" onClick={()=>toggleBody(a.id)} style={btnStyle()}><Eye size={13}/> {expanded?'Ocultar e-mail':temCorpo?'Ver corpo do e-mail':'Ver detalhes'}</button>}
          </div>
        </div>
        {temDetalhe&&expanded&&<div style={{marginTop:10,border:'1px solid '+C.border,borderRadius:12,background:C.white,padding:12}}>
          {(a.assunto_email||a.remetente)&&<div style={{fontSize:12,color:C.muted,marginBottom:8}}>E-mail: {a.assunto_email||'Sem assunto'}{a.remetente?` · ${a.remetente}`:''}</div>}
          {temCorpo&&<>
            <div style={{fontSize:12,fontWeight:900,color:C.text,marginBottom:6}}>Corpo do e-mail recebido</div>
            <pre style={{fontFamily:'inherit',fontSize:13,lineHeight:1.45,color:C.text,whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,maxHeight:260,overflow:'auto'}}>{corpoLimpo}</pre>
          </>}
          <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end',marginTop:12}}>
            {a.url_origem&&<a href={a.url_origem} target="_blank" rel="noreferrer" style={{...btnStyle(),textDecoration:'none'}}><ExternalLink size={13}/> Abrir origem</a>}
            {podeAbrir&&<button type="button" onClick={()=>onOpenProcess(a.processo_id)} style={btnStyle('green')}><ExternalLink size={13}/> Abrir processo</button>}
            {podeCriar&&<button type="button" onClick={()=>onCreateProcess(a)} style={btnStyle('blue')}><Plus size={13}/> Criar processo</button>}
            {podeVincular&&<button disabled={savingId===a.id} onClick={()=>vincular(a)} style={btnStyle('blue')}><Link2 size={13}/> Vincular</button>}
            {!ignored&&<button disabled={savingId===a.id} onClick={()=>ignorar(a)} style={btnStyle('red')}><EyeOff size={13}/> Desconsiderar</button>}
            {ignored&&<button disabled={savingId===a.id} onClick={()=>restaurar(a)} style={btnStyle('green')}><RotateCcw size={13}/> Restaurar</button>}
          </div>
        </div>}
        {ignored&&a.motivo_ignorado&&<div style={{fontSize:12,color:C.red,marginTop:8}}>Motivo: {a.motivo_ignorado}</div>}
      </article>
    })}</div>}
  </section>
}
