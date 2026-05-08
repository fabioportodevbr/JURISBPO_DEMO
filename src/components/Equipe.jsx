import { useEffect, useMemo, useState } from 'react'
import { supabase, ROLES, can } from '../lib/supabase.js'
import AvatarUsuario from './common/AvatarUsuario.jsx'
import { X, Send, Mail, Phone, Briefcase, Scale, Paperclip, UserRound, Plus, Trash2, UserPlus, ShieldCheck } from 'lucide-react'

const C={white:'#fff',text:'#0f172a',muted:'#64748b',border:'#e5e7eb',navy:'#022c22',gold:'#10b981',green:'#10b981',greenBg:'#dcfce7',red:'#dc2626',redBg:'#fee2e2'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:10,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const BTN={border:0,borderRadius:10,padding:'10px 14px',fontWeight:900,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8}

function Modal({title,onClose,children,width=640}){
  return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.white,borderRadius:16,width:'100%',maxWidth:width,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 24px 80px rgba(15,23,42,.25)'}}>
      <div style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border,alignItems:'center',gap:12}}>
        <b style={{fontSize:16}}>{title}</b>
        <button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',display:'flex',padding:4,color:C.text}}><X/></button>
      </div>
      <div style={{padding:18,overflow:'auto'}}>{children}</div>
    </div>
  </div>
}

function InfoLine({icon,label,value}){
  return <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}>
    <div style={{color:C.green,marginTop:1}}>{icon}</div>
    <div style={{minWidth:0}}>
      <div style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:14,color:C.text,wordBreak:'break-word'}}>{value || 'Não informado'}</div>
    </div>
  </div>
}

