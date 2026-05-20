import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { Send, Paperclip, Download, Users, MessageSquare, Hash, X, FileText, Image, Mail, Archive, ArchiveRestore, Reply, Inbox } from 'lucide-react'

import { C } from '../lib/theme'
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}

function avatar(nome,size=32){
  const ini=(nome||'?').split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'?'
  const hue=[...(nome||'')].reduce((a,c)=>a+c.charCodeAt(0),0)%360
  return <div style={{width:size,height:size,borderRadius:'50%',background:`hsl(${hue},52%,40%)`,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:size*0.38,flexShrink:0}}>{ini}</div>
}

function OnlineDot({online,size=8}){
  return <span style={{width:size,height:size,borderRadius:'50%',background:online?'#22c55e':'#94a3b8',display:'inline-block',flexShrink:0,border:'1.5px solid white'}}/>
}

function Modal({title,onClose,children,width=720}){
  return <div onMouseDown={e=>e.target===e.currentTarget&&(e.currentTarget._md=1)} onClick={e=>e.target===e.currentTarget&&e.currentTarget._md&&(delete e.currentTarget._md,onClose())} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:width,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border,alignItems:'center',gap:12}}>
        <b style={{fontSize:16}}>{title}</b>
        <button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',padding:4,color:C.muted}}><X size={18}/></button>
      </div>
      <div style={{padding:18,overflow:'auto',flex:1}}>{children}</div>
    </div>
  </div>
}

function timeLabel(iso){
  if(!iso)return''
  const d=new Date(iso),now=new Date()
  const sameDay=d.toDateString()===now.toDateString()
  if(sameDay)return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
}

function FileIcon({tipo}){
  if((tipo||'').startsWith('image/'))return <Image size={15} color={C.blue}/>
  return <FileText size={15} color={C.muted}/>
}

