import { useEffect, useMemo, useState } from 'react'
import { fetchAllRows, supabase } from '../lib/supabase.js'
import { BarChart3, FileText, DollarSign, Scale, Download, Printer, SlidersHorizontal, ArrowLeft, CalendarDays, CheckSquare } from 'lucide-react'
import { APP_CONFIG } from '../config/appConfig.js'

import { C } from '../lib/theme'
import { pickDefaultEmpresaGrupoId, scopeDataByEmpresaGrupo } from '../lib/empresaGrupoFilter.js'
import EmpresaGrupoToggleBar from './EmpresaGrupoToggleBar.jsx'
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const TIPOS_ATIVIDADE={tarefa:'Tarefa',prazo_processual:'Prazo processual',audiencia:'Audiência',reuniao:'Reunião'}
const STATUS_ATIVIDADE={a_fazer:'A fazer',em_andamento:'Em andamento',concluida:'Concluída',cancelada:'Cancelada'}
const CATEGORIAS={trabalhista:'Trabalhista',civel:'Cível',administrativo:'Administrativo',tributario:'Tributário',criminal:'Criminal'}
const FASES={conhecimento:'Conhecimento',recurso:'Recurso',execucao_provisoria:'Execução Provisória',execucao_sentenca:'Execução de sentença',arquivo_definitivo:'Arquivo definitivo'}
const PERICIAS_PROCESSO={medica:'Médica',tecnica:'Técnica'}
const RESULTADOS_PRIMEIRA={procedente:'Procedente',procedente_em_parte:'Procedente em parte',improcedente:'Improcedente',acordo:'Acordo',ausencia_reclamante:'Ausência do(a) reclamante',extinto_sem_julgamento_merito:'Extinto sem julgamento do mérito'}
const RESULTADOS_SEGUNDA={reclamante_total:'Totalmente provido o recurso do reclamante',reclamante_parcial:'Parcialmente provido o recurso do reclamante',reclamada_total:'Totalmente provido o recurso da reclamada',reclamada_parcial:'Parcialmente provido o recurso da reclamada',mantida_primeiro_grau:'Mantida a decisão de primeiro grau'}

