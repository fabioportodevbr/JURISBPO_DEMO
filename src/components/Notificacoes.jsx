import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Bell, Mail, CheckCircle, RefreshCw, Send, Inbox, X, Paperclip, Reply, Download, FileText, Archive, ArchiveRestore } from 'lucide-react'

const C={navy:'#050505',white:'#fff',text:'#0f172a',muted:'#64748b',border:'#e5e7eb',blue:'#1d4ed8',blueBg:'#dbeafe',amber:'#b45309',amberBg:'#fef3c7',green:'#16a34a',greenBg:'#dcfce7',red:'#dc2626',redBg:'#fee2e2',purple:'#064e3b',purpleBg:'#ede9fe'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const tipoInfo={
  nova_atividade:['Nova atividade',C.blueBg,C.blue],
  atividade_redistribuida:['Atividade redistribuída',C.purpleBg,C.purple],
  atividade_aceita:['Atividade aceita',C.greenBg,C.green],
  atividade_devolvida:['Atividade devolvida',C.redBg,C.red],
  atividade_50_prazo:['50% do prazo',C.amberBg,C.amber],
  atividade_vencida:['Atividade vencida',C.redBg,C.red],
  mensagem:['Mensagem',C.greenBg,C.green]
}
function Modal({title,onClose,children,width=720}){return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:width,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border,alignItems:'center',gap:12}}><b>{title}</b><button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',display:'flex',padding:4}}><X/></button></div><div style={{padding:18,overflow:'auto'}}>{children}</div></div></div>}
function Chip({tipo}){const [label,bg,color]=tipoInfo[tipo]||[tipo||'Aviso','#f1f5f9','#64748b'];return <span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,background:bg,color,textTransform:'uppercase',whiteSpace:'nowrap'}}>{label}</span>}
function Empty({text}){return <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:28,textAlign:'center',color:C.muted}}><Inbox size={28} style={{display:'block',margin:'0 auto 8px'}}/>{text}</div>}
function initials(nome){return (nome||'?').split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase()||'?'}