// ─── Messages Tab (Group + DM) ────────────────────────────────────────────────
function ChatPane({profile,team,onlineMap}){
  const [salaId,setSalaId]=useState('geral')
  const [salaTitle,setSalaTitle]=useState('Sala Geral')
  const [msgs,setMsgs]=useState([])
  const [texto,setTexto]=useState('')
  const [arquivo,setArquivo]=useState(null)
  const [sending,setSending]=useState(false)
  const [unreadDM,setUnreadDM]=useState({}) // userId -> count
  const bottomRef=useRef()
  const fileRef=useRef()
  const channelRef=useRef()

  // Get or create DM sala
  const getSala=useCallback(async(targetId)=>{
    const eid=profile.escritorio_id
    const {data:existing}=await supabase.from('chat_salas').select('id').eq('escritorio_id',eid).eq('tipo','direto').contains('participantes',[profile.id,targetId]).maybeSingle()
    if(existing)return existing.id
    const {data:novo}=await supabase.from('chat_salas').insert({escritorio_id:eid,tipo:'direto',participantes:[profile.id,targetId]}).select('id').single()
    return novo?.id||null
  },[profile])

  const loadMsgs=useCallback(async(sid)=>{
    if(!sid)return
    if(sid==='geral'){
      const { data: lastClear } = await supabase.from('chat_mensagens')
        .select('criado_em')
        .eq('escritorio_id', profile.escritorio_id)
        .eq('tipo', 'geral')
        .eq('texto', '[SISTEMA_ARQUIVAR_SESSAO]')
        .order('criado_em', { ascending: false }).limit(1).maybeSingle()
      
      let query = supabase.from('chat_mensagens')
        .select('*')
        .eq('escritorio_id',profile.escritorio_id)
        .eq('tipo','geral')
        .neq('texto', '[SISTEMA_ARQUIVAR_SESSAO]')
        .order('criado_em',{ascending:false})
        .limit(200)
        
      if (lastClear) {
         query = query.gt('criado_em', lastClear.criado_em)
      }
      const { data } = await query
      setMsgs(data ? data.reverse() : [])
    } else {
      const{data}=await supabase.from('chat_mensagens').select('*').eq('sala_id',sid).order('criado_em',{ascending:true}).limit(200)
      setMsgs(data||[])
      // Mark as read
      try {
        await supabase.rpc('marcar_chat_lido',{p_sala_id:sid,p_usuario_id:profile.id})
      } catch (err) {}
    }
  },[profile])

  const subscribeToSala=useCallback((sid)=>{
    if(channelRef.current) supabase.removeChannel(channelRef.current)
    const filter=sid==='geral'
      ?`escritorio_id=eq.${profile.escritorio_id}`
      :`sala_id=eq.${sid}`
    const ch=supabase.channel('chat_'+sid)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'chat_mensagens',filter},payload=>{
        if (sid==='geral') {
          if (payload.new.texto === '[SISTEMA_ARQUIVAR_SESSAO]') {
            setMsgs([])
            return
          }
          if (payload.new.tipo !== 'geral') return;
        }
        setMsgs(prev=>[...prev,payload.new])
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),50)
      })
      .subscribe()
    channelRef.current=ch
  },[profile])

  useEffect(()=>{
    loadMsgs(salaId)
    subscribeToSala(salaId)
    return()=>{if(channelRef.current)supabase.removeChannel(channelRef.current)}
  },[salaId])

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'auto'})},[msgs.length>0&&msgs[0]?.id])

  const abrirDM=async(u)=>{
    const sid=await getSala(u.id)
    if(!sid)return
    setSalaId(sid)
    setSalaTitle(u.nome)
  }

  const enviar=async()=>{
    if(!texto.trim()&&!arquivo)return
    setSending(true)
    try{
      let arquivo_url=null,arquivo_nome=null,arquivo_tipo=null
      if(arquivo){
        const ext=arquivo.name.split('.').pop()
        const path=`${profile.escritorio_id}/${Date.now()}.${ext}`
        const{error:upErr}=await supabase.storage.from('chat-arquivos').upload(path,arquivo,{cacheControl:'3600',upsert:false})
        if(!upErr){
          const{data:urlData}=supabase.storage.from('chat-arquivos').getPublicUrl(path)
          arquivo_url=urlData.publicUrl
          arquivo_nome=arquivo.name
          arquivo_tipo=arquivo.type
        }
      }
      const payload={
        escritorio_id:profile.escritorio_id,
        remetente_id:profile.id,
        remetente_nome:profile.nome||profile.email||'Usuário',
        texto:texto.trim()||null,
        arquivo_url,arquivo_nome,arquivo_tipo,
        tipo:salaId==='geral'?'geral':'direto',
        sala_id:salaId==='geral'?null:salaId,
      }
      await supabase.from('chat_mensagens').insert(payload)
      setTexto('')
      setArquivo(null)
      if(fileRef.current)fileRef.current.value=''
    }finally{setSending(false)}
  }

  const outrosDM=team.filter(t=>t.id!==profile.id)

  const [historicoOpen, setHistoricoOpen] = useState(false)
  const [sessoes, setSessoes] = useState([])
  const [sessaoMsgs, setSessaoMsgs] = useState(null)
  const [loadingHist, setLoadingHist] = useState(false)

  const loadHistorico = async () => {
    setLoadingHist(true)
    const { data: comandos } = await supabase.from('chat_mensagens')
      .select('criado_em, id')
      .eq('escritorio_id', profile.escritorio_id)
      .eq('tipo', 'geral')
      .eq('texto', '[SISTEMA_ARQUIVAR_SESSAO]')
      .order('criado_em', { ascending: true })

    const { data: firstMsg } = await supabase.from('chat_mensagens')
      .select('criado_em')
      .eq('escritorio_id', profile.escritorio_id)
      .eq('tipo', 'geral')
      .order('criado_em', { ascending: true })
      .limit(1).maybeSingle()
      
    if (!comandos || comandos.length === 0) {
      setSessoes([])
      setLoadingHist(false)
      return
    }

    const sessions = []
    let currentStart = firstMsg ? firstMsg.criado_em : comandos[0].criado_em
    
    for (let i = 0; i < comandos.length; i++) {
      sessions.push({
        id: comandos[i].id,
        inicio: currentStart,
        fim: comandos[i].criado_em,
        count: 'Várias'
      })
      currentStart = comandos[i].criado_em
    }
    
    setSessoes(sessions.reverse())
    setLoadingHist(false)
  }

  const openSessao = async (session) => {
    const { data } = await supabase.from('chat_mensagens')
      .select('*')
      .eq('escritorio_id', profile.escritorio_id)
      .eq('tipo', 'geral')
      .neq('texto', '[SISTEMA_ARQUIVAR_SESSAO]')
      .gte('criado_em', session.inicio)
      .lte('criado_em', session.fim)
      .order('criado_em', { ascending: true })
    setSessaoMsgs(data||[])
  }

  return <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
    {/* Chat area */}
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.white}}>
      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,background:C.white}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {salaId==='geral'?<Hash size={18} color={C.muted}/>:<div style={{position:'relative'}}>{avatar(salaTitle,32)}<span style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',background:onlineMap[team.find(t=>t.nome===salaTitle)?.id]?'#22c55e':'#94a3b8',border:'2px solid white'}}/></div>}
          <div>
            <b style={{fontSize:15,color:C.text}}>{salaTitle}</b>
            {salaId==='geral'&&<div style={{fontSize:12,color:C.muted}}>{team.length} membros · {Object.keys(onlineMap).filter(k=>onlineMap[k]).length} online</div>}
            {salaId!=='geral'&&<div style={{fontSize:12,color:C.muted}}>{onlineMap[team.find(t=>t.nome===salaTitle)?.id]?'🟢 Online':'⚪ Offline'}</div>}
          </div>
        </div>
        {salaId==='geral'&&<button onClick={()=>{setHistoricoOpen(true);loadHistorico()}} style={{display:'flex',alignItems:'center',gap:6,background:C.grayBg,border:'1px solid '+C.border,color:C.text,padding:'6px 12px',borderRadius:6,fontSize:13,cursor:'pointer',fontWeight:600}}><Archive size={14}/> Histórico</button>}
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:2}}>
        {msgs.length===0&&<div style={{textAlign:'center',padding:'60px 0',color:C.muted}}><MessageSquare size={32} style={{display:'block',margin:'0 auto 12px',opacity:.3}}/><p style={{margin:0,fontSize:14}}>Nenhuma mensagem ativa. A sala foi limpa recentemente.</p></div>}
        {msgs.map((m,i)=>{
          const meu=m.remetente_id===profile.id
          const prev=msgs[i-1]
          const agrup=prev?.remetente_id===m.remetente_id&&(new Date(m.criado_em)-new Date(prev.criado_em))<120000
          return <div key={m.id} style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:agrup?0:8}}>
            <div style={{width:32,flexShrink:0}}>{!agrup&&avatar(m.remetente_nome,32)}</div>
            <div style={{flex:1,minWidth:0}}>
              {!agrup&&<div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:2}}>
                <span style={{fontSize:13,fontWeight:700,color:meu?C.green:C.text}}>{m.remetente_nome}</span>
                <span style={{fontSize:11,color:C.muted}}>{timeLabel(m.criado_em)}</span>
              </div>}
              {m.texto&&<p style={{margin:0,fontSize:14,color:C.text,lineHeight:1.5,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{m.texto}</p>}
              {m.arquivo_url&&<a href={m.arquivo_url} target="_blank" rel="noreferrer" style={{display:'inline-flex',alignItems:'center',gap:8,marginTop:4,padding:'8px 12px',border:'1px solid '+C.border,borderRadius:10,background:C.grayBg,textDecoration:'none',color:C.text,fontSize:13,maxWidth:320}}>
                {m.arquivo_tipo?.startsWith('image/')?<img src={m.arquivo_url} alt={m.arquivo_nome} style={{maxWidth:240,maxHeight:180,borderRadius:8,display:'block'}}/>:<><FileIcon tipo={m.arquivo_tipo}/><span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.arquivo_nome}</span><Download size={14} color={C.blue}/></>}
              </a>}
            </div>
          </div>
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:'12px 20px',borderTop:'1px solid '+C.border,flexShrink:0,background:C.white}}>
        {arquivo&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:C.grayBg,borderRadius:8,marginBottom:8,fontSize:13}}>
          <FileIcon tipo={arquivo.type}/>
          <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{arquivo.name}</span>
          <button onClick={()=>{setArquivo(null);if(fileRef.current)fileRef.current.value=''}} style={{border:0,background:'none',cursor:'pointer',color:C.muted,padding:2}}><X size={14}/></button>
        </div>}
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <textarea value={texto} onChange={e=>setTexto(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar()}}} placeholder={`Mensagem para ${salaTitle}... (Enter para enviar, Shift+Enter para quebra de linha)`} style={{...INP,minHeight:44,maxHeight:140,resize:'vertical',flex:1,lineHeight:1.5}}/>
          <input ref={fileRef} type="file" style={{display:'none'}} onChange={e=>setArquivo(e.target.files?.[0]||null)}/>
          <button onClick={()=>fileRef.current?.click()} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px',cursor:'pointer',color:C.muted,flexShrink:0,display:'flex'}} title="Anexar arquivo"><Paperclip size={18}/></button>
          <button onClick={enviar} disabled={sending||(!texto.trim()&&!arquivo)} style={{background:texto.trim()||arquivo?C.navy:'#e2e8f0',color:texto.trim()||arquivo?'white':C.muted,border:0,borderRadius:8,padding:'10px 16px',cursor:texto.trim()||arquivo?'pointer':'default',fontWeight:700,display:'flex',alignItems:'center',gap:6,flexShrink:0,transition:'all .15s'}}>
            <Send size={16}/>{sending?'...':'Enviar'}
          </button>
        </div>
      </div>
    </div>

    {/* Sidebar */}
    <div style={{width:240,background:C.bg,display:'flex',flexDirection:'column',flexShrink:0,borderLeft:'1px solid '+C.border}}>
      {/* Geral */}
      <div style={{padding:'16px 10px 8px'}}>
        <div style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6,paddingLeft:8}}>Canais</div>
        <button onClick={()=>{setSalaId('geral');setSalaTitle('Sala Geral')}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',border:0,borderRadius:8,cursor:'pointer',background:salaId==='geral'?'white':'transparent',color:salaId==='geral'?C.navy:C.text,fontSize:14,fontWeight:salaId==='geral'?700:400,textAlign:'left',transition:'all .12s',boxShadow:salaId==='geral'?'0 1px 3px rgba(0,0,0,0.05)':'none'}}>
          <Hash size={15}/> Sala Geral
        </button>
      </div>
      {/* DMs */}
      <div style={{padding:'8px 10px',flex:1,overflowY:'auto'}}>
        <div style={{fontSize:10,fontWeight:900,color:C.muted,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6,paddingLeft:8}}>Mensagens Diretas</div>
        {outrosDM.map(u=>{
          const isOnline=!!onlineMap[u.id]
          const active=salaId!=='geral'&&salaTitle===u.nome
          return <button key={u.id} onClick={()=>abrirDM(u)} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',border:0,borderRadius:8,cursor:'pointer',background:active?'white':'transparent',color:active?C.navy:C.text,fontSize:13,fontWeight:active?700:400,textAlign:'left',transition:'all .12s',marginBottom:1,boxShadow:active?'0 1px 3px rgba(0,0,0,0.05)':'none'}}>
            <div style={{position:'relative',flexShrink:0}}>
              {avatar(u.nome,26)}
              <span style={{position:'absolute',bottom:-1,right:-1,width:9,height:9,borderRadius:'50%',background:isOnline?'#22c55e':'#94a3b8',border:'1.5px solid '+(active?C.white:C.bg)}}/>
            </div>
            <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.nome}</span>
          </button>
        })}
      </div>
    </div>

    {historicoOpen && <Modal title="Histórico da Sala Geral" onClose={()=>{setHistoricoOpen(false);setSessaoMsgs(null)}} width={600}>
      {sessaoMsgs ? (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <button onClick={()=>setSessaoMsgs(null)} style={{alignSelf:'flex-start',background:'none',border:'none',color:C.blue,cursor:'pointer',fontWeight:600,fontSize:13}}>← Voltar às sessões</button>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {sessaoMsgs.map((m,i)=>{
              const prev=sessaoMsgs[i-1]
              const agrup=prev?.remetente_id===m.remetente_id&&(new Date(m.criado_em)-new Date(prev.criado_em))<120000
              return <div key={m.id} style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:agrup?0:8}}>
                <div style={{width:32,flexShrink:0}}>{!agrup&&avatar(m.remetente_nome,32)}</div>
                <div style={{flex:1,minWidth:0}}>
                  {!agrup&&<div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:2}}>
                    <span style={{fontSize:13,fontWeight:700,color:C.text}}>{m.remetente_nome}</span>
                    <span style={{fontSize:11,color:C.muted}}>{timeLabel(m.criado_em)}</span>
                  </div>}
                  {m.texto&&<p style={{margin:0,fontSize:14,color:C.text,lineHeight:1.5,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{m.texto}</p>}
                </div>
              </div>
            })}
          </div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {loadingHist ? <div style={{textAlign:'center',padding:30,color:C.muted}}>Carregando histórico...</div> : sessoes.length === 0 ? <div style={{textAlign:'center',padding:30,color:C.muted}}>Nenhuma sessão arquivada encontrada.</div> : sessoes.map(s => (
            <div key={s.id} onClick={()=>openSessao(s)} style={{padding:'14px 16px',border:'1px solid '+C.border,borderRadius:8,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',background:C.grayBg}}>
              <div>
                <div style={{fontWeight:600,fontSize:14,color:C.text}}>Sessão de {new Date(s.inicio).toLocaleDateString('pt-BR')}</div>
                <div style={{fontSize:12,color:C.muted}}>Das {new Date(s.inicio).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} às {new Date(s.fim).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
              <div style={{fontSize:13,color:C.muted}}>{s.count} mensagens</div>
            </div>
          ))}
        </div>
      )}
    </Modal>}
  </div>
}

