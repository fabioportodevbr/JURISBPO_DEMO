import { useEffect, useMemo, useState } from 'react'
import { supabase, can, fetchAllRows } from '../lib/supabase.js'
import { Plus, RefreshCw, Pencil, Trash2, X, CalendarDays, Paperclip, Archive, RotateCcw, Search, ChevronDown } from 'lucide-react'
import DocumentosVinculados from './DocumentoVinculados.jsx'

const C={navy:'#022c22',white:'#fff',text:'#0f172a',muted:'#64748b',border:'#e5e7eb',blue:'#1d4ed8',blueBg:'#dbeafe',red:'#dc2626',redBg:'#fee2e2',green:'#16a34a',greenBg:'#dcfce7',amber:'#b45309',amberBg:'#fef3c7',purple:'#10b981',purpleBg:'#dcfce7',grayBg:'#f1f5f9'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:8,boxSizing:'border-box',fontSize:14,background:'#fff',color:'#0f172a'}
const TIPOS=[['tarefa','Tarefas'],['prazo_processual','Prazos processuais'],['audiencia','Audiências'],['reuniao','Reuniões']]
const STATUS=[['a_fazer','A fazer'],['em_andamento','Em andamento'],['concluida','Concluída'],['cancelada','Cancelada']]
const PRIOR=[['baixa','Baixa'],['media','Média'],['alta','Alta'],['urgente','Urgente']]
const AUDIENCIA_MODALIDADES=[['presencial','Presencial'],['online','Online']]
const AUDIENCIA_TIPOS=[['inicial','Inicial'],['instrucao','Instrução'],['una','Una'],['conciliacao','Conciliação']]
const typeKind={tarefa:'blue',prazo_processual:'red',audiencia:'purple',reuniao:'green'}
function label(arr,v){return arr.find(x=>x[0]===v)?.[1]||v||'—'}
function dateBR(d){return d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—'}
function F({label:lbl,children}){return <div style={{marginBottom:12,flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{lbl}</label>{children}</div>}
function Modal({title,onClose,children,width=820}){return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:width,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border,alignItems:'center'}}><b style={{fontSize:15}}>{title}</b><button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',display:'flex'}}><X size={18}/></button></div><div style={{padding:18,overflow:'auto',flex:1}}>{children}</div></div></div>}
function Chip({children,kind='blue'}){const m={blue:[C.blueBg,C.blue],red:[C.redBg,C.red],green:[C.greenBg,C.green],amber:[C.amberBg,C.amber],purple:[C.purpleBg,C.purple],gray:[C.grayBg,C.muted]};const[bg,color]=m[kind]||m.gray;return <span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,background:bg,color,textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>}
const movimentoLabel=(h)=>h.tipo_evento==='devolucao'?'Devolução':h.tipo_evento==='aceite'?'Aceite':h.tipo_evento==='arquivamento'?'Arquivamento':h.tipo_evento==='conclusao_arquivamento'?'Conclusão e arquivamento':h.tipo_evento==='reabertura'?'Reabertura':'Redistribuição'
function isArquivada(a){return a.status==='concluida'}

/* ── Card clicável de atividade ── */
function AtividadeCard({t,team,cont,onOpen}){
  const[hov,setHov]=useState(false)
  const arq=isArquivada(t)
  const resp=team.find(x=>x.id===t.responsavel_id)?.nome
  const prKind={urgente:'red',alta:'amber',media:'blue',baixa:'gray'}[t.prioridade]||'gray'
  const hoje=new Date();hoje.setHours(0,0,0,0)
  const dprazo=t.prazo?new Date(t.prazo+'T12:00:00'):null
  const prazoKind=dprazo?(dprazo<hoje?'red':dprazo-hoje<7*86400000?'amber':'gray'):'gray'
  return(
    <button
      onClick={()=>onOpen(t)}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{width:'100%',textAlign:'left',cursor:'pointer',background:hov?C.grayBg:(arq?'#f8fafc':C.white),border:'1px solid '+(hov?'#94a3b8':C.border),borderRadius:12,padding:'12px 14px',display:'grid',gap:8,opacity:arq?0.85:1,fontFamily:'inherit',transition:'all .12s',boxShadow:hov?'0 2px 8px rgba(0,0,0,0.08)':'none'}}
    >
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <Chip kind={typeKind[t.tipo]}>{label(TIPOS,t.tipo)}</Chip>
        {arq&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓ Concluída</span>}
      </div>
      <div style={{fontSize:13,fontWeight:700,color:C.text,lineHeight:1.35,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{t.titulo}</div>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
        {t.prazo&&<Chip kind={prazoKind}>{dateBR(t.prazo)}{t.horario?' · '+t.horario:''}</Chip>}
        {t.prioridade&&t.prioridade!=='baixa'&&<Chip kind={prKind}>{label(PRIOR,t.prioridade)}</Chip>}
        {t.tipo==='audiencia'&&t.audiencia_modalidade&&<Chip kind="green">{label(AUDIENCIA_MODALIDADES,t.audiencia_modalidade)}</Chip>}
        {t.tipo==='audiencia'&&t.audiencia_tipo&&<Chip kind="purple">{label(AUDIENCIA_TIPOS,t.audiencia_tipo)}</Chip>}
      </div>
      <div style={{fontSize:11,color:C.muted,display:'flex',flexWrap:'wrap',gap:10,borderTop:'1px solid '+C.border,paddingTop:6}}>
        {resp&&<span>{resp}</span>}
        {t.processos&&<span style={{color:C.blue}}>{t.processos.numero||t.processos.titulo}</span>}
        {t.contrato_id&&cont.find(c=>c.id===t.contrato_id)&&<span>{cont.find(c=>c.id===t.contrato_id).titulo||'Contrato vinculado'}</span>}
        {arq&&<span style={{color:C.green,fontWeight:700}}>em {t.concluida_em?new Date(t.concluida_em).toLocaleDateString('pt-BR'):'—'}</span>}
      </div>
    </button>
  )
}

/* ── Componente principal ── */
export default function Atividades({profile}){
  const [items,setItems]=useState([])
  const [team,setTeam]=useState([])
  const [proc,setProc]=useState([])
  const [cont,setCont]=useState([])
  const [modal,setModal]=useState(false)
  const [tab,setTab]=useState('dados')
  const [form,setForm]=useState({})
  const [loading,setLoading]=useState(true)
  const [history,setHistory]=useState([])
  const [saving,setSaving]=useState(false)
  const [rotinas,setRotinas]=useState([])
  const [buscaGeral,setBuscaGeral]=useState('')
  const [rotinaModal,setRotinaModal]=useState(false)
  const [rotinaForm,setRotinaForm]=useState({id:null,texto:'',recorrencia:'',cor:'#10b981',itens:[]})
  const [rotinaTarget,setRotinaTarget]=useState(null)
  const [rotinasSaving,setRotinasSaving]=useState(false)
  const [novoItem,setNovoItem]=useState('')
  const [rotinaExpanded,setRotinaExpanded]=useState(false)
  const [expandedTipos,setExpandedTipos]=useState({})
  const [arquivoTipos,setArquivoTipos]=useState({})
  const [ordemTipos,setOrdemTipos]=useState({})

  const isGerente=profile?.role==='gerente'
  const canCreate=can(profile,'atividades.criar')
  const canEdit=can(profile,'atividades.editar')
  const canDelete=can(profile,'atividades.excluir')
  const canArchive=can(profile,'atividades.criar')||canEdit

  /* ── Rotinas ── */
  const loadRotinas=async()=>{
    const{data,error}=await supabase.from('rotinas').select('id,usuario_id,texto,recorrencia,cor,itens,criado_em').eq('escritorio_id',profile.escritorio_id).order('criado_em',{ascending:true})
    if(error)console.error('rotinas error',error)
    setRotinas(data||[])
  }
  const saveRotina=async()=>{
    if(!canCreate)return alert('Visitante possui acesso somente leitura.')
    if(!rotinaForm.texto.trim()||!rotinaForm.recorrencia.trim())return
    setRotinasSaving(true)
    const uid=rotinaTarget||profile.id
    if(rotinaForm.id){await supabase.from('rotinas').update({texto:rotinaForm.texto.trim(),recorrencia:rotinaForm.recorrencia.trim(),cor:rotinaForm.cor,itens:rotinaForm.itens||[],atualizado_em:new Date().toISOString()}).eq('id',rotinaForm.id)}
    else{await supabase.from('rotinas').insert({escritorio_id:profile.escritorio_id,usuario_id:uid,texto:rotinaForm.texto.trim(),recorrencia:rotinaForm.recorrencia.trim(),cor:rotinaForm.cor,itens:rotinaForm.itens||[]})}
    setRotinaModal(false);setRotinaForm({id:null,texto:'',recorrencia:'',cor:'#10b981',itens:[]});setRotinaTarget(null);setNovoItem('')
    setRotinasSaving(false);loadRotinas()
  }
  const deleteRotina=async(id)=>{
    if(!canDelete)return alert('Visitante possui acesso somente leitura.')
    if(!confirm('Excluir esta rotina?'))return
    await supabase.from('rotinas').delete().eq('id',id)
    loadRotinas()
  }
  const toggleItem=async(rotina,itemId)=>{
    const itens=(rotina.itens||[]).map(it=>it.id===itemId?{...it,concluido:!it.concluido}:it)
    await supabase.from('rotinas').update({itens}).eq('id',rotina.id)
    setRotinas(prev=>prev.map(r=>r.id===rotina.id?{...r,itens}:r))
  }
  const addItem=()=>{const txt=novoItem.trim();if(!txt)return;setRotinaForm(f=>({...f,itens:[...(f.itens||[]),{id:crypto.randomUUID(),texto:txt,concluido:false}]}));setNovoItem('')}
  const removeItem=(itemId)=>{setRotinaForm(f=>({...f,itens:(f.itens||[]).filter(it=>it.id!==itemId)}))}

  /* ── Atividades ── */
  const load=async()=>{
    const eid=profile.escritorio_id
    let atividades=[]
    if(profile.role==='gerente'){
      atividades=await fetchAllRows(()=>supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal)').eq('escritorio_id',eid).order('created_at',{ascending:false}))
    }else{
      const[privadas,compartilhadas]=await Promise.all([
        fetchAllRows(()=>supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal)').eq('escritorio_id',eid).in('tipo',['tarefa','prazo_processual']).eq('responsavel_id',profile.id).order('created_at',{ascending:false})),
        fetchAllRows(()=>supabase.from('atividades').select('*, processos(id,numero,titulo,tribunal)').eq('escritorio_id',eid).in('tipo',['audiencia','reuniao']).order('created_at',{ascending:false}))
      ])
      const mapa=new Map()
      ;[...(privadas||[]),...(compartilhadas||[])].forEach(x=>mapa.set(x.id,x))
      atividades=Array.from(mapa.values()).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))
    }
    const[{data:l},p,c]=await Promise.all([
      supabase.from('usuarios_escritorios').select('usuario_id,papel,profiles(id,nome,email)').eq('escritorio_id',eid).eq('ativo',true),
      fetchAllRows(()=>supabase.from('processos').select('id,numero,titulo').eq('escritorio_id',eid).order('created_at',{ascending:false})),
      fetchAllRows(()=>supabase.from('contratos').select('id,numero,titulo,contratante,contratada').eq('escritorio_id',eid).order('created_at',{ascending:false}))
    ])
    setItems(atividades)
    setTeam((l||[]).map(x=>({id:x.usuario_id,nome:x.profiles?.nome||x.profiles?.email||x.usuario_id})))
    setProc(p||[])
    setCont(c||[])
    setLoading(false)
    loadRotinas()
  }
  useEffect(()=>{load()},[profile.escritorio_id,profile.id,profile.role])

  /* carrega histórico quando tab muda */
  useEffect(()=>{
    if(tab==='historico'&&form.id){
      supabase.from('atividade_atribuicoes').select('*').eq('atividade_id',form.id).order('created_at',{ascending:false}).then(({data})=>setHistory(data||[]))
    }
  },[tab,form.id])

  const ativos=useMemo(()=>items.filter(i=>!isArquivada(i)&&i.status!=='cancelada'),[items])
  const arquivados=useMemo(()=>items.filter(isArquivada),[items])

  const matchBusca=(a,q)=>{if(!q?.trim())return true;const s=q.toLowerCase();return[a.titulo,a.descricao,a.local,team.find(x=>x.id===a.responsavel_id)?.nome,a.processos?.numero,a.processos?.titulo,dateBR(a.prazo)].some(v=>String(v||'').toLowerCase().includes(s))}

  const getSortedList=(tipo,isArq,ordem)=>{
    const base=(isArq?arquivados:ativos).filter(i=>i.tipo===tipo&&matchBusca(i,buscaGeral))
    return base.slice().sort((a,b)=>{
      if(ordem==='antigas')return String(a.created_at||'').localeCompare(String(b.created_at||''))
      if(ordem==='data_asc')return String(a.prazo||'9').localeCompare(String(b.prazo||'9'))
      if(ordem==='data_desc')return String(b.prazo||'').localeCompare(String(a.prazo||''))
      return String(b.created_at||'').localeCompare(String(a.created_at||''))
    })
  }

  /* ── Ações ── */
  const open=(t=null,tipo='tarefa')=>{
    if(!t&&!canCreate)return alert('Visitante possui acesso somente leitura.')
    setForm(t?{...t,audiencia_modalidade:t.audiencia_modalidade||'presencial',audiencia_tipo:t.audiencia_tipo||'inicial'}:{tipo,status:'a_fazer',titulo:'',descricao:'',prioridade:'media',responsavel_id:profile.id,prazo:'',horario:'',local:'',processo_id:'',contrato_id:'',audiencia_modalidade:'presencial',audiencia_tipo:'inicial'})
    setTab('dados')
    setHistory([])
    setModal(true)
  }
  const registrarEvento=async(atividade,tipoEvento,observacao='',extra={})=>{
    if(!atividade?.id)return
    const base={atividade_id:atividade.id,usuario_anterior_id:extra.usuario_anterior_id||atividade.responsavel_id||null,usuario_novo_id:extra.usuario_novo_id||atividade.responsavel_id||null,atribuido_por:profile.id,observacao}
    const completo={...base,escritorio_id:profile.escritorio_id,tipo_evento:tipoEvento,motivo:extra.motivo||null}
    const{error}=await supabase.from('atividade_atribuicoes').insert(completo)
    if(error){const fb=await supabase.from('atividade_atribuicoes').insert(base);if(fb.error)console.error('Erro histórico:',fb.error)}
  }
  const save=async()=>{
    if(form.id&&!canEdit)return alert('Visitante possui acesso somente leitura.')
    if(!form.id&&!canCreate)return alert('Visitante possui acesso somente leitura.')
    if(!form.titulo)return alert('Informe o título.')
    if(['prazo_processual','audiencia'].includes(form.tipo)&&!form.processo_id)return alert('Prazos processuais e audiências devem ser vinculados a um processo.')
    setSaving(true)
    const antigo=items.find(x=>x.id===form.id)
    const{processos,contratos,profiles:_,... cleanForm}=form
    const vaiArquivar=cleanForm.status==='concluida'&&antigo?.status!=='concluida'
    const payload={...cleanForm,escritorio_id:profile.escritorio_id,responsavel_id:form.responsavel_id||null,processo_id:form.processo_id||null,contrato_id:form.contrato_id||null,prazo:form.prazo||null,horario:form.horario||null,criado_por:form.criado_por||profile.id,concluida_em:cleanForm.status==='concluida'?(form.concluida_em||new Date().toISOString()):null}
    let r
    if(form.id)r=await supabase.from('atividades').update(payload).eq('id',form.id).select().single()
    else r=await supabase.from('atividades').insert(payload).select().single()
    if(r.error){setSaving(false);return alert(r.error.message)}
    const mudou=!antigo||antigo.responsavel_id!==payload.responsavel_id
    if(mudou&&payload.responsavel_id){
      await registrarEvento(r.data,antigo?'redistribuicao':'atribuicao',antigo?'Atividade redistribuída':'Atividade criada/atribuída',{usuario_anterior_id:antigo?.responsavel_id||null,usuario_novo_id:payload.responsavel_id})
      if(payload.responsavel_id!==profile.id){await supabase.from('notificacoes').insert({escritorio_id:profile.escritorio_id,usuario_id:payload.responsavel_id,tipo:antigo?'atividade_redistribuida':'nova_atividade',titulo:antigo?'Atividade redistribuída para você':'Nova atividade atribuída a você',descricao:`${r.data.titulo} — por ${profile.nome||'Usuário'} em ${new Date().toLocaleString('pt-BR')}`,origem_tipo:'atividade',origem_id:String(r.data.id)})}
    }
    if(vaiArquivar){await registrarEvento(r.data,'conclusao_arquivamento',`Status alterado para concluída e atividade enviada ao arquivo por ${profile.nome||profile.email||profile.id} em ${new Date().toLocaleString('pt-BR')}.`)}
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'))
    setSaving(false);setModal(false);load()
  }
  const arquivar=async(t)=>{
    if(!canArchive)return alert('Sem permissão para arquivar atividades.')
    if(!t?.id)return
    if(!window.confirm('Arquivar esta atividade? Ela será marcada como concluída.'))return
    const agora=new Date().toISOString()
    const{data,error}=await supabase.from('atividades').update({status:'concluida',concluida_em:t.concluida_em||agora}).eq('id',t.id).eq('escritorio_id',profile.escritorio_id).select().single()
    if(error)return alert(error.message)
    await registrarEvento(data,'arquivamento',`Atividade arquivada por ${profile.nome||profile.email||profile.id} em ${new Date().toLocaleString('pt-BR')}.`)
    load()
  }
  const reabrir=async(t)=>{
    if(!canArchive)return alert('Sem permissão para reabrir atividades.')
    if(!t?.id)return
    const{data,error}=await supabase.from('atividades').update({status:'a_fazer',concluida_em:null}).eq('id',t.id).eq('escritorio_id',profile.escritorio_id).select().single()
    if(error)return alert(error.message)
    await registrarEvento(data,'reabertura',`Atividade reaberta por ${profile.nome||profile.email||profile.id} em ${new Date().toLocaleString('pt-BR')}.`)
    load()
  }
  const del=async(t)=>{
    if(!canDelete)return alert('Visitante possui acesso somente leitura.')
    if(!confirm('Excluir atividade definitivamente?'))return
    await supabase.from('atividades').delete().eq('id',t.id)
    load()
  }

  if(loading)return <div style={{padding:40,color:C.muted}}>Carregando atividades...</div>

  const myRotinas=rotinas.filter(r=>r.usuario_id===profile.id)

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>

      {/* ══════════════════════ STICKY HEADER ══════════════════════ */}
      <div style={{position:'sticky',top:0,zIndex:10,background:C.white,borderBottom:'2px solid '+C.border,padding:'16px 24px 14px'}}>

        {/* Linha 1: título + botão */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Atividades</h1>
          {canCreate&&<button onClick={()=>open()} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',border:'none',borderRadius:8,background:C.navy,color:'white',cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
            <Plus size={14}/>Nova Atividade
          </button>}
        </div>

        {/* Linha 2: busca */}
        <div style={{display:'flex',alignItems:'center',gap:8,background:'#f8fafc',border:'1px solid '+C.border,borderRadius:8,padding:'2px 12px',marginBottom:12}}>
          <Search size={14} color={C.muted}/>
          <input
            value={buscaGeral}
            onChange={e=>setBuscaGeral(e.target.value)}
            placeholder="Buscar em todas as atividades…"
            style={{border:'none',outline:'none',flex:1,padding:'9px 0',fontSize:14,color:C.text,background:'transparent'}}
          />
          {buscaGeral&&<button onClick={()=>setBuscaGeral('')} style={{border:0,background:'none',cursor:'pointer',color:C.muted,display:'flex',padding:2}}><X size={13}/></button>}
        </div>

        {/* Linha 3: Minhas Rotinas (colapsável) */}
        <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,overflow:'hidden'}}>
          <div
            onClick={()=>setRotinaExpanded(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',cursor:'pointer',userSelect:'none'}}
          >
            <RefreshCw size={14} color={C.green}/>
            <b style={{fontSize:13,color:C.green,flex:1}}>Minhas Rotinas</b>
            <span style={{fontSize:12,color:C.muted,marginRight:4}}>{myRotinas.length} procedimento(s)</span>
            {canCreate&&<button
              onClick={e=>{e.stopPropagation();setRotinaForm({id:null,texto:'',recorrencia:'',cor:'#10b981',itens:[]});setRotinaTarget(null);setRotinaModal(true)}}
              style={{border:'1px solid #86efac',background:'white',color:C.green,borderRadius:6,padding:'3px 10px',fontWeight:700,fontSize:12,cursor:'pointer',marginRight:6}}
            >+ Adicionar</button>}
            <ChevronDown size={14} color={C.green} style={{transform:rotinaExpanded?'rotate(180deg)':'none',transition:'transform .2s'}}/>
          </div>

          {rotinaExpanded&&(
            <div style={{padding:'0 14px 14px'}}>
              {myRotinas.length===0&&<p style={{margin:'0 0 8px',fontSize:13,color:C.muted}}>Nenhuma rotina cadastrada. Clique em "+ Adicionar" para começar.</p>}
              <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
                {myRotinas.map(r=>(
                  <div key={r.id} style={{background:'white',border:'2px solid '+(r.cor||C.green),borderRadius:10,padding:'10px 14px',minWidth:180,maxWidth:260,flex:'1 1 180px',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                      <div style={{flex:1}}>
                        <p style={{margin:'0 0 6px',fontSize:13,fontWeight:600,color:C.text,lineHeight:1.4}}>{r.texto}</p>
                        <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,color:'white',background:r.cor||C.green,borderRadius:20,padding:'2px 10px'}}><RefreshCw size={9}/>{r.recorrencia}</span>
                        {(r.itens||[]).length>0&&(
                          <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:4}}>
                            {(r.itens||[]).map(it=>(
                              <div key={it.id} onClick={e=>{e.stopPropagation();toggleItem(r,it.id)}} style={{display:'flex',alignItems:'flex-start',gap:7,cursor:'pointer'}}>
                                <div style={{width:15,height:15,borderRadius:4,border:'2px solid '+(r.cor||C.green),background:it.concluido?(r.cor||C.green):'white',flexShrink:0,marginTop:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                  {it.concluido&&<svg width="9" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                <span style={{fontSize:12,color:it.concluido?'#94a3b8':C.text,textDecoration:it.concluido?'line-through':'none',lineHeight:1.4}}>{it.texto}</span>
                              </div>
                            ))}
                            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{(r.itens||[]).filter(i=>i.concluido).length}/{(r.itens||[]).length} concluídos</div>
                          </div>
                        )}
                      </div>
                      <div style={{display:'flex',gap:4,flexShrink:0}}>
                        {canEdit&&<button onClick={()=>{setRotinaForm({id:r.id,texto:r.texto,recorrencia:r.recorrencia,cor:r.cor||'#10b981',itens:r.itens||[]});setRotinaTarget(r.usuario_id);setRotinaModal(true);setNovoItem('')}} style={{border:0,background:'none',cursor:'pointer',color:C.muted,padding:3,display:'flex'}}><Pencil size={13}/></button>}
                        {canDelete&&<button onClick={()=>deleteRotina(r.id)} style={{border:0,background:'none',cursor:'pointer',color:C.red,padding:3,display:'flex'}}><Trash2 size={13}/></button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {isGerente&&(
                <details style={{marginTop:12}}>
                  <summary style={{fontSize:12,fontWeight:700,color:C.muted,cursor:'pointer',userSelect:'none'}}>Ver rotinas da equipe</summary>
                  <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
                    {Object.entries(
                      rotinas.filter(r=>r.usuario_id!==profile.id).reduce((acc,r)=>{
                        const n=team.find(t=>t.id===r.usuario_id)?.nome||r.usuario_id
                        if(!acc[n])acc[n]=[]
                        acc[n].push(r)
                        return acc
                      },{})
                    ).map(([nome,rs])=>(
                      <div key={nome}>
                        <div style={{fontSize:12,fontWeight:800,color:C.muted,marginBottom:4}}>{nome}</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                          {rs.map(r=>(
                            <div key={r.id} style={{background:'white',border:'1.5px solid '+(r.cor||C.green),borderRadius:8,padding:'8px 12px',fontSize:12,color:C.text,display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                              <span style={{flex:1}}>{r.texto}</span>
                              <span style={{fontSize:10,fontWeight:700,color:'white',background:r.cor||C.green,borderRadius:20,padding:'1px 8px',whiteSpace:'nowrap'}}>{r.recorrencia}</span>
                              {canDelete&&<button onClick={()=>deleteRotina(r.id)} style={{border:0,background:'none',cursor:'pointer',color:C.red,padding:2,display:'flex'}}><Trash2 size={12}/></button>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {rotinas.filter(r=>r.usuario_id!==profile.id).length===0&&<p style={{margin:0,fontSize:12,color:C.muted}}>Nenhum membro da equipe cadastrou rotinas ainda.</p>}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════ CONTEÚDO PRINCIPAL ══════════════════════ */}
      <div style={{padding:'8px 24px 32px'}}>
        {TIPOS.map(([tipo,nome])=>{
          const isExp=!!expandedTipos[tipo]
          const isArq=!!arquivoTipos[tipo]
          const ordem=ordemTipos[tipo]||'recentes'
          const countAtivos=ativos.filter(i=>i.tipo===tipo&&matchBusca(i,buscaGeral)).length
          const countArq=arquivados.filter(i=>i.tipo===tipo).length
          const list=getSortedList(tipo,isArq,ordem)

          return(
            <section key={tipo} style={{marginTop:18}}>

              {/* Cabeçalho da seção — sempre visível */}
              <div
                onClick={()=>setExpandedTipos(p=>({...p,[tipo]:!p[tipo]}))}
                style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 0',borderBottom:'2px solid '+C.border,cursor:'pointer',userSelect:'none'}}
              >
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <h2 style={{margin:0,fontSize:16,fontWeight:800,color:C.text}}>{nome}</h2>
                  {countAtivos>0&&(
                    <span style={{fontSize:11,fontWeight:900,background:C.blueBg,color:C.blue,borderRadius:999,padding:'2px 9px'}}>{countAtivos}</span>
                  )}
                  {buscaGeral&&countAtivos===0&&(
                    <span style={{fontSize:11,color:C.muted}}>0 resultados</span>
                  )}
                  {countArq>0&&!buscaGeral&&(
                    <span style={{fontSize:11,color:C.muted,opacity:0.7}}>{countArq} arquivada(s)</span>
                  )}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,color:C.muted}}>
                  <span style={{fontSize:12}}>{isExp?'Recolher':'Expandir'}</span>
                  <ChevronDown size={15} style={{transform:isExp?'rotate(180deg)':'none',transition:'transform .2s'}}/>
                </div>
              </div>

              {/* Conteúdo expandido */}
              {isExp&&(
                <div style={{marginTop:14}}>

                  {/* Controles: Ativos/Arquivo + Ordenação */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
                    <div style={{display:'flex',gap:6}}>
                      <button
                        onClick={()=>setArquivoTipos(p=>({...p,[tipo]:false}))}
                        style={{border:'1px solid '+C.border,borderRadius:7,padding:'6px 14px',background:!isArq?C.navy:C.white,color:!isArq?'white':C.text,fontWeight:700,fontSize:12,cursor:'pointer',transition:'all .12s'}}
                      >Ativos ({ativos.filter(i=>i.tipo===tipo).length})</button>
                      <button
                        onClick={()=>setArquivoTipos(p=>({...p,[tipo]:true}))}
                        style={{border:'1px solid '+C.border,borderRadius:7,padding:'6px 14px',background:isArq?C.navy:C.white,color:isArq?'white':C.text,fontWeight:700,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:5,transition:'all .12s'}}
                      ><Archive size={12}/>Arquivo ({countArq})</button>
                    </div>
                    <select
                      value={ordem}
                      onChange={e=>setOrdemTipos(p=>({...p,[tipo]:e.target.value}))}
                      style={{border:'1px solid '+C.border,borderRadius:7,padding:'6px 10px',fontSize:12,background:C.white,color:C.text,cursor:'pointer',fontFamily:'inherit'}}
                    >
                      <option value="recentes">Mais recentes</option>
                      <option value="antigas">Mais antigas</option>
                      <option value="data_asc">Por data do evento ↑</option>
                      <option value="data_desc">Por data do evento ↓</option>
                    </select>
                  </div>

                  {/* Calendário de audiências */}
                  {tipo==='audiencia'&&!isArq&&list.filter(a=>a.prazo).length>0&&(
                    <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:14,marginBottom:14}}>
                      <h3 style={{marginTop:0,marginBottom:10,display:'flex',gap:8,alignItems:'center',fontSize:14,fontWeight:700}}><CalendarDays size={15}/>Calendário de audiências</h3>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8}}>
                        {list.filter(a=>a.prazo).slice().sort((a,b)=>String(a.prazo||'').localeCompare(String(b.prazo||''))).map(a=>(
                          <div key={a.id} style={{border:'1px solid '+C.border,borderRadius:10,padding:'10px 12px',cursor:'pointer'}} onClick={()=>open(a)}>
                            <b style={{fontSize:12,color:C.text}}>{dateBR(a.prazo)}</b>
                            <div style={{fontSize:11,color:C.muted,marginTop:3}}>{a.horario||'—'} · {a.titulo}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grid de cards */}
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                    {list.length
                      ?list.map(t=><AtividadeCard key={t.id} t={t} team={team} cont={cont} onOpen={open}/>)
                      :<div style={{padding:22,color:C.muted,border:'1px dashed '+C.border,borderRadius:12,gridColumn:'1/-1',textAlign:'center',fontSize:13}}>
                        {isArq?'Nenhum registro arquivado neste tipo.':'Sem registros ativos.'}
                      </div>
                    }
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {/* ══════════════════════ MODAL DE ATIVIDADE ══════════════════════ */}
      {modal&&(
        <Modal title={form.id?'Atividade':'Nova atividade'} onClose={()=>setModal(false)}>
          {/* Abas */}
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',borderBottom:'1px solid '+C.border,paddingBottom:12}}>
            {['dados','historico','documentos'].map(t=>(
              <button
                key={t}
                onClick={()=>setTab(t)}
                disabled={!form.id&&t!=='dados'}
                style={{border:'1px solid '+C.border,borderRadius:20,padding:'6px 14px',background:tab===t?C.navy:C.white,color:tab===t?'white':(!form.id&&t!=='dados'?C.muted:C.text),cursor:!form.id&&t!=='dados'?'default':'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:5}}
              >
                {t==='documentos'&&<Paperclip size={12}/>}
                {t==='historico'&&'🕓 '}
                {t==='dados'?'Dados':t==='historico'?'Histórico':'Documentos'}
              </button>
            ))}
          </div>

          {/* Tab: Dados */}
          {tab==='dados'&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
                <F label="Tipo"><select style={INP} value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,processo_id:'',contrato_id:''})}>{TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
                <F label="Status"><select style={INP} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
              </div>
              {form.tipo==='audiencia'&&(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
                  <F label="Modalidade da audiência"><select style={INP} value={form.audiencia_modalidade||'presencial'} onChange={e=>setForm({...form,audiencia_modalidade:e.target.value})}>{AUDIENCIA_MODALIDADES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
                  <F label="Tipo de audiência"><select style={INP} value={form.audiencia_tipo||'inicial'} onChange={e=>setForm({...form,audiencia_tipo:e.target.value})}>{AUDIENCIA_TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
                </div>
              )}
              <F label="Título"><input style={INP} value={form.titulo||''} onChange={e=>setForm({...form,titulo:e.target.value})}/></F>
              <F label="Descrição"><textarea style={{...INP,minHeight:80,resize:'vertical',fontFamily:'inherit'}} value={form.descricao||''} onChange={e=>setForm({...form,descricao:e.target.value})}/></F>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
                <F label="Prioridade"><select style={INP} value={form.prioridade} onChange={e=>setForm({...form,prioridade:e.target.value})}>{PRIOR.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
                <F label="Responsável"><select style={INP} value={form.responsavel_id||''} onChange={e=>setForm({...form,responsavel_id:e.target.value||null})}><option value="">Sem responsável</option>{team.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></F>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
                <F label="Data / prazo"><input type="date" style={INP} value={form.prazo||''} onChange={e=>setForm({...form,prazo:e.target.value})}/></F>
                <F label="Horário"><input type="time" style={INP} value={form.horario||''} onChange={e=>setForm({...form,horario:e.target.value})}/></F>
              </div>
              <F label="Local / link"><input style={INP} value={form.local||''} onChange={e=>setForm({...form,local:e.target.value})}/></F>
              <F label="Processo vinculado"><select style={INP} value={form.processo_id||''} onChange={e=>setForm({...form,processo_id:e.target.value,contrato_id:''})}><option value="">Sem processo</option>{proc.map(p=><option key={p.id} value={p.id}>{p.titulo} — {p.numero}</option>)}</select></F>
              {!['prazo_processual','audiencia'].includes(form.tipo)&&<F label="Contrato vinculado"><select style={INP} value={form.contrato_id||''} onChange={e=>setForm({...form,contrato_id:e.target.value,processo_id:''})}><option value="">Sem contrato</option>{cont.map(c=><option key={c.id} value={c.id}>{c.titulo}</option>)}</select></F>}

              {/* Rodapé do modal: ações + salvar */}
              <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:18,paddingTop:14,borderTop:'1px solid '+C.border,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {form.id&&canArchive&&!isArquivada(form)&&(
                    <button type="button" onClick={()=>{setModal(false);arquivar(form)}} style={{display:'flex',alignItems:'center',gap:6,border:'1px solid #bbf7d0',background:'#f0fdf4',borderRadius:8,padding:'8px 14px',fontWeight:700,cursor:'pointer',color:C.green,fontSize:13}}>
                      <Archive size={14}/>Arquivar
                    </button>
                  )}
                  {form.id&&canArchive&&isArquivada(form)&&(
                    <button type="button" onClick={()=>{setModal(false);reabrir(form)}} style={{display:'flex',alignItems:'center',gap:6,border:'1px solid #fef3c7',background:'#fffbeb',borderRadius:8,padding:'8px 14px',fontWeight:700,cursor:'pointer',color:C.amber,fontSize:13}}>
                      <RotateCcw size={14}/>Reabrir
                    </button>
                  )}
                  {form.id&&canDelete&&(
                    <button type="button" onClick={()=>{setModal(false);del(form)}} style={{display:'flex',alignItems:'center',gap:6,border:'1px solid #fca5a5',background:'#fee2e2',borderRadius:8,padding:'8px 14px',fontWeight:700,cursor:'pointer',color:C.red,fontSize:13}}>
                      <Trash2 size={14}/>Excluir
                    </button>
                  )}
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={()=>setModal(false)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px',cursor:'pointer',fontWeight:700}}>Cancelar</button>
                  <button onClick={save} disabled={saving} style={{background:saving?C.muted:C.navy,color:'white',border:0,borderRadius:8,padding:'10px 16px',fontWeight:800,cursor:saving?'default':'pointer'}}>
                    {saving?'Salvando…':'Salvar'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Tab: Histórico */}
          {tab==='historico'&&(
            <>
              <b style={{display:'block',marginBottom:12,fontSize:14}}>{form.titulo}</b>
              {history.length===0&&<div style={{color:C.muted,padding:'20px 0',textAlign:'center'}}>Nenhum registro de histórico encontrado.</div>}
              {history.map(h=>(
                <div key={h.id} style={{border:'1px solid '+C.border,borderRadius:10,padding:'12px 14px',marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.text}}>
                    <b>{movimentoLabel(h)}</b>
                    {h.usuario_anterior_id&&<span style={{color:C.muted}}> · De <b>{team.find(x=>x.id===h.usuario_anterior_id)?.nome||'—'}</b> para <b>{team.find(x=>x.id===h.usuario_novo_id)?.nome||'—'}</b></span>}
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:5}}>
                    Por {team.find(x=>x.id===h.atribuido_por)?.nome||'—'} · {new Date(h.created_at).toLocaleString('pt-BR')}
                    {h.motivo?` · Motivo: ${h.motivo}`:h.observacao?` · ${h.observacao}`:''}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Tab: Documentos */}
          {tab==='documentos'&&form.id&&(
            <DocumentosVinculados profile={profile} atividadeId={form.id} title="Documentos da atividade"/>
          )}
        </Modal>
      )}

      {/* ══════════════════════ MODAL DE ROTINA ══════════════════════ */}
      {rotinaModal&&(
        <Modal title={rotinaForm.id?'Editar rotina':'Nova rotina'} onClose={()=>setRotinaModal(false)} width={480}>
          <div style={{display:'grid',gap:14}}>
            {isGerente&&!rotinaForm.id&&(
              <div>
                <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Para quem</label>
                <select value={rotinaTarget||profile.id} onChange={e=>setRotinaTarget(e.target.value===profile.id?null:e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:14,color:C.text}}>
                  <option value={profile.id}>Eu mesmo</option>
                  {team.filter(t=>t.id!==profile.id).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Descrição da rotina</label>
              <textarea value={rotinaForm.texto} onChange={e=>setRotinaForm(f=>({...f,texto:e.target.value}))} placeholder="Ex: Enviar relatório de processos para a gestão" style={{width:'100%',minHeight:80,padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:14,resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Recorrência</label>
              <input value={rotinaForm.recorrencia} onChange={e=>setRotinaForm(f=>({...f,recorrencia:e.target.value}))} placeholder="Ex: Toda segunda-feira, Todo dia 5, Quinzenal…" style={{width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:14,boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:8}}>Lista de tarefas</label>
              <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
                {(rotinaForm.itens||[]).map(it=>(
                  <div key={it.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'#f8fafc',borderRadius:7,border:'1px solid '+C.border}}>
                    <span style={{flex:1,fontSize:13,color:C.text}}>{it.texto}</span>
                    <button onClick={()=>removeItem(it.id)} style={{border:0,background:'none',cursor:'pointer',color:C.red,padding:2,display:'flex'}}><Trash2 size={13}/></button>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <input value={novoItem} onChange={e=>setNovoItem(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addItem()}}} placeholder="Novo item… (Enter para adicionar)" style={{flex:1,padding:'8px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:13,boxSizing:'border-box'}}/>
                <button onClick={addItem} disabled={!novoItem.trim()} style={{border:0,background:novoItem.trim()?C.navy:'#e2e8f0',color:novoItem.trim()?'white':C.muted,borderRadius:8,padding:'8px 14px',fontWeight:700,fontSize:13,cursor:novoItem.trim()?'pointer':'default'}}>+ Add</button>
              </div>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:8}}>Cor do card</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {['#10b981','#1d4ed8','#b45309','#7c3aed','#dc2626','#0f766e','#334155'].map(cor=>(
                  <button key={cor} onClick={()=>setRotinaForm(f=>({...f,cor}))} style={{width:28,height:28,borderRadius:'50%',background:cor,border:rotinaForm.cor===cor?'3px solid '+C.text:'2px solid transparent',cursor:'pointer',transition:'border .1s'}}/>
                ))}
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
              <button onClick={()=>setRotinaModal(false)} style={{border:'1px solid '+C.border,background:'white',borderRadius:8,padding:'10px 16px',cursor:'pointer',fontWeight:700}}>Cancelar</button>
              <button onClick={saveRotina} disabled={rotinasSaving||!rotinaForm.texto.trim()||!rotinaForm.recorrencia.trim()} style={{background:rotinasSaving||!rotinaForm.texto.trim()||!rotinaForm.recorrencia.trim()?C.muted:'#10b981',color:'white',border:0,borderRadius:8,padding:'10px 16px',fontWeight:800,cursor:'pointer'}}>
                {rotinasSaving?'Salvando…':rotinaForm.id?'Salvar alterações':'Adicionar rotina'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