function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function num(v){return Number(v||0).toLocaleString('pt-BR')}
function brDate(d){if(!d)return '—';try{return new Date(String(d).includes('T')?d:d+'T12:00:00').toLocaleDateString('pt-BR')}catch{return '—'}}
function brDateTime(d){if(!d)return '—';try{return new Date(d).toLocaleString('pt-BR')}catch{return '—'}}
function monthKey(d){if(!d)return 'Sem data';const x=new Date(String(d).includes('T')?d:d+'T12:00:00');return `${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`}
function dateObj(d){return d?new Date(String(d).includes('T')?d:d+'T12:00:00'):null}
function sameMonthYear(d,ref){const x=dateObj(d);return !!x&&x.getMonth()===ref.getMonth()&&x.getFullYear()===ref.getFullYear()}
function sameYear(d,year){const x=dateObj(d);return !!x&&x.getFullYear()===year}
function monthName(ref){return ref.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase())}
function clean(s){return String(s??'').replace(/[<>&]/g,m=>({ '<':'&lt;','>':'&gt;','&':'&amp;' }[m]))}
function slug(s){return String(s||'relatorio').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()}
function parseMoney(v){if(v===null||v===undefined||v==='')return 0;if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v).replace(/[^\d,.-]/g,'');if(!s)return 0;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');return Number(s)||0}
function normalizarResultadoPrimeira(v=''){const s=String(v||'');if(RESULTADOS_PRIMEIRA[s])return s;const low=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return Object.entries(RESULTADOS_PRIMEIRA).find(([,l])=>l.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===low)?.[0]||''}
function extrairPericiasProcesso(p={}){const m=String(p?.observacoes||'').match(/\[PERICIAS_PROCESSO:([^\]]*)\]/);if(!m)return [];try{return (JSON.parse(decodeURIComponent(m[1]))||[]).filter(v=>PERICIAS_PROCESSO[v])}catch{return []}}
function extrairResultadosProcesso(p={}){const m=String(p?.observacoes||'').match(/\[RESULTADOS_PROCESSO:([^\]]*)\]/);if(!m)return {primeira:normalizarResultadoPrimeira(p?.resultado),segunda:[]};try{const r=JSON.parse(decodeURIComponent(m[1]))||{};return {primeira:normalizarResultadoPrimeira(r.primeira||p?.resultado),segunda:Array.isArray(r.segunda)?r.segunda.filter(v=>RESULTADOS_SEGUNDA[v]):[]}}catch{return {primeira:normalizarResultadoPrimeira(p?.resultado),segunda:[]}}}
function enriquecerProcessoRelatorio(p={}){const pericias=extrairPericiasProcesso(p);const resultados=extrairResultadosProcesso(p);return {...p,pericias,pericias_label:pericias.map(v=>PERICIAS_PROCESSO[v]).join(', '),resultado_primeira_instancia:resultados.primeira,resultado_primeira_instancia_label:RESULTADOS_PRIMEIRA[resultados.primeira]||'',resultado_segunda_instancia:resultados.segunda,resultado_segunda_instancia_label:resultados.segunda.map(v=>RESULTADOS_SEGUNDA[v]).join(', '),resultado:resultados.primeira||p.resultado||''}}
const PAGO_MARK='[PAGAMENTOS_CAMPOS:'
const EXCLUIDO_MARK='[REGISTRO_FINANCEIRO_EXCLUIDO:'
function extrairPagamentosCampos(obj={}){const obs=String(obj?.observacoes||'');const m=obs.match(/\[PAGAMENTOS_CAMPOS:([^\]]*)\]/);if(!m)return {};try{return JSON.parse(decodeURIComponent(m[1]))||{}}catch{return {}}}
function financeiroExcluido(f={}){return String(f?.observacoes||'').includes(EXCLUIDO_MARK)}
function valorRestituidoFinanceiro(f={}){const direto=parseMoney(f.valor_restituido);if(direto>0)return direto;const m=String(f?.observacoes||'').match(/\[VALOR_RESTITUIDO:([^\]]*)\]/);return m?parseMoney(m[1]):0}
function dataPagamentoCampo(f={},campo){const pagos=extrairPagamentosCampos(f);return pagos?.[campo]?.data_pagamento||pagos?.[campo]?.data||null}
function dataGastoCampo(f={},campo){if(campo==='seguro_premio')return dataPagamentoCampo(f,campo)||f.apolice_inicio||f.data_referencia||f.created_at;if(campo==='valor_bruto'||campo==='valor_restituido')return f.data_referencia||f.primeiro_vencimento||f.data_vencimento||f.created_at;return dataPagamentoCampo(f,campo)||f.data_referencia||f.primeiro_vencimento||f.data_vencimento||f.created_at}
const CAMPOS_ENCARGOS=['deposito_ro','deposito_rr','deposito_embargos','agravo_instrumento','custas','fgts','honorarios_sucumbenciais','honorarios_periciais','honorarios_e_custos','inss_reclamante','inss_reclamada','multa_inadimplemento']
function itensFinanceiros(f={}){
  if(financeiroExcluido(f))return []
  const itens=[]
  const vb=parseMoney(f.valor_bruto)
  if(vb>0)itens.push({categoria:String(f.natureza||'acordo').toLowerCase()==='execucao'?'execucao':'acordo',campo:'valor_bruto',valor:vb,data:dataGastoCampo(f,'valor_bruto')})
  CAMPOS_ENCARGOS.forEach(c=>{const v=parseMoney(f[c]);if(v>0)itens.push({categoria:'encargos',campo:c,valor:v,data:dataGastoCampo(f,c)})})
  const seguro=parseMoney(f.seguro_premio)
  if(seguro>0)itens.push({categoria:'seguro',campo:'seguro_premio',valor:seguro,data:dataGastoCampo(f,'seguro_premio')})
  const restituido=valorRestituidoFinanceiro(f)
  if(restituido>0)itens.push({categoria:'restituicoes',campo:'valor_restituido',valor:-restituido,data:dataGastoCampo(f,'valor_restituido')})
  return itens
}
function totalFinanceiro(f){return Math.max(itensFinanceiros(f).reduce((s,x)=>s+x.valor,0),0)}
function financeiroQuitado(f){return ['pago','quitado','concluido','concluído'].includes(String(f.status_pagamento||'').toLowerCase())}
function economiaElegivel(p,fs){return p?.transito_julgado===true || fs.some(f=>f.processo_id===p.id && ['acordo','execucao','execução'].includes(String(f.natureza||'').toLowerCase()) && financeiroQuitado(f))}
function totalGastoDoProcesso(p,fs){return fs.filter(f=>f.processo_id===p.id).reduce((s,f)=>s+totalFinanceiro(f),0)}
function economiaReal(p,fs){if(!economiaElegivel(p,fs))return 0;return Math.max(Number(p.valor_acao||0)-totalGastoDoProcesso(p,fs),0)}
function within(d,ini,fim){if(!ini&&!fim)return true;if(!d)return false;const x=new Date(String(d).includes('T')?d:d+'T12:00:00');if(ini&&x<new Date(ini+'T00:00:00'))return false;if(fim&&x>new Date(fim+'T23:59:59'))return false;return true}
function Card({title,value,sub,icon,color=C.navy}){return <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:14,padding:16}}><div style={{display:'flex',gap:8,alignItems:'center',fontSize:12,fontWeight:900,color:C.muted,textTransform:'uppercase'}}>{icon}{title}</div><div style={{fontSize:28,fontWeight:900,color,marginTop:12}}>{value}</div>{sub&&<div style={{fontSize:12,color:C.muted}}>{sub}</div>}</div>}
function F({label,children}){return <div style={{marginBottom:12}}><label style={{display:'block',fontSize:11,fontWeight:900,color:C.muted,textTransform:'uppercase',marginBottom:5}}>{label}</label>{children}</div>}