// ─── Messages Tab (async, from existing mensagens table) ──────────────────────
function MensagensPane({profile,team,openId}){
  const [modo,setModo]=useState('entrada')
  const [mensagens,setMensagens]=useState([])
  const [anexos,setAnexos]=useState([])
  const [loading,setLoading]=useState(false)
  const [compose,setCompose]=useState(false)
  const [selected,setSelected]=useState(null)
  const [replyText,setReplyText]=useState('')
  const [replyFiles,setReplyFiles]=useState([])
  const [form,setForm]=useState({destinatario_id:'',assunto:'',corpo:'',arquivos:[]})
  const [sending,setSending]=useState(false)

  const teamMap=useMemo(()=>Object.fromEntries(team.map(t=>[t.id,t])),[team])

  const carregar=async()=>{
    setLoading(true)
    const{data:msgs}=await supabase.from('mensagens').select('*').or(`destinatario_id.eq.${profile.id},remetente_id.eq.${profile.id}`).order('created_at',{ascending:false})
    setMensagens(msgs||[])
    const ids=(msgs||[]).map(m=>m.id)
    if(ids.length){const{data:att}=await supabase.from('mensagens_anexos').select('*').in('mensagem_id',ids);setAnexos(att||[])}
    setLoading(false)
  }

  useEffect(()=>{carregar()},[profile.id])

  useEffect(()=>{
    if(!openId||!mensagens.length||selected)return
    const root=mensagens.find(m=>m.id===openId&&!m.parent_id)
    if(!root)return
    if(root.remetente_id===profile.id&&root.destinatario_id!==profile.id)setModo('enviadas')
    else setModo('entrada')
    setSelected(root)
  },[openId,mensagens])

  const anexosPorMsg=useMemo(()=>{const o={};(anexos||[]).forEach(a=>{if(!o[a.mensagem_id])o[a.mensagem_id]=[];o[a.mensagem_id].push(a)});return o},[anexos])
  const mensagensPorParent=useMemo(()=>{const o={};(mensagens||[]).forEach(m=>{const k=m.parent_id||m.id;if(!o[k])o[k]=[];o[k].push(m)});return o},[mensagens])

  const arquivada=(m)=>{
    const pid=m.parent_id||m.id
    return (mensagensPorParent[pid]||[]).every(x=>(x.arquivada_por||[]).includes(profile.id))
  }
  const raizes=useMemo(()=>{
    const seen=new Set()
    return mensagens.filter(m=>{
      if(m.parent_id)return false
      if(seen.has(m.id))return false
      seen.add(m.id)
      const arq=arquivada(m)
      if(modo==='arquivo') return arq&&(m.remetente_id===profile.id||m.destinatario_id===profile.id)
      if(arq) return false
      if(modo==='entrada') return m.destinatario_id===profile.id
      if(modo==='enviadas') return m.remetente_id===profile.id
      return false
    })
  },[mensagens,modo,profile.id])

  const enviar=async()=>{
    if(!form.destinatario_id||!form.assunto.trim())return
    setSending(true)
    const novaId=crypto.randomUUID()
    const{error:erroInsert}=await supabase.from('mensagens').insert({id:novaId,remetente_id:profile.id,destinatario_id:form.destinatario_id,assunto:form.assunto,corpo:form.corpo,lida:false,arquivada_por:[]})
    if(erroInsert){
      console.error('Erro ao enviar mensagem:',erroInsert)
      setSending(false)
      return alert('Erro ao enviar: '+erroInsert.message)
    }
    if(form.arquivos?.length){
      for(const f of form.arquivos){
        const ext=f.name.split('.').pop()
        const path=`mensagens/${novaId}/${Date.now()}.${ext}`
        const{error}=await supabase.storage.from('documentos').upload(path,f,{upsert:false})
        if(!error){const{data:u}=supabase.storage.from('documentos').getPublicUrl(path);await supabase.from('mensagens_anexos').insert({mensagem_id:novaId,nome:f.name,url:u.publicUrl,tipo:f.type,tamanho:f.size})}
      }
    }
    const{error:erroNotif}=await supabase.from('notificacoes').insert({escritorio_id:profile.escritorio_id,usuario_id:form.destinatario_id,tipo:'mensagem',titulo:'Nova mensagem de '+(profile.nome||'Usuário'),descricao:form.assunto,origem_tipo:'mensagem',origem_id:novaId,lida:false,arquivada:false})
    if(erroNotif)console.error('Erro ao criar notificação:',erroNotif)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setForm({destinatario_id:'',assunto:'',corpo:'',arquivos:[]})
    setCompose(false)
    setSending(false)
    carregar()
  }

  const responder=async()=>{
    if(!replyText.trim()&&!replyFiles.length)return
    setSending(true)
    const destId=selected.remetente_id===profile.id?selected.destinatario_id:selected.remetente_id
    const novaId=crypto.randomUUID()
    const{error:erroInsert}=await supabase.from('mensagens').insert({id:novaId,remetente_id:profile.id,destinatario_id:destId,assunto:'Re: '+selected.assunto,corpo:replyText,parent_id:selected.parent_id||selected.id,lida:false,arquivada_por:[]})
    if(erroInsert){
      console.error('Erro ao responder:',erroInsert)
      setSending(false)
      return alert('Erro ao responder: '+erroInsert.message)
    }
    if(replyFiles.length){
      for(const f of replyFiles){const ext=f.name.split('.').pop();const path=`mensagens/${novaId}/${Date.now()}.${ext}`;const{error}=await supabase.storage.from('documentos').upload(path,f,{upsert:false});if(!error){const{data:u}=supabase.storage.from('documentos').getPublicUrl(path);await supabase.from('mensagens_anexos').insert({mensagem_id:novaId,nome:f.name,url:u.publicUrl,tipo:f.type,tamanho:f.size})}}
    }
    const rootId=selected.parent_id||selected.id
    const{error:erroNotif}=await supabase.from('notificacoes').insert({escritorio_id:profile.escritorio_id,usuario_id:destId,tipo:'mensagem',titulo:(profile.nome||'Usuário')+' respondeu sua mensagem',descricao:selected.assunto,origem_tipo:'mensagem',origem_id:rootId,lida:false,arquivada:false})
    if(erroNotif)console.error('Erro ao criar notificação de resposta:',erroNotif)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setReplyText('');setReplyFiles([]);setSending(false);carregar()
  }

  const arquivar=async(m)=>{
    const pid=m.parent_id||m.id
    const thread=(mensagensPorParent[pid]||[])
    for(const t of thread){
      const arqs=Array.from(new Set([...(t.arquivada_por||[]),profile.id]))
      await supabase.from('mensagens').update({arquivada_por:arqs}).eq('id',t.id)
    }
    carregar()
  }

  const restaurar=async(m)=>{
    const pid=m.parent_id||m.id
    const thread=(mensagensPorParent[pid]||[])
    for(const t of thread){
      const arqs=(t.arquivada_por||[]).filter(x=>x!==profile.id)
      await supabase.from('mensagens').update({arquivada_por:arqs}).eq('id',t.id)
    }
    carregar()
  }

  const baixar=async(a)=>{
    const{data,error}=await supabase.storage.from('documentos').download(a.url.split('/documentos/')[1])
    if(error||!data)return
    const url=URL.createObjectURL(data)
    const el=document.createElement('a');el.href=url;el.download=a.nome;el.click();URL.revokeObjectURL(url)
  }

  const initials=(nome)=>(nome||'?').split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'?'

  return <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
    <div style={{padding:'16px 24px',borderBottom:'1px solid '+C.border,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,background:C.white}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={()=>setModo('entrada')} style={{border:'1px solid '+C.border,background:modo==='entrada'?C.navy:C.white,color:modo==='entrada'?'white':C.text,borderRadius:20,padding:'7px 14px',fontWeight:700,cursor:'pointer',display:'flex',gap:6,alignItems:'center',fontSize:13}}><Inbox size={14}/>Entrada</button>
        <button onClick={()=>setModo('enviadas')} style={{border:'1px solid '+C.border,background:modo==='enviadas'?C.navy:C.white,color:modo==='enviadas'?'white':C.text,borderRadius:20,padding:'7px 14px',fontWeight:700,cursor:'pointer',display:'flex',gap:6,alignItems:'center',fontSize:13}}><Send size={14}/>Enviadas</button>
        <button onClick={()=>setModo('arquivo')} style={{border:'1px solid '+C.border,background:modo==='arquivo'?C.navy:C.white,color:modo==='arquivo'?'white':C.text,borderRadius:20,padding:'7px 14px',fontWeight:700,cursor:'pointer',display:'flex',gap:6,alignItems:'center',fontSize:13}}><Archive size={14}/>Arquivo</button>
      </div>
      <button onClick={()=>setCompose(true)} style={{background:C.navy,color:'white',border:0,borderRadius:8,padding:'9px 16px',fontWeight:700,cursor:'pointer',display:'flex',gap:6,alignItems:'center',fontSize:13}}><Send size={14}/>Nova mensagem</button>
    </div>
    <div style={{flex:1,overflowY:'auto',padding:'16px 24px',display:'flex',flexDirection:'column',gap:10}}>
      {loading?<div style={{color:C.muted,textAlign:'center',padding:40}}>Carregando...</div>:raizes.length===0?<div style={{textAlign:'center',padding:'60px 0',color:C.muted}}><Mail size={32} style={{display:'block',margin:'0 auto 12px',opacity:.3}}/><p style={{margin:0,fontSize:14}}>{modo==='arquivo'?'Nenhuma mensagem arquivada.':modo==='enviadas'?'Nenhuma mensagem enviada.':'Caixa de entrada vazia.'}</p></div>:raizes.map(m=>{
        const env=m.remetente_id===profile.id
        const outro=env?teamMap[m.destinatario_id]:teamMap[m.remetente_id]
        const respostas=(mensagensPorParent[m.id]||[]).filter(r=>r.id!==m.id)
        const nlida=!m.lida&&!env
        return <div key={m.id} onClick={()=>setSelected(m)} style={{background:nlida?C.blueBg:C.white,border:'1px solid '+(nlida?'#93c5fd':C.border),borderRadius:12,padding:'14px 16px',cursor:'pointer',transition:'box-shadow .12s'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.07)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:C.navyL,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,flexShrink:0,fontSize:14}}>{initials(outro?.nome)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,marginBottom:4}}>
                <span style={{fontSize:14,fontWeight:nlida?800:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.assunto}</span>
                <span style={{fontSize:11,color:C.muted,flexShrink:0}}>{new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
              <div style={{fontSize:12,color:C.muted}}>{env?`Para: ${outro?.nome||'?'}`:`De: ${outro?.nome||'?'}`}</div>
              <p style={{margin:'6px 0 0',fontSize:13,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.corpo}</p>
              {respostas.length>0&&<div style={{marginTop:6,fontSize:12,color:C.muted}}>{respostas.length} resposta(s)</div>}
            </div>
          </div>
        </div>
      })}
    </div>

    {compose&&<Modal title="Nova mensagem" onClose={()=>setCompose(false)} width={640}>
      <div style={{display:'grid',gap:14}}>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Destinatário</label><select style={{...INP,marginTop:5}} value={form.destinatario_id} onChange={e=>setForm({...form,destinatario_id:e.target.value})}><option value="">Escolha um usuário</option>{team.filter(t=>t.id!==profile.id).map(t=><option key={t.id} value={t.id}>{t.nome}{t.email?` — ${t.email}`:''}</option>)}</select></div>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Assunto</label><input style={{...INP,marginTop:5}} value={form.assunto} onChange={e=>setForm({...form,assunto:e.target.value})} placeholder="Assunto da mensagem"/></div>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Mensagem</label><textarea style={{...INP,marginTop:5,minHeight:130}} value={form.corpo} onChange={e=>setForm({...form,corpo:e.target.value})} placeholder="Escreva sua mensagem..."/></div>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Anexos</label><input type="file" multiple style={{...INP,marginTop:5}} onChange={e=>setForm({...form,arquivos:Array.from(e.target.files||[])})}/></div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10}}><button onClick={()=>setCompose(false)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px',cursor:'pointer'}}>Cancelar</button><button disabled={sending} onClick={enviar} style={{border:0,background:sending?C.muted:C.navy,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:800,cursor:'pointer'}}>{sending?'Enviando...':'Enviar'}</button></div>
      </div>
    </Modal>}

    {selected&&<Modal title={selected.assunto} onClose={()=>{setSelected(null);setReplyText('');setReplyFiles([])}} width={760}>
      <div style={{display:'grid',gap:16}}>
        {[selected,...(mensagensPorParent[selected.parent_id||selected.id]||[]).filter(r=>r.id!==selected.id)].map(m=>{
          const env=m.remetente_id===profile.id
          const rem=teamMap[m.remetente_id]
          const ini=initials(rem?.nome)
          return <div key={m.id} style={{display:'flex',gap:10,paddingBottom:16,borderBottom:'1px solid '+C.border}}>
            <div style={{width:38,height:38,borderRadius:'50%',background:C.navyL,color:C.text,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,flexShrink:0}}>{ini}</div>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><b style={{fontSize:14}}>{rem?.nome||'?'}</b><span style={{fontSize:12,color:C.muted}}>{new Date(m.created_at).toLocaleString('pt-BR')}</span></div>
              <p style={{margin:0,fontSize:14,lineHeight:1.6,whiteSpace:'pre-wrap',color:C.text}}>{m.corpo}</p>
              {(anexosPorMsg[m.id]||[]).length>0&&<div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>{(anexosPorMsg[m.id]||[]).map(a=><button key={a.id} onClick={()=>baixar(a)} style={{display:'flex',alignItems:'center',gap:8,border:'1px solid '+C.border,background:C.grayBg,borderRadius:8,padding:'8px 10px',cursor:'pointer',textAlign:'left'}}><FileText size={15}/><span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nome}</span><Download size={14} color={C.blue}/></button>)}</div>}
            </div>
          </div>
        })}
        <div><h3 style={{fontSize:15,margin:'0 0 10px',display:'flex',gap:6,alignItems:'center'}}><Reply size={16}/>Responder</h3>
          <textarea style={{...INP,minHeight:100}} placeholder="Sua resposta..." value={replyText} onChange={e=>setReplyText(e.target.value)}/>
          <div style={{marginTop:8}}><input type="file" multiple style={INP} onChange={e=>setReplyFiles(Array.from(e.target.files||[]))}/></div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:12}}>
            <button onClick={()=>arquivada(selected)?restaurar(selected):arquivar(selected)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:13}}>{arquivada(selected)?<ArchiveRestore size={14}/>:<Archive size={14}/>}{arquivada(selected)?'Restaurar':'Arquivar'}</button>
            <button onClick={()=>{setSelected(null);setReplyText('');setReplyFiles([])}} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 14px',cursor:'pointer',fontSize:13}}>Fechar</button>
            <button disabled={sending} onClick={responder} style={{border:0,background:sending?C.muted:C.navy,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:13}}><Send size={14}/>{sending?'Enviando...':'Responder'}</button>
          </div>
        </div>
      </div>
    </Modal>}
  </div>
}

