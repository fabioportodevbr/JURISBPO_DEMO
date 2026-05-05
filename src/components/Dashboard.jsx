import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Bell, AlertTriangle, Mail, CheckCircle, CalendarDays, Clock, CalendarCheck } from 'lucide-react'
import ClippingJuridico from './ClippingJuridico.jsx'
import AndamentosProcessuaisPush from './AndamentosProcessuaisPush.jsx'

const C={text:'#0f172a',muted:'#64748b',border:'#e5e7eb',white:'#fff',blue:'#1d4ed8',green:'#16a34a',amber:'#b45309',red:'#dc2626',redBg:'#fee2e2',amberBg:'#fef3c7',blueBg:'#dbeafe',greenBg:'#dcfce7'}
const Card=({title,value,sub,color})=><div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:18}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:'.06em'}}>{title}</div><div style={{fontSize:30,fontWeight:900,color,marginTop:8}}>{value}</div><div style={{fontSize:13,color:C.muted}}>{sub}</div></div>

function todayISO(){const d=new Date();d.setHours(0,0,0,0);return d.toISOString().slice(0,10)}
function addDaysISO(days){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function daysUntil(date){if(!date)return null;const today=new Date();today.setHours(0,0,0,0);const d=new Date(date+'T12:00:00');return Math.ceil((d-today)/86400000)}
function brDate(date){return date?new Date(date+'T12:00:00').toLocaleDateString('pt-BR'):'—'}
function renewalState(c){if(!c.notificar_renovacao||!c.data_fim)return null;const untilEnd=daysUntil(c.data_fim);const limit=untilEnd-Number(c.renovacao_antecedencia_dias||0);const alertDays=Number(c.renovacao_alerta_dias||30);if(limit<0)return {level:'vencido',days:limit,text:`Limite de renovação vencido há ${Math.abs(limit)} dia(s)`};if(limit<=alertDays)return {level:'alerta',days:limit,text:`Manifestar interesse em renovação em até ${limit} dia(s)`};return null}
function isOpen(a){return !['concluida','cancelada'].includes(a.status)}
function isTaskOrDeadline(a){return ['tarefa','prazo_processual'].includes(a.tipo)}
function isHearing(a){return a.tipo==='audiencia'}
function isMeeting(a){return a.tipo==='reuniao'}
function compareByDate(a,b){return String(a.prazo||'9999-99-99').localeCompare(String(b.prazo||'9999-99-99')) || String(a.horario||'').localeCompare(String(b.horario||''))}
function ListBlock({title,icon,items,empty,kind='default'}){
  const bg = kind==='danger'?C.redBg:kind==='warning'?C.amberBg:kind==='info'?C.blueBg:kind==='success'?C.greenBg:C.white
  return <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,marginTop:22,overflow:'hidden'}}>
    <h2 style={{fontSize:15,padding:'16px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8}}>{icon}{title}</h2>
    {items.length?items.map(t=><div key={t.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:bg}}>
      <b>{t.titulo}</b>
      <div style={{fontSize:12,color:C.muted,marginTop:3}}>
        {t.tipo} · {brDate(t.prazo)}{t.horario?` às ${t.horario}`:''}{t.status?` · ${t.status}`:''}
      </div>
    </div>):<div style={{padding:24,textAlign:'center',color:C.muted}}>{empty}</div>}
  </div>
}

function PushDashboardHeader({novos, importantes, ultimo}){
  return <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',padding:'14px 16px',border:'1px solid '+C.border,borderRadius:14,background:importantes?C.amberBg:C.blueBg,marginTop:22,marginBottom:10}}>
    <div>
      <div style={{fontSize:13,fontWeight:900,color:C.text,display:'flex',alignItems:'center',gap:8}}><Mail size={16}/>Acompanhamento processual via push</div>
      <div style={{fontSize:12,color:C.muted,marginTop:3}}>{ultimo?`Último recebimento: ${new Date(ultimo.criado_em).toLocaleString('pt-BR')}`:'Últimos andamentos recebidos por e-mail dos tribunais.'}</div>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <span style={{border:'1px solid '+C.blue,background:C.white,color:C.blue,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900}}>{novos} novo(s) em 24h</span>
      <span style={{border:'1px solid '+(importantes?C.amber:C.green),background:C.white,color:importantes?C.amber:C.green,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900}}>{importantes} importante(s)</span>
    </div>
  </div>
}