const REPORTS=[
  {id:'processos_ativos',nome:'Processos ativos',grupo:'Processos'},
  {id:'processos_arquivados',nome:'Processos arquivados/encerrados',grupo:'Processos'},
  {id:'sentencas_procedentes',nome:'Sentenças procedentes',grupo:'Processos'},
  {id:'sentencas_improcedentes',nome:'Sentenças improcedentes',grupo:'Processos'},
  {id:'acordos',nome:'Acordos',grupo:'Financeiro'},
  {id:'execucoes',nome:'Execuções',grupo:'Financeiro'},
  {id:'gastos',nome:'Valores gastos por acordos/execuções/encargos',grupo:'Financeiro'},
  {id:'tarefas',nome:'Tarefas',grupo:'Atividades'},
  {id:'prazos',nome:'Prazos processuais',grupo:'Atividades'},
  {id:'audiencias',nome:'Audiências',grupo:'Atividades'},
  {id:'reunioes',nome:'Reuniões',grupo:'Atividades'},
  {id:'atividades_concluidas',nome:'Atividades realizadas/concluídas',grupo:'Atividades'},
  {id:'geral',nome:'Relatório geral consolidado',grupo:'Consolidado'},
]

const FIELD_SETS={
  processos:[
    ['numero','Número'],['titulo','Título/parte principal'],['parte_contraria','Parte contrária'],['categoria','Categoria'],['tribunal','Tribunal'],['orgao','Órgão administrativo'],['status','Status'],['fase','Fase'],['data_ajuizamento','Data de ajuizamento'],['valor_acao','Valor da ação'],['valor_gasto','Valor efetivamente gasto'],['valor_economizado','Valor economizado'],['pericias_label','Perícias'],['transito_julgado','Trânsito em julgado'],['resultado_primeira_instancia_label','Resultado 1ª instância'],['resultado_segunda_instancia_label','Resultado 2ª instância'],['resultado','Resultado/sentença'],['resumo_processo','Resumo'],['observacoes','Observações']
  ],
  financeiro:[
    ['processo','Processo'],['natureza','Natureza'],['data_referencia','Data referência'],['valor_bruto','Valor bruto'],['valor_restituido','Valor restituido'],['forma_pagamento','Forma de pagamento'],['numero_parcelas','Número de parcelas'],['data_vencimento','Vencimento'],['agravo_instrumento','AGRAVO DE INSTRUMENTO'],['custas','Custas'],['fgts','FGTS'],['honorarios_sucumbenciais','Honorários sucumbenciais'],['honorarios_periciais','Honorários periciais'],['honorarios_e_custos','Honorários e custos'],['inss_reclamante','INSS reclamante'],['inss_reclamada','INSS reclamada'],['multa_inadimplemento','Multa'],['status_pagamento','Status pagamento'],['seguro_garantia','Seguro-garantia'],['apolice_numero','Nº apólice'],['apolice_inicio','Início vigência'],['apolice_fim','Fim vigência'],['valor_assegurado','Valor assegurado'],['seguro_premio','Prêmio pago'],['total','Total estimado']
  ],
  atividades:[
    ['tipo','Tipo'],['titulo','Título'],['descricao','Descrição'],['status','Status'],['prioridade','Prioridade'],['responsavel','Responsável'],['processo','Processo'],['contrato','Contrato'],['prazo','Data/prazo'],['horario','Horário'],['local','Local/link'],['audiencia_modalidade','Modalidade'],['audiencia_tipo','Tipo de audiência'],['created_at','Criada em']
  ]
}

function defaultFields(kind){return FIELD_SETS[kind].map(x=>x[0]).filter((_,i)=>i<9)}