export default function Notificacoes({profile}){
  const [aba,setAba]=useState('notificacoes')
  const [notificacoesModo,setNotificacoesModo]=useState('entrada')
  const [mensagensModo,setMensagensModo]=useState('entrada')
  const [notificacoes,setNotificacoes]=useState([])
  const [mensagens,setMensagens]=useState([])
  const [anexos,setAnexos]=useState([])
  const [team,setTeam]=useState([])
  const [loading,setLoading]=useState(false)
  const [compose,setCompose]=useState(false)
  const [selected,setSelected]=useState(null)
  const [replyText,setReplyText]=useState('')
  const [replyFiles,setReplyFiles]=useState([])
  const [form,setForm]=useState({destinatario_id:'',assunto:'',corpo:'',arquivos:[]})
  const [sending,setSending]=useState(false)
  const [devolucao,setDevolucao]=useState(null)
  const [motivoDevolucao,setMotivoDevolucao]=useState('')

  async function carregar(){
    if(!profile?.id) return
    setLoading(true)
    const eid=profile.escritorio_id
    const [{data:notifs,error:notifErr},{data:msgs,error:msgErr},{data:links,error:teamErr}]=await Promise.all([
      supabase.from('notificacoes').select('*').eq('usuario_id',profile.id).order('created_at',{ascending:false}),
      supabase.from('mensagens').select('*').or(`destinatario_id.eq.${profile.id},remetente_id.eq.${profile.id}`).order('created_at',{ascending:false}),
      supabase.from('usuarios_escritorios').select('usuario_id,papel,ativo,profiles(id,nome,email,cor)').eq('escritorio_id',eid).eq('ativo',true)
    ])
    if(notifErr) console.error(notifErr)
    if(msgErr) console.error(msgErr)
    if(teamErr) console.error(teamErr)
    setNotificacoes(notifs||[])
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setMensagens(msgs||[])
    setTeam((links||[]).map(x=>({id:x.usuario_id,nome:x.profiles?.nome||x.profiles?.email||x.usuario_id,email:x.profiles?.email||'',cor:x.profiles?.cor,papel:x.papel})))

    const ids=(msgs||[]).map(m=>m.id).filter(Boolean)
    if(ids.length){
      const {data:att,error:attErr}=await supabase.from('mensagens_anexos').select('*').in('mensagem_id',ids).order('created_at',{ascending:true})
      if(attErr) console.error(attErr)
      setAnexos(att||[])
    } else {
      setAnexos([])
    }
    setLoading(false)
  }
  useEffect(()=>{carregar()},[profile?.id,profile?.escritorio_id])

  const teamMap=useMemo(()=>Object.fromEntries(team.map(t=>[t.id,t])),[team])
  const anexosPorMensagem=useMemo(()=>{
    const out={}
    anexos.forEach(a=>{ if(!out[a.mensagem_id]) out[a.mensagem_id]=[]; out[a.mensagem_id].push(a) })
    return out
  },[anexos])
  const mensagensPorParent=useMemo(()=>{
    const out={}
    mensagens.forEach(m=>{ if(m.parent_id){ if(!out[m.parent_id]) out[m.parent_id]=[]; out[m.parent_id].push(m) } })
    return out
  },[mensagens])
  const mensagemArquivada = (m) => Array.isArray(m.arquivada_por) && m.arquivada_por.includes(profile.id)
  const notificacoesArquivadasAtivas = notificacoesModo === 'arquivo'
  const mensagensArquivadasAtivas = mensagensModo === 'arquivo'
  const notificacoesVisiveis = (notificacoes||[]).filter(n => notificacoesArquivadasAtivas ? !!n.arquivada : !n.arquivada)
  const threadsRaiz = (mensagens||[]).filter(m=>!m.parent_id)
  const mensagensVisiveis = threadsRaiz.filter(m => mensagensArquivadasAtivas ? mensagemArquivada(m) : !mensagemArquivada(m))
  const respostasNaoLidasPorThread = (threadId) => (mensagensPorParent[threadId]||[]).filter(r => r.destinatario_id===profile.id && !r.lida && !mensagemArquivada(r)).length
  const naoLidas=(notificacoes||[]).filter(n=>!n.lida&&!n.arquivada).length+(mensagens||[]).filter(m=>m.destinatario_id===profile.id&&!m.lida&&!mensagemArquivada(m)).length

  async function marcarNotifLida(id){
    await supabase.from('notificacoes').update({lida:true,lida_em:new Date().toISOString()}).eq('id',id)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }
  async function marcarMsgLida(id){
    await supabase.from('mensagens').update({lida:true,lida_em:new Date().toISOString()}).eq('id',id)
    await supabase.from('notificacoes').update({lida:true,lida_em:new Date().toISOString()}).eq('usuario_id',profile.id).eq('origem_tipo','mensagem').eq('origem_id',id)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }
  async function marcarThreadMensagemLida(m){
    if(!m) return
    const threadId = m.parent_id || m.id
    const ids = [threadId, ...((mensagensPorParent[threadId] || []).map(r=>r.id))]
    const recebidas = ids.filter(Boolean).filter(id => {
      const item = mensagens.find(x => x.id === id)
      return item && item.destinatario_id === profile.id && !item.lida
    })
    if(recebidas.length){
      await supabase.from('mensagens').update({lida:true,lida_em:new Date().toISOString()}).in('id',recebidas)
    }
    await supabase.from('notificacoes').update({lida:true,lida_em:new Date().toISOString()}).eq('usuario_id',profile.id).eq('origem_tipo','mensagem').in('origem_id',ids.filter(Boolean))
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }

  async function arquivarNotificacao(id){
    const now=new Date().toISOString()
    const {error}=await supabase.from('notificacoes').update({arquivada:true,arquivada_em:now,lida:true,lida_em:now}).eq('id',id)
    if(error) return alert('Erro ao arquivar notificação: '+error.message)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }

  async function restaurarNotificacao(id){
    const {error}=await supabase.from('notificacoes').update({arquivada:false,arquivada_em:null}).eq('id',id)
    if(error) return alert('Erro ao restaurar notificação: '+error.message)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }

  async function arquivarThreadMensagem(m){
    if(!m) return
    const threadId=m.parent_id||m.id
    const ids=[threadId,...((mensagensPorParent[threadId]||[]).map(r=>r.id))]
    const atuais=(mensagens||[]).filter(x=>ids.includes(x.id))
    for(const msg of atuais){
      const arr=Array.isArray(msg.arquivada_por)?msg.arquivada_por:[]
      if(!arr.includes(profile.id)){
        const {error}=await supabase.from('mensagens').update({arquivada_por:[...arr,profile.id],arquivada_em:new Date().toISOString()}).eq('id',msg.id)
        if(error) return alert('Erro ao arquivar mensagem: '+error.message)
      }
    }
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }

  async function restaurarThreadMensagem(m){
    if(!m) return
    const threadId=m.parent_id||m.id
    const ids=[threadId,...((mensagensPorParent[threadId]||[]).map(r=>r.id))]
    const atuais=(mensagens||[]).filter(x=>ids.includes(x.id))
    for(const msg of atuais){
      const arr=(Array.isArray(msg.arquivada_por)?msg.arquivada_por:[]).filter(id=>id!==profile.id)
      const {error}=await supabase.from('mensagens').update({arquivada_por:arr,arquivada_em:arr.length?msg.arquivada_em:null}).eq('id',msg.id)
      if(error) return alert('Erro ao restaurar mensagem: '+error.message)
    }
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }

  async function uploadAnexos(mensagemId, files){
    const lista=Array.from(files||[])
    if(!lista.length) return null
    for(const file of lista){
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_')
      const path=`${profile.escritorio_id}/${mensagemId}/${Date.now()}-${safeName}`
      const {error:uploadError}=await supabase.storage.from('mensagens').upload(path,file,{upsert:false,contentType:file.type || 'application/octet-stream'})
      if(uploadError) return uploadError
      const {error:insertError}=await supabase.from('mensagens_anexos').insert({
        mensagem_id: mensagemId,
        escritorio_id: profile.escritorio_id,
        nome: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size || null,
        uploaded_by: profile.id
      })
      if(insertError) return insertError
    }
    return null
  }

  async function baixarAnexo(anexo){
    const {data,error}=await supabase.storage.from('mensagens').createSignedUrl(anexo.storage_path,60)
    if(error) return alert('Erro ao abrir anexo: '+error.message)
    window.open(data.signedUrl,'_blank','noopener,noreferrer')
  }

  async function enviarMensagem(){
    if(!form.destinatario_id) return alert('Escolha o destinatário.')
    if(!form.assunto.trim()) return alert('Informe o assunto.')
    if(!form.corpo.trim()) return alert('Escreva a mensagem.')
    setSending(true)
    const {data,error}=await supabase.from('mensagens').insert({
      escritorio_id: profile.escritorio_id,
      remetente_id: profile.id,
      destinatario_id: form.destinatario_id,
      assunto: form.assunto.trim(),
      corpo: form.corpo.trim(),
      lida: false
    }).select('id').single()
    if(error){ setSending(false); return alert('Erro ao enviar mensagem: '+error.message) }
    const attachErr=await uploadAnexos(data.id,form.arquivos)
    if(attachErr){ setSending(false); return alert('Mensagem enviada, mas houve erro ao anexar arquivo: '+attachErr.message) }
    const { error: notifInsertErr1 } = await supabase.from('notificacoes').insert({
      escritorio_id: profile.escritorio_id,
      usuario_id: form.destinatario_id,
      tipo: 'mensagem',
      titulo: `Nova mensagem de ${profile.nome || 'usuário'}`,
      descricao: form.assunto.trim(),
      origem_tipo: 'mensagem',
      origem_id: data.id
    })
    if(notifInsertErr1) console.warn('Falha ao criar notificação da mensagem:', notifInsertErr1)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setSending(false)
    setCompose(false);setForm({destinatario_id:'',assunto:'',corpo:'',arquivos:[]});carregar()
  }

  async function responderMensagem(){
    if(!selected) return
    if(!replyText.trim() && !replyFiles.length) return alert('Digite uma resposta ou anexe ao menos um arquivo.')
    const destinatario=selected.remetente_id===profile.id?selected.destinatario_id:selected.remetente_id
    setSending(true)
    const {data,error}=await supabase.from('mensagens').insert({
      escritorio_id: profile.escritorio_id,
      remetente_id: profile.id,
      destinatario_id: destinatario,
      parent_id: selected.parent_id || selected.id,
      assunto: selected.assunto?.startsWith('Re:') ? selected.assunto : `Re: ${selected.assunto || 'Mensagem'}`,
      corpo: replyText.trim() || '(anexo)',
      lida: false
    }).select('id').single()
    if(error){ setSending(false); return alert('Erro ao responder: '+error.message) }
    const attachErr=await uploadAnexos(data.id,replyFiles)
    if(attachErr){ setSending(false); return alert('Resposta enviada, mas houve erro ao anexar arquivo: '+attachErr.message) }
    const { error: notifInsertErr2 } = await supabase.from('notificacoes').insert({
      escritorio_id: profile.escritorio_id,
      usuario_id: destinatario,
      tipo: 'mensagem',
      titulo: `Resposta de ${profile.nome || 'usuário'}`,
      descricao: selected.assunto || 'Mensagem interna',
      origem_tipo: 'mensagem',
      origem_id: data.id
    })
    if(notifInsertErr2) console.warn('Falha ao criar notificação da resposta:', notifInsertErr2)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setSending(false)
    setReplyText('');setReplyFiles([]);setSelected(null);carregar()
  }


  async function buscarUltimaRedistribuicao(atividadeId){
    const {data,error}=await supabase
      .from('atividade_atribuicoes')
      .select('*')
      .eq('atividade_id',atividadeId)
      .eq('usuario_novo_id',profile.id)
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle()
    if(error) console.warn('Falha ao buscar histórico de redistribuição:', error)
    return data || null
  }

  async function aceitarAtividade(n){
    if(!n?.origem_id) return alert('Não foi possível identificar a atividade vinculada.')
    const atividadeId=n.origem_id
    const {error:histErr}=await supabase.from('atividade_atribuicoes').insert({
      atividade_id: atividadeId,
      usuario_anterior_id: profile.id,
      usuario_novo_id: profile.id,
      atribuido_por: profile.id,
      tipo_movimento: 'aceite',
      observacao: 'Atividade aceita pelo responsável.'
    })
    if(histErr) return alert('Erro ao registrar aceite: '+histErr.message)
    await supabase.from('notificacoes').update({lida:true,lida_em:new Date().toISOString(),aceita_em:new Date().toISOString()}).eq('id',n.id)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }

  async function confirmarDevolucao(){
    if(!devolucao?.origem_id) return
    if(!motivoDevolucao.trim()) return alert('Informe o motivo da devolução.')
    const atividadeId=devolucao.origem_id
    const ultima=await buscarUltimaRedistribuicao(atividadeId)
    const usuarioDestino=ultima?.atribuido_por
    if(!usuarioDestino) return alert('Não consegui identificar quem redistribuiu esta atividade para devolvê-la.')
    const {error:updateErr}=await supabase.from('atividades').update({responsavel_id:usuarioDestino,updated_at:new Date().toISOString()}).eq('id',atividadeId)
    if(updateErr) return alert('Erro ao devolver atividade: '+updateErr.message)
    const {error:histErr}=await supabase.from('atividade_atribuicoes').insert({
      atividade_id: atividadeId,
      usuario_anterior_id: profile.id,
      usuario_novo_id: usuarioDestino,
      atribuido_por: profile.id,
      tipo_movimento: 'devolucao',
      motivo: motivoDevolucao.trim(),
      observacao: 'Atividade devolvida pelo responsável.'
    })
    if(histErr) return alert('Atividade devolvida, mas houve erro ao registrar histórico: '+histErr.message)
    await supabase.from('notificacoes').update({lida:true,lida_em:new Date().toISOString(),devolvida_em:new Date().toISOString()}).eq('id',devolucao.id)
    const {data:atividade}=await supabase.from('atividades').select('titulo,prazo').eq('id',atividadeId).maybeSingle()
    await supabase.from('notificacoes').insert({
      escritorio_id: profile.escritorio_id,
      usuario_id: usuarioDestino,
      tipo: 'atividade_devolvida',
      titulo: 'Atividade devolvida para você',
      descricao: `${profile.nome || 'Usuário'} devolveu a atividade${atividade?.titulo?' "'+atividade.titulo+'"':''} em ${new Date().toLocaleString('pt-BR')}. Motivo: ${motivoDevolucao.trim()}`,
      origem_tipo: 'atividade',
      origem_id: String(atividadeId)
    })
    setDevolucao(null);setMotivoDevolucao('')
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    carregar()
  }

  function abrirMensagem(m){
    setSelected(m)
    marcarThreadMensagemLida(m)
  }


  function NotificationCard({n}){
    const podeDecidir=n.tipo==='atividade_redistribuida' && n.origem_tipo==='atividade' && !n.lida && !n.aceita_em && !n.devolvida_em
    return <div style={{background:n.lida?C.white:'#fffbeb',border:'1px solid '+(n.lida?C.border:'#fde68a'),borderRadius:12,padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start',flexWrap:'wrap'}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><b>{n.titulo}</b><Chip tipo={n.tipo}/>{!n.lida&&!n.arquivada&&<span style={{fontSize:10,fontWeight:900,color:C.amber}}>NOVA</span>}{n.arquivada&&<span style={{fontSize:10,fontWeight:900,color:C.muted}}>ARQUIVADA</span>}</div>
          {n.descricao&&<p style={{fontSize:13,color:C.muted,margin:'7px 0 0',lineHeight:1.45}}>{n.descricao}</p>}
          <div style={{fontSize:11,color:C.muted,marginTop:7}}>{new Date(n.created_at).toLocaleString('pt-BR')}</div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          {podeDecidir&&<>
            <button onClick={()=>aceitarAtividade(n)} style={{border:0,background:C.green,color:'white',borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>Aceitar</button>
            <button onClick={()=>setDevolucao(n)} style={{border:0,background:C.red,color:'white',borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}>Devolver</button>
          </>}
          {!n.lida&&!podeDecidir&&<button onClick={()=>marcarNotifLida(n.id)} style={{border:0,background:C.green,color:'white',borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap'}}><CheckCircle size={14}/> Lida</button>}
          {n.arquivada?<button onClick={()=>restaurarNotificacao(n.id)} style={{border:'1px solid '+C.border,background:C.white,color:C.text,borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap',display:'flex',gap:5,alignItems:'center'}}><ArchiveRestore size={14}/>Restaurar</button>:<button onClick={()=>arquivarNotificacao(n.id)} style={{border:'1px solid '+C.border,background:C.white,color:C.text,borderRadius:8,padding:'8px 10px',fontWeight:800,cursor:'pointer',whiteSpace:'nowrap',display:'flex',gap:5,alignItems:'center'}}><Archive size={14}/>Arquivar</button>}
        </div>
      </div>
    </div>
  }

  function MessageCard({m,compact=false}){
    const enviada=m.remetente_id===profile.id
    const outra=teamMap[enviada?m.destinatario_id:m.remetente_id]
    const atts=anexosPorMensagem[m.id]||[]
    const unreadReplies=respostasNaoLidasPorThread(m.id)
    const archived=mensagemArquivada(m)
    return <button onClick={()=>abrirMensagem(m)} style={{width:'100%',textAlign:'left',background:((!m.lida&&!enviada)||unreadReplies>0)?C.blueBg:C.white,border:'1px solid '+(((!m.lida&&!enviada)||unreadReplies>0)?'#bfdbfe':C.border),borderRadius:12,padding:compact?10:14,cursor:'pointer'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'start'}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><b style={{overflow:'hidden',textOverflow:'ellipsis'}}>{m.assunto}</b><span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,background:enviada?'#f1f5f9':C.greenBg,color:enviada?C.muted:C.green}}>{enviada?'Enviada':'Recebida'}</span>{!m.lida&&!enviada&&<span style={{fontSize:10,fontWeight:900,color:C.blue}}>NOVA</span>}{unreadReplies>0&&<span style={{fontSize:10,fontWeight:900,color:C.red,background:C.redBg,borderRadius:20,padding:'3px 8px'}}>{unreadReplies} resposta(s) nova(s)</span>}{archived&&<span style={{fontSize:10,fontWeight:900,color:C.muted}}>ARQUIVADA</span>}{atts.length>0&&<span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:800,color:C.muted}}><Paperclip size={12}/>{atts.length}</span>}</div>
          <p style={{fontSize:13,color:C.muted,margin:'7px 0 0',whiteSpace:'pre-wrap',display:'-webkit-box',WebkitLineClamp:compact?2:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{m.corpo}</p>
          <div style={{fontSize:11,color:C.muted,marginTop:7}}>{enviada?'Para':'De'}: {outra?.nome||'Usuário'} · {new Date(m.created_at).toLocaleString('pt-BR')}</div>
        </div>
        <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
          {unreadReplies>0&&<span style={{border:0,background:C.blue,color:'white',borderRadius:8,padding:'8px 10px',fontWeight:800,whiteSpace:'nowrap'}}>Ler resposta</span>}
          {!m.lida&&!enviada&&<span style={{border:0,background:C.green,color:'white',borderRadius:8,padding:'8px 10px',fontWeight:800,whiteSpace:'nowrap'}}>Lida</span>}
          {archived?<span onClick={(e)=>{e.stopPropagation();restaurarThreadMensagem(m)}} style={{border:'1px solid '+C.border,background:C.white,color:C.text,borderRadius:8,padding:'8px 10px',fontWeight:800,whiteSpace:'nowrap',display:'inline-flex',gap:5,alignItems:'center'}}><ArchiveRestore size={14}/>Restaurar</span>:<span onClick={(e)=>{e.stopPropagation();arquivarThreadMensagem(m)}} style={{border:'1px solid '+C.border,background:C.white,color:C.text,borderRadius:8,padding:'8px 10px',fontWeight:800,whiteSpace:'nowrap',display:'inline-flex',gap:5,alignItems:'center'}}><Archive size={14}/>Arquivar</span>}
        </div>
      </div>
    </button>
  }

  return <div style={{padding:24}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'center'}}>
      <div><h1 style={{margin:0,fontSize:22}}>Notificações</h1><p style={{color:C.muted,margin:'6px 0 0'}}>Avisos de atividades, redistribuições, vencimentos e mensagens internas.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={carregar} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 14px',cursor:'pointer',display:'flex',gap:8,alignItems:'center'}}><RefreshCw size={16}/>Atualizar</button>
        <button onClick={()=>setCompose(true)} style={{border:0,background:C.navy,color:'white',borderRadius:8,padding:'10px 14px',fontWeight:800,cursor:'pointer',display:'flex',gap:8,alignItems:'center'}}><Send size={16}/>Nova mensagem</button>
      </div>
    </div>

    {naoLidas>0&&<div style={{marginTop:16,background:C.amberBg,color:C.amber,border:'1px solid #fde68a',borderRadius:12,padding:12,fontSize:14}}>Você tem <b>{naoLidas}</b> item(ns) não lido(s).</div>}

    <div style={{display:'flex',gap:8,margin:'18px 0 10px',flexWrap:'wrap',alignItems:'center'}}>
      <button onClick={()=>setAba('notificacoes')} style={{border:'1px solid '+C.border,background:aba==='notificacoes'?C.navy:C.white,color:aba==='notificacoes'?'white':C.text,borderRadius:20,padding:'8px 12px',fontWeight:800,cursor:'pointer',display:'flex',gap:7,alignItems:'center'}}><Bell size={15}/>Notificações</button>
      <button onClick={()=>setAba('mensagens')} style={{border:'1px solid '+C.border,background:aba==='mensagens'?C.navy:C.white,color:aba==='mensagens'?'white':C.text,borderRadius:20,padding:'8px 12px',fontWeight:800,cursor:'pointer',display:'flex',gap:7,alignItems:'center'}}><Mail size={15}/>Mensagens</button>
    </div>

    {aba==='notificacoes'&&<div style={{display:'flex',gap:8,margin:'0 0 18px',flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:12,fontWeight:900,color:C.muted,textTransform:'uppercase',marginRight:4}}>Notificações:</span>
      <button onClick={()=>setNotificacoesModo('entrada')} style={{border:'1px solid '+C.border,background:notificacoesModo==='entrada'?C.greenBg:C.white,color:notificacoesModo==='entrada'?C.green:C.text,borderRadius:20,padding:'7px 11px',fontWeight:800,cursor:'pointer',display:'flex',gap:6,alignItems:'center'}}><Inbox size={14}/>Caixa de entrada</button>
      <button onClick={()=>setNotificacoesModo('arquivo')} style={{border:'1px solid '+C.border,background:notificacoesModo==='arquivo'?C.greenBg:C.white,color:notificacoesModo==='arquivo'?C.green:C.text,borderRadius:20,padding:'7px 11px',fontWeight:800,cursor:'pointer',display:'flex',gap:6,alignItems:'center'}}><Archive size={14}/>Arquivo</button>
    </div>}

    {aba==='mensagens'&&<div style={{display:'flex',gap:8,margin:'0 0 18px',flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:12,fontWeight:900,color:C.muted,textTransform:'uppercase',marginRight:4}}>Mensagens:</span>
      <button onClick={()=>setMensagensModo('entrada')} style={{border:'1px solid '+C.border,background:mensagensModo==='entrada'?C.greenBg:C.white,color:mensagensModo==='entrada'?C.green:C.text,borderRadius:20,padding:'7px 11px',fontWeight:800,cursor:'pointer',display:'flex',gap:6,alignItems:'center'}}><Inbox size={14}/>Caixa de entrada</button>
      <button onClick={()=>setMensagensModo('arquivo')} style={{border:'1px solid '+C.border,background:mensagensModo==='arquivo'?C.greenBg:C.white,color:mensagensModo==='arquivo'?C.green:C.text,borderRadius:20,padding:'7px 11px',fontWeight:800,cursor:'pointer',display:'flex',gap:6,alignItems:'center'}}><Archive size={14}/>Arquivo</button>
    </div>}

    {loading?<div style={{color:C.muted}}>Carregando...</div>:aba==='notificacoes'?<div style={{display:'grid',gap:10}}>{notificacoesVisiveis.length===0?<Empty text={notificacoesModo==='arquivo'?'Nenhuma notificação arquivada.':'Nenhuma notificação na caixa de entrada.'}/>:notificacoesVisiveis.map(n=><NotificationCard key={n.id} n={n}/>)}</div>:<div style={{display:'grid',gap:10}}>{mensagensVisiveis.length===0?<Empty text={mensagensModo==='arquivo'?'Nenhuma mensagem arquivada.':'Nenhuma mensagem na caixa de entrada.'}/>:mensagensVisiveis.map(m=><MessageCard key={m.id} m={m}/>)}</div>}


    {devolucao&&<Modal title="Devolver atividade" onClose={()=>{setDevolucao(null);setMotivoDevolucao('')}} width={560}>
      <div style={{display:'grid',gap:12}}>
        <div style={{background:C.redBg,color:C.red,border:'1px solid #fecaca',borderRadius:10,padding:12,fontSize:13,lineHeight:1.45}}>
          A devolução será registrada no histórico da atividade e a responsabilidade voltará para quem redistribuiu a atividade para você.
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Motivo da devolução</label>
          <textarea style={{...INP,marginTop:5,minHeight:120}} value={motivoDevolucao} onChange={e=>setMotivoDevolucao(e.target.value)} placeholder="Explique por que a atividade está sendo devolvida." />
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
          <button onClick={()=>{setDevolucao(null);setMotivoDevolucao('')}} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px'}}>Cancelar</button>
          <button onClick={confirmarDevolucao} style={{border:0,background:C.red,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:800}}>Confirmar devolução</button>
        </div>
      </div>
    </Modal>}

    {compose&&<Modal title="Nova mensagem" onClose={()=>setCompose(false)}><div style={{display:'grid',gap:12}}><div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Destinatário</label><select style={{...INP,marginTop:5}} value={form.destinatario_id} onChange={e=>setForm({...form,destinatario_id:e.target.value})}><option value="">Escolha um usuário</option>{team.filter(t=>t.id!==profile.id).map(t=><option key={t.id} value={t.id}>{t.nome} {t.email?`— ${t.email}`:''}</option>)}</select></div><div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Assunto</label><input style={{...INP,marginTop:5}} value={form.assunto} onChange={e=>setForm({...form,assunto:e.target.value})}/></div><div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Mensagem</label><textarea style={{...INP,marginTop:5,minHeight:130}} value={form.corpo} onChange={e=>setForm({...form,corpo:e.target.value})}/></div><div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Anexos</label><input type="file" multiple style={{...INP,marginTop:5}} onChange={e=>setForm({...form,arquivos:Array.from(e.target.files||[])})}/>{form.arquivos?.length>0&&<div style={{fontSize:12,color:C.muted,marginTop:6}}>{form.arquivos.length} arquivo(s) selecionado(s)</div>}</div><div style={{display:'flex',justifyContent:'flex-end',gap:10}}><button onClick={()=>setCompose(false)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px'}}>Cancelar</button><button disabled={sending} onClick={enviarMensagem} style={{border:0,background:sending?C.muted:C.navy,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:800}}>{sending?'Enviando...':'Enviar'}</button></div></div></Modal>}

    {selected&&<Modal title="Mensagem" onClose={()=>{setSelected(null);setReplyText('');setReplyFiles([])}} width={760}>
      <div style={{display:'grid',gap:14}}>
        <MessageDetails m={selected} teamMap={teamMap} profile={profile} anexos={anexosPorMensagem[selected.id]||[]} onDownload={baixarAnexo}/>
        {(mensagensPorParent[selected.parent_id || selected.id]||[]).filter(r=>r.id!==selected.id).length>0&&<div style={{borderTop:'1px solid '+C.border,paddingTop:12}}><h3 style={{fontSize:15,margin:'0 0 10px'}}>Respostas</h3><div style={{display:'grid',gap:8}}>{(mensagensPorParent[selected.parent_id || selected.id]||[]).filter(r=>r.id!==selected.id).map(r=><div key={r.id} style={{border:'1px solid '+C.border,borderRadius:12,padding:12,background:'#f8fafc'}}><MessageDetails m={r} teamMap={teamMap} profile={profile} anexos={anexosPorMensagem[r.id]||[]} onDownload={baixarAnexo} compact/></div>)}</div></div>}
        <div style={{borderTop:'1px solid '+C.border,paddingTop:12}}>
          <h3 style={{fontSize:15,margin:'0 0 10px',display:'flex',gap:6,alignItems:'center'}}><Reply size={16}/>Responder</h3>
          <textarea style={{...INP,minHeight:100}} placeholder="Digite sua resposta..." value={replyText} onChange={e=>setReplyText(e.target.value)}/>
          <div style={{marginTop:10}}><input type="file" multiple style={INP} onChange={e=>setReplyFiles(Array.from(e.target.files||[]))}/>{replyFiles.length>0&&<div style={{fontSize:12,color:C.muted,marginTop:6}}>{replyFiles.length} arquivo(s) selecionado(s)</div>}</div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:12}}><button onClick={()=> selected && (mensagemArquivada(selected)?restaurarThreadMensagem(selected):arquivarThreadMensagem(selected))} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px',display:'flex',alignItems:'center',gap:6}}>{selected && mensagemArquivada(selected)?<ArchiveRestore size={15}/>:<Archive size={15}/>} {selected && mensagemArquivada(selected)?'Restaurar':'Arquivar'}</button><button onClick={()=>{setSelected(null);setReplyText('');setReplyFiles([])}} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px'}}>Fechar</button><button disabled={sending} onClick={responderMensagem} style={{border:0,background:sending?C.muted:C.navy,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:800,display:'flex',alignItems:'center',gap:8}}><Send size={15}/>{sending?'Enviando...':'Enviar resposta'}</button></div>
        </div>
      </div>
    </Modal>}
  </div>
}

function MessageDetails({m,teamMap,profile,anexos,onDownload,compact=false}){
  const enviada=m.remetente_id===profile.id
  const remetente=teamMap[m.remetente_id]
  const destinatario=teamMap[m.destinatario_id]
  return <div>
    <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
      <div style={{width:38,height:38,borderRadius:'50%',background:(remetente?.cor||C.blue),color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,flexShrink:0}}>{initials(remetente?.nome)}</div>
      <div style={{minWidth:0,flex:1}}>
        <h2 style={{fontSize:compact?14:18,margin:'0 0 4px'}}>{m.assunto}</h2>
        <div style={{fontSize:12,color:C.muted}}>De: {remetente?.nome||'Usuário'} {remetente?.email?`<${remetente.email}>`:''}</div>
        <div style={{fontSize:12,color:C.muted}}>Para: {destinatario?.nome||'Usuário'} {destinatario?.email?`<${destinatario.email}>`:''}</div>
        <div style={{fontSize:12,color:C.muted,marginTop:3}}>{new Date(m.created_at).toLocaleString('pt-BR')} · {enviada?'enviada por você':'recebida'}</div>
      </div>
    </div>
    <div style={{whiteSpace:'pre-wrap',lineHeight:1.5,color:C.text,marginTop:14,fontSize:14}}>{m.corpo}</div>
    {anexos?.length>0&&<div style={{marginTop:14,borderTop:'1px solid '+C.border,paddingTop:10}}><div style={{fontSize:12,fontWeight:900,color:C.muted,textTransform:'uppercase',marginBottom:8}}>Anexos</div><div style={{display:'grid',gap:8}}>{anexos.map(a=><button key={a.id} onClick={()=>onDownload(a)} style={{display:'flex',alignItems:'center',gap:8,border:'1px solid '+C.border,background:C.white,borderRadius:10,padding:'9px 10px',cursor:'pointer',textAlign:'left'}}><FileText size={16} color={C.muted}/><span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nome}</span><Download size={15} color={C.blue}/></button>)}</div></div>}
  </div>
}
