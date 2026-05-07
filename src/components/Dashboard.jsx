import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, can } from '../lib/supabase.js'
import { Bell, AlertTriangle, Mail, CheckCircle, CalendarDays, Clock, CalendarCheck, ExternalLink, Link2, Plus, X } from 'lucide-react'
import ClippingJuridico from './ClippingJuridico.jsx'
import { FinanceiroResumoDashboard } from './FinanceiroResumoDashboard.tsx'

const C={text:'#0f172a',muted:'#64748b',border:'#e5e7eb',white:'#fff',blue:'#1d4ed8',green:'#16a34a',amber:'#b45309',red:'#dc2626',redBg:'#fee2e2',amberBg:'#fef3c7',blueBg:'#dbeafe',greenBg:'#dcfce7',grayBg:'#f8fafc'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const Card=({title,value,sub,color})=><div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:18}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:'.06em'}}>{title}</div><div style={{fontSize:30,fontWeight:900,color,marginTop:8}}>{value}</div><div style={{fontSize:13,color:C.muted}}>{sub}</div></div>

function todayISO(){const d=new Date();d.setHours(0,0,0,0);return d.toISOString().slice(0,10)}
function addDaysISO(days){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function daysUntil(date){if(!date)return null;const today=new Date();today.setHours(0,0,0,0);const d=new Date(date+'T12:00:00');return Math.ceil((d-today)/86400000)}
function brDate(date){return date?new Date(date+'T12:00:00').toLocaleDateString('pt-BR'):'-'}
function renewalState(c){if(!c.notificar_renovacao||!c.data_fim)return null;const untilEnd=daysUntil(c.data_fim);const limit=untilEnd-Number(c.renovacao_antecedencia_dias||0);const alertDays=Number(c.renovacao_alerta_dias||30);if(limit<0)return {level:'vencido',days:limit,text:`Limite de renovação vencido há ${Math.abs(limit)} dia(s)`};if(limit<=alertDays)return {level:'alerta',days:limit,text:`Manifestar interesse em renovação em até ${limit} dia(s)`};return null}
function isOpen(a){return !['concluida','cancelada'].includes(a.status)}
function isTaskOrDeadline(a){return ['tarefa','prazo_processual'].includes(a.tipo)}
function isHearing(a){return a.tipo==='audiencia'}
function isMeeting(a){return a.tipo==='reuniao'}
function compareByDate(a,b){return String(a.prazo||'9999-99-99').localeCompare(String(b.prazo||'9999-99-99')) || String(a.horario||'').localeCompare(String(b.horario||''))}
function shortText(v='',limit=190){const t=String(v||'').replace(/\s+/g,' ').trim();return t.length>limit?t.slice(0,limit).trim()+'...':t}

const PUSH_IMPORTANTE=/senten[cç]a|ac[oó]rd[aã]o|decis[aã]o|liminar|tutela|intima[cç][aã]o|cita[cç][aã]o|prazo|audi[eê]ncia|per[ií]cia|bloqueio|penhora|publica[cç][aã]o|di[aá]rio|urgente|manifestar/iu
function pushText(p){return [p.movimento,p.assunto_email,p.corpo_email_resumo,p.corpo_resumo,p.corpo_email_limpo].filter(Boolean).join(' ')}
function isImportantPush(p){return PUSH_IMPORTANTE.test(pushText(p))}

function ListBlock({title,icon,items,empty,kind='default'}){
  const bg=kind==='danger'?C.redBg:kind==='warning'?C.amberBg:kind==='info'?C.blueBg:kind==='success'?C.greenBg:C.white
  return <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,marginTop:22,overflow:'hidden'}}>
    <h2 style={{fontSize:15,padding:'16px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8}}>{icon}{title}</h2>
    {items.length?items.map(t=><div key={t.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:bg}}>
      <b>{t.titulo}</b>
      <div style={{fontSize:12,color:C.muted,marginTop:3}}>{t.tipo} · {brDate(t.prazo)}{t.horario?` às ${t.horario}`:''}{t.status?` · ${t.status}`:''}</div>
    </div>):<div style={{padding:24,textAlign:'center',color:C.muted}}>{empty}</div>}
  </div>
}