function saudacaoHorario() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard({profile}){
  const[st,setSt]=useState({
    p:0,c:0,
    pendentes:[], futuras:[], audienciasSemana:[], reunioesSemana:[],
    ren:[], notificacoes:[], mensagens:[],
    pushNovos:0, pushImportantes:0, pushUltimo:null
  })

  useEffect(()=>{(async()=>{
    const eid=profile.escritorio_id
    const hoje=todayISO()
    const amanha=addDaysISO(1)
    const fimSemana=addDaysISO(7)
    const desde24h=new Date(Date.now()-24*60*60*1000).toISOString()

    let atividadesQuery=supabase
      .from('atividades')
      .select('*')
      .eq('escritorio_id',eid)
      .neq('status','concluida')

    // Mantém a mesma regra de visibilidade geral:
    // gerente vê tudo; demais veem tarefas/prazos próprios + audiências/reuniões compartilhadas.
    if(profile.role!=='gerente'){
      atividadesQuery=atividadesQuery.or(`tipo.in.(audiencia,reuniao),and(tipo.in.(tarefa,prazo_processual),responsavel_id.eq.${profile.id})`)
    }

    const[{data:p},{data:c},{data:a},{data:n},{data:m},{data:push}]=await Promise.all([
      supabase.from('processos').select('*').eq('escritorio_id',eid),
      supabase.from('contratos').select('*').eq('escritorio_id',eid),
      atividadesQuery,
      supabase.from('notificacoes').select('*').eq('usuario_id',profile.id).eq('lida',false).eq('arquivada',false).order('created_at',{ascending:false}).limit(5),
      supabase.from('mensagens').select('*').eq('destinatario_id',profile.id).eq('lida',false).not('arquivada_por','cs',`{${profile.id}}`).order('created_at',{ascending:false}).limit(5),
      supabase.from('andamentos_processuais_push').select('id, movimento, assunto_email, corpo_email_resumo, corpo_resumo, corpo_email_limpo, status_associacao, criado_em').eq('escritorio_id',eid).neq('status_associacao','ignorado').order('criado_em',{ascending:false}).limit(25),
    ])

    const atividades=(a||[]).filter(isOpen)

    const pendentes=atividades
      .filter(x=>isTaskOrDeadline(x)&&x.prazo&&x.prazo<=hoje)
      .sort(compareByDate)

    const futuras=atividades
      .filter(x=>isTaskOrDeadline(x)&&x.prazo&&x.prazo>=amanha)
      .sort(compareByDate)

    const audienciasSemana=atividades
      .filter(x=>isHearing(x)&&x.prazo&&x.prazo>=hoje&&x.prazo<=fimSemana)
      .sort(compareByDate)

    const reunioesSemana=atividades
      .filter(x=>isMeeting(x)&&x.prazo&&x.prazo>=hoje&&x.prazo<=fimSemana)
      .sort(compareByDate)

    const ren=(c||[]).map(x=>({...x,renovacao:renewalState(x)})).filter(x=>x.renovacao).sort((x,y)=>x.renovacao.days-y.renovacao.days).slice(0,5)

    const importantesRegex=/senten[cç]a|ac[oó]rd[aã]o|decis[aã]o|liminar|tutela|intima[cç][aã]o|cita[cç][aã]o|prazo|audi[eê]ncia|per[ií]cia|bloqueio|penhora|publica[cç][aã]o|di[aá]rio|urgente|manifestar/iu
    const pushItems=push||[]
    const pushNovos=pushItems.filter(x=>x.criado_em&&new Date(x.criado_em)>=new Date(desde24h)).length
    const pushImportantes=pushItems.filter(x=>importantesRegex.test([x.movimento,x.assunto_email,x.corpo_email_resumo,x.corpo_resumo,x.corpo_email_limpo].filter(Boolean).join(' '))).length

    setSt({
      p:(p||[]).filter(x=>x.status==='ativo').length,
      c:(c||[]).filter(x=>x.status==='ativo'||x.status==='a_vencer').length,
      pendentes,
      futuras,
      audienciasSemana,
      reunioesSemana,
      ren,
      notificacoes:n||[],
      mensagens:m||[],
      pushNovos,
      pushImportantes,
      pushUltimo:pushItems[0]||null
    })
  })()},[profile.escritorio_id,profile.id,profile.role])

  const totalAvisos=useMemo(()=>st.notificacoes.length+st.mensagens.length,[st.notificacoes,st.mensagens])

  return <div style={{padding:24}}>
    <h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Painel Jurídico</h1>
    <p style={{color:C.muted,marginTop:6}}>{saudacaoHorario()}, {profile.nome}</p>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14,marginTop:22}}>
      <Card title="Processos ativos" value={st.p} sub="em andamento" color={C.blue}/>
      <Card title="Contratos ativos" value={st.c} sub="vigentes ou a vencer" color={C.green}/>
      <Card title="Atividades pendentes" value={st.pendentes.length} sub="vencidas ou vencendo hoje" color={st.pendentes.length?C.red:C.green}/>
      <Card title="Atividades futuras" value={st.futuras.length} sub="tarefas e prazos a partir de amanhã" color={C.amber}/>
      <Card title="Audiências na semana" value={st.audienciasSemana.length} sub="próximos 7 dias" color={C.blue}/>
      <Card title="Reuniões na semana" value={st.reunioesSemana.length} sub="próximos 7 dias" color={C.green}/>
      <Card title="Alertas e mensagens" value={totalAvisos} sub="itens não lidos" color={totalAvisos?C.red:C.green}/>
    </div>

    <PushDashboardHeader novos={st.pushNovos} importantes={st.pushImportantes} ultimo={st.pushUltimo} />
    <AndamentosProcessuaisPush profile={profile} compact limit={3} />

    <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,marginTop:22,overflow:'hidden'}}>
      <h2 style={{fontSize:15,padding:'16px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8}}><Bell size={16}/>Notificações e mensagens não lidas</h2>
      {totalAvisos? <div>
        {st.notificacoes.map(n=><div key={'n-'+n.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:'#fffbeb'}}><b>{n.titulo}</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{n.descricao||'Notificação interna'} · {new Date(n.created_at).toLocaleString('pt-BR')}</div></div>)}
        {st.mensagens.map(m=><div key={'m-'+m.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:C.blueBg}}><b style={{display:'flex',alignItems:'center',gap:6}}><Mail size={14}/> {m.assunto}</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{m.corpo?.slice(0,160)}{m.corpo?.length>160?'...':''} · {new Date(m.created_at).toLocaleString('pt-BR')}</div></div>)}
      </div> : <div style={{padding:24,textAlign:'center',color:C.muted,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><CheckCircle size={16}/>Nenhuma notificação ou mensagem nova.</div>}
    </div>

    <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,marginTop:22,overflow:'hidden'}}>
      <h2 style={{fontSize:15,padding:'16px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8}}><Bell size={16}/>Alertas de renovação contratual</h2>
      {st.ren.length?st.ren.map(c=><div key={c.id} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:c.renovacao.level==='vencido'?C.redBg:C.amberBg}}>
        <b>{c.titulo}</b>
        <div style={{fontSize:12,color:C.muted,marginTop:3}}>{c.numero?'Contrato nº '+c.numero+' · ':''}{c.contratante||'Contratante não informado'} × {c.contratada||'Contratada não informada'} · fim: {brDate(c.data_fim)}</div>
        <div style={{fontSize:12,fontWeight:900,color:c.renovacao.level==='vencido'?C.red:C.amber,marginTop:4,display:'flex',gap:6,alignItems:'center'}}><AlertTriangle size={13}/>{c.renovacao.text}</div>
      </div>):<div style={{padding:24,textAlign:'center',color:C.muted}}>Nenhum alerta de renovação no momento.</div>}
    </div>

    <ClippingJuridico />

    <ListBlock title="Atividades pendentes" icon={<AlertTriangle size={16}/>} items={st.pendentes.slice(0,6)} empty="Nenhuma tarefa ou prazo vencido/vencendo hoje." kind="danger"/>
    <ListBlock title="Atividades futuras" icon={<Clock size={16}/>} items={st.futuras.slice(0,6)} empty="Nenhuma tarefa ou prazo futuro agendado." kind="warning"/>
    <ListBlock title="Audiências na semana" icon={<CalendarDays size={16}/>} items={st.audienciasSemana.slice(0,6)} empty="Nenhuma audiência nos próximos 7 dias." kind="info"/>
    <ListBlock title="Reuniões na semana" icon={<CalendarCheck size={16}/>} items={st.reunioesSemana.slice(0,6)} empty="Nenhuma reunião nos próximos 7 dias." kind="success"/>
  </div>
}