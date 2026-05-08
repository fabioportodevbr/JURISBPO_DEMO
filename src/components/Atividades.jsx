import { useEffect, useMemo, useState } from 'react'
import { supabase, can, fetchAllRows } from '../lib/supabase.js'
import { Plus, RefreshCw, Pencil, Edit2, Trash2, X, CalendarDays, History, Paperclip, ArrowRight, Archive, RotateCcw } from 'lucide-react'
import DocumentosVinculados from './DocumentoVinculados.jsx'

const C={navy:'#022c22',white:'#fff',text:'#0f172a',muted:'#64748b',border:'#e5e7eb',blue:'#1d4ed8',blueBg:'#dbeafe',red:'#dc2626',redBg:'#fee2e2',green:'#16a34a',greenBg:'#dcfce7',amber:'#b45309',amberBg:'#fef3c7',purple:'#10b981',purpleBg:'#dcfce7',grayBg:'#f1f5f9'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const TIPOS=[['tarefa','Tarefas'],['prazo_processual','Prazos processuais'],['audiencia','Audiências'],['reuniao','Reuniões']]
const STATUS=[['a_fazer','A fazer'],['em_andamento','Em andamento'],['concluida','Concluída'],['cancelada','Cancelada']]
const PRIOR=[['baixa','Baixa'],['media','Média'],['alta','Alta'],['urgente','Urgente']]
const AUDIENCIA_MODALIDADES=[['presencial','Presencial'],['online','Online']]
const AUDIENCIA_TIPOS=[['inicial','Inicial'],['instrucao','Instrução'],['una','Una'],['conciliacao','Conciliação']]
const typeKind={tarefa:'blue',prazo_processual:'red',audiencia:'purple',reuniao:'green'}
function label(arr,v){return arr.find(x=>x[0]===v)?.[1]||v||'—'}
function dateBR(d){return d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—'}
function F({label,children}){return <div style={{marginBottom:12,flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>{children}</div>}
function Modal({title,onClose,children,width=820}){return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:width,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}><div style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border}}><b>{title}</b><button onClick={onClose} style={{border:0,background:'none',cursor:'pointer'}}><X/></button></div><div style={{padding:18,overflow:'auto'}}>{children}</div></div></div>}
function Chip({children,kind='blue'}){const m={blue:[C.blueBg,C.blue],red:[C.redBg,C.red],green:[C.greenBg,C.green],amber:[C.amberBg,C.amber],purple:[C.purpleBg,C.purple],gray:[C.grayBg,C.muted]};const [bg,color]=m[kind]||m.gray;return <span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,background:bg,color,textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>}
const movimentoLabel=(h)=>h.tipo_evento==='devolucao'?'Devolução':h.tipo_evento==='aceite'?'Aceite':h.tipo_evento==='arquivamento'?'Arquivamento':h.tipo_evento==='conclusao_arquivamento'?'Conclusão e arquivamento':h.tipo_evento==='reabertura'?'Reabertura':'Redistribuição'
function isArquivada(a){return a.status==='concluida'}
function arquivoTitulo(tipo){return `Arquivo de ${label(TIPOS,tipo).toLowerCase()}`}

export default function Atividades({profile}){
  const [items,setItems]=useState([]),[team,setTeam]=useState([]),[proc,setProc]=useState([]),[cont,setCont]=useState([]),[modal,setModal]=useState(false),[tab,setTab]=useState('dados'),[form,setForm]=useState({}),[loading,setLoading]=useState(true),[tipoView,setTipoView]=useState(null),[arquivoView,setArquivoView]=useState(false),[historyFor,setHistoryFor]=useState(null),[history,setHistory]=useState([]),[saving,setSaving]=useState(false),[ordemView,setOrdemView]=useState('recentes')
  const [rotinas,setRotinas]=useState([])
  const [rotinaModal,setRotinaModal]=useState(false)
  const [rotinaForm,setRotinaForm]=useState({id:null,texto:'',recorrencia:'',cor:'#10b981',itens:[]})
  const [rotinaTarget,setRotinaTarget]=useState(null) // userId when gerente creates for someone
  const [rotinasSaving,setRotinasSaving]=useState(false)
  const [novoItem,setNovoItem]=useState('')
  const isGerente=profile?.role==='gerente'
  const canCreate = can(profile, 'atividades.criar')
  const canEdit = can(profile, 'atividades.editar')
  const canDelete = can(profile, 'atividades.excluir')
  const canArchive = can(profile, 'atividades.criar') || canEdit
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
    if(rotinaForm.id){
      await supabase.from('rotinas').update({texto:rotinaForm.texto.trim(),recorrencia:rotinaForm.recorrencia.trim(),cor:rotinaForm.cor,itens:rotinaForm.itens||[],atualizado_em:new Date().toISOString()}).eq('id',rotinaForm.id)
    }else{
      await supabase.from('rotinas').insert({escritorio_id:profile.escritorio_id,usuario_id:uid,texto:rotinaForm.texto.trim(),recorrencia:rotinaForm.recorrencia.trim(),cor:rotinaForm.cor,itens:rotinaForm.itens||[]})
    }
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
  const addItem=()=>{
    const txt=novoItem.trim()
    if(!txt)return
    const item={id:crypto.randomUUID(),texto:txt,concluido:false}
    setRotinaForm(f=>({...f,itens:[...(f.itens||[]),item]}))
    setNovoItem('')
  }
  const removeItem=(itemId)=>{
    setRotinaForm(f=>({...f,itens:(f.itens||[]).filter(it=>it.id!==itemId)}))
  }
  const load=async()=>{
    const eid=profile.escritorio_id

    let atividades=[]

    if(profile.role==='gerente'){
      atividades=await fetchAllRows(()=>supabase
        .from('atividades')
        .select('*, processos(id,numero,titulo,tribunal)')
        .eq('escritorio_id',eid)
        .order('created_at',{ascending:false}))
    }else{
      const [privadas, compartilhadas]=await Promise.all([
        fetchAllRows(()=>supabase
          .from('atividades')
          .select('*, processos(id,numero,titulo,tribunal)')
          .eq('escritorio_id',eid)
          .in('tipo',['tarefa','prazo_processual'])
          .eq('responsavel_id',profile.id)
          .order('created_at',{ascending:false})),
        fetchAllRows(()=>supabase
          .from('atividades')
          .select('*, processos(id,numero,titulo,tribunal)')
          .eq('escritorio_id',eid)
          .in('tipo',['audiencia','reuniao'])
          .order('created_at',{ascending:false}))
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
  useEffect(()=>{load();loadRotinas()},[profile.escritorio_id,profile.id,profile.role])
  const ativos=useMemo(()=>items.filter(i=>!isArquivada(i)&&i.status!=='cancelada'),[items])
  const arquivados=useMemo(()=>items.filter(isArquivada),[items])
  const grouped=useMemo(()=>Object.fromEntries(TIPOS.map(([t])=>[t,ativos.filter(i=>i.tipo===t).slice(0,3)])),[ativos])
  const archiveCounts=useMemo(()=>Object.fromEntries(TIPOS.map(([t])=>[t,arquivados.filter(i=>i.tipo===t).length])),[arquivados])
  const currentList=useMemo(()=>{if(!tipoView)return[];const base=(arquivoView?arquivados:ativos).filter(i=>i.tipo===tipoView);return base.slice().sort((a,b)=>{if(ordemView==='antigas')return String(a.created_at||'').localeCompare(String(b.created_at||''));if(ordemView==='data_asc')return String(a.prazo||'9').localeCompare(String(b.prazo||'9'));if(ordemView==='data_desc')return String(b.prazo||'').localeCompare(String(a.prazo||''));return String(b.created_at||'').localeCompare(String(a.created_at||''))})},[tipoView,arquivoView,arquivados,ativos,ordemView])
  const openTipo=(tipo,arquivo=false)=>{setTipoView(tipo);setArquivoView(arquivo);setOrdemView('recentes')}
  const open=(t=null,tipo='tarefa')=>{if(!t&&!canCreate)return alert('Visitante possui acesso somente leitura.');if(t&&!canEdit)return showHistory(t);setForm(t?{...t,audiencia_modalidade:t.audiencia_modalidade||'presencial',audiencia_tipo:t.audiencia_tipo||'inicial'}:{tipo,status:'a_fazer',titulo:'',descricao:'',prioridade:'media',responsavel_id:profile.id,prazo:'',horario:'',local:'',processo_id:'',contrato_id:'',audiencia_modalidade:'presencial',audiencia_tipo:'inicial'});setTab('dados');setModal(true)}
  const registrarEvento=async(atividade,tipoEvento,observacao='',extra={})=>{
    if(!atividade?.id)return
    const base={
      atividade_id:atividade.id,
      usuario_anterior_id:extra.usuario_anterior_id||atividade.responsavel_id||null,
      usuario_novo_id:extra.usuario_novo_id||atividade.responsavel_id||null,
      atribuido_por:profile.id,
      observacao
    }
    const completo={...base,escritorio_id:profile.escritorio_id,tipo_evento:tipoEvento,motivo:extra.motivo||null}
    const {error}=await supabase.from('atividade_atribuicoes').insert(completo)
    if(error){
      const fallback=await supabase.from('atividade_atribuicoes').insert(base)
      if(fallback.error)console.error('Erro ao registrar histórico da atividade:', fallback.error)
    }
  }
  const save=async()=>{if(form.id&&!canEdit)return alert('Visitante possui acesso somente leitura.');if(!form.id&&!canCreate)return alert('Visitante possui acesso somente leitura.');if(!form.titulo)return alert('Informe o título.');if(['prazo_processual','audiencia'].includes(form.tipo)&&!form.processo_id)return alert('Prazos processuais e audiências devem ser vinculados a um processo.');setSaving(true);const antigo=items.find(x=>x.id===form.id);const { processos, contratos, profiles, ...cleanForm } = form;
    const vaiArquivar=cleanForm.status==='concluida'&&antigo?.status!=='concluida'
    const payload={...cleanForm,escritorio_id:profile.escritorio_id,responsavel_id:form.responsavel_id||null,processo_id:form.processo_id||null,contrato_id:form.contrato_id||null,prazo:form.prazo||null,horario:form.horario||null,criado_por:form.criado_por||profile.id,concluida_em:cleanForm.status==='concluida'?(form.concluida_em||new Date().toISOString()):null};let r;if(form.id)r=await supabase.from('atividades').update(payload).eq('id',form.id).select().single();else r=await supabase.from('atividades').insert(payload).select().single();if(r.error){setSaving(false);return alert(r.error.message)}
    const mudou=!antigo || antigo.responsavel_id!==payload.responsavel_id
    if(mudou&&payload.responsavel_id){await registrarEvento(r.data,antigo?'redistribuicao':'atribuicao',antigo?'Atividade redistribuída':'Atividade criada/atribuída',{usuario_anterior_id:antigo?.responsavel_id||null,usuario_novo_id:payload.responsavel_id}); if(payload.responsavel_id!==profile.id){await supabase.from('notificacoes').insert({escritorio_id:profile.escritorio_id,usuario_id:payload.responsavel_id,tipo:antigo?'atividade_redistribuida':'nova_atividade',titulo:antigo?'Atividade redistribuída para você':'Nova atividade atribuída a você',descricao:`${r.data.titulo} — por ${profile.nome || 'Usuário'} em ${new Date().toLocaleString('pt-BR')}`,origem_tipo:'atividade',origem_id:String(r.data.id)})}}
    if(vaiArquivar){await registrarEvento(r.data,'conclusao_arquivamento',`Status alterado para concluída e atividade enviada ao arquivo por ${profile.nome||profile.email||profile.id} em ${new Date().toLocaleString('pt-BR')}.`)}
    window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'));setSaving(false);setModal(false);load()}
  const arquivar=async(t)=>{if(!canArchive)return alert('Sem permissão para arquivar atividades.');if(!t?.id)return;const ok=window.confirm('Arquivar esta atividade? Ela será marcada como concluída e movida para o arquivo do tipo correspondente.');if(!ok)return;const agora=new Date().toISOString();const {data,error}=await supabase.from('atividades').update({status:'concluida',concluida_em:t.concluida_em||agora}).eq('id',t.id).eq('escritorio_id',profile.escritorio_id).select().single();if(error)return alert(error.message);await registrarEvento(data,'arquivamento',`Atividade arquivada por ${profile.nome||profile.email||profile.id} em ${new Date().toLocaleString('pt-BR')}.`);load()}
  const reabrir=async(t)=>{if(!canArchive)return alert('Sem permissão para reabrir atividades.');if(!t?.id)return;const {data,error}=await supabase.from('atividades').update({status:'a_fazer',concluida_em:null}).eq('id',t.id).eq('escritorio_id',profile.escritorio_id).select().single();if(error)return alert(error.message);await registrarEvento(data,'reabertura',`Atividade reaberta por ${profile.nome||profile.email||profile.id} em ${new Date().toLocaleString('pt-BR')}.`);load()}
  const del=async(t)=>{if(!canDelete)return alert('Visitante possui acesso somente leitura.');if(confirm('Excluir atividade?')){await supabase.from('atividades').delete().eq('id',t.id);load()}}
  const showHistory=async(t)=>{const {data}=await supabase.from('atividade_atribuicoes').select('*').eq('atividade_id',t.id).order('created_at',{ascending:false});setHistory(data||[]);setHistoryFor(t)}
  const renderCard=(t)=><div key={t.id} style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:14}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><div><Chip kind={typeKind[t.tipo]}>{label(TIPOS,t.tipo)}</Chip><b style={{display:'block',marginTop:8,lineHeight:1.3}}>{t.titulo}</b></div><div style={{display:'flex',gap:2}}><button onClick={()=>showHistory(t)} title="Histórico" style={{border:0,background:'none',color:C.muted,cursor:'pointer'}}><History size={14}/></button>{canArchive&&!isArquivada(t)&&<button onClick={()=>arquivar(t)} title="Arquivar" style={{border:0,background:'none',color:C.green,cursor:'pointer'}}><Archive size={14}/></button>}{canArchive&&isArquivada(t)&&<button onClick={()=>reabrir(t)} title="Reabrir" style={{border:0,background:'none',color:C.amber,cursor:'pointer'}}><RotateCcw size={14}/></button>}{canEdit&&!isArquivada(t)&&<button onClick={()=>open(t)} style={{border:0,background:'none',color:C.blue,cursor:'pointer'}}><Edit2 size={14}/></button>}{canDelete&&!isArquivada(t)&&<button onClick={()=>del(t)} style={{border:0,background:'none',color:C.red,cursor:'pointer'}}><Trash2 size={14}/></button>}</div></div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}><Chip kind={t.prioridade==='urgente'?'red':t.prioridade==='alta'?'amber':'gray'}>{label(PRIOR,t.prioridade)}</Chip>{t.prazo&&<Chip kind="amber">{dateBR(t.prazo)}</Chip>}{t.horario&&<Chip kind="purple">{t.horario}</Chip>}{isArquivada(t)&&<Chip kind="green">Arquivada</Chip>}{['audiencia','reuniao'].includes(t.tipo)&&<Chip kind="green">Compartilhada</Chip>}{['tarefa','prazo_processual'].includes(t.tipo)&&<Chip kind="gray">Individual</Chip>}{t.tipo==='audiencia'&&t.audiencia_modalidade&&<Chip kind="green">{label(AUDIENCIA_MODALIDADES,t.audiencia_modalidade)}</Chip>}{t.tipo==='audiencia'&&t.audiencia_tipo&&<Chip kind="purple">{label(AUDIENCIA_TIPOS,t.audiencia_tipo)}</Chip>}</div>{t.descricao&&<p style={{fontSize:12,color:C.muted,margin:'8px 0 0'}}>{t.descricao}</p>}<div style={{fontSize:12,color:C.muted,marginTop:8}}>Responsável: {team.find(x=>x.id===t.responsavel_id)?.nome||'—'}</div>{t.processos&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>Processo: {t.processos.numero || t.processos.titulo}</div>}{t.contrato_id&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>Contrato: {(cont.find(c=>c.id===t.contrato_id)?.numero || cont.find(c=>c.id===t.contrato_id)?.titulo) || 'Contrato vinculado'}</div>}{isArquivada(t)&&<div style={{fontSize:11,color:C.green,marginTop:6,fontWeight:800}}>Arquivada/concluída em {t.concluida_em?new Date(t.concluida_em).toLocaleString('pt-BR'):'data não registrada'}</div>}</div>
  if(loading)return <div style={{padding:40,color:C.muted}}>Carregando atividades...</div>
  return <div style={{padding:24}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',alignItems:'flex-start'}}><div><h1 style={{margin:0,fontSize:22}}>Atividades</h1><p style={{color:C.muted}}>Tarefas e prazos são individuais. Audiências e reuniões são compartilhadas com a equipe.</p></div>{canCreate&&<button onClick={()=>open()} style={{display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit'}}><Plus size={14}/>Nova Atividade</button>}</div>
{/* ── Minhas Rotinas ── */}
    <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:'14px 18px',marginBottom:4}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <RefreshCw size={15} color={C.green}/>
          <b style={{fontSize:14,color:C.green}}>Minhas Rotinas</b>
          <span style={{fontSize:12,color:C.muted}}>{rotinas.filter(r=>r.usuario_id===profile.id).length} procedimento(s) recorrente(s)</span>
        </div>
        {canCreate&&<button onClick={()=>{setRotinaForm({id:null,texto:'',recorrencia:'',cor:'#10b981'});setRotinaTarget(null);setRotinaModal(true)}} style={{display:'flex',alignItems:'center',gap:6,border:'1px solid #86efac',background:'white',color:C.green,borderRadius:8,padding:'6px 12px',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Adicionar</button>}
      </div>
      {rotinas.filter(r=>r.usuario_id===profile.id).length===0&&<p style={{margin:0,fontSize:13,color:C.muted}}>Nenhuma rotina cadastrada ainda. Clique em "+ Adicionar" para registrar seus procedimentos recorrentes.</p>}
      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
        {rotinas.filter(r=>r.usuario_id===profile.id).map(r=><div key={r.id} style={{background:'white',border:'2px solid '+(r.cor||C.green),borderRadius:10,padding:'10px 14px',minWidth:200,maxWidth:280,flex:'1 1 200px',position:'relative',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
            <div style={{flex:1}}>
              <p style={{margin:'0 0 6px',fontSize:13,fontWeight:600,color:C.text,lineHeight:1.4}}>{r.texto}</p>
              <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,color:'white',background:r.cor||C.green,borderRadius:20,padding:'2px 10px'}}><RefreshCw size={9}/>{r.recorrencia}</span>
              {(r.itens||[]).length>0&&<div style={{marginTop:10,display:'flex',flexDirection:'column',gap:5}}>
                {(r.itens||[]).map(it=><div key={it.id} onClick={e=>{e.stopPropagation();toggleItem(r,it.id)}} style={{display:'flex',alignItems:'flex-start',gap:7,cursor:'pointer'}}>
                  <div style={{width:16,height:16,borderRadius:4,border:'2px solid '+(r.cor||C.green),background:it.concluido?(r.cor||C.green):'white',flexShrink:0,marginTop:1,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
                    {it.concluido&&<svg width="9" height="9" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{fontSize:12,color:it.concluido?'#94a3b8':C.text,textDecoration:it.concluido?'line-through':'none',lineHeight:1.4,flex:1}}>{it.texto}</span>
                </div>)}
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{(r.itens||[]).filter(i=>i.concluido).length}/{(r.itens||[]).length} concluídos</div>
              </div>}
            </div>
            <div style={{display:'flex',gap:4,flexShrink:0}}>
              {canEdit&&<button onClick={()=>{setRotinaForm({id:r.id,texto:r.texto,recorrencia:r.recorrencia,cor:r.cor||'#10b981',itens:r.itens||[]});setRotinaTarget(r.usuario_id);setRotinaModal(true);setNovoItem('')}} style={{border:0,background:'none',cursor:'pointer',color:C.muted,padding:3,display:'flex'}}><Pencil size={13}/></button>}
              {canDelete&&<button onClick={()=>deleteRotina(r.id)} style={{border:0,background:'none',cursor:'pointer',color:'#dc2626',padding:3,display:'flex'}}><Trash2 size={13}/></button>}
            </div>
          </div>
        </div>)}
      </div>
      {isGerente&&<details style={{marginTop:12}}><summary style={{fontSize:12,fontWeight:700,color:C.muted,cursor:'pointer',userSelect:'none'}}>Ver rotinas da equipe</summary>
        <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>{Object.entries(rotinas.filter(r=>r.usuario_id!==profile.id).reduce((acc,r)=>{const n=(team||[]).find(t=>t.id===r.usuario_id)?.nome||r.usuario_id;if(!acc[n])acc[n]=[];acc[n].push(r);return acc},{})).map(([nome,rs])=><div key={nome}><div style={{fontSize:12,fontWeight:800,color:C.muted,marginBottom:4}}>{nome}</div><div style={{display:'flex',flexWrap:'wrap',gap:8}}>{rs.map(r=><div key={r.id} style={{background:'white',border:'1.5px solid '+(r.cor||C.green),borderRadius:8,padding:'8px 12px',fontSize:12,color:C.text,display:'flex',alignItems:'center',gap:8,flexShrink:0}}><span style={{flex:1}}>{r.texto}</span><span style={{fontSize:10,fontWeight:700,color:'white',background:r.cor||C.green,borderRadius:20,padding:'1px 8px',whiteSpace:'nowrap'}}>{r.recorrencia}</span>{canDelete&&<button onClick={()=>deleteRotina(r.id)} style={{border:0,background:'none',cursor:'pointer',color:'#dc2626',padding:2,display:'flex'}}><Trash2 size={12}/></button>}</div>)}</div></div>)}{rotinas.filter(r=>r.usuario_id!==profile.id).length===0&&<p style={{margin:0,fontSize:12,color:C.muted}}>Nenhum membro da equipe cadastrou rotinas ainda.</p>}</div>
      </details>}
    </div>
    {/* ── Botão para gerente criar rotina para outro membro ── */}
    {rotinaModal&&<Modal title={rotinaForm.id?'Editar rotina':'Nova rotina'} onClose={()=>setRotinaModal(false)} width={480}>
      <div style={{display:'grid',gap:14}}>
        {isGerente&&!rotinaForm.id&&<div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Para quem</label>
          <select value={rotinaTarget||profile.id} onChange={e=>setRotinaTarget(e.target.value=== profile.id?null:e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:14,color:C.text}}>
            <option value={profile.id}>Eu mesmo</option>
            {team.filter(t=>t.id!==profile.id).map(t=><option key={t.id} value={t.id}>{t.nome||t.email}</option>)}
          </select>
        </div>}
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Descrição da rotina</label>
          <textarea value={rotinaForm.texto} onChange={e=>setRotinaForm(f=>({...f,texto:e.target.value}))} placeholder="Ex: Enviar relatório de processos para a gestão" style={{width:'100%',minHeight:80,padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:14,resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>Recorrência</label>
          <input value={rotinaForm.recorrencia} onChange={e=>setRotinaForm(f=>({...f,recorrencia:e.target.value}))} placeholder="Ex: Toda segunda-feira, Todo dia 5, Quinzenal..." style={{width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:14,boxSizing:'border-box'}}/>
          <p style={{margin:'6px 0 0',fontSize:11,color:C.muted}}>Escreva como preferir: "Todo dia útil", "Toda segunda e quarta", "Todo dia 1º", etc.</p>
        </div>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:8}}>Lista de tarefas</label>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:8}}>
            {(rotinaForm.itens||[]).map(it=><div key={it.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'#f8fafc',borderRadius:7,border:'1px solid '+C.border}}>
              <span style={{flex:1,fontSize:13,color:C.text}}>{it.texto}</span>
              <button onClick={()=>removeItem(it.id)} style={{border:0,background:'none',cursor:'pointer',color:'#dc2626',padding:2,display:'flex',flexShrink:0}}><Trash2 size={13}/></button>
            </div>)}
          </div>
          <div style={{display:'flex',gap:8}}>
            <input value={novoItem} onChange={e=>setNovoItem(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addItem()}}} placeholder="Novo item... (Enter para adicionar)" style={{flex:1,padding:'8px 12px',border:'1px solid '+C.border,borderRadius:8,fontSize:13,boxSizing:'border-box'}}/>
            <button onClick={addItem} disabled={!novoItem.trim()} style={{border:0,background:novoItem.trim()?C.navy:'#e2e8f0',color:novoItem.trim()?'white':C.muted,borderRadius:8,padding:'8px 14px',fontWeight:700,fontSize:13,cursor:novoItem.trim()?'pointer':'default'}}>+ Add</button>
          </div>
        </div>
        <div><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:8}}>Cor do post-it</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {['#10b981','#1d4ed8','#b45309','#7c3aed','#dc2626','#0f766e','#334155'].map(cor=><button key={cor} onClick={()=>setRotinaForm(f=>({...f,cor}))} style={{width:28,height:28,borderRadius:'50%',background:cor,border:rotinaForm.cor===cor?'3px solid '+C.text:'2px solid transparent',cursor:'pointer',transition:'border .1s'}}/>)}
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:4}}>
          <button onClick={()=>setRotinaModal(false)} style={{border:'1px solid '+C.border,background:'white',borderRadius:8,padding:'10px 16px',cursor:'pointer',fontWeight:700}}>Cancelar</button>
          <button onClick={saveRotina} disabled={rotinasSaving||!rotinaForm.texto.trim()||!rotinaForm.recorrencia.trim()} style={{background:rotinasSaving||!rotinaForm.texto.trim()||!rotinaForm.recorrencia.trim()?C.muted:'#10b981',color:'white',border:0,borderRadius:8,padding:'10px 16px',fontWeight:800,cursor:'pointer'}}>{rotinasSaving?'Salvando...':rotinaForm.id?'Salvar alterações':'Adicionar rotina'}</button>
        </div>
      </div>
    </Modal>}
    {!tipoView? <div style={{display:'flex',flexDirection:'column',gap:28,marginTop:18}}>{TIPOS.map(([tipo,nome])=><section key={tipo}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:8,borderBottom:'2px solid '+C.border}}><h2 style={{margin:0,fontSize:16,fontWeight:800,color:C.text}}>{nome}</h2><div style={{display:'flex',gap:8,alignItems:'center'}}><button onClick={()=>openTipo(tipo,true)} style={{border:0,background:'none',color:C.green,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:13}}><Archive size={13}/> arquivo ({archiveCounts[tipo]||0})</button><button onClick={()=>openTipo(tipo,false)} style={{border:0,background:'none',color:C.blue,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:13}}>ver mais <ArrowRight size={13}/></button></div></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>{grouped[tipo]?.length?grouped[tipo].map(renderCard):<div style={{padding:20,textAlign:'center',color:C.muted,border:'1px dashed '+C.border,borderRadius:10,gridColumn:'1/-1'}}>Sem registros.</div>}</div></section>)}</div> : <div style={{marginTop:18}}><button onClick={()=>{setTipoView(null);setArquivoView(false)}} style={{...INP,width:'auto',marginBottom:12}}>← Voltar</button><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><h2>{arquivoView?arquivoTitulo(tipoView):label(TIPOS,tipoView)}</h2><div style={{display:'flex',gap:8,alignItems:'center'}}><select value={ordemView} onChange={e=>setOrdemView(e.target.value)} style={{...INP,width:'auto',flexShrink:0}}><option value="recentes">Mais recentes</option><option value="antigas">Mais antigas</option><option value="data_asc">Por data do evento ↑</option><option value="data_desc">Por data do evento ↓</option></select><button onClick={()=>setArquivoView(v=>!v)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'9px 12px',fontWeight:800,cursor:'pointer',display:'flex',gap:6,alignItems:'center'}}>{arquivoView?<><ArrowRight size={14}/> Ver ativos</>:<><Archive size={14}/> Ver arquivo</>}</button></div></div>{tipoView==='audiencia'&&!arquivoView&&<div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:14,marginBottom:14}}><h3 style={{marginTop:0,display:'flex',gap:8,alignItems:'center'}}><CalendarDays size={16}/>Calendário de audiências</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8}}>{currentList.filter(a=>a.prazo).slice().sort((a,b)=>String(a.prazo||'').localeCompare(String(b.prazo||''))).map(a=><div key={a.id} style={{border:'1px solid '+C.border,borderRadius:10,padding:10}}><b>{dateBR(a.prazo)}</b><div style={{fontSize:12,color:C.muted}}>{a.horario||'sem horário'} · {a.titulo}</div></div>)}{!currentList.filter(a=>a.prazo).length&&<div style={{color:C.muted}}>Nenhuma audiência agendada.</div>}</div></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>{currentList.map(renderCard)}{!currentList.length&&<div style={{padding:22,color:C.muted,border:'1px dashed '+C.border,borderRadius:12}}>{arquivoView?'Nenhum registro arquivado neste tipo.':'Nenhum registro encontrado.'}</div>}</div></div>}
    {modal&&<Modal title={form.id?'Editar atividade':'Nova atividade'} onClose={()=>setModal(false)}><div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>{['dados','documentos'].map(t=><button key={t} onClick={()=>setTab(t)} disabled={!form.id&&t==='documentos'} style={{border:'1px solid '+C.border,borderRadius:20,padding:'7px 12px',background:tab===t?C.navy:C.white,color:tab===t?'white':C.text,cursor:'pointer',fontWeight:800}}>{t==='documentos'?<><Paperclip size={13}/> Documentos</>:'Dados'}</button>)}</div>{tab==='dados'?<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><F label="Tipo"><select style={INP} value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,processo_id:'',contrato_id:''})}>{TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Status"><select style={INP} value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F></div>{form.tipo==='audiencia'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><F label="Modalidade da audiência"><select style={INP} value={form.audiencia_modalidade||'presencial'} onChange={e=>setForm({...form,audiencia_modalidade:e.target.value})}>{AUDIENCIA_MODALIDADES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Tipo de audiência"><select style={INP} value={form.audiencia_tipo||'inicial'} onChange={e=>setForm({...form,audiencia_tipo:e.target.value})}>{AUDIENCIA_TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F></div>}<F label="Título"><input style={INP} value={form.titulo||''} onChange={e=>setForm({...form,titulo:e.target.value})}/></F><F label="Descrição"><textarea style={{...INP,minHeight:90}} value={form.descricao||''} onChange={e=>setForm({...form,descricao:e.target.value})}/></F><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><F label="Prioridade"><select style={INP} value={form.prioridade} onChange={e=>setForm({...form,prioridade:e.target.value})}>{PRIOR.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Responsável"><select style={INP} value={form.responsavel_id||''} onChange={e=>setForm({...form,responsavel_id:e.target.value||null})}><option value="">Sem responsável</option>{team.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></F></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><F label="Data / prazo"><input type="date" style={INP} value={form.prazo||''} onChange={e=>setForm({...form,prazo:e.target.value})}/></F><F label="Horário"><input type="time" style={INP} value={form.horario||''} onChange={e=>setForm({...form,horario:e.target.value})}/></F></div><F label="Local / link"><input style={INP} value={form.local||''} onChange={e=>setForm({...form,local:e.target.value})}/></F><F label="Processo vinculado"><select style={INP} value={form.processo_id||''} onChange={e=>setForm({...form,processo_id:e.target.value,contrato_id:''})}><option value="">Sem processo</option>{proc.map(p=><option key={p.id} value={p.id}>{p.titulo} — {p.numero}</option>)}</select></F>{!['prazo_processual','audiencia'].includes(form.tipo)&&<F label="Contrato vinculado"><select style={INP} value={form.contrato_id||''} onChange={e=>setForm({...form,contrato_id:e.target.value,processo_id:''})}><option value="">Sem contrato</option>{cont.map(c=><option key={c.id} value={c.id}>{c.titulo}</option>)}</select></F>}<div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:12}}><button onClick={()=>setModal(false)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 16px'}}>Cancelar</button><button onClick={save} disabled={saving} style={{background:saving?C.muted:C.navy,color:'white',border:0,borderRadius:8,padding:'10px 16px',fontWeight:800}}>{saving?'Salvando...':'Salvar'}</button></div></>:<DocumentosVinculados profile={profile} atividadeId={form.id} title="Documentos da atividade"/>}</Modal>}
    {historyFor&&<Modal title="Histórico de atribuições" onClose={()=>setHistoryFor(null)} width={620}><b>{historyFor.titulo}</b>{history.length===0&&<div style={{color:C.muted,marginTop:12}}>Nenhum registro encontrado.</div>}{history.map(h=><div key={h.id} style={{border:'1px solid '+C.border,borderRadius:10,padding:12,marginTop:10}}><div style={{fontSize:13}}>De <b>{team.find(x=>x.id===h.usuario_anterior_id)?.nome||'—'}</b> para <b>{team.find(x=>x.id===h.usuario_novo_id)?.nome||'—'}</b></div><div style={{fontSize:12,color:C.muted,marginTop:4}}>Por {team.find(x=>x.id===h.atribuido_por)?.nome||'—'} · {new Date(h.created_at).toLocaleString('pt-BR')} · <b>{movimentoLabel(h)}</b>{h.motivo?` · Motivo: ${h.motivo}`:h.observacao?` · ${h.observacao}`:''}</div></div>)}</Modal>}
  </div>
}