function PushDashboardHeader({novos,importantes,ultimo,onClick}){
  return <button type="button" onClick={onClick} style={{width:'100%',textAlign:'left',display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',padding:'14px 16px',border:'1px solid '+C.border,borderRadius:14,background:importantes?C.amberBg:C.blueBg,marginTop:22,marginBottom:10,cursor:'pointer'}}>
    <div>
      <div style={{fontSize:13,fontWeight:900,color:C.text,display:'flex',alignItems:'center',gap:8}}><Mail size={16}/>Acompanhamento processual via push</div>
      <div style={{fontSize:12,color:C.muted,marginTop:3}}>{ultimo?`Último recebimento: ${new Date(ultimo.criado_em).toLocaleString('pt-BR')}`:'Últimos andamentos recebidos por e-mail dos tribunais.'}</div>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <span style={{border:'1px solid '+C.blue,background:C.white,color:C.blue,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900}}>{novos} novo(s) em 24h</span>
      <span style={{border:'1px solid '+(importantes?C.amber:C.green),background:C.white,color:importantes?C.amber:C.green,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900}}>{importantes} importante(s)</span>
      <span style={{border:'1px solid '+C.border,background:C.white,color:C.text,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900,display:'inline-flex',alignItems:'center',gap:5}}><ExternalLink size={13}/> Ver pushes</span>
    </div>
  </button>
}

function PushModal({items,profile,onClose,onOpenProcess,onCreateProcess}){
  const podeCriar=can(profile,'processos.criar')
  return <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:650,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:920,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',padding:18,borderBottom:'1px solid '+C.border}}>
        <div><b>Pushes novos em 24h</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>Clique em um push vinculado para abrir o processo, ou crie um novo processo para associar o andamento.</div></div>
        <button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',color:C.text}}><X size={22}/></button>
      </div>
      <div style={{padding:16,overflow:'auto'}}>
        {!items.length&&<div style={{border:'1px dashed '+C.border,borderRadius:12,padding:24,textAlign:'center',color:C.muted}}>Nenhum push novo nas últimas 24h.</div>}
        {items.map(p=>{
          const importante=isImportantPush(p)
          const vinculado=!!p.processo_id
          const resumo=shortText(p.corpo_email_resumo||p.corpo_resumo||p.corpo_email_limpo||p.assunto_email||'')
          return <article key={p.id} onClick={()=>vinculado?onOpenProcess(p.processo_id):(podeCriar&&onCreateProcess(p))} style={{border:'1px solid '+(importante?'#fde68a':C.border),background:importante?C.amberBg:C.white,borderRadius:12,padding:14,marginBottom:10,cursor:vinculado||podeCriar?'pointer':'default'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{minWidth:0}}>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <b>{p.movimento||'Andamento recebido'}</b>
                  <span style={{fontSize:11,fontWeight:900,borderRadius:999,padding:'3px 8px',background:vinculado?C.greenBg:C.blueBg,color:vinculado?C.green:C.blue}}>{vinculado?'Vinculado':'Sem processo'}</span>
                  {importante&&<span style={{fontSize:11,fontWeight:900,borderRadius:999,padding:'3px 8px',background:C.white,color:C.amber,border:'1px solid #fde68a'}}>Importante</span>}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>{p.numero_processo||'Processo não identificado'}{p.tribunal?` · ${p.tribunal}`:''} · recebido em {new Date(p.criado_em).toLocaleString('pt-BR')}</div>
                {resumo&&<p style={{fontSize:13,color:C.text,lineHeight:1.45,margin:'8px 0 0'}}>{resumo}</p>}
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}} onClick={e=>e.stopPropagation()}>
                {vinculado?<button onClick={()=>onOpenProcess(p.processo_id)} style={{border:'1px solid '+C.green,background:C.greenBg,color:C.green,borderRadius:8,padding:'8px 10px',fontWeight:900,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}><Link2 size={14}/>Abrir processo</button>:podeCriar?<button onClick={()=>onCreateProcess(p)} style={{border:'1px solid '+C.blue,background:C.blueBg,color:C.blue,borderRadius:8,padding:'8px 10px',fontWeight:900,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}><Plus size={14}/>Criar processo</button>:<span style={{fontSize:12,color:C.muted}}>Sem permissão para criar</span>}
              </div>
            </div>
          </article>
        })}
      </div>
    </div>
  </div>
}

function Field({label,children}){return <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>{children}</div>}

function CriarProcessoPushModal({push,form,setForm,saving,onCancel,onSave}){
  return <div onClick={e=>e.target===e.currentTarget&&onCancel()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:680,padding:18}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,borderBottom:'1px solid '+C.border,paddingBottom:12,marginBottom:14}}>
        <div><b>Criar processo e vincular push</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{push?.numero_processo||'Número não identificado'} · {push?.tribunal||'Tribunal não informado'}</div></div>
        <button onClick={onCancel} style={{border:0,background:'none',cursor:'pointer'}}><X/></button>
      </div>
      <Field label="Número do processo"><input style={INP} value={form.numero} onChange={e=>setForm({...form,numero:e.target.value})}/></Field>
      <Field label="Título / parte principal"><input style={INP} value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})}/></Field>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
        <Field label="Tribunal"><input style={INP} value={form.tribunal} onChange={e=>setForm({...form,tribunal:e.target.value})}/></Field>
        <Field label="Categoria"><select style={INP} value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}><option value="trabalhista">Trabalhista</option><option value="civel">Cível</option><option value="administrativo">Administrativo</option><option value="tributario">Tributário</option><option value="criminal">Criminal</option></select></Field>
      </div>
      <Field label="Parte contrária"><input style={INP} value={form.parte_contraria} onChange={e=>setForm({...form,parte_contraria:e.target.value})}/></Field>
      <Field label="Resumo inicial"><textarea style={{...INP,minHeight:90}} value={form.resumo_processo} onChange={e=>setForm({...form,resumo_processo:e.target.value})}/></Field>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,flexWrap:'wrap'}}><button onClick={onCancel} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'10px 14px',fontWeight:800}}>Cancelar</button><button onClick={onSave} disabled={saving} style={{border:0,background:saving?C.muted:C.blue,color:'white',borderRadius:8,padding:'10px 16px',fontWeight:900}}>{saving?'Criando...':'Criar e vincular'}</button></div>
    </div>
  </div>
}