export default function Equipe({profile}){
  const [m,setM]=useState([])
  const [loading,setLoading]=useState(true)
  const [selecionado,setSelecionado]=useState(null)
  const [modoMensagem,setModoMensagem]=useState(false)
  const [msg,setMsg]=useState({assunto:'',corpo:'',arquivos:[]})
  const [sending,setSending]=useState(false)
  const [showNovoMembro,setShowNovoMembro]=useState(false)
  const [novoMembro,setNovoMembro]=useState({nome:'',email:'',cargo:'Advogado(a)',papel:'advogado',senhaTemporaria:''})
  const [creating,setCreating]=useState(false)
  const [removing,setRemoving]=useState(null)

  const isGerente=useMemo(()=>can(profile,'equipe.gerenciar') || profile?.papel==='gerente' || profile?.role==='gerente',[profile])

  const load=async()=>{
    setLoading(true)
    const {data:links,error:linksError}=await supabase
      .from('usuarios_escritorios')
      .select('usuario_id,papel,ativo,created_at')
      .eq('escritorio_id',profile.escritorio_id)
      .eq('ativo',true)
      .order('created_at',{ascending:true})

    if(linksError){ console.error(linksError); setM([]); setLoading(false); return }

    const ids=[...(new Set((links||[]).map(x=>x.usuario_id).filter(Boolean)))]
    let profiles=[]
    if(ids.length){
      const {data,error}=await supabase
        .from('profiles')
        .select('id,nome,email,telefone,cargo,oab,ativo,cor,avatar_url,foto_url')
        .in('id',ids)
      if(error) console.error(error)
      profiles=data||[]
    }
    const byId=Object.fromEntries(profiles.map(p=>[p.id,p]))
    setM((links||[]).map(link=>({ ...link, profile: byId[link.usuario_id] || null })))
    setLoading(false)
  }

  useEffect(()=>{load()},[profile.escritorio_id])

  const membroSelecionado=useMemo(()=>{
    if(!selecionado) return null
    const p=selecionado.profile || {}
    const name=p?.nome || p?.email || selecionado.usuario_id
    return {...selecionado, displayName:name, displayEmail:p?.email || 'Profile não localizado', roleLabel:ROLES[selecionado.papel]?.label||selecionado.papel}
  },[selecionado])

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

  async function enviarMensagem(){
    if(!membroSelecionado?.usuario_id) return
    if(membroSelecionado.usuario_id===profile.id) return alert('Você não pode enviar mensagem para si mesmo por aqui.')
    if(!msg.assunto.trim()) return alert('Informe o assunto da mensagem.')
    if(!msg.corpo.trim() && !msg.arquivos.length) return alert('Digite a mensagem ou anexe ao menos um arquivo.')
    setSending(true)
    const {data,error}=await supabase.from('mensagens').insert({
      escritorio_id: profile.escritorio_id,
      remetente_id: profile.id,
      destinatario_id: membroSelecionado.usuario_id,
      assunto: msg.assunto.trim(),
      corpo: msg.corpo.trim() || '(anexo)',
      lida: false
    }).select('id').single()
    if(error){ setSending(false); return alert('Erro ao enviar mensagem: '+error.message) }
    const attachErr=await uploadAnexos(data.id,msg.arquivos)
    if(attachErr){ setSending(false); return alert('Mensagem enviada, mas houve erro ao anexar arquivo: '+attachErr.message) }
    const {error:notifErr}=await supabase.from('notificacoes').insert({
      escritorio_id: profile.escritorio_id,
      usuario_id: membroSelecionado.usuario_id,
      tipo: 'mensagem',
      titulo: `Nova mensagem de ${profile.nome || 'usuário'}`,
      descricao: msg.assunto.trim(),
      origem_tipo: 'mensagem',
      origem_id: data.id
    })
    if(notifErr) console.warn('Falha ao criar notificação da mensagem:', notifErr)
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setSending(false)
    setMsg({assunto:'',corpo:'',arquivos:[]})
    setModoMensagem(false)
    setSelecionado(null)
    alert('Mensagem enviada com sucesso.')
  }

  async function criarMembro(){
    if(!isGerente) return alert('Apenas gerentes podem incluir membros.')
    if(!novoMembro.nome.trim()) return alert('Informe o nome do membro.')
    if(!novoMembro.email.trim()) return alert('Informe o e-mail do membro.')
    setCreating(true)
    const {data,error}=await supabase.functions.invoke('equipe-criar-membro',{
      body:{
        nome: novoMembro.nome.trim(),
        email: novoMembro.email.trim().toLowerCase(),
        cargo: novoMembro.cargo.trim() || ROLES[novoMembro.papel]?.label || 'Advogado(a)',
        papel: novoMembro.papel,
        senha_temporaria: novoMembro.senhaTemporaria?.trim() || undefined,
        escritorio_id: profile.escritorio_id
      }
    })
    setCreating(false)
    if(error) return alert('Erro ao incluir membro: '+(error.message || JSON.stringify(error)))
    if(data?.error) return alert('Erro ao incluir membro: '+(typeof data.error==='string'?data.error:JSON.stringify(data.error)))
    setShowNovoMembro(false)
    setNovoMembro({nome:'',email:'',cargo:'Advogado(a)',papel:'advogado',senhaTemporaria:''})
    await load()
    alert('Membro incluído com sucesso.')
  }

  async function removerMembro(x){
    if(!isGerente) return alert('Apenas gerentes podem remover membros.')
    if(x.usuario_id===profile.id) return alert('Você não pode remover seu próprio usuário pela tela de Equipe.')
    const nome=x.profile?.nome || x.profile?.email || x.usuario_id
    if(!confirm(`Remover ${nome} da equipe?\n\nO usuário deixará de aparecer na equipe e perderá o vínculo ativo com a empresa.`)) return
    setRemoving(x.usuario_id)
    const {data,error}=await supabase.functions.invoke('equipe-remover-membro',{
      body:{ usuario_id:x.usuario_id, escritorio_id:profile.escritorio_id }
    })
    setRemoving(null)
    if(error) return alert('Erro ao remover membro: '+(error.message || JSON.stringify(error)))
    if(data?.error) return alert('Erro ao remover membro: '+(typeof data.error==='string'?data.error:JSON.stringify(data.error)))
    if(selecionado?.usuario_id===x.usuario_id) setSelecionado(null)
    await load()
    alert(data?.already_removed ? 'Membro ja estava removido e foi retirado da lista.' : 'Membro removido com sucesso.')
  }

  return <div style={{padding:24}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}>
      <div>
        <h1 style={{margin:0,fontSize:22}}>Equipe</h1>
        <p style={{color:C.muted}}>Membros vinculados à empresa. Clique em um membro para ver o perfil e enviar mensagem.</p>
      </div>
      {isGerente&&<button onClick={()=>setShowNovoMembro(true)} style={{...BTN,background:C.green,color:'white'}}><UserPlus size={16}/>Adicionar membro</button>}
    </div>

    {isGerente&&<div style={{marginTop:8,marginBottom:10,border:'1px solid '+C.border,borderRadius:12,padding:12,background:'#f8fafc',display:'flex',gap:10,alignItems:'flex-start',color:C.muted,fontSize:13}}>
      <ShieldCheck size={18} color={C.green}/>
      <div><b style={{color:C.text}}>Administração de equipe liberada para gerente.</b><br/>A inclusão e remoção dependem das Edge Functions <code>equipe-criar-membro</code> e <code>equipe-remover-membro</code>.</div>
    </div>}

    {loading&&<p style={{color:C.muted}}>Carregando equipe...</p>}
    {!loading&&!m.length&&<p style={{color:C.muted,marginTop:18}}>Nenhum membro ativo encontrado.</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14,marginTop:18}}>
      {m.map(x=>{const p=x.profile; const name=p?.nome || p?.email || x.usuario_id; const role=ROLES[x.papel]?.label||x.papel
        return <div key={x.usuario_id} style={{background:C.white,border:'1px solid '+C.border,borderRadius:14,padding:16,display:'flex',gap:14,alignItems:'center',boxShadow:'0 1px 2px rgba(15,23,42,.04)'}}>
          <button onClick={()=>{setSelecionado(x);setModoMensagem(false);setMsg({assunto:'',corpo:'',arquivos:[]})}} style={{border:0,background:'transparent',padding:0,display:'flex',gap:14,alignItems:'center',textAlign:'left',cursor:'pointer',flex:1,minWidth:0}}>
            <AvatarUsuario profile={{...p, nome:name}} size={46} />
            <div style={{minWidth:0,flex:1}}>
              <b style={{display:'block',color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</b>
              <div style={{fontSize:12,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p?.email || 'Profile não localizado'}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:7}}>{role} · {x.ativo?'ativo':'inativo'}</div>
            </div>
          </button>
          {isGerente && x.usuario_id!==profile.id && <button title="Remover membro" disabled={removing===x.usuario_id} onClick={()=>removerMembro(x)} style={{border:'1px solid #fecaca',background:C.redBg,color:C.red,borderRadius:10,padding:9,cursor:removing===x.usuario_id?'not-allowed':'pointer',display:'flex'}}><Trash2 size={16}/></button>}
        </div>})}
    </div>

    {showNovoMembro&&<Modal title="Adicionar membro da equipe" onClose={()=>setShowNovoMembro(false)} width={560}>
      <div style={{display:'grid',gap:12}}>
        <div style={{padding:12,borderRadius:12,background:'#f8fafc',border:'1px solid '+C.border,color:C.muted,fontSize:13}}>
          Esta tela chama a Edge Function <b>equipe-criar-membro</b>. Você criará essa função no Supabase usando Service Role, como combinado.
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>Nome</label>
          <input style={{...INP,marginTop:5}} value={novoMembro.nome} onChange={e=>setNovoMembro({...novoMembro,nome:e.target.value})} placeholder="Nome completo" />
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>E-mail</label>
          <input style={{...INP,marginTop:5}} value={novoMembro.email} onChange={e=>setNovoMembro({...novoMembro,email:e.target.value})} placeholder="email@empresa.com.br" />
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>Papel</label>
            <select style={{...INP,marginTop:5}} value={novoMembro.papel} onChange={e=>setNovoMembro({...novoMembro,papel:e.target.value,cargo:ROLES[e.target.value]?.label || novoMembro.cargo})}>
              <option value="advogado">Advogado(a)</option>
              <option value="assistente">Assistente</option>
              <option value="visitante">Visitante (somente leitura)</option>
              <option value="gerente">Gerente Jurídico</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>Cargo</label>
            <input style={{...INP,marginTop:5}} value={novoMembro.cargo} onChange={e=>setNovoMembro({...novoMembro,cargo:e.target.value})} placeholder="Cargo" />
          </div>
        </div>
        <div>
          <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>Senha temporária</label>
          <input style={{...INP,marginTop:5}} value={novoMembro.senhaTemporaria} onChange={e=>setNovoMembro({...novoMembro,senhaTemporaria:e.target.value})} placeholder="Opcional. Se vazio, a função define uma senha temporária." />
          <div style={{fontSize:12,color:C.muted,marginTop:6}}>Recomendado futuramente: convite por e-mail ou redefinição de senha.</div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:8}}>
          <button onClick={()=>setShowNovoMembro(false)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px',cursor:'pointer'}}>Cancelar</button>
          <button disabled={creating} onClick={criarMembro} style={{...BTN,background:creating?C.muted:C.green,color:'white',cursor:creating?'not-allowed':'pointer'}}><Plus size={16}/>{creating?'Incluindo...':'Incluir membro'}</button>
        </div>
      </div>
    </Modal>}

    {membroSelecionado&&<Modal title="Perfil do membro" onClose={()=>{setSelecionado(null);setModoMensagem(false);setMsg({assunto:'',corpo:'',arquivos:[]})}}>
      <div style={{display:'grid',gap:16}}>
        <div style={{display:'flex',alignItems:'center',gap:16,background:'#f8fafc',border:'1px solid '+C.border,borderRadius:14,padding:16}}>
          <AvatarUsuario profile={{...membroSelecionado.profile,nome:membroSelecionado.displayName}} size={72} />
          <div style={{minWidth:0}}>
            <h2 style={{margin:'0 0 4px',fontSize:22,color:C.text}}>{membroSelecionado.displayName}</h2>
            <div style={{fontSize:14,color:C.muted,wordBreak:'break-word'}}>{membroSelecionado.displayEmail}</div>
            <div style={{display:'inline-flex',marginTop:9,padding:'4px 9px',borderRadius:20,background:C.greenBg,color:C.green,fontSize:12,fontWeight:900}}>{membroSelecionado.roleLabel} · {membroSelecionado.ativo?'ativo':'inativo'}</div>
          </div>
        </div>

        <div style={{border:'1px solid '+C.border,borderRadius:14,padding:'4px 14px',background:C.white}}>
          <InfoLine icon={<UserRound size={17}/>} label="Nome" value={membroSelecionado.profile?.nome}/>
          <InfoLine icon={<Mail size={17}/>} label="E-mail" value={membroSelecionado.profile?.email}/>
          <InfoLine icon={<Briefcase size={17}/>} label="Cargo" value={membroSelecionado.profile?.cargo}/>
          <InfoLine icon={<Scale size={17}/>} label="OAB" value={membroSelecionado.profile?.oab}/>
          <InfoLine icon={<Phone size={17}/>} label="Telefone" value={membroSelecionado.profile?.telefone}/>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}>
          {isGerente && membroSelecionado.usuario_id!==profile.id ? <button disabled={removing===membroSelecionado.usuario_id} onClick={()=>removerMembro(membroSelecionado)} style={{...BTN,background:C.redBg,color:C.red,border:'1px solid #fecaca'}}><Trash2 size={16}/>Remover da equipe</button> : <span/>}
          {membroSelecionado.usuario_id!==profile.id&&<button onClick={()=>setModoMensagem(v=>!v)} style={{...BTN,background:C.green,color:'white'}}><Send size={16}/>{modoMensagem?'Cancelar mensagem':'Enviar mensagem'}</button>}
        </div>

        {modoMensagem&&<div style={{border:'1px solid '+C.border,borderRadius:14,padding:14,display:'grid',gap:12,background:'#f8fafc'}}>
          <div>
            <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>Assunto</label>
            <input style={{...INP,marginTop:5}} value={msg.assunto} onChange={e=>setMsg({...msg,assunto:e.target.value})} placeholder="Assunto da mensagem" />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>Mensagem</label>
            <textarea style={{...INP,marginTop:5,minHeight:120}} value={msg.corpo} onChange={e=>setMsg({...msg,corpo:e.target.value})} placeholder={`Escreva para ${membroSelecionado.displayName}...`} />
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>Anexos</label>
            <input type="file" multiple style={{...INP,marginTop:5}} onChange={e=>setMsg({...msg,arquivos:Array.from(e.target.files||[])})}/>
            {msg.arquivos?.length>0&&<div style={{fontSize:12,color:C.muted,marginTop:6,display:'flex',alignItems:'center',gap:5}}><Paperclip size={13}/>{msg.arquivos.length} arquivo(s) selecionado(s)</div>}
          </div>
          <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
            <button onClick={()=>{setModoMensagem(false);setMsg({assunto:'',corpo:'',arquivos:[]})}} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px',cursor:'pointer'}}>Cancelar</button>
            <button disabled={sending} onClick={enviarMensagem} style={{border:0,background:sending?C.muted:C.navy,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:900,cursor:sending?'not-allowed':'pointer',display:'flex',gap:8,alignItems:'center'}}><Send size={15}/>{sending?'Enviando...':'Enviar mensagem'}</button>
          </div>
        </div>}
      </div>
    </Modal>}
  </div>
}
