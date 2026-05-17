import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, can, fetchAllRows } from '../lib/supabase.js'
import { Bell, AlertTriangle, Mail, CalendarDays, Clock, CalendarCheck, ExternalLink, Link2, Plus, X, EyeOff } from 'lucide-react'
import MuralRecados from './MuralRecados.jsx'
import { FinanceiroResumoDashboard } from './FinanceiroResumoDashboard.tsx'
import { motivoDesconsideracaoPush, registrarPushDesconsiderado } from '../lib/pushArquivo.js'

import { C } from '../lib/theme'
import { Prv } from '../lib/PrivacyContext'
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const Card=({title,value,sub,color})=><div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:'22px 24px'}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:'.06em'}}>{title}</div><div style={{fontSize:42,fontWeight:900,color,marginTop:8,lineHeight:1}}>{value}</div><div style={{fontSize:13,color:C.muted,marginTop:6}}>{sub}</div></div>

function todayISO(){const d=new Date();d.setHours(0,0,0,0);return d.toISOString().slice(0,10)}
function addDaysISO(days){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
function daysUntil(date){if(!date)return null;const today=new Date();today.setHours(0,0,0,0);const d=new Date(date+'T12:00:00');return Math.ceil((d-today)/86400000)}
function brDate(date){return date?new Date(date+'T12:00:00').toLocaleDateString('pt-BR'):'-'}
function renewalState(c){if(!c.notificar_renovacao||!c.data_fim)return null;const untilEnd=daysUntil(c.data_fim);const limit=untilEnd-Number(c.renovacao_antecedencia_dias||0);const alertDays=Number(c.renovacao_alerta_dias||30);if(limit<0)return {level:'vencido',days:limit,text:`Limite de renovação vencido há ${Math.abs(limit)} dia(s)`};if(limit<=alertDays)return {level:'alerta',days:limit,text:`Manifestar interesse em renovação em até ${limit} dia(s)`};return null}
const CONTRATO_VENCIMENTO_ALERTA_DIAS=30
function vencimentoContratoState(c){
  if(!c.data_fim||['encerrado','arquivo_temporario'].includes(c.status))return null
  const days=daysUntil(c.data_fim)
  if(days===null||days>CONTRATO_VENCIMENTO_ALERTA_DIAS)return null
  if(days<0)return {level:'critico',days,text:`Contrato vencido há ${Math.abs(days)} dia(s)`}
  if(days===0)return {level:'critico',days,text:'Contrato vence hoje'}
  return {level:'critico',days,text:`Contrato vence em ${days} dia(s)`}
}
function isOpen(a){return !['concluida','cancelada'].includes(a.status)}
function isTaskOrDeadline(a){return ['tarefa','prazo_processual'].includes(a.tipo)}
function isHearing(a){return a.tipo==='audiencia'}
function isMeeting(a){return a.tipo==='reuniao'}
function compareByDate(a,b){return String(a.prazo||'9999-99-99').localeCompare(String(b.prazo||'9999-99-99')) || String(a.horario||'').localeCompare(String(b.horario||''))}
function scheduledDateTime(a){
  if(!a?.prazo)return null
  const horario=String(a.horario||'').match(/^\d{2}:\d{2}/)?.[0]||'23:59'
  return new Date(`${a.prazo}T${horario}:00`)
}
function isScheduledNowOrFuture(a,now=new Date()){
  const dt=scheduledDateTime(a)
  return dt ? dt >= now : false
}
function shortText(v='',limit=190){const t=String(v||'').replace(/\s+/g,' ').trim();return t.length>limit?t.slice(0,limit).trim()+'...':t}

const PUSH_IMPORTANTE=/senten[cç]a|ac[oó]rd[aã]o|decis[aã]o|liminar|tutela|intima[cç][aã]o|cita[cç][aã]o|prazo|audi[eê]ncia|per[ií]cia|bloqueio|penhora|publica[cç][aã]o|di[aá]rio|urgente|manifestar/iu
function pushText(p){return [p.movimento,p.assunto_email,p.corpo_email_resumo,p.corpo_resumo,p.corpo_email_limpo].filter(Boolean).join(' ')}
function isImportantPush(p){return PUSH_IMPORTANTE.test(pushText(p))}

function ListBlock({title,icon,items,empty,kind='default',onItemClick,limit=3}){
  const [expanded,setExpanded]=useState(false)
  const bg=kind==='danger'?C.redBg:kind==='warning'?C.amberBg:kind==='info'?C.blueBg:kind==='success'?C.greenBg:C.white
  const visible=expanded?items:items.slice(0,limit)
  const overflow=items.length-limit
  return <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column',height:'100%'}}>
    <h2 style={{fontSize:15,padding:'14px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
      {icon}{title}
      {items.length>0&&<span style={{marginLeft:'auto',fontSize:11,fontWeight:900,background:C.border,color:C.text,borderRadius:999,padding:'1px 8px'}}>{items.length}</span>}
    </h2>
    <div style={{flex:1}}>
      {visible.length?visible.map(t=><div key={t.id} onClick={onItemClick?()=>onItemClick(t):undefined} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:bg,cursor:onItemClick?'pointer':'default',transition:'filter .12s'}} onMouseEnter={onItemClick?e=>e.currentTarget.style.filter='brightness(0.96)':undefined} onMouseLeave={onItemClick?e=>e.currentTarget.style.filter='none':undefined}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
          <div><b>{t.titulo}</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{t.tipo} · {brDate(t.prazo)}{t.horario?` às ${t.horario}`:''}{t.status?` · ${t.status}`:''}</div></div>
          {onItemClick&&<ExternalLink size={13} color={C.muted} style={{flexShrink:0}}/>}
        </div>
      </div>):<div style={{padding:24,textAlign:'center',color:C.muted}}>{empty}</div>}
    </div>
    {items.length>limit&&<button onClick={()=>setExpanded(v=>!v)} style={{border:0,borderTop:'1px solid '+C.border,background:C.bg,color:C.muted,padding:'9px 18px',cursor:'pointer',fontWeight:800,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6,flexShrink:0,width:'100%'}}>
      {expanded?'↑ Ver menos':<><span style={{background:C.border,color:C.text,borderRadius:999,padding:'1px 7px',fontWeight:900,fontSize:11}}>+{overflow}</span> Ver todos ↓</>}
    </button>}
  </div>
}

function AlertasContratuaisBlock({items,onItemClick,limit=3}){
  const [expanded,setExpanded]=useState(false)
  const visible=expanded?items:items.slice(0,limit)
  const overflow=items.length-limit
  return <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,overflow:'hidden',display:'flex',flexDirection:'column',height:'100%'}}>
    <h2 style={{fontSize:15,padding:'14px 18px',margin:0,borderBottom:'1px solid '+C.border,display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
      <Bell size={16}/>Alertas contratuais
      {items.length>0&&<span style={{marginLeft:'auto',fontSize:11,fontWeight:900,background:C.border,color:C.text,borderRadius:999,padding:'1px 8px'}}>{items.length}</span>}
    </h2>
    <div style={{flex:1}}>
      {visible.length?visible.map(c=>{
        const critico=c.renovacao.level==='critico'||c.renovacao.level==='vencido'
        return <div key={c.alertaId||c.id} onClick={()=>onItemClick(c)} style={{padding:'12px 18px',borderBottom:'1px solid '+C.border,background:critico?C.redBg:C.amberBg,cursor:'pointer',transition:'filter .12s'}} onMouseEnter={e=>e.currentTarget.style.filter='brightness(0.96)'} onMouseLeave={e=>e.currentTarget.style.filter='none'}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
            <div><b style={{fontSize:13}}>{c.titulo}</b><div style={{fontSize:11,color:critico?C.red:C.amber,marginTop:3,fontWeight:800,display:'flex',gap:5,alignItems:'center'}}><AlertTriangle size={12}/>{c.renovacao.text}</div></div>
            <ExternalLink size={13} color={C.muted} style={{flexShrink:0}}/>
          </div>
        </div>
      }):<div style={{padding:24,textAlign:'center',color:C.muted,fontSize:13}}>Nenhum alerta de vencimento ou renovação no momento.</div>}
    </div>
    {items.length>limit&&<button onClick={()=>setExpanded(v=>!v)} style={{border:0,borderTop:'1px solid '+C.border,background:C.bg,color:C.muted,padding:'9px 18px',cursor:'pointer',fontWeight:800,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6,flexShrink:0,width:'100%'}}>
      {expanded?'↑ Ver menos':<><span style={{background:C.border,color:C.text,borderRadius:999,padding:'1px 7px',fontWeight:900,fontSize:11}}>+{overflow}</span> Ver todos ↓</>}
    </button>}
  </div>
}

function PushDashboardHeader({novos,importantes,ultimo,onClick}){
  return <button type="button" onClick={onClick} style={{width:'100%',textAlign:'left',display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap',padding:'14px 16px',border:'1px solid '+C.border,borderRadius:14,background:importantes?C.amberBg:C.blueBg,cursor:'pointer'}}>
    <div>
      <div style={{fontSize:13,fontWeight:900,color:C.text,display:'flex',alignItems:'center',gap:8}}><Mail size={16}/>Acompanhamento processual via push</div>
      <div style={{fontSize:12,color:C.muted,marginTop:3}}>{ultimo?`Último recebimento: ${new Date(ultimo.criado_em).toLocaleString('pt-BR')}`:'Últimos andamentos recebidos por e-mail dos tribunais.'}</div>
    </div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <span style={{border:'1px solid '+C.red,background:C.redBg,color:C.red,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900}}>{novos} novo(s) em 24h</span>
      <span style={{border:'1px solid '+(importantes?C.amber:C.green),background:C.white,color:importantes?C.amber:C.green,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900}}>{importantes} importante(s)</span>
      <span style={{border:'1px solid '+C.border,background:C.white,color:C.text,borderRadius:999,padding:'6px 10px',fontSize:12,fontWeight:900,display:'inline-flex',alignItems:'center',gap:5}}><ExternalLink size={13}/> Ver pushes</span>
    </div>
  </button>
}

function PushModal({items,profile,onClose,onOpenProcess,onCreateProcess,onDismiss}){
  const podeCriar=can(profile,'processos.criar')
  const [dismissing,setDismissing]=useState(null)
  return <div onMouseDown={e=>e.target===e.currentTarget&&(e.currentTarget._md=1)} onClick={e=>e.target===e.currentTarget&&e.currentTarget._md&&(delete e.currentTarget._md,onClose())} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:650,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
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
                <button disabled={dismissing===p.id} onClick={async()=>{if(!window.confirm('Desconsiderar este andamento? Ele ficará oculto na lista principal.'))return;setDismissing(p.id);await onDismiss(p);setDismissing(null)}} style={{border:'1px solid '+C.red,background:C.redBg,color:C.red,borderRadius:8,padding:'8px 10px',fontWeight:900,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,opacity:dismissing===p.id?0.5:1}}><EyeOff size={14}/>{dismissing===p.id?'...':'Desconsiderar'}</button>
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
  return <div onMouseDown={e=>e.target===e.currentTarget&&(e.currentTarget._md=1)} onClick={e=>e.target===e.currentTarget&&e.currentTarget._md&&(delete e.currentTarget._md,onCancel())} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:700,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
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

function AudienciaModal({audiencia,onClose,onOpenProcess}){
  const a=audiencia
  const MODS={presencial:'Presencial',online:'Online'}
  const TIPOS_AUD={inicial:'Inicial',instrucao:'Instrução',una:'Una',conciliacao:'Conciliação'}
  const STATUS_AUD={a_fazer:'A fazer',em_andamento:'Em andamento',concluida:'Concluída',cancelada:'Cancelada'}
  const PRIOR_AUD={baixa:'Baixa',media:'Média',alta:'Alta',urgente:'Urgente'}
  const priorColor={baixa:C.muted,media:C.amber,alta:C.red,urgente:C.red}[a.prioridade]||C.muted
  return <div onMouseDown={e=>e.target===e.currentTarget&&(e.currentTarget._md=1)} onClick={e=>e.target===e.currentTarget&&e.currentTarget._md&&(delete e.currentTarget._md,onClose())} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:650,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:520,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',padding:'16px 18px',borderBottom:'1px solid '+C.border,background:C.blueBg}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10}}><CalendarDays size={20} color={C.blue} style={{marginTop:2,flexShrink:0}}/><div><b style={{fontSize:15,color:C.text,display:'block',lineHeight:1.3}}>{a.titulo}</b><span style={{fontSize:12,color:C.muted}}>Audiência</span></div></div>
        <button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',color:C.muted,flexShrink:0}}><X size={20}/></button>
      </div>
      <div style={{padding:18}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Data</div><div style={{fontSize:18,fontWeight:900,color:C.text}}>{brDate(a.prazo)}</div></div>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Horário</div><div style={{fontSize:18,fontWeight:900,color:C.text}}>{a.horario||'—'}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Modalidade</div><div style={{fontSize:13,fontWeight:600}}>{MODS[a.audiencia_modalidade]||a.audiencia_modalidade||'—'}</div></div>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Tipo</div><div style={{fontSize:13,fontWeight:600}}>{TIPOS_AUD[a.audiencia_tipo]||a.audiencia_tipo||'—'}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Status</div><div style={{fontSize:13}}>{STATUS_AUD[a.status]||a.status||'—'}</div></div>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Prioridade</div><div style={{fontSize:13,fontWeight:700,color:priorColor}}>{PRIOR_AUD[a.prioridade]||a.prioridade||'—'}</div></div>
        </div>
        {a.local&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Local / link</div><div style={{fontSize:13,color:C.text}}>{a.local}</div></div>}
        {a.descricao&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Descrição</div><div style={{fontSize:13,color:C.text,lineHeight:1.45}}>{a.descricao}</div></div>}
        {a.processo_id&&<div style={{borderTop:'1px solid '+C.border,paddingTop:14,marginTop:4}}><button onClick={()=>{onClose();onOpenProcess(a.processo_id)}} style={{display:'inline-flex',alignItems:'center',gap:8,border:'1px solid '+C.blue,background:C.blueBg,color:C.blue,borderRadius:8,padding:'9px 16px',fontWeight:900,cursor:'pointer',fontSize:13}}><ExternalLink size={14}/>Abrir processo vinculado</button></div>}
      </div>
    </div>
  </div>
}

function AtividadeModal({atividade,onClose,onOpenProcess}){
  const a=atividade
  const TIPOS_MAP={tarefa:'Tarefa',prazo_processual:'Prazo processual',reuniao:'Reunião',audiencia:'Audiência'}
  const STATUS_MAP={a_fazer:'A fazer',em_andamento:'Em andamento',concluida:'Concluída',cancelada:'Cancelada'}
  const PRIOR_MAP={baixa:'Baixa',media:'Média',alta:'Alta',urgente:'Urgente'}
  const priorColor={baixa:C.muted,media:C.amber,alta:C.red,urgente:C.red}[a.prioridade]||C.muted
  const kindBg={tarefa:C.redBg,prazo_processual:C.redBg,reuniao:C.greenBg}[a.tipo]||C.blueBg
  const kindColor={tarefa:C.red,prazo_processual:C.red,reuniao:C.green}[a.tipo]||C.blue
  const Icon={tarefa:AlertTriangle,prazo_processual:Clock,reuniao:CalendarCheck}[a.tipo]||Clock
  return <div onMouseDown={e=>e.target===e.currentTarget&&(e.currentTarget._md=1)} onClick={e=>e.target===e.currentTarget&&e.currentTarget._md&&(delete e.currentTarget._md,onClose())} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:650,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:520,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',padding:'16px 18px',borderBottom:'1px solid '+C.border,background:kindBg}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10}}><Icon size={20} color={kindColor} style={{marginTop:2,flexShrink:0}}/><div><b style={{fontSize:15,color:C.text,display:'block',lineHeight:1.3}}>{a.titulo}</b><span style={{fontSize:12,color:C.muted}}>{TIPOS_MAP[a.tipo]||a.tipo}</span></div></div>
        <button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',color:C.muted,flexShrink:0}}><X size={20}/></button>
      </div>
      <div style={{padding:18}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Data / Prazo</div><div style={{fontSize:18,fontWeight:900,color:C.text}}>{brDate(a.prazo)}</div></div>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Horário</div><div style={{fontSize:18,fontWeight:900,color:C.text}}>{a.horario||'—'}</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Status</div><div style={{fontSize:13}}>{STATUS_MAP[a.status]||a.status||'—'}</div></div>
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Prioridade</div><div style={{fontSize:13,fontWeight:700,color:priorColor}}>{PRIOR_MAP[a.prioridade]||a.prioridade||'—'}</div></div>
        </div>
        {a.local&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Local / link</div><div style={{fontSize:13,color:C.text}}>{a.local}</div></div>}
        {a.descricao&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Descrição</div><div style={{fontSize:13,color:C.text,lineHeight:1.45}}>{a.descricao}</div></div>}
        {a.processo_id&&<div style={{borderTop:'1px solid '+C.border,paddingTop:14,marginTop:4}}><button onClick={()=>{onClose();onOpenProcess(a.processo_id)}} style={{display:'inline-flex',alignItems:'center',gap:8,border:'1px solid '+C.blue,background:C.blueBg,color:C.blue,borderRadius:8,padding:'9px 16px',fontWeight:900,cursor:'pointer',fontSize:13}}><ExternalLink size={14}/>Abrir processo vinculado</button></div>}
      </div>
    </div>
  </div>
}

function ContratoAlertaModal({contrato,onClose,onOpenContract}){
  const c=contrato
  const critico=c.renovacao?.level==='critico'||c.renovacao?.level==='vencido'
  const bg=critico?C.redBg:C.amberBg
  const color=critico?C.red:C.amber
  const alertaVencimento=c.tipoAlerta==='contrato_vencimento'
  return <div onMouseDown={e=>e.target===e.currentTarget&&(e.currentTarget._md=1)} onClick={e=>e.target===e.currentTarget&&e.currentTarget._md&&(delete e.currentTarget._md,onClose())} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:650,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <div style={{background:C.white,borderRadius:14,width:'100%',maxWidth:520,overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',padding:'16px 18px',borderBottom:'1px solid '+C.border,background:bg}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:10}}><AlertTriangle size={20} color={color} style={{marginTop:2,flexShrink:0}}/><div><b style={{fontSize:15,color:C.text,display:'block',lineHeight:1.3}}>{c.titulo}</b><span style={{fontSize:12,color:C.muted}}>{alertaVencimento?'Alerta de vencimento contratual':'Alerta de renovação contratual'}</span></div></div>
        <button onClick={onClose} style={{border:0,background:'none',cursor:'pointer',color:C.muted,flexShrink:0}}><X size={20}/></button>
      </div>
      <div style={{padding:18}}>
        <div style={{background:bg,border:'1px solid '+(critico?'#fca5a5':'#fde68a'),borderRadius:10,padding:'12px 14px',marginBottom:14,display:'flex',alignItems:'center',gap:8}}><AlertTriangle size={16} color={color}/><span style={{fontSize:13,fontWeight:800,color}}>{c.renovacao?.text}</span></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
          {c.numero&&<div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Número</div><div style={{fontSize:14,fontWeight:700}}>{c.numero}</div></div>}
          <div><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Vigência até</div><div style={{fontSize:18,fontWeight:900,color}}>{brDate(c.data_fim)}</div></div>
        </div>
        <div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Contratante</div><div style={{fontSize:13,color:C.text}}>{c.contratante||'—'}</div></div>
        <div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Contratada</div><div style={{fontSize:13,color:C.text}}>{c.contratada||'—'}</div></div>
        {c.objeto&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Objeto</div><div style={{fontSize:13,color:C.text,lineHeight:1.45}}>{c.objeto}</div></div>}
        {c.observacoes&&<div style={{marginBottom:14}}><div style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',marginBottom:4}}>Observações</div><div style={{fontSize:13,color:C.muted,fontStyle:'italic'}}>{c.observacoes}</div></div>}
        <div style={{borderTop:'1px solid '+C.border,paddingTop:14,marginTop:4}}><button onClick={()=>{onClose();onOpenContract(c.id)}} style={{display:'inline-flex',alignItems:'center',gap:8,border:'1px solid '+color,background:bg,color,borderRadius:8,padding:'9px 16px',fontWeight:900,cursor:'pointer',fontSize:13}}><ExternalLink size={14}/>Acessar contrato</button></div>
      </div>
    </div>
  </div>
}

function saudacaoHorario(){
  const h=new Date().getHours()
  if(h>=5&&h<12)return 'Bom dia'
  if(h>=12&&h<18)return 'Boa tarde'
  return 'Boa noite'
}

// Cache processos/contratos/atividades (pesados) — push sempre fresco
let _dashboard_cache=null
const DASHBOARD_CACHE_TTL=2*60*1000 // 2 min (dados mais dinâmicos)

export default function Dashboard({profile, unreadCount=0}){
  const navigate=useNavigate()
  const[pushModal,setPushModal]=useState(false)
  const[audienciaModal,setAudienciaModal]=useState(null)
  const[atividadeModal,setAtividadeModal]=useState(null)
  const[contratoModal,setContratoModal]=useState(null)
  const[createPush,setCreatePush]=useState(null)
  const[createForm,setCreateForm]=useState({numero:'',titulo:'',tribunal:'',categoria:'trabalhista',parte_contraria:'',resumo_processo:''})
  const[savingProcess,setSavingProcess]=useState(false)
  const[st,setSt]=useState({p:0,c:0,pendentes:[],futuras:[],audienciasSemana:[],reunioesSemana:[],ren:[],pushNovos:0,pushImportantes:0,pushUltimo:null,pushItems:[]})
  const firstLoad=useRef(true)

  useEffect(()=>{(async()=>{
    const eid=profile.escritorio_id
    const isFirst=firstLoad.current
    if(isFirst)firstLoad.current=false
    const hoje=todayISO()
    const amanha=addDaysISO(1)
    const fimSemana=addDaysISO(7)
    const desde24h=new Date(Date.now()-24*60*60*1000).toISOString()
    const agora=new Date()
    const atividadesQueryFactory=()=>{let query=supabase.from('atividades').select('*').eq('escritorio_id',eid).neq('status','concluida');if(profile.role!=='gerente'){query=query.or(`tipo.in.(audiencia,reuniao),and(tipo.in.(tarefa,prazo_processual),responsavel_id.eq.${profile.id})`)}return query}
    // Cache: p/c/a são pesados; push é rápido e deve ser sempre fresco
    let p,c,a
    if(isFirst&&_dashboard_cache?.eid===eid&&Date.now()-_dashboard_cache.ts<DASHBOARD_CACHE_TTL){
      p=_dashboard_cache.p;c=_dashboard_cache.c;a=_dashboard_cache.a
    }else{
      ;[p,c,a]=await Promise.all([
        fetchAllRows(()=>supabase.from('processos').select('*').eq('escritorio_id',eid)),
        fetchAllRows(()=>supabase.from('contratos').select('*').eq('escritorio_id',eid)),
        fetchAllRows(atividadesQueryFactory),
      ])
      _dashboard_cache={eid,ts:Date.now(),p,c,a}
    }
    const{data:push}=await supabase.from('andamentos_processuais_push').select('id,processo_id,cliente_id,numero_processo,tribunal,movimento,assunto_email,corpo_email_resumo,corpo_resumo,corpo_email_limpo,remetente,data_movimento,criado_em,status_associacao').eq('escritorio_id',eid).neq('status_associacao','ignorado').gte('criado_em',desde24h).order('criado_em',{ascending:false}).limit(100)
    const atividades=(a||[]).filter(isOpen)
    const pendentes=atividades.filter(x=>isTaskOrDeadline(x)&&x.prazo&&x.prazo<=hoje).sort(compareByDate)
    const futuras=atividades.filter(x=>isTaskOrDeadline(x)&&x.prazo&&x.prazo>=amanha).sort(compareByDate)
    const audienciasSemana=atividades.filter(x=>isHearing(x)&&x.prazo&&x.prazo>=hoje&&x.prazo<=fimSemana&&isScheduledNowOrFuture(x,agora)).sort(compareByDate)
    const reunioesSemana=atividades.filter(x=>isMeeting(x)&&x.prazo&&x.prazo>=hoje&&x.prazo<=fimSemana).sort(compareByDate)
    const contratosVencimento=(c||[]).map(x=>({...x,tipoAlerta:'contrato_vencimento',alertaId:`contrato-vencimento-${x.id}`,renovacao:vencimentoContratoState(x)})).filter(x=>x.renovacao)
    const vencimentoIds=new Set(contratosVencimento.map(x=>x.id))
    const contratosRenovacao=(c||[]).filter(x=>!vencimentoIds.has(x.id)).map(x=>({...x,tipoAlerta:'contrato_renovacao',alertaId:`contrato-renovacao-${x.id}`,renovacao:renewalState(x)})).filter(x=>x.renovacao)
    const ren=[...contratosVencimento,...contratosRenovacao].sort((x,y)=>{
      const prioridade=(x.renovacao.level==='critico'||x.renovacao.level==='vencido')?-1:0
      const prioridadeY=(y.renovacao.level==='critico'||y.renovacao.level==='vencido')?-1:0
      return prioridade-prioridadeY || x.renovacao.days-y.renovacao.days
    }).slice(0,7)
    const pushItems=push||[]
    setSt({p:(p||[]).filter(x=>x.status==='ativo').length,c:(c||[]).filter(x=>x.status==='ativo'||x.status==='a_vencer').length,pendentes,futuras,audienciasSemana,reunioesSemana,ren,pushNovos:pushItems.length,pushImportantes:pushItems.filter(isImportantPush).length,pushUltimo:pushItems[0]||null,pushItems})
  })()},[profile.escritorio_id,profile.id,profile.role])

  const abrirProcesso=(processoId)=>{if(!processoId)return;setPushModal(false);navigate(`/processos?processo_id=${processoId}`)}
  const abrirContrato=(contratoId)=>{if(!contratoId)return;navigate(`/contratos?contrato_id=${contratoId}`)}

  const iniciarCriacaoProcesso=(push)=>{
    setCreatePush(push)
    setCreateForm({numero:push.numero_processo||'',titulo:push.numero_processo?`Processo ${push.numero_processo}`:(push.movimento||'Novo processo'),tribunal:push.tribunal||'',categoria:'trabalhista',parte_contraria:'',resumo_processo:shortText(pushText(push),700)})
  }

  const desconsiderarPush=async(p)=>{
    const motivo=motivoDesconsideracaoPush(profile)
    await registrarPushDesconsiderado(supabase,p,profile,motivo)
    const {error}=await supabase.from('andamentos_processuais_push').update({status_associacao:'ignorado',ignorado_em:new Date().toISOString(),motivo_ignorado:motivo}).eq('id',p.id)
    if(error){alert('Erro ao desconsiderar: '+error.message);return}
    setSt(prev=>({...prev,pushItems:prev.pushItems.filter(x=>x.id!==p.id),pushNovos:prev.pushNovos-1,pushImportantes:isImportantPush(p)?prev.pushImportantes-1:prev.pushImportantes}))
  }

  const salvarProcessoPush=async()=>{
    if(!createPush)return
    if(!createForm.titulo.trim())return alert('Informe o título do processo.')
    setSavingProcess(true)
    const {data,error}=await supabase.from('processos').insert({escritorio_id:profile.escritorio_id,numero:createForm.numero||null,titulo:createForm.titulo.trim(),parte_contraria:createForm.parte_contraria||null,partes_contrarias:createForm.parte_contraria?[{nome:createForm.parte_contraria}]:[],tribunal:createForm.tribunal||null,categoria:createForm.categoria||'trabalhista',resumo_processo:createForm.resumo_processo||null,status:'ativo',fase:'conhecimento',responsavel_id:profile.id,created_by:profile.id}).select('id').single()
    if(error){setSavingProcess(false);return alert(error.message)}
    const {error:linkError}=await supabase.from('andamentos_processuais_push').update({processo_id:data.id,cliente_id:null,escritorio_id:profile.escritorio_id,status_associacao:'associado'}).eq('id',createPush.id)
    setSavingProcess(false)
    if(linkError)return alert('Processo criado, mas não foi possível vincular o push: '+linkError.message)
    setCreatePush(null)
    setPushModal(false)
    abrirProcesso(data.id)
  }

  return <div style={{padding:'24px 28px',maxWidth:1400,margin:'0 auto'}}>

    {/* ── Cabeçalho ─────────────────────────────────────────── */}
    <div style={{marginBottom:28}}>
      <h1 style={{margin:0,fontSize:28,fontWeight:900,color:C.text,lineHeight:1.1}}>Painel Jurídico</h1>
      <p style={{color:C.muted,marginTop:6,fontSize:15,margin:'6px 0 0'}}>{saudacaoHorario()}, <Prv>{profile.nome}</Prv></p>
    </div>

    {/* ── 6 cards em 3 colunas ──────────────────────────────── */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:20}}>
      <Card title="Processos ativos"      value={st.p}                   sub="em andamento"                          color={C.blue}/>
      <Card title="Contratos ativos"      value={st.c}                   sub="vigentes ou a vencer"                  color={C.green}/>
      <Card title="Notificações"          value={unreadCount}            sub="itens não lidos"                       color={unreadCount?C.red:C.green}/>
      <Card title="Atividades pendentes"  value={st.pendentes.length}    sub="vencidas ou vencendo hoje"             color={st.pendentes.length?C.red:C.green}/>
      <Card title="Audiências na semana"  value={st.audienciasSemana.length} sub="próximos 7 dias"                  color={C.blue}/>
      <Card title="Reuniões na semana"    value={st.reunioesSemana.length}   sub="próximos 7 dias"                  color={C.green}/>
    </div>

    {/* ── Push — largura total ──────────────────────────────── */}
    <div style={{marginBottom:20}}>
      <PushDashboardHeader novos={st.pushNovos} importantes={st.pushImportantes} ultimo={st.pushUltimo} onClick={()=>setPushModal(true)}/>
    </div>

    {/* ── Mural + Alertas contratuais ───────────────────────── */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
      <MuralRecados profile={profile}/>
      <AlertasContratuaisBlock items={st.ren} onItemClick={setContratoModal}/>
    </div>

    {/* ── Audiências + Pendentes ────────────────────────────── */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
      <ListBlock title="Audiências na semana"   icon={<CalendarDays size={16}/>}  items={st.audienciasSemana} empty="Nenhuma audiência nos próximos 7 dias."          kind="info"   onItemClick={setAudienciaModal}/>
      <ListBlock title="Atividades pendentes"   icon={<AlertTriangle size={16}/>} items={st.pendentes}        empty="Nenhuma tarefa ou prazo vencido/vencendo hoje." kind="danger" onItemClick={setAtividadeModal}/>
    </div>

    {/* ── Futuras + Reuniões ────────────────────────────────── */}
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
      <ListBlock title="Atividades futuras"     icon={<Clock size={16}/>}         items={st.futuras}          empty="Nenhuma tarefa ou prazo futuro agendado."       kind="warning" onItemClick={setAtividadeModal}/>
      <ListBlock title="Reuniões na semana"     icon={<CalendarCheck size={16}/>} items={st.reunioesSemana}   empty="Nenhuma reunião nos próximos 7 dias."           kind="success" onItemClick={setAtividadeModal}/>
    </div>

    {/* ── Financeiro — largura total ────────────────────────── */}
    <FinanceiroResumoDashboard profile={profile}/>

    {/* ── Modais ───────────────────────────────────────────── */}
    {pushModal&&<PushModal items={st.pushItems} profile={profile} onClose={()=>setPushModal(false)} onOpenProcess={abrirProcesso} onCreateProcess={iniciarCriacaoProcesso} onDismiss={desconsiderarPush}/>}
    {audienciaModal&&<AudienciaModal audiencia={audienciaModal} onClose={()=>setAudienciaModal(null)} onOpenProcess={abrirProcesso}/>}
    {atividadeModal&&<AtividadeModal atividade={atividadeModal} onClose={()=>setAtividadeModal(null)} onOpenProcess={abrirProcesso}/>}
    {contratoModal&&<ContratoAlertaModal contrato={contratoModal} onClose={()=>setContratoModal(null)} onOpenContract={abrirContrato}/>}
    {createPush&&<CriarProcessoPushModal push={createPush} form={createForm} setForm={setCreateForm} saving={savingProcess} onCancel={()=>setCreatePush(null)} onSave={salvarProcessoPush}/>}
  </div>
}