function saudacaoHorario(){
  const h=new Date().getHours()
  if(h>=5&&h<12)return 'Bom dia'
  if(h>=12&&h<18)return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard({profile}){
  const navigate=useNavigate()
  const[pushModal,setPushModal]=useState(false)
  const[createPush,setCreatePush]=useState(null)
  const[createForm,setCreateForm]=useState({numero:'',titulo:'',tribunal:'',categoria:'trabalhista',parte_contraria:'',resumo_processo:''})
  const[savingProcess,setSavingProcess]=useState(false)
  const[st,setSt]=useState({p:0,c:0,pendentes:[],futuras:[],audienciasSemana:[],reunioesSemana:[],ren:[],notificacoes:[],mensagens:[],pushNovos:0,pushImportantes:0,pushUltimo:null,pushItems:[]})

  useEffect(()=>{(async()=>{
    const eid=profile.escritorio_id
    const hoje=todayISO()
    const amanha=addDaysISO(1)
    const fimSemana=addDaysISO(7)
    const desde24h=new Date(Date.now()-24*60*60*1000).toISOString()
    let atividadesQuery=supabase.from('atividades').select('*').eq('escritorio_id',eid).neq('status','concluida')
    if(profile.role!=='gerente'){atividadesQuery=atividadesQuery.or(`tipo.in.(audiencia,reuniao),and(tipo.in.(tarefa,prazo_processual),responsavel_id.eq.${profile.id})`)}
    const[{data:p},{data:c},{data:a},{data:n},{data:m},{data:push}]=await Promise.all([
      supabase.from('processos').select('*').eq('escritorio_id',eid),
      supabase.from('contratos').select('*').eq('escritorio_id',eid),
      atividadesQuery,
      supabase.from('notificacoes').select('*').eq('usuario_id',profile.id).eq('lida',false).eq('arquivada',false).order('created_at',{ascending:false}).limit(5),
      supabase.from('mensagens').select('*').eq('destinatario_id',profile.id).eq('lida',false).not('arquivada_por','cs',`{${profile.id}}`).order('created_at',{ascending:false}).limit(5),
      supabase.from('andamentos_processuais_push').select('id,processo_id,cliente_id,numero_processo,tribunal,movimento,assunto_email,corpo_email_resumo,corpo_resumo,corpo_email_limpo,remetente,data_movimento,criado_em,status_associacao').eq('escritorio_id',eid).neq('status_associacao','ignorado').gte('criado_em',desde24h).order('criado_em',{ascending:false}).limit(100),
    ])
    const atividades=(a||[]).filter(isOpen)
    const pendentes=atividades.filter(x=>isTaskOrDeadline(x)&&x.prazo&&x.prazo<=hoje).sort(compareByDate)
    const futuras=atividades.filter(x=>isTaskOrDeadline(x)&&x.prazo&&x.prazo>=amanha).sort(compareByDate)
    const audienciasSemana=atividades.filter(x=>isHearing(x)&&x.prazo&&x.prazo>=hoje&&x.prazo<=fimSemana).sort(compareByDate)
    const reunioesSemana=atividades.filter(x=>isMeeting(x)&&x.prazo&&x.prazo>=hoje&&x.prazo<=fimSemana).sort(compareByDate)
    const ren=(c||[]).map(x=>({...x,renovacao:renewalState(x)})).filter(x=>x.renovacao).sort((x,y)=>x.renovacao.days-y.renovacao.days).slice(0,5)
    const pushItems=push||[]
    setSt({p:(p||[]).filter(x=>x.status==='ativo').length,c:(c||[]).filter(x=>x.status==='ativo'||x.status==='a_vencer').length,pendentes,futuras,audienciasSemana,reunioesSemana,ren,notificacoes:n||[],mensagens:m||[],pushNovos:pushItems.length,pushImportantes:pushItems.filter(isImportantPush).length,pushUltimo:pushItems[0]||null,pushItems})
  })()},[profile.escritorio_id,profile.id,profile.role])

  const totalAvisos=useMemo(()=>st.notificacoes.length+st.mensagens.length,[st.notificacoes,st.mensagens])

  const abrirProcesso=(processoId)=>{if(!processoId)return;setPushModal(false);navigate(`/processos?processo_id=${processoId}`)}

  const iniciarCriacaoProcesso=(push)=>{
    setCreatePush(push)
    setCreateForm({numero:push.numero_processo||'',titulo:push.numero_processo?`Processo ${push.numero_processo}`:(push.movimento||'Novo processo'),tribunal:push.tribunal||'',categoria:'trabalhista',parte_contraria:'',resumo_processo:shortText(pushText(push),700)})
  }

  const salvarProcessoPush=async()=>{
    if(!createPush)return
    if(!createForm.titulo.trim())return alert('Informe o título do processo.')
    setSavingProcess(true)
    const {data,error}=await supabase.from('processos').insert({escritorio_id:profile.escritorio_id,numero:createForm.numero||null,titulo:createForm.titulo.trim(),parte_contraria:createForm.parte_contraria||null,tribunal:createForm.tribunal||null,categoria:createForm.categoria||'trabalhista',resumo_processo:createForm.resumo_processo||null,status:'ativo',fase:'conhecimento',responsavel_id:profile.id,created_by:profile.id}).select('id').single()
    if(error){setSavingProcess(false);return alert(error.message)}
    const {error:linkError}=await supabase.from('andamentos_processuais_push').update({processo_id:data.id,cliente_id:null,escritorio_id:profile.escritorio_id,status_associacao:'associado'}).eq('id',createPush.id)
    setSavingProcess(false)
    if(linkError)return alert('Processo criado, mas não foi possível vincular o push: '+linkError.message)
    setCreatePush(null)
    setPushModal(false)
    abrirProcesso(data.id)
  }

  return <div style={{padding:24}}>
    <div>
      <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Painel Jurídico</h1>
      <p style={{color:C.muted,marginTop:6}}>{saudacaoHorario()}, {profile.nome}</p>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14,marginTop:22}}>
      <Card title="Processos ativos" value={st.p} sub="em andamento" color={C.blue}/>
      <Card title="Contratos ativos" value={st.c} sub="vigentes ou a vencer" color={C.green}/>
      <Card title="Atividades pendentes" value={st.pendentes.length} sub="vencidas ou vencendo hoje" color={st.pendentes.length?C.red:C.green}/>
      <Card title="Atividades futuras" value={st.futuras.length} sub="tarefas e prazos a partir de amanhã" color={C.amber}/>
      <Card title="Audiências na semana" value={st.audienciasSemana.length} sub="próximos 7 dias" color={C.blue}/>
      <Card title="Reuniões na semana" value={st.reunioesSemana.length} sub="próximos 7 dias" color={C.green}/>
      <Card title="Alertas e mensagens" value={totalAvisos} sub="itens não lidos" color={totalAvisos?C.red:C.green}/>
    </div>

    <PushDashboardHeader novos={st.pushNovos} importantes={st.pushImportantes} ultimo={st.pushUltimo} onClick={()=>setPushModal(true)}/>
    <ListBlock title="Audiências na semana" icon={<CalendarDays size={16}/>} items={st.audienciasSemana.slice(0,6)} empty="Nenhuma audiência nos próximos 7 dias." kind="info"/>

    <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,marginTop:22,overflow:'hidden'}}>
      <h2 style={{fontSize:15,padding:'16px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8}}><Bell size={16}/>Notificações e mensagens não lidas</h2>
      {totalAvisos?<div>
        {st.notificacoes.map(n=><div key={'n-'+n.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:'#fffbeb'}}><b>{n.titulo}</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{n.descricao||'Notificação interna'} · {new Date(n.created_at).toLocaleString('pt-BR')}</div></div>)}
        {st.mensagens.map(m=><div key={'m-'+m.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:C.blueBg}}><b style={{display:'flex',alignItems:'center',gap:6}}><Mail size={14}/> {m.assunto}</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{m.corpo?.slice(0,160)}{m.corpo?.length>160?'...':''} · {new Date(m.created_at).toLocaleString('pt-BR')}</div></div>)}
      </div>:<div style={{padding:24,textAlign:'center',color:C.muted,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><CheckCircle size={16}/>Nenhuma notificação ou mensagem nova.</div>}
    </div>

    <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,marginTop:22,overflow:'hidden'}}>
      <h2 style={{fontSize:15,padding:'16px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8}}><Bell size={16}/>Alertas de renovação contratual</h2>
      {st.ren.length?st.ren.map(c=><div key={c.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:c.renovacao.level==='vencido'?C.redBg:C.amberBg}}>
        <b>{c.titulo}</b>
        <div style={{fontSize:12,color:C.muted,marginTop:3}}>{c.numero?'Contrato nº '+c.numero+' · ':''}{c.contratante||'Contratante não informado'} × {c.contratada||'Contratada não informada'} · fim: {brDate(c.data_fim)}</div>
        <div style={{fontSize:12,fontWeight:900,color:c.renovacao.level==='vencido'?C.red:C.amber,marginTop:4,display:'flex',gap:6,alignItems:'center'}}><AlertTriangle size={13}/>{c.renovacao.text}</div>
      </div>):<div style={{padding:24,textAlign:'center',color:C.muted}}>Nenhum alerta de renovação no momento.</div>}
    </div>

    <ListBlock title="Atividades pendentes" icon={<AlertTriangle size={16}/>} items={st.pendentes.slice(0,6)} empty="Nenhuma tarefa ou prazo vencido/vencendo hoje." kind="danger"/>
    <ListBlock title="Atividades futuras" icon={<Clock size={16}/>} items={st.futuras.slice(0,6)} empty="Nenhuma tarefa ou prazo futuro agendado." kind="warning"/>
    <ListBlock title="Reuniões na semana" icon={<CalendarCheck size={16}/>} items={st.reunioesSemana.slice(0,6)} empty="Nenhuma reunião nos próximos 7 dias." kind="success"/>
    <FinanceiroResumoDashboard profile={profile}/>
    <ClippingJuridico/>

    {pushModal&&<PushModal items={st.pushItems} profile={profile} onClose={()=>setPushModal(false)} onOpenProcess={abrirProcesso} onCreateProcess={iniciarCriacaoProcesso}/>}
    {createPush&&<CriarProcessoPushModal push={createPush} form={createForm} setForm={setCreateForm} saving={savingProcess} onCancel={()=>setCreatePush(null)} onSave={salvarProcessoPush}/>}
  </div>
}
