import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Bell, CheckCircle, RefreshCw, Inbox, X, Archive, ArchiveRestore } from 'lucide-react'

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

export default function Notificacoes({profile}){
  const [modo,setModo]=useState('entrada')
  const [notificacoes,setNotificacoes]=useState([])
  const [loading,setLoading]=useState(false)
  const [devolucao,setDevolucao]=useState(null)
  const [motivoDevolucao,setMotivoDevolucao]=useState('')

  async function carregar(){
    if(!profile?.id)return
    setLoading(true)
    const{data:notifs,error}=await supabase.from('notificacoes').select('*').eq('usuario_id',profile.id).order('created_at',{ascending:false})
    if(error)console.error(error)
    setNotificacoes(notifs||[])
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setLoading(false)
  }

  useEffect(()=>{carregar()},[profile?.id])

  const notificacoesVisiveis=useMemo(()=>modo==='entrada'?(notificacoes||[]).filter(n=>!n.arquivada):(notificacoes||[]).filter(n=>!!n.arquivada),[notificacoes,modo])

  async function marcarLida(n){
    if(n.lida)return
    await supabase.from('notificacoes').update({lida:true,lida_em:new Date().toISOString()}).eq('id',n.id)
    setNotificacoes(prev=>prev.map(x=>x.id===n.id?{...x,lida:true}:x))
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
  }

  async function arquivar(n){
    await supabase.from('notificacoes').update({arquivada:true,arquivada_em:new Date().toISOString()}).eq('id',n.id)
    setNotificacoes(prev=>prev.map(x=>x.id===n.id?{...x,arquivada:true}:x))
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
  }

  async function restaurar(n){
    await supabase.from('notificacoes').update({arquivada:false,arquivada_em:null}).eq('id',n.id)
    setNotificacoes(prev=>prev.map(x=>x.id===n.id?{...x,arquivada:false}:x))
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
  }

  async function confirmarDevolucao(){
    if(!devolucao?.origem_id)return
    if(!motivoDevolucao.trim())return alert('Informe o motivo da devolução.')
    const atividadeId=devolucao.origem_id
    const{data:atividade}=await supabase.from('atividades').select('*').eq('id',atividadeId).maybeSingle()
    if(!atividade)return alert('Atividade não encontrada.')
    await supabase.from('atividade_historico').insert({atividade_id:atividadeId,usuario_id:profile.id,usuario_nome:profile.nome||'Usuário',tipo_movimento:'devolucao',motivo:motivoDevolucao.trim()})
    await supabase.from('atividades').update({responsavel_id:atividade.redistribuida_de||atividade.criado_por||null,redistribuida_de:null,status:'a_fazer'}).eq('id',atividadeId)
    if(atividade.redistribuida_de){await supabase.from('notificacoes').insert({usuario_id:atividade.redistribuida_de,tipo:'atividade_devolvida',titulo:'Atividade devolvida',descricao:`${profile.nome||'Usuário'} devolveu a atividade${atividade?.titulo?`: ${atividade.titulo}`:'.'}`})}
    await supabase.from('notificacoes').update({lida:true,lida_em:new Date().toISOString()}).eq('id',devolucao.id)
    setDevolucao(null);setMotivoDevolucao('');carregar()
  }

  function NotificationCard({n}){
    return <div onClick={()=>marcarLida(n)} style={{background:n.lida?C.white:C.blueBg,border:'1px solid '+(n.lida?C.border:'#93c5fd'),borderRadius:12,padding:'14px 16px',cursor:'pointer',display:'flex',gap:12,alignItems:'flex-start'}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:4}}>
          <Chip tipo={n.tipo}/>
          {!n.lida&&<span style={{fontSize:10,fontWeight:900,color:C.blue,background:'#eff6ff',borderRadius:20,padding:'2px 8px'}}>NOVO</span>}
          <span style={{fontSize:11,color:C.muted,marginLeft:'auto'}}>{new Date(n.created_at).toLocaleString('pt-BR')}</span>
        </div>
        <b style={{fontSize:14,color:C.text}}>{n.titulo}</b>
        {n.descricao&&<p style={{margin:'4px 0 0',fontSize:13,color:C.muted,lineHeight:1.5}}>{n.descricao}</p>}
        {n.tipo==='atividade_redistribuida'&&n.origem_id&&<button onClick={e=>{e.stopPropagation();setDevolucao(n)}} style={{marginTop:8,border:0,background:C.red,color:'white',borderRadius:7,padding:'6px 12px',fontWeight:800,fontSize:12,cursor:'pointer'}}>Devolver atividade</button>}
      </div>
      <div style={{display:'flex',gap:4,flexShrink:0}}>
        {!n.arquivada?<button onClick={e=>{e.stopPropagation();arquivar(n)}} title="Arquivar" style={{border:'1px solid '+C.border,background:C.white,borderRadius:7,padding:'5px 8px',cursor:'pointer',color:C.muted,display:'flex'}}><Archive size={14}/></button>:<button onClick={e=>{e.stopPropagation();restaurar(n)}} title="Restaurar" style={{border:'1px solid '+C.border,background:C.white,borderRadius:7,padding:'5px 8px',cursor:'pointer',color:C.green,display:'flex'}}><ArchiveRestore size={14}/></button>}
      </div>
    </div>
  }

  const naoLidas=(notificacoes||[]).filter(n=>!n.lida&&!n.arquivada).length

  return <div style={{padding:24}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
      <div>
        <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Notificações</h1>
        <p style={{color:C.muted,marginTop:4,marginBottom:0}}>Avisos de atividades, redistribuições e vencimentos de prazo.</p>
      </div>
      <button onClick={carregar} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'9px 16px',cursor:'pointer',display:'flex',gap:7,alignItems:'center',fontWeight:700,fontSize:13}}><RefreshCw size={14}/>Atualizar</button>
    </div>

    <div style={{display:'flex',gap:8,margin:'18px 0',flexWrap:'wrap',alignItems:'center'}}>
      <button onClick={()=>setModo('entrada')} style={{border:'1px solid '+C.border,background:modo==='entrada'?C.greenBg:C.white,color:modo==='entrada'?C.green:C.text,borderRadius:20,padding:'7px 11px',fontWeight:800,cursor:'pointer',display:'flex',gap:6,alignItems:'center',fontSize:13}}><Inbox size={14}/>Caixa de entrada{naoLidas>0&&<span style={{background:C.red,color:'white',borderRadius:999,padding:'1px 7px',fontSize:11,fontWeight:900}}>{naoLidas}</span>}</button>
      <button onClick={()=>setModo('arquivo')} style={{border:'1px solid '+C.border,background:modo==='arquivo'?C.greenBg:C.white,color:modo==='arquivo'?C.green:C.text,borderRadius:20,padding:'7px 11px',fontWeight:800,cursor:'pointer',display:'flex',gap:6,alignItems:'center',fontSize:13}}><Archive size={14}/>Arquivo</button>
    </div>

    {loading?<div style={{color:C.muted}}>Carregando...</div>:<div style={{display:'grid',gap:10}}>{notificacoesVisiveis.length===0?<Empty text={modo==='arquivo'?'Nenhuma notificação arquivada.':'Nenhuma notificação na caixa de entrada.'}/>:notificacoesVisiveis.map(n=><NotificationCard key={n.id} n={n}/>)}</div>}

    {devolucao&&<Modal title="Devolver atividade" onClose={()=>{setDevolucao(null);setMotivoDevolucao('')}} width={560}>
      <div style={{display:'grid',gap:12}}>
        <div style={{background:C.redBg,color:C.red,border:'1px solid #fecaca',borderRadius:10,padding:12,fontSize:13,lineHeight:1.45}}>A devolução será registrada no histórico e a responsabilidade voltará para quem redistribuiu a atividade.</div>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase'}}>Motivo da devolução</label><textarea style={{...INP,marginTop:5,minHeight:120}} value={motivoDevolucao} onChange={e=>setMotivoDevolucao(e.target.value)} placeholder="Explique por que a atividade está sendo devolvida."/></div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
          <button onClick={()=>{setDevolucao(null);setMotivoDevolucao('')}} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px',cursor:'pointer'}}>Cancelar</button>
          <button onClick={confirmarDevolucao} style={{border:0,background:C.red,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:800,cursor:'pointer'}}>Confirmar devolução</button>
        </div>
      </div>
    </Modal>}
  </div>
}