export default function Relatorios({profile}){
  const [data,setData]=useState({processos:[],financeiros:[],atividades:[],contratos:[],equipe:[]})
  const [loading,setLoading]=useState(true)
  const [mode,setMode]=useState('dashboard')
  const [tipo,setTipo]=useState('processos_ativos')
  const [inicio,setInicio]=useState('')
  const [fim,setFim]=useState('')
  const [categoria,setCategoria]=useState('todas')
  const [statusAtividade,setStatusAtividade]=useState('todos')
  const [campos,setCampos]=useState(defaultFields('processos'))
  const [preview,setPreview]=useState(null)
  const [parteFilter,setParteFilter]=useState('')
  const [empresasGrupo,setEmpresasGrupo]=useState([])
  const [empresaVista,setEmpresaVista]=useState('')

  useEffect(()=>{(async()=>{
    const eid=profile.escritorio_id
    const [processos, financeiros, atividades, contratos, equipeRes]=await Promise.all([
      fetchAllRows(()=>supabase.from('processos').select('*').eq('escritorio_id',eid)),
      fetchAllRows(()=>supabase.from('financeiro_processos').select('*').eq('escritorio_id',eid)),
      fetchAllRows(()=>supabase.from('atividades').select('*').eq('escritorio_id',eid)),
      fetchAllRows(()=>supabase.from('contratos').select('*').eq('escritorio_id',eid)),
      supabase.from('usuarios_escritorios').select('usuario_id,profiles(id,nome,email)').eq('escritorio_id',eid).eq('ativo',true),
    ])
    setData({
      processos:processos||[],
      financeiros:financeiros||[],
      atividades:atividades||[],
      contratos:contratos||[],
      equipe:(equipeRes.data||[]).map(x=>({id:x.usuario_id,nome:x.profiles?.nome||x.profiles?.email||x.usuario_id,email:x.profiles?.email||''}))
    })
    setLoading(false)
  })()},[profile.escritorio_id])

  useEffect(()=>{(async()=>{
    const { data }=await supabase.from('partes_crm').select('id,nome,nome_fantasia').eq('escritorio_id',profile.escritorio_id).eq('tipo','empresa_grupo').eq('status','ativo').order('nome')
    setEmpresasGrupo(data||[])
  })()},[profile.escritorio_id])

  useEffect(()=>{
    if(!empresasGrupo.length)return
    setEmpresaVista(v=>v||pickDefaultEmpresaGrupoId(empresasGrupo))
  },[empresasGrupo])

  const viewData=useMemo(()=>scopeDataByEmpresaGrupo(data,empresasGrupo,empresaVista),[data,empresasGrupo,empresaVista])

  const maps=useMemo(()=>({
    processos:Object.fromEntries(viewData.processos.map(p=>[p.id,p])),
    contratos:Object.fromEntries(viewData.contratos.map(c=>[c.id,c])),
    equipe:Object.fromEntries(viewData.equipe.map(u=>[u.id,u])),
  }),[viewData])

  const st=useMemo(()=>{
    const ps=viewData.processos, fs=viewData.financeiros.filter(f=>!financeiroExcluido(f)), as=viewData.atividades
    const hoje=new Date()
    const anoAtual=hoje.getFullYear()
    const mesAnterior=new Date(anoAtual,hoje.getMonth()-1,1)
    const baseCat=()=>({acordo:0,execucao:0,seguro:0,encargos:0,restituicoes:0,total:0})
    const gastosMesAtual=baseCat()
    const gastosMesAnterior=baseCat()
    const gastosAnoAtual=baseCat()
    const gastosAnoAnterior=baseCat()
    fs.forEach(f=>{itensFinanceiros(f).forEach(item=>{
      if(sameMonthYear(item.data,hoje)){gastosMesAtual[item.categoria]+=item.valor;gastosMesAtual.total+=item.valor}
      if(sameMonthYear(item.data,mesAnterior)){gastosMesAnterior[item.categoria]+=item.valor;gastosMesAnterior.total+=item.valor}
      if(sameYear(item.data,anoAtual)){gastosAnoAtual[item.categoria]+=item.valor;gastosAnoAtual.total+=item.valor}
      if(sameYear(item.data,anoAtual-1)){gastosAnoAnterior[item.categoria]+=item.valor;gastosAnoAnterior.total+=item.valor}
    })})
    const variacaoMes=gastosMesAnterior.total?((gastosMesAtual.total-gastosMesAnterior.total)/gastosMesAnterior.total)*100:(gastosMesAtual.total?100:0)
    const economia=ps.reduce((s,p)=>s+economiaReal(p,fs),0)
    const acordos=fs.filter(f=>f.natureza==='acordo')
    const execs=fs.filter(f=>f.natureza==='execucao')
    return {processos:ps.length,ativos:ps.filter(p=>p.status!=='encerrado'&&p.status!=='arquivado').length,encerrados:ps.filter(p=>p.status==='encerrado'||p.status==='arquivado').length,acordos:acordos.length,execucoes:execs.length,totalGasto:gastosMesAtual.total,totalAnoAtual:gastosAnoAtual.total,totalAnoAnterior:gastosAnoAnterior.total,gastosMesAtual,gastosMesAnterior,gastosAnoAtual,gastosAnoAnterior,variacaoMes,anoAtual,anoAnterior:anoAtual-1,mesAtualLabel:monthName(hoje),mesAnteriorLabel:monthName(mesAnterior),economia,improcedentes:ps.filter(p=>String(p.resultado||'').toLowerCase().includes('improced')).length,procedentes:ps.filter(p=>String(p.resultado||'').toLowerCase().includes('proced')&&!String(p.resultado||'').toLowerCase().includes('improced')).length,atividades:as.length,prazos:as.filter(a=>a.tipo==='prazo_processual').length,audiencias:as.filter(a=>a.tipo==='audiencia').length,percAcordo:fs.length?Math.round(acordos.length/fs.length*100):0,percExec:fs.length?Math.round(execs.length/fs.length*100):0}
  },[viewData])
  const kind=useMemo(()=>tipo.includes('acordos')||tipo.includes('execu')||tipo==='gastos'?'financeiro':tipo.includes('tarefas')||tipo.includes('prazos')||tipo.includes('audiencias')||tipo.includes('reunioes')||tipo.includes('atividades')?'atividades':'processos',[tipo])
  useEffect(()=>{setCampos(defaultFields(kind))},[kind])

  function formatValue(row,field){
    if(['valor_acao','valor_gasto','valor_economizado','valor_bruto','valor_restituido','agravo_instrumento','custas','fgts','honorarios_sucumbenciais','honorarios_periciais','honorarios_e_custos','inss_reclamante','inss_reclamada','multa_inadimplemento','valor_assegurado','seguro_premio','total'].includes(field))return money(row[field])
    if(['data_ajuizamento','data_referencia','data_vencimento','apolice_inicio','apolice_fim','prazo'].includes(field))return brDate(row[field])
    if(field==='created_at')return brDateTime(row[field])
    if(field==='transito_julgado')return row[field]?'Sim':'Não'
    if(field==='seguro_garantia')return row[field]?'Sim':'Não'
    if(field==='resultado')return RESULTADOS_PRIMEIRA[row[field]]||row[field]||'—'
    if(['pericias_label','resultado_primeira_instancia_label','resultado_segunda_instancia_label'].includes(field))return row[field]||'—'
    if(field==='categoria')return CATEGORIAS[row[field]]||row[field]||'—'
    if(field==='fase')return FASES[row[field]]||row[field]||'—'
    if(field==='tipo')return TIPOS_ATIVIDADE[row[field]]||row[field]||'—'
    if(field==='status'&&row.__kind==='atividade')return STATUS_ATIVIDADE[row[field]]||row[field]||'—'
    if(field==='processo'){const p=maps.processos[row.processo_id];return p?`${p.numero||''} ${p.titulo||''}`.trim():'—'}
    if(field==='contrato'){const c=maps.contratos[row.contrato_id];return c?`${c.numero||''} ${c.titulo||''}`.trim():'—'}
    if(field==='responsavel'){const u=maps.equipe[row.responsavel_id];return u?.nome||'—'}
    if(field==='natureza')return row[field]==='execucao'?'Execução':row[field]==='acordo'?'Acordo':row[field]||'—'
    if(field==='audiencia_modalidade')return row[field]==='online'?'Online':row[field]==='presencial'?'Presencial':row[field]||'—'
    if(field==='audiencia_tipo')return ({inicial:'Inicial',instrucao:'Instrução',una:'Una',conciliacao:'Conciliação'})[row[field]]||row[field]||'—'
    return row[field]??'—'
  }

  function gerarDados(){
    let title=REPORTS.find(r=>r.id===tipo)?.nome||'Relatório'
    let rows=[]
    if(kind==='processos'){
      rows=viewData.processos.map(enriquecerProcessoRelatorio).filter(p=>categoria==='todas'||(p.categoria||'trabalhista')===categoria)
      if(tipo==='processos_ativos')rows=rows.filter(p=>p.status!=='encerrado'&&p.status!=='arquivado')
      if(tipo==='processos_arquivados')rows=rows.filter(p=>p.status==='encerrado'||p.status==='arquivado'||p.fase==='arquivo_definitivo')
      if(tipo==='sentencas_procedentes')rows=rows.filter(p=>String(p.resultado||'').toLowerCase().includes('proced')&&!String(p.resultado||'').toLowerCase().includes('improced'))
      if(tipo==='sentencas_improcedentes')rows=rows.filter(p=>String(p.resultado||'').toLowerCase().includes('improced'))
      rows=rows.filter(p=>within(p.data_ajuizamento||p.updated_at||p.created_at,inicio,fim))
      if(parteFilter.trim())rows=rows.filter(p=>String(p.parte_contraria||'').toLowerCase().includes(parteFilter.trim().toLowerCase()))
      rows=rows.map(p=>({...p,__kind:'processo',valor_gasto:totalGastoDoProcesso(p,viewData.financeiros),valor_economizado:economiaReal(p,viewData.financeiros)}))
    } else if(kind==='financeiro'){
      rows=viewData.financeiros.filter(f=>!financeiroExcluido(f))
      if(tipo==='acordos')rows=rows.filter(f=>f.natureza==='acordo')
      if(tipo==='execucoes')rows=rows.filter(f=>f.natureza==='execucao')
      rows=rows.filter(f=>itensFinanceiros(f).some(item=>within(item.data,inicio,fim))).map(f=>({...f,__kind:'financeiro',valor_restituido:valorRestituidoFinanceiro(f),total:totalFinanceiro(f)}))
    } else {
      rows=viewData.atividades
      if(tipo==='tarefas')rows=rows.filter(a=>a.tipo==='tarefa')
      if(tipo==='prazos')rows=rows.filter(a=>a.tipo==='prazo_processual')
      if(tipo==='audiencias')rows=rows.filter(a=>a.tipo==='audiencia')
      if(tipo==='reunioes')rows=rows.filter(a=>a.tipo==='reuniao')
      if(tipo==='atividades_concluidas')rows=rows.filter(a=>a.status==='concluida')
      if(statusAtividade!=='todos')rows=rows.filter(a=>a.status===statusAtividade)
      rows=rows.filter(a=>within(a.prazo||a.created_at,inicio,fim)).map(a=>({...a,__kind:'atividade'}))
    }
    const totals={quantidade:rows.length}
    if(kind==='financeiro')totals.valorTotal=rows.reduce((s,r)=>s+totalFinanceiro(r),0)
    if(kind==='processos'){
      totals.valorCausa=rows.reduce((s,r)=>s+Number(r.valor_acao||0),0)
      totals.valorGasto=rows.reduce((s,r)=>s+Number(r.valor_gasto||0),0)
      totals.economia=rows.reduce((s,r)=>s+Number(r.valor_economizado||0),0)
    }
    return {title,rows,totals,kind,campos:[...campos]}
  }

  function htmlRelatorio(rep){
    const fieldLabels=Object.fromEntries(FIELD_SETS[rep.kind].map(([k,l])=>[k,l]))
    const periodo=inicio||fim?`${inicio?brDate(inicio):'início'} a ${fim?brDate(fim):'hoje'}`:'Todos os períodos'
    const summary=[]
    summary.push(`<div><b>Tipo:</b> ${clean(rep.title)}</div>`)
    summary.push(`<div><b>Período:</b> ${clean(periodo)}</div>`)
    summary.push(`<div><b>Quantidade:</b> ${num(rep.totals.quantidade)}</div>`)
    if(rep.totals.valorTotal!==undefined)summary.push(`<div><b>Valor total:</b> ${money(rep.totals.valorTotal)}</div>`)
    if(rep.totals.valorCausa!==undefined){summary.push(`<div><b>Valor da ação:</b> ${money(rep.totals.valorCausa)}</div>`);summary.push(`<div><b>Valor gasto:</b> ${money(rep.totals.valorGasto)}</div>`);summary.push(`<div><b>Economia:</b> ${money(rep.totals.economia)}</div>`)}
    const rows=rep.rows.map(r=>`<tr>${rep.campos.map(c=>`<td>${clean(formatValue(r,c))}</td>`).join('')}</tr>`).join('')
    return `<!doctype html><html><head><meta charset="utf-8"/><title>${clean(rep.title)}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:32px}h1{margin:0 0 4px}.muted{color:#64748b}.summary{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:8px;margin:18px 0;padding:14px;border:1px solid #e5e7eb;border-radius:10px;background:#f8fafc}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #e5e7eb;padding:7px;vertical-align:top}th{background:#064e3b;color:white;text-align:left}tr:nth-child(even){background:#f8fafc}@media print{body{margin:18mm}.no-print{display:none}}</style></head><body><h1>${clean(rep.title)}</h1><div class="muted">${clean(APP_CONFIG.nome)} - gerado em ${new Date().toLocaleString('pt-BR')}</div><div class="summary">${summary.join('')}</div><table><thead><tr>${rep.campos.map(c=>`<th>${clean(fieldLabels[c]||c)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${rep.campos.length}">Nenhum registro encontrado.</td></tr>`}</tbody></table></body></html>`
  }

  function visualizar(){setPreview(gerarDados())}
  function baixarHtml(rep=gerarDados()){
    const blob=new Blob([htmlRelatorio(rep)],{type:'text/html;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slug(rep.title)}-${new Date().toISOString().slice(0,10)}.html`;a.click();URL.revokeObjectURL(a.href)
  }
  function baixarCsv(rep=gerarDados()){
    const labels=Object.fromEntries(FIELD_SETS[rep.kind].map(([k,l])=>[k,l]));const lines=[rep.campos.map(c=>`"${(labels[c]||c).replace(/"/g,'""')}"`).join(';')]
    rep.rows.forEach(r=>lines.push(rep.campos.map(c=>`"${String(formatValue(r,c)).replace(/"/g,'""')}"`).join(';')))
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slug(rep.title)}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href)
  }
  function gerarPdf(rep=gerarDados()){
    const w=window.open('','_blank')
    if(!w){alert('Permita pop-ups para gerar o PDF.');return}
    w.document.open();w.document.write(htmlRelatorio(rep));w.document.close();setTimeout(()=>{w.focus();w.print()},400)
  }

  if(loading)return <div style={{padding:40,color:C.muted}}>Carregando relatórios...</div>
  const currentFields=FIELD_SETS[kind]
  return <div style={{padding:24}}>
    {mode==='dashboard'?<>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Relatórios</h1><p style={{color:C.muted,margin:'6px 0 0'}}>Dados consolidados e geração de relatórios customizados.</p></div><button onClick={()=>{setMode('gerador');setPreview(null)}} style={{background:C.navy,color:'white',border:0,borderRadius:10,padding:'11px 16px',fontWeight:900,display:'flex',alignItems:'center',gap:8}}><SlidersHorizontal size={16}/>Gerar relatório</button></div>
      <EmpresaGrupoToggleBar empresas={empresasGrupo} value={empresaVista} onChange={setEmpresaVista}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:14,marginTop:18}}><Card title="Processos" value={st.processos} sub={`${st.ativos} ativos · ${st.encerrados} encerrados`} icon={<Scale size={15}/>} color={C.blue}/><Card title="Gasto do mês" value={money(st.totalGasto)} sub={st.mesAtualLabel} icon={<DollarSign size={15}/>} color={C.red}/><Card title={`Acumulado ${st.anoAtual}`} value={money(st.totalAnoAtual)} sub="janeiro até o mês atual" icon={<BarChart3 size={15}/>} color={C.amber}/><Card title={`Total ${st.anoAnterior}`} value={money(st.totalAnoAnterior)} sub="histórico resumido do ano anterior" icon={<DollarSign size={15}/>} color={C.muted}/><Card title="Mês atual vs anterior" value={`${st.variacaoMes>=0?'+':''}${st.variacaoMes.toFixed(1)}%`} sub={`${money(st.gastosMesAtual.total)} vs ${money(st.gastosMesAnterior.total)}`} icon={<BarChart3 size={15}/>} color={st.variacaoMes>0?C.red:st.variacaoMes<0?C.green:C.muted}/><Card title="Atividades" value={st.atividades} sub={`${st.prazos} prazos · ${st.audiencias} audiências`} icon={<CheckSquare size={15}/>} color={C.blue}/></div>
      <section style={{background:C.white,border:'1px solid '+C.border,borderRadius:14,marginTop:20,overflow:'hidden'}}><h2 style={{fontSize:16,margin:0,padding:16,borderBottom:'1px solid '+C.border}}>Gastos do mês e natureza — {st.mesAtualLabel}</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{background:C.bg,color:C.muted,textAlign:'left'}}><th style={{padding:12}}>Acordo</th><th style={{padding:12}}>Execução</th><th style={{padding:12}}>Seguro-garantia</th><th style={{padding:12}}>Encargos</th><th style={{padding:12}}>Restituicoes</th><th style={{padding:12}}>Total do mês</th></tr></thead><tbody><tr style={{borderTop:'1px solid '+C.border}}><td style={{padding:12}}>{money(st.gastosMesAtual.acordo)}</td><td style={{padding:12}}>{money(st.gastosMesAtual.execucao)}</td><td style={{padding:12}}>{money(st.gastosMesAtual.seguro)}</td><td style={{padding:12}}>{money(st.gastosMesAtual.encargos)}</td><td style={{padding:12,color:C.green}}>{money(st.gastosMesAtual.restituicoes)}</td><td style={{padding:12,fontWeight:900}}>{money(st.gastosMesAtual.total)}</td></tr></tbody></table></div></section>
      <section style={{background:C.white,border:'1px solid '+C.border,borderRadius:14,marginTop:20,overflow:'hidden'}}><h2 style={{fontSize:16,margin:0,padding:16,borderBottom:'1px solid '+C.border}}>Acumulados gerenciais</h2><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{background:C.bg,color:C.muted,textAlign:'left'}}><th style={{padding:12}}>Período</th><th style={{padding:12}}>Acordo</th><th style={{padding:12}}>Execução</th><th style={{padding:12}}>Seguro-garantia</th><th style={{padding:12}}>Encargos</th><th style={{padding:12}}>Restituicoes</th><th style={{padding:12}}>Total</th></tr></thead><tbody>{[[`Ano atual ${st.anoAtual}`,st.gastosAnoAtual],[`Ano anterior ${st.anoAnterior}`,st.gastosAnoAnterior]].map(([periodo,v])=><tr key={periodo} style={{borderTop:'1px solid '+C.border}}><td style={{padding:12,fontWeight:800}}>{periodo}</td><td style={{padding:12}}>{money(v.acordo)}</td><td style={{padding:12}}>{money(v.execucao)}</td><td style={{padding:12}}>{money(v.seguro)}</td><td style={{padding:12}}>{money(v.encargos)}</td><td style={{padding:12,color:C.green}}>{money(v.restituicoes)}</td><td style={{padding:12,fontWeight:900}}>{money(v.total)}</td></tr>)}</tbody></table></div></section>
      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14,marginTop:20}}><Card title="Sentenças improcedentes" value={st.improcedentes} sub="com base no campo resultado" icon={<FileText size={15}/>} color={C.green}/><Card title="Sentenças procedentes" value={st.procedentes} sub="com base no campo resultado" icon={<FileText size={15}/>} color={C.red}/><Card title="Audiências" value={st.audiencias} sub="atividades do tipo audiência" icon={<CalendarDays size={15}/>} color={C.amber}/></section>
    </>:<>
      <button onClick={()=>setMode('dashboard')} style={{border:0,background:'none',color:C.muted,cursor:'pointer',display:'flex',alignItems:'center',gap:6,marginBottom:12}}><ArrowLeft size={16}/>Voltar ao painel de relatórios</button>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h1 style={{margin:0,fontSize:22,fontWeight:900,color:C.text}}>Gerar relatório</h1><p style={{color:C.muted,margin:'6px 0 0'}}>Escolha tipo, período e campos. O PDF será gerado pela janela de impressão do navegador.</p></div></div>
      <EmpresaGrupoToggleBar empresas={empresasGrupo} value={empresaVista} onChange={setEmpresaVista}/>
      <section style={{background:C.white,border:'1px solid '+C.border,borderRadius:14,padding:16,marginTop:14}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}><F label="Tipo de relatório"><select style={INP} value={tipo} onChange={e=>{setTipo(e.target.value);setPreview(null)}}>{Object.entries(REPORTS.reduce((a,r)=>{(a[r.grupo]||=[]).push(r);return a},{})).map(([g,rs])=><optgroup key={g} label={g}>{rs.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}</optgroup>)}</select></F><F label="Data inicial"><input style={INP} type="date" value={inicio} onChange={e=>setInicio(e.target.value)}/></F><F label="Data final"><input style={INP} type="date" value={fim} onChange={e=>setFim(e.target.value)}/></F>{kind==='processos'&&<F label="Categoria"><select style={INP} value={categoria} onChange={e=>setCategoria(e.target.value)}><option value="todas">Todas</option>{Object.entries(CATEGORIAS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>}{kind==='processos'&&<F label="Parte contrária / reclamada"><input style={INP} value={parteFilter} onChange={e=>{setParteFilter(e.target.value);setPreview(null)}} placeholder="Filtrar por empresa…"/></F>}{kind==='atividades'&&<F label="Status"><select style={INP} value={statusAtividade} onChange={e=>setStatusAtividade(e.target.value)}><option value="todos">Todos</option>{Object.entries(STATUS_ATIVIDADE).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>}</div>
        <F label="Campos do relatório"><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:8}}>{currentFields.map(([v,l])=><label key={v} style={{display:'flex',gap:8,alignItems:'center',fontSize:13,padding:8,border:'1px solid '+C.border,borderRadius:8,background:campos.includes(v)?C.greenBg:C.white}}><input type="checkbox" checked={campos.includes(v)} onChange={e=>setCampos(e.target.checked?[...campos,v]:campos.filter(c=>c!==v))}/>{l}</label>)}</div></F>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button onClick={visualizar} style={{background:C.navy,color:'white',border:0,borderRadius:10,padding:'10px 14px',fontWeight:900}}>Visualizar</button><button onClick={()=>gerarPdf(preview||gerarDados())} style={{background:'#10b981',color:'white',border:0,borderRadius:10,padding:'10px 14px',fontWeight:900,display:'flex',gap:6,alignItems:'center'}}><Printer size={15}/>Gerar PDF</button><button onClick={()=>baixarHtml(preview||gerarDados())} style={{background:C.white,color:C.text,border:'1px solid '+C.border,borderRadius:10,padding:'10px 14px',fontWeight:900,display:'flex',gap:6,alignItems:'center'}}><Download size={15}/>Baixar HTML</button><button onClick={()=>baixarCsv(preview||gerarDados())} style={{background:C.white,color:C.text,border:'1px solid '+C.border,borderRadius:10,padding:'10px 14px',fontWeight:900}}>Baixar CSV</button></div>
      </section>
      {preview&&<section style={{background:C.white,border:'1px solid '+C.border,borderRadius:14,marginTop:18,overflow:'hidden'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:16,borderBottom:'1px solid '+C.border}}><div><h2 style={{margin:0,fontSize:17}}>{preview.title}</h2><p style={{margin:'4px 0 0',color:C.muted,fontSize:13}}>{preview.rows.length} registro(s) encontrado(s)</p></div><button onClick={()=>gerarPdf(preview)} style={{background:'#10b981',color:'white',border:0,borderRadius:10,padding:'9px 13px',fontWeight:900}}>PDF</button></div><div style={{padding:14,display:'flex',gap:10,flexWrap:'wrap',background:C.bg,borderBottom:'1px solid '+C.border}}><b>Quantidade: {preview.totals.quantidade}</b>{preview.totals.valorTotal!==undefined&&<b>Total: {money(preview.totals.valorTotal)}</b>}{preview.totals.economia!==undefined&&<b>Economia: {money(preview.totals.economia)}</b>}</div><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr style={{background:C.soft,color:C.muted,textAlign:'left'}}>{preview.campos.map(c=><th key={c} style={{padding:10,borderBottom:'1px solid '+C.border}}>{Object.fromEntries(FIELD_SETS[preview.kind].map(x=>[x[0],x[1]]))[c]}</th>)}</tr></thead><tbody>{preview.rows.map((r,i)=><tr key={i} style={{borderBottom:'1px solid '+C.border}}>{preview.campos.map(c=><td key={c} style={{padding:10,verticalAlign:'top',maxWidth:260}}>{formatValue(r,c)}</td>)}</tr>)}{!preview.rows.length&&<tr><td colSpan={preview.campos.length} style={{padding:24,textAlign:'center',color:C.muted}}>Nenhum registro encontrado.</td></tr>}</tbody></table></div></section>}
    </>}
  </div>
}