// ─── Main Forum Component ─────────────────────────────────────────────────────
export default function Forum({profile}){
  const [searchParams] = useSearchParams()
  const [aba,setAba]=useState(()=>searchParams.get('tab')==='mensagens'?'mensagens':'chat')
  const [team,setTeam]=useState([])

  // Sync tab when URL param changes (e.g. TopBar dropdown navegates while on /forum)
  useEffect(()=>{
    const tab=searchParams.get('tab')
    if(tab==='mensagens'||tab==='chat') setAba(tab)
  },[searchParams])
  const [onlineMap,setOnlineMap]=useState({})
  const presenceRef=useRef()

  useEffect(()=>{
    supabase.from('usuarios_escritorios').select('usuario_id,papel,ativo,profiles(id,nome,email,cor)').eq('escritorio_id',profile.escritorio_id).eq('ativo',true).then(({data})=>{
      setTeam((data||[]).map(x=>({id:x.usuario_id,nome:x.profiles?.nome||x.profiles?.email||x.usuario_id,email:x.profiles?.email||'',cor:x.profiles?.cor,papel:x.papel})))
    })
  },[profile.escritorio_id])

  // Presence
  useEffect(()=>{
    const ch=supabase.channel('presenca_'+profile.escritorio_id)
    ch.on('presence',{event:'sync'},()=>{
      const state=ch.presenceState()
      const map={}
      Object.values(state).forEach(presences=>presences.forEach(p=>{if(p.userId)map[p.userId]=true}))
      setOnlineMap(map)
    })
    .subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        const state = ch.presenceState()
        let count = 0
        Object.values(state).forEach(arr => count += arr.length)
        
        if (count === 0) {
          const { data: lastMsg } = await supabase.from('chat_mensagens').select('criado_em, tipo, texto').eq('escritorio_id', profile.escritorio_id).eq('tipo', 'geral').order('criado_em', { ascending: false }).limit(1).maybeSingle()
          if (lastMsg && lastMsg.texto !== '[SISTEMA_ARQUIVAR_SESSAO]') {
            const msAgo = Date.now() - new Date(lastMsg.criado_em).getTime()
            if (msAgo > 2 * 60 * 1000) {
               await supabase.from('chat_mensagens').insert({
                 escritorio_id: profile.escritorio_id,
                 remetente_id: profile.id,
                 remetente_nome: 'Sistema Automático',
                 texto: '[SISTEMA_ARQUIVAR_SESSAO]',
                 tipo: 'geral'
               })
            }
          }
        }
        await ch.track({userId:profile.id,nome:profile.nome||profile.email||'?',at:new Date().toISOString()})
      }
    })
    presenceRef.current=ch
    return()=>{supabase.removeChannel(ch)}
  },[profile.id,profile.escritorio_id])

  const onlineCount=Object.keys(onlineMap).filter(k=>onlineMap[k]).length

  return <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
    {/* Top tabs */}
    <div style={{padding:'0 24px',borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:0,background:C.white,flexShrink:0}}>
      <div style={{display:'flex',gap:0,marginRight:'auto'}}>
        {[
          {id:'chat',icon:<MessageSquare size={15}/>,label:'Chat em tempo real'},
          {id:'mensagens',icon:<Mail size={15}/>,label:'Mensagens'},
        ].map(t=><button key={t.id} onClick={()=>setAba(t.id)} style={{display:'flex',alignItems:'center',gap:7,padding:'14px 18px',border:0,background:'none',cursor:'pointer',fontSize:14,fontWeight:aba===t.id?800:400,color:aba===t.id?C.text:C.muted,borderBottom:aba===t.id?'2px solid '+C.navy:'2px solid transparent',marginBottom:-1,transition:'all .12s'}}>
          {t.icon}{t.label}
        </button>)}
      </div>
      {aba==='chat'&&<div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.muted,padding:'0 4px'}}>
        <Users size={14}/>{onlineCount} online agora
      </div>}
    </div>
    <div style={{flex:1,overflow:'hidden'}}>
      {aba==='chat'&&<ChatPane profile={profile} team={team} onlineMap={onlineMap}/>}
      {aba==='mensagens'&&<MensagensPane profile={profile} team={team} openId={searchParams.get('open')||undefined}/>}
    </div>
  </div>
}
