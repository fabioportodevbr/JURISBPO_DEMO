import { useEffect, useMemo, useState } from 'react'
import { supabase, can } from '../lib/supabase.js'
import { Plus, Search, Edit2, Trash2, X, FolderOpen, Clock, CheckSquare, DollarSign, Download } from 'lucide-react'
import DocumentosVinculados from './DocumentoVinculados.jsx'
import AndamentosProcessuaisPush from './AndamentosProcessuaisPush.jsx'
import { SeguroGarantiaCampos, TransitoJulgadoCampo, calcularResumoFinanceiroProcesso } from './FinanceiroSeguroGarantia.jsx'

const C={navy:'#050505',white:'#fff',text:'#0f172a',muted:'#64748b',border:'#e5e7eb',blue:'#1d4ed8',blueBg:'#dbeafe',red:'#dc2626',redBg:'#fee2e2',green:'#16a34a',greenBg:'#dcfce7',amber:'#b45309',amberBg:'#fef3c7',purple:'#064e3b',purpleBg:'#dcfce7',grayBg:'#f1f5f9'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}
const STATUS=[['ativo','Ativo'],['arquivo_temporario','Arquivo temporário'],['encerrado','Encerrado']]
const FASES=[['conhecimento','Conhecimento'],['recurso','Recurso'],['execucao_sentenca','Execução de sentença'],['arquivo_definitivo','Arquivo definitivo']]
const CATEGORIAS=[['trabalhista','Trabalhista'],['civel','Cível'],['administrativo','Administrativo'],['tributario','Tributário'],['criminal','Criminal']]
const ATIV_TIPOS=[['tarefa','Tarefas'],['prazo_processual','Prazos processuais'],['audiencia','Audiências'],['reuniao','Reuniões']]
const ATIV_STATUS=[['a_fazer','A fazer'],['em_andamento','Em andamento'],['concluida','Concluída'],['cancelada','Cancelada']]
const ATIV_PRIOR=[['baixa','Baixa'],['media','Média'],['alta','Alta'],['urgente','Urgente']]
const AUDIENCIA_MODALIDADES=[['presencial','Presencial'],['online','Online']]
const AUDIENCIA_TIPOS=[['inicial','Inicial'],['instrucao','Instrução'],['una','Una'],['conciliacao','Conciliação']]
const NATUREZAS=[['acordo','Acordo'],['execucao','Execução']]
const FORMAS=[['avista','À vista'],['parcelado','Parcelado']]
const PAG_STATUS=[['pendente','Pendente'],['em_dia','Em dia'],['atrasado','Atrasado'],['pago','Pago'],['quitado','Quitado'],['inadimplido','Inadimplido']]
const CAMPOS_AP=[
  ['deposito_ro','DEPÓSITO RO'],['deposito_rr','DEPÓSITO RR'],['deposito_embargos','DEPÓSITO EMBARGOS'],
  ['custas','CUSTAS'],['fgts','FGTS'],['honorarios_sucumbenciais','HONORÁRIOS SUCUMBENCIAIS'],['honorarios_periciais','HONORÁRIOS PERICIAIS'],
  ['inss_reclamante','INSS RECLAMANTE'],['inss_reclamada','INSS RECLAMADA'],['multa_inadimplemento','MULTA POR INADIMPLEMENTO'],['seguro_premio','PRÊMIO SEGURO-GARANTIA']
]
function itensFinanceirosAP(f={}){return CAMPOS_AP.map(([k,l])=>({key:k,label:l,valor:parseMoney(f[k])})).filter(x=>x.valor>0)}
function financeiroEhAcordoExecucao(f={}){return parseMoney(f.valor_bruto)>0}
function tituloAPFinanceiro(f={}){const itens=itensFinanceirosAP(f);return financeiroEhAcordoExecucao(f)?label(NATUREZAS,f.natureza)||'Acordo':itens.map(x=>x.label).join(' + ')||label(NATUREZAS,f.natureza)||'Pagamento'}
function observacaoAPFinanceiro(f={},base=''){const limpas=limparObservacoesParcelas(base||f.observacoes||'');if(financeiroEhAcordoExecucao(f))return limpas;const itens=itensFinanceirosAP(f);const linhas=itens.map(x=>`${x.label}: ${money(x.valor)}`);if(itens.length)linhas.push(`TOTAL: ${money(itens.reduce((s,x)=>s+x.valor,0))}`);return [limpas,...linhas].filter(Boolean).join('\n')}
function label(arr,v){return arr.find(x=>x[0]===v)?.[1]||v||'—'}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function dateBR(d){return d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR'):'—'}
const VENC_MARK='[VENCIMENTOS_PARCELAS:'
const VALORES_MARK='[VALORES_PARCELAS:'
const DIVIDIR_MARK='[DIVIDIR_PARCELAS:'
const PAGO_MARK='[PAGAMENTOS_CAMPOS:'
const AUDIT_PAGO_MARK='[AUDITORIA_PAGAMENTOS:'
function parseMoney(v){if(v===null||v===undefined||v==='')return 0;if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v).replace(/[^\d,.-]/g,'');if(!s)return 0;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');return Number(s)||0}
function moeda(v){if(v===null||v===undefined||v==='')return '';return parseMoney(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function moedaChange(valor,setter){const digits=String(valor||'').replace(/\D/g,'');setter(digits?(Number(digits)/100).toFixed(2):'')}
function limparObservacoesParcelas(obs=''){return String(obs||'').replace(/\n?\[VENCIMENTOS_PARCELAS:[^\]]*\]/g,'').replace(/\n?\[VALORES_PARCELAS:[^\]]*\]/g,'').replace(/\n?\[DIVIDIR_PARCELAS:[^\]]*\]/g,'').replace(/\n?\[PAGAMENTOS_CAMPOS:[^\]]*\]/g,'').replace(/\n?\[AUDITORIA_PAGAMENTOS:[^\]]*\]/g,'').replace(/\n?\[REGISTRO_FINANCEIRO_EXCLUIDO:[^\]]*\]/g,'').trim()}
function extrairVencimentosParcelas(obj={}){const obs=String(obj?.observacoes||'');const m=obs.match(/\[VENCIMENTOS_PARCELAS:([^\]]*)\]/);const arr=m?m[1].split(',').map(x=>x.trim()).filter(Boolean):[];if(!arr.length&&obj?.primeiro_vencimento)arr.push(obj.primeiro_vencimento);const n=Math.max(1,Number(obj?.numero_parcelas||1));while(arr.length<n)arr.push('');return arr.slice(0,n)}
function extrairDividirParcelas(obj={}){const obs=String(obj?.observacoes||'');const m=obs.match(/\[DIVIDIR_PARCELAS:([^\]]*)\]/);return m?m[1]!=='nao':true}
function extrairValoresParcelas(obj={}){const obs=String(obj?.observacoes||'');const m=obs.match(/\[VALORES_PARCELAS:([^\]]*)\]/);const n=Math.max(1,Number(obj?.numero_parcelas||1));const arr=m?m[1].split(',').map(x=>parseMoney(x)):[];const total=totalFinanceiroBrutoRegistro(obj);if(!arr.length){const igual=total/n;for(let i=0;i<n;i++)arr.push(igual)}while(arr.length<n)arr.push(0);return arr.slice(0,n)}
function juntarObservacoesParcelas(obs='',vencimentos=[],valores=[],dividir=true){const limpas=limparObservacoesParcelas(obs);const datas=(vencimentos||[]).map(x=>String(x||'').trim()).filter(Boolean);const marcadorDatas=datas.length?`${VENC_MARK}${datas.join(',')}]`:'';const marcadorDividir=`${DIVIDIR_MARK}${dividir?'sim':'nao'}]`;const marcadorValores=!dividir&&valores?.length?`${VALORES_MARK}${valores.map(v=>parseMoney(v).toFixed(2)).join(',')}]`:'';return [limpas,marcadorDatas,marcadorDividir,marcadorValores].filter(Boolean).join('\n')}
function extrairPagamentosCampos(obj={}){const obs=String(obj?.observacoes||'');const m=obs.match(/\[PAGAMENTOS_CAMPOS:([^\]]*)\]/);if(!m)return {};try{return JSON.parse(decodeURIComponent(m[1]))||{}}catch{return {}}}
function juntarPagamentosCampos(obs='',pagos={}){const limpas=String(obs||'').replace(/\n?\[PAGAMENTOS_CAMPOS:[^\]]*\]/g,'').replace(/\n?\[AUDITORIA_PAGAMENTOS:[^\]]*\]/g,'').replace(/\n?\[REGISTRO_FINANCEIRO_EXCLUIDO:[^\]]*\]/g,'').trim();const marcador=pagos&&Object.keys(pagos).length?`${PAGO_MARK}${encodeURIComponent(JSON.stringify(pagos))}]`:'';return [limpas,marcador].filter(Boolean).join('\n')}
function extrairAuditoriaPagamentos(obj={}){const obs=String(obj?.observacoes||'');const m=obs.match(/\[AUDITORIA_PAGAMENTOS:([^\]]*)\]/);if(!m)return [];try{return JSON.parse(decodeURIComponent(m[1]))||[]}catch{return []}}
function juntarAuditoriaPagamentos(obs='',auditoria=[]){const limpas=String(obs||'').replace(/\n?\[AUDITORIA_PAGAMENTOS:[^\]]*\]/g,'').trim();const marcador=auditoria?.length?`${AUDIT_PAGO_MARK}${encodeURIComponent(JSON.stringify(auditoria))}]`:'';return [limpas,marcador].filter(Boolean).join('\n')}
const EXCLUIDO_MARK='[REGISTRO_FINANCEIRO_EXCLUIDO:'
function usuarioAuditoria(profile){return {usuario_id:profile?.id||'',usuario_nome:profile?.nome||profile?.email||profile?.id||'',data:new Date().toISOString()}}
function extrairRegistroExcluido(obj={}){const obs=String(obj?.observacoes||'');const m=obs.match(/\[REGISTRO_FINANCEIRO_EXCLUIDO:([^\]]*)\]/);if(!m)return null;try{return JSON.parse(decodeURIComponent(m[1]))||null}catch{return null}}
function financeiroExcluido(f={}){return !!extrairRegistroExcluido(f)}
function temPagamentoCampoAtivo(f={}){return Object.values(extrairPagamentosCampos(f)||{}).some(v=>v?.pago)}
function juntarRegistroExcluido(obs='',evento=null){const limpas=String(obs||'').replace(/\n?\[REGISTRO_FINANCEIRO_EXCLUIDO:[^\]]*\]/g,'').trim();const marcador=evento?`${EXCLUIDO_MARK}${encodeURIComponent(JSON.stringify(evento))}]`:'';return [limpas,marcador].filter(Boolean).join('\n')}
function ordinalParcela(i){const nomes=['1º','2º','3º','4º','5º','6º','7º','8º','9º','10º','11º','12º'];return nomes[i-1]||`${i}º`}
function F({label,children}){return <div style={{marginBottom:12,flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>{children}</div>}
function PaidValueField({label,field,fin,setFin,onPaid}){const pago=fin.pagamentos_campos?.[field]?.pago;return <F label={label}><div style={{display:'flex',gap:6,alignItems:'center'}}><input type="text" inputMode="numeric" style={INP} value={moeda(fin[field])} onChange={e=>moedaChange(e.target.value,v=>setFin(f=>({...f,[field]:v})))} placeholder="R$ 0,00"/><button type="button" onClick={()=>onPaid(field,label)} style={{whiteSpace:'nowrap',border:'1px solid '+(pago?C.green:C.border),background:pago?C.greenBg:C.white,color:pago?C.green:C.text,borderRadius:8,padding:'9px 10px',fontSize:12,fontWeight:800,cursor:'pointer'}}>{pago?'Pago':'Marcar pago'}</button></div>{pago&&<div style={{fontSize:11,color:C.green,marginTop:4}}>Pago{fin.pagamentos_campos?.[field]?.comprovante?` · ${fin.pagamentos_campos[field].comprovante}`:''}</div>}</F>}
function Modal({title,onClose,children}){return <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><div className="modal-content" style={{background:C.white,borderRadius:14,width:'100%',maxWidth:1080,maxHeight:'92vh',display:'flex',flexDirection:'column',overflow:'hidden'}}><div className="modal-header" style={{display:'flex',justifyContent:'space-between',padding:18,borderBottom:'1px solid '+C.border}}><b>{title}</b><button onClick={onClose} style={{border:0,background:'none',cursor:'pointer'}}><X/></button></div><div className="modal-body" style={{padding:18,overflow:'auto'}}>{children}</div></div></div>}

const AP_INPUT={width:'100%',border:'1px solid #111',minHeight:26,padding:'4px 6px',fontSize:12,boxSizing:'border-box',background:'#fff'}
const AP_DEPARTAMENTOS=['BRASÍLIA','SÃO PAULO','PAULÍNIA','RORAIMA','RIO DE JANEIRO','BAHIA','AMAZONAS','VALPARAÍSO DO GOIÁS','RONDÔNIA','ALAGOAS','TERESINA']
const AP_FORMAS=['Depósito','Dinheiro','Guia','Cheque','PIX']
const AP_AREAS=['Administrativo','Judicial']
function competenciaAtual(){return new Date().toLocaleDateString('pt-BR',{month:'2-digit',year:'numeric'})}
function inferirDepartamento(proc){const t=String(`${proc?.tribunal||''} ${proc?.orgao||''}`).toUpperCase();if(t.includes('TJSP')||t.includes('TRT-2')||t.includes('SÃO PAULO')||t.includes('SAO PAULO'))return 'SÃO PAULO';if(t.includes('TRT-15')||t.includes('PAULÍNIA')||t.includes('PAULINIA')||t.includes('CAMPINAS'))return 'PAULÍNIA';if(t.includes('DF')||t.includes('BRASÍLIA')||t.includes('BRASILIA')||t.includes('TRT-10'))return 'BRASÍLIA';if(t.includes('RR')||t.includes('RORAIMA'))return 'RORAIMA';if(t.includes('RJ')||t.includes('RIO DE JANEIRO'))return 'RIO DE JANEIRO';if(t.includes('BA')||t.includes('BAHIA'))return 'BAHIA';if(t.includes('AM')||t.includes('AMAZONAS'))return 'AMAZONAS';if(t.includes('GO')||t.includes('VALPARAÍSO')||t.includes('VALPARAISO'))return 'VALPARAÍSO DO GOIÁS';if(t.includes('RO')||t.includes('RONDÔNIA')||t.includes('RONDONIA'))return 'RONDÔNIA';if(t.includes('AL')||t.includes('ALAGOAS'))return 'ALAGOAS';if(t.includes('PI')||t.includes('TERESINA'))return 'TERESINA';return 'BRASÍLIA'}
function totalAP(f){return totalFinanceiroBrutoRegistro(f)}
function AutorizacaoPagamentoModal({processo, financeiro, profile, onClose}){
  const ehAcordoAP=financeiroEhAcordoExecucao(financeiro)
  const parcelasAP=ehAcordoAP?extrairVencimentosParcelas(financeiro):[financeiro?.primeiro_vencimento||'']
  const qtdParcelasAP=ehAcordoAP?Math.max(1,Number(financeiro?.numero_parcelas||parcelasAP.length||1)):1
  const valoresAP=ehAcordoAP?(extrairDividirParcelas(financeiro)?Array.from({length:qtdParcelasAP},()=>Number(totalAP(financeiro)||0)/qtdParcelasAP):extrairValoresParcelas(financeiro)):[Number(totalAP(financeiro)||0)]
  const [ap,setAp]=useState(()=>({empresa_pagadora:processo?.parte_contraria||'BR BPO TECNOLOGIA E SERVIÇOS S.A',competencia:competenciaAtual(),emissao:new Date().toISOString().slice(0,10),favorecido:processo?.titulo||'',referente_a:tituloAPFinanceiro(financeiro),vencimento:parcelasAP[0]||financeiro?.primeiro_vencimento||'',forma_pagamento:'Depósito',departamento:inferirDepartamento(processo),area:String(processo?.categoria||'trabalhista').toLowerCase()==='administrativo'?'Administrativo':'Judicial',total:Number(totalAP(financeiro)||0).toFixed(2),banco:'',agencia:'',conta:'',pix:'',cpf_cnpj:'',observacao:observacaoAPFinanceiro(financeiro),solicitante:profile?.nome||'',recebido_em:''}))
  const upd=(k,v)=>setAp(a=>({...a,[k]:v}))
  const imprimirAP=()=>{
    const origem=document.querySelector('.ap-print')
    if(!origem)return window.print()

    const clone=origem.cloneNode(true)

    const origCampos=origem.querySelectorAll('input, textarea, select')
    const cloneCampos=clone.querySelectorAll('input, textarea, select')
    origCampos.forEach((el,i)=>{
      const dst=cloneCampos[i]
      if(!dst)return
      const tag=el.tagName
      if(tag==='TEXTAREA'){
        dst.textContent=el.value||''
        dst.setAttribute('data-value',el.value||'')
      }else if(tag==='SELECT'){
        Array.from(dst.options||[]).forEach(opt=>{opt.selected=opt.value===el.value})
        dst.setAttribute('data-value',el.options?.[el.selectedIndex]?.text||el.value||'')
      }else{
        dst.setAttribute('value',el.value||'')
        dst.setAttribute('data-value',el.value||'')
      }
    })

    const win=window.open('','_blank')
    if(!win)return alert('O navegador bloqueou a janela de impressão. Permita pop-ups para gerar a AP.')

    const html=`<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Autorização de Pagamento</title>
<style>
  @page{size:A4 portrait;margin:8mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#f3f4f6;color:#000;font-family:Arial,sans-serif}
  .toolbar{position:sticky;top:0;z-index:10;background:#111827;color:#fff;padding:10px 14px;display:flex;gap:10px;justify-content:flex-end;align-items:center;font-family:Arial,sans-serif}
  .toolbar span{margin-right:auto;font-size:13px;color:#e5e7eb}
  .toolbar button{border:0;border-radius:8px;padding:9px 14px;font-weight:800;cursor:pointer}
  .toolbar .primary{background:#fff;color:#111827}
  .toolbar .secondary{background:#374151;color:#fff}
  .ap-print{width:194mm;margin:10mm auto;background:#fff;color:#000}
  .ap-print table{border-collapse:collapse;width:100%;table-layout:fixed;background:#fff}
  .ap-page{display:block;width:194mm;min-height:281mm;margin:0 auto 10mm auto;padding:0;background:#fff;box-shadow:0 0 0 1px #ddd;break-after:page;page-break-after:always}
  .ap-page:last-child{break-after:auto;page-break-after:auto}
  td{border:1px solid #111;padding:3px 4px;font-size:9px;line-height:1.08;vertical-align:middle}
  input,select,textarea{font-size:9px;min-height:16px;padding:1px 2px;border:0;background:transparent;color:#000;width:100%;appearance:none;-webkit-appearance:none}
  textarea{min-height:24px;overflow:hidden;resize:none}
  .ap-sign{height:42px!important;font-size:8.5px!important;padding:3px 4px!important}
  .ap-recebido{height:34px!important}
  .ap-small-title{font-size:9.4px!important;font-weight:900;text-align:center}
  .ap-actions{display:none!important}
  @media print{
    html,body{background:#fff!important}
    .toolbar{display:none!important}
    .ap-print{width:194mm;margin:0 auto!important}
    .ap-page{width:194mm;min-height:281mm;margin:0!important;padding:0!important;box-shadow:none!important;break-after:page!important;page-break-after:always!important}
    .ap-page:last-child{break-after:auto!important;page-break-after:auto!important}
  }
</style>
</head>
<body>
  <div class="toolbar">
    <span>Pré-visualização da Autorização de Pagamento — cada parcela deve aparecer em uma página própria.</span>
    <button class="secondary" onclick="window.close()">Fechar</button>
    <button class="primary" onclick="window.print()">Imprimir / salvar PDF</button>
  </div>
  ${clone.outerHTML}
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
  }
  const cell={border:'1px solid #111',padding:'4px 5px',fontSize:10,verticalAlign:'middle',lineHeight:1.15}
  const labelCell={...cell,fontWeight:800,background:'#f8fafc',width:'24%'}
  const sig={border:'1px solid #111',height:58,textAlign:'center',verticalAlign:'bottom',fontSize:9,fontWeight:700,padding:'4px 5px',lineHeight:1.1}
  const assinatura='____________________________________'
  return <Modal title="Autorização de Pagamento (AP)" onClose={onClose}>
    <style>{`
      .ap-print{width:190mm;max-width:100%;margin:0 auto;font-family:Arial,sans-serif;color:#000;background:#fff}
      .ap-print table{border-collapse:collapse;width:100%;table-layout:fixed}
      .ap-page{width:100%;page-break-after:always;break-after:page;margin-bottom:24px}
      .ap-page:last-child{page-break-after:auto;break-after:auto;margin-bottom:0}
      .ap-print input,.ap-print select,.ap-print textarea{width:100%;border:1px solid #111;min-height:22px;padding:2px 4px;font-size:10px;box-sizing:border-box;background:#fff;color:#000}
      .ap-print textarea{min-height:34px;resize:vertical}
      .ap-small-title{font-size:11px;font-weight:900;text-align:center}
      @media print{
        @page{size:A4 portrait;margin:8mm}
        .ap-actions{display:none!important}
        .ap-page{break-after:page;page-break-after:always}
        .ap-page:last-child{break-after:auto;page-break-after:auto}
      }
    `}</style>
    <div className="ap-print">
      {Array.from({length:qtdParcelasAP}).map((_,idx)=>{const venc=parcelasAP[idx]||ap.vencimento;const valorParcela=valoresAP[idx]??(Number(ap.total||0)/qtdParcelasAP);const obsParcela=qtdParcelasAP>1?`${limparObservacoesParcelas(ap.observacao)}${limparObservacoesParcelas(ap.observacao)?' — ':''}Parcela ${idx+1} de ${qtdParcelasAP}`:limparObservacoesParcelas(ap.observacao);return <div className="ap-page" key={idx}><table><tbody>
        <tr>
          <td colSpan={3} style={{...cell,textAlign:'center',fontWeight:800,color:'#dc2626'}}>BR BPO TECNOLOGIA E SERVIÇOS S.A</td>
          <td style={labelCell}>COMPETÊNCIA:</td>
          <td style={cell}><input value={ap.competencia} onChange={e=>upd('competencia',e.target.value)} placeholder="mês/ano"/></td>
        </tr>
        <tr>
          <td colSpan={3} className="ap-small-title" style={{...cell}}>AUTORIZAÇÃO DE PAGAMENTO ( AP )</td>
          <td style={labelCell}>EMISSÃO:</td>
          <td style={cell}><input type="date" value={ap.emissao} onChange={e=>upd('emissao',e.target.value)}/></td>
        </tr>
        <tr><td style={labelCell}>EMPRESA PAGADORA:</td><td colSpan={4} style={cell}><input value={ap.empresa_pagadora} onChange={e=>upd('empresa_pagadora',e.target.value)}/></td></tr>
        <tr><td style={labelCell}>FAVORECIDO:</td><td colSpan={4} style={cell}><input value={ap.favorecido} onChange={e=>upd('favorecido',e.target.value)}/></td></tr>
        <tr><td style={labelCell}>REFERENTE A:</td><td colSpan={4} style={cell}><input value={ap.referente_a} onChange={e=>upd('referente_a',e.target.value)} placeholder="Acordo, execução, honorários..."/></td></tr>
        <tr><td style={labelCell}>PROCESSO:</td><td colSpan={4} style={cell}>{processo?.numero||'sem número'} - {processo?.titulo||''}</td></tr>
        <tr><td style={labelCell}>TRIBUNAL / VARA:</td><td colSpan={4} style={cell}>{processo?.tribunal||processo?.orgao||'—'}</td></tr>
        <tr>
          <td style={labelCell}>VENCIMENTO:</td><td style={cell}><input type="date" value={venc} readOnly/></td>
          <td style={labelCell}>FORMA DE PAGTO:</td><td colSpan={2} style={cell}><select value={ap.forma_pagamento} onChange={e=>upd('forma_pagamento',e.target.value)}>{AP_FORMAS.map(x=><option key={x}>{x}</option>)}</select></td>
        </tr>
        <tr>
          <td style={labelCell}>DEPARTAMENTO:</td><td colSpan={2} style={cell}><select value={ap.departamento} onChange={e=>upd('departamento',e.target.value)}>{AP_DEPARTAMENTOS.map(x=><option key={x}>{x}</option>)}</select></td>
          <td style={labelCell}>ÁREA:</td><td style={cell}><select value={ap.area} onChange={e=>upd('area',e.target.value)}>{AP_AREAS.map(x=><option key={x}>{x}</option>)}</select></td>
        </tr>
        <tr>
          <td style={labelCell}>VALOR LÍQUIDO:</td><td style={cell}><input type="number" step="0.01" value={Number(valorParcela||0).toFixed(2)} readOnly/></td>
          <td style={labelCell}>VALOR BRUTO:</td><td style={cell}>{money(ehAcordoAP?financeiro?.valor_bruto:totalAP(financeiro))}</td>
          <td style={cell}><b>AJUSTES:</b> {money(ehAcordoAP?totalAP(financeiro)-parseMoney(financeiro?.valor_bruto):0)}</td>
        </tr>
        <tr><td style={labelCell}>OBSERVAÇÃO:</td><td colSpan={4} style={cell}><textarea value={obsParcela} onChange={e=>upd('observacao',e.target.value)}/></td></tr>
        <tr><td colSpan={5} style={{...cell,background:'#ffff00',textAlign:'center',fontWeight:800}}>PAGAMENTO REFERENTE A {ap.referente_a?.toUpperCase()}</td></tr>
        <tr><td style={labelCell}>NOME</td><td colSpan={4} style={cell}><input value={ap.favorecido} onChange={e=>upd('favorecido',e.target.value)}/></td></tr>
        <tr><td style={labelCell}>BANCO</td><td style={cell}><input value={ap.banco} onChange={e=>upd('banco',e.target.value)}/></td><td style={labelCell}>AGÊNCIA</td><td colSpan={2} style={cell}><input value={ap.agencia} onChange={e=>upd('agencia',e.target.value)}/></td></tr>
        <tr><td style={labelCell}>CONTA</td><td style={cell}><input value={ap.conta} onChange={e=>upd('conta',e.target.value)}/></td><td style={labelCell}>PIX</td><td colSpan={2} style={cell}><input value={ap.pix} onChange={e=>upd('pix',e.target.value)}/></td></tr>
        <tr><td style={labelCell}>CPF/CNPJ</td><td colSpan={2} style={cell}><input value={ap.cpf_cnpj} onChange={e=>upd('cpf_cnpj',e.target.value)}/></td><td style={labelCell}>VALOR (R$)</td><td style={cell}>{money(valorParcela)}</td></tr>
        <tr><td colSpan={2} style={{...cell,color:'#00f',fontWeight:800}}>VALOR TOTAL</td><td colSpan={3} style={{...cell,color:'#00f',fontWeight:800,textAlign:'right'}}>{money(valorParcela)}</td></tr>
        <tr>
          <td colSpan={2} className="ap-sign" style={sig}>{assinatura}<br/>SOLICITANTE<br/>{ap.solicitante||'REDIGIDA POR'}</td>
          <td colSpan={3} className="ap-sign" style={sig}>{assinatura}<br/>APROVAÇÃO COORDENAÇÃO</td>
        </tr>
        <tr>
          <td colSpan={2} className="ap-sign" style={sig}>{assinatura}<br/>APROVAÇÃO GERÊNCIA</td>
          <td colSpan={3} className="ap-sign" style={sig}>{assinatura}<br/>APROVAÇÃO DIRETORIA</td>
        </tr>
        <tr>
          <td colSpan={2} className="ap-recebido" style={{...cell,height:46}}>RECEBIDO EM: <input type="date" style={{width:120}} value={ap.recebido_em} onChange={e=>upd('recebido_em',e.target.value)}/></td>
          <td colSpan={3} className="ap-recebido" style={{...cell,textAlign:'center',verticalAlign:'bottom',fontWeight:800}}>{assinatura}<br/>DEP. FINANCEIRO</td>
        </tr>
      </tbody></table></div>})}
      <div className="ap-actions" style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:14}}><button onClick={imprimirAP} style={{background:C.navy,color:'white',border:0,borderRadius:8,padding:'10px 16px',fontWeight:800,cursor:'pointer'}}>Imprimir / salvar PDF</button></div>
    </div>
  </Modal>
}

function Chip({children,kind='blue'}){const m={blue:[C.blueBg,C.blue],red:[C.redBg,C.red],green:[C.greenBg,C.green],amber:[C.amberBg,C.amber],purple:[C.purpleBg,C.purple],gray:[C.grayBg,C.muted]};const [bg,color]=m[kind]||m.gray;return <span style={{fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:20,background:bg,color,textTransform:'uppercase',whiteSpace:'nowrap'}}>{children}</span>}
function MiniSection({title,items,onOpen,icon}){if(!items.length)return null;return <section style={{marginBottom:18}}><h3 style={{fontSize:14,margin:'0 0 8px',display:'flex',alignItems:'center',gap:8}}>{icon}{title}</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>{items.map(p=><button key={p.id} onClick={()=>onOpen(p)} style={{textAlign:'left',background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:12,cursor:'pointer'}}><div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}><Chip kind={p.status==='encerrado'?'gray':p.status==='arquivo_temporario'?'amber':'blue'}>{label(STATUS,p.status)}</Chip><Chip kind={p.fase==='execucao_sentenca'?'green':p.fase==='recurso'?'purple':p.fase==='arquivo_definitivo'?'gray':'blue'}>{label(FASES,p.fase)}</Chip><Chip kind="green">{label(CATEGORIAS,p.categoria||'trabalhista')}</Chip></div><div style={{fontFamily:'monospace',fontSize:12,color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.numero||'sem número'}</div><div style={{fontSize:13,fontWeight:800,color:C.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.titulo}</div><div style={{fontSize:11,color:C.muted,marginTop:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.tribunal||p.orgao||'Sem tribunal/órgão'}</div></button>)}</div></section>}

function limparValorRestituido(observacoes=''){return String(observacoes||'').replace(/\n?\[VALOR_RESTITUIDO:[^\]]*\]/g,'').trim()}
function valorRestituidoFinanceiro(f={}){
  const direto=parseMoney(f.valor_restituido)
  if(direto>0)return direto
  const m=String(f.observacoes||'').match(/\[VALOR_RESTITUIDO:([^\]]*)\]/)
  return m?parseMoney(m[1]):0
}
function juntarValorRestituido(observacoes='',valor=0){
  const limpas=limparValorRestituido(observacoes)
  const restituido=parseMoney(valor)
  return [limpas,restituido>0?`[VALOR_RESTITUIDO:${restituido.toFixed(2)}]`:'' ].filter(Boolean).join('\n')
}
function totalFinanceiroBrutoRegistro(f){
  return parseMoney(f.valor_bruto)
    + parseMoney(f.deposito_ro)
    + parseMoney(f.deposito_rr)
    + parseMoney(f.deposito_embargos)
    + parseMoney(f.custas)
    + parseMoney(f.fgts)
    + parseMoney(f.honorarios_sucumbenciais)
    + parseMoney(f.honorarios_periciais)
    + parseMoney(f.inss_reclamante)
    + parseMoney(f.inss_reclamada)
    + parseMoney(f.multa_inadimplemento)
    + parseMoney(f.seguro_premio)
}
function totalFinanceiroRegistro(f){return Math.max(totalFinanceiroBrutoRegistro(f)-valorRestituidoFinanceiro(f),0)}
function itensGastoRegistro(f={}){
  const itens=[]
  if(parseMoney(f.valor_bruto)>0)itens.push({label:label(NATUREZAS,f.natureza)||'Acordo/Execução',valor:parseMoney(f.valor_bruto),tipo:'principal'})
  CAMPOS_AP.forEach(([k,l])=>{const v=parseMoney(f[k]);if(v>0)itens.push({label:l,valor:v,tipo:k})})
  const restituido=valorRestituidoFinanceiro(f)
  if(restituido>0)itens.push({label:'VALOR RESTITUIDO',valor:-restituido,tipo:'valor_restituido'})
  return itens
}
function detalharGastosFinanceiros(financeiros=[]){
  const ativos=(financeiros||[]).filter(f=>!financeiroExcluido(f))
  const linhas=[]
  ativos.forEach(f=>itensGastoRegistro(f).forEach(item=>linhas.push({...item,registro:f})))
  return {linhas,total:ativos.reduce((s,f)=>s+totalFinanceiroRegistro(f),0)}
}
function processoFinanceiros(procId, financeiros=[]){return (financeiros||[]).filter(f=>f.processo_id===procId&&!financeiroExcluido(f))}
function processoAtividades(procId, atividades=[]){return (atividades||[]).filter(a=>a.processo_id===procId)}
function processoTemValorFinanceiro(procId, financeiros=[], campo){return processoFinanceiros(procId,financeiros).some(f=>parseMoney(f[campo])>0)}
function processoTemHonorarios(procId, financeiros=[]){return processoFinanceiros(procId,financeiros).some(f=>parseMoney(f.honorarios_sucumbenciais)>0||parseMoney(f.honorarios_periciais)>0)}
function processoTemAcordo(procId, financeiros=[]){return processoFinanceiros(procId,financeiros).some(f=>String(f.natureza||'').toLowerCase()==='acordo'&&parseMoney(f.valor_bruto)>0)}
function processoTemExecucao(procId, financeiros=[]){return processoFinanceiros(procId,financeiros).some(f=>['execucao','execução'].includes(String(f.natureza||'').toLowerCase())&&parseMoney(f.valor_bruto)>0)}
function processoTemApolice(procId, financeiros=[]){return processoFinanceiros(procId,financeiros).some(f=>!!f.seguro_garantia||!!f.apolice_numero||parseMoney(f.valor_assegurado)>0||parseMoney(f.seguro_premio)>0)}
function matchBoolFilter(valor, filtro){return filtro==='todos'||(filtro==='sim'?!!valor:!valor)}

function financeiroQuitado(f){
  return ['pago','quitado','concluido','concluído'].includes(String(f.status_pagamento||'').toLowerCase())
}
function economiaPodeSerContabilizada(proc, financeiros=[]){
  return proc?.transito_julgado===true || financeiros.some(f=>['acordo','execucao','execução'].includes(String(f.natureza||'').toLowerCase()) && financeiroQuitado(f))
}
function resumoFinanceiroProcesso(proc, financeiros=[]){
  const totalGasto=financeiros.reduce((s,f)=>s+totalFinanceiroRegistro(f),0)
  const valorAcao=Number(proc?.valor_acao||0)
  const elegivel=economiaPodeSerContabilizada(proc,financeiros)
  return {totalGasto,elegivel,valorEconomizado:elegivel?Math.max(valorAcao-totalGasto,0):0}
}

const emptyFinance={natureza:'acordo',data_referencia:'',valor_bruto:'',deposito_ro:'',deposito_rr:'',deposito_embargos:'',valor_restituido:'',forma_pagamento:'avista',numero_parcelas:1,atualizar_selic:false,primeiro_vencimento:'',custas:'',fgts:'',honorarios_sucumbenciais:'',honorarios_periciais:'',inss_reclamante:'',inss_reclamada:'',multa_inadimplemento:'',status_pagamento:'pendente',pagamentos_campos:{},auditoria_pagamentos:[],seguro_garantia:false,apolice_numero:'',apolice_inicio:'',apolice_fim:'',valor_assegurado:'',seguro_premio:'',observacoes:'',vencimentos_parcelas:[''],dividir_valor_parcelas:true,valores_parcelas:['']}

export default function Processos({profile}){
  const [items,setItems]=useState([]),[team,setTeam]=useState([]),[atividades,setAtividades]=useState([]),[financeiros,setFinanceiros]=useState([]),[partes,setPartes]=useState([])
  const [q,setQ]=useState(''),[showAll,setShowAll]=useState(false),[statusFilter,setStatusFilter]=useState('ativos'),[catFilter,setCatFilter]=useState('todas'),[advOpen,setAdvOpen]=useState(false),[adv,setAdv]=useState({transito:'todos',audiencia:'todos',deposito_ro:'todos',deposito_rr:'todos',deposito_embargos:'todos',custas:'todos',honorarios:'todos',multa:'todos',apolice:'todos',acordo:'todos',execucao:'todos'}),[modal,setModal]=useState(false),[tab,setTab]=useState('dados'),[form,setForm]=useState({}),[task,setTask]=useState({tipo:'tarefa',status:'a_fazer',titulo:'',descricao:'',prioridade:'media',responsavel_id:'',prazo:'',horario:'',local:'',audiencia_modalidade:'presencial',audiencia_tipo:'inicial'}),[fin,setFin]=useState(emptyFinance),[editingFinanceId,setEditingFinanceId]=useState(null),[paidModal,setPaidModal]=useState(null),[gastoModal,setGastoModal]=useState(false),[apFinanceiro,setApFinanceiro]=useState(null),[loading,setLoading]=useState(true)
  const accessKey='jurisbpo_recent_processos_v2'
  const canCreateProcesso=can(profile,'processos.criar')
  const canEditProcesso=can(profile,'processos.editar')
  const canCreateAtividade=can(profile,'atividades.criar')
  const canCreateFinanceiro=can(profile,'financeiro.criar')
  const canEditFinanceiro=can(profile,'financeiro.editar')
  const canDeleteFinanceiro=can(profile,'financeiro.excluir')
  const load=async()=>{const eid=profile.escritorio_id;const[{data:p},{data:l},{data:a},{data:f},{data:pc}]=await Promise.all([supabase.from('processos').select('*').eq('escritorio_id',eid).order('updated_at',{ascending:false}),supabase.from('usuarios_escritorios').select('usuario_id,papel,profiles(id,nome,email)').eq('escritorio_id',eid).eq('ativo',true),supabase.from('atividades').select('*').eq('escritorio_id',eid).order('created_at',{ascending:false}),supabase.from('financeiro_processos').select('*').eq('escritorio_id',eid).order('created_at',{ascending:false}),supabase.from('partes_crm').select('*').eq('escritorio_id',eid).eq('status','ativo').order('nome')]);setItems(p||[]);setTeam((l||[]).map(x=>({id:x.usuario_id,nome:x.profiles?.nome||x.profiles?.email||x.usuario_id})));setAtividades(a||[]);setFinanceiros(f||[]);setPartes(pc||[]);setLoading(false)}
  useEffect(()=>{load()},[profile.escritorio_id])
  const active=items.filter(p=>p.status!=='encerrado'), closed=items.filter(p=>p.status==='encerrado')
  const latestCreated=active.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5)
  const latestEdited=active.slice().sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0)).slice(0,5)
  const latestAccessed=useMemo(()=>{let ids=[];try{ids=JSON.parse(localStorage.getItem(accessKey)||'[]')}catch{};return ids.map(id=>items.find(p=>p.id===id)).filter(Boolean).slice(0,5)},[items])
  const list=useMemo(()=>{const term=q.trim().toLowerCase();const base=statusFilter==='arquivados'?closed:statusFilter==='todos'?items:active;return base.filter(p=>{
    if(catFilter!=='todas'&&(p.categoria||'trabalhista')!==catFilter)return false
    if(term&&![p.numero,p.titulo,p.parte_contraria,p.tribunal,p.orgao,p.fase,p.resumo_processo,p.categoria].some(v=>String(v||'').toLowerCase().includes(term)))return false
    if(!matchBoolFilter(p.transito_julgado,adv.transito))return false
    if(!matchBoolFilter(processoAtividades(p.id,atividades).some(a=>a.tipo==='audiencia'),adv.audiencia))return false
    if(!matchBoolFilter(processoTemValorFinanceiro(p.id,financeiros,'deposito_ro'),adv.deposito_ro))return false
    if(!matchBoolFilter(processoTemValorFinanceiro(p.id,financeiros,'deposito_rr'),adv.deposito_rr))return false
    if(!matchBoolFilter(processoTemValorFinanceiro(p.id,financeiros,'deposito_embargos'),adv.deposito_embargos))return false
    if(!matchBoolFilter(processoTemValorFinanceiro(p.id,financeiros,'custas'),adv.custas))return false
    if(!matchBoolFilter(processoTemHonorarios(p.id,financeiros),adv.honorarios))return false
    if(!matchBoolFilter(processoTemValorFinanceiro(p.id,financeiros,'multa_inadimplemento'),adv.multa))return false
    if(!matchBoolFilter(processoTemApolice(p.id,financeiros),adv.apolice))return false
    if(!matchBoolFilter(processoTemAcordo(p.id,financeiros),adv.acordo))return false
    if(!matchBoolFilter(processoTemExecucao(p.id,financeiros),adv.execucao))return false
    return true
  })},[items,q,statusFilter,catFilter,adv,atividades,financeiros])
  const procActs=atividades.filter(a=>a.processo_id===form.id)
  const procFin=financeiros.filter(f=>f.processo_id===form.id&&!financeiroExcluido(f))
  const hasValorRestituidoColumn=financeiros.some(f=>Object.prototype.hasOwnProperty.call(f,'valor_restituido'))
  const remember=(p)=>{try{const arr=JSON.parse(localStorage.getItem(accessKey)||'[]').filter(id=>id!==p.id);localStorage.setItem(accessKey,JSON.stringify([p.id,...arr].slice(0,10)))}catch{}}
  const open=(p=null)=>{if(!p&&!canCreateProcesso)return alert('Visitante possui acesso somente leitura.');const padrao=partes.find(x=>x.nome==='BRBPO Tecnologia e Serviços S.A.')||partes[0];const obj=p||{numero:'',titulo:'',parte_contraria:padrao?.nome||'BRBPO Tecnologia e Serviços S.A.',parte_contraria_id:padrao?.id||'',nova_parte_nome:'',nova_parte_cnpj:'',nova_parte_grupo:'',tribunal:'',orgao:'',categoria:'trabalhista',data_ajuizamento:'',valor_acao:'',valor_gasto:'',valor_economizado:'',resumo_processo:'',status:'ativo',fase:'conhecimento',responsavel_id:profile.id,observacoes:'',vencimentos_parcelas:[''],dividir_valor_parcelas:true,valores_parcelas:['']};setForm({...obj,parte_contraria_id:obj.parte_contraria_id||'',data_ajuizamento:obj.data_ajuizamento||'',valor_acao:obj.valor_acao ?? '',valor_gasto:obj.valor_gasto ?? '',valor_economizado:obj.valor_economizado ?? ''});setTask({tipo:'tarefa',status:'a_fazer',titulo:'',descricao:'',prioridade:'media',responsavel_id:profile.id,prazo:'',horario:'',local:'',audiencia_modalidade:'presencial',audiencia_tipo:'inicial'});setFin(emptyFinance);setTab('dados');setModal(true);if(p)remember(p)}
  useEffect(()=>{if(loading)return;const params=new URLSearchParams(window.location.search);const id=params.get('processo_id');if(!id)return;const alvo=items.find(p=>p.id===id);if(alvo){open(alvo);window.history.replaceState(null,'','/processos')}},[loading,items])
  const save=async()=>{if(form.id&&!canEditProcesso)return alert('Visitante possui acesso somente leitura.');if(!form.id&&!canCreateProcesso)return alert('Visitante possui acesso somente leitura.');if(!form.titulo)return alert('Informe o título/parte principal.');let parteId=form.parte_contraria_id||null;let parteNome=form.parte_contraria||'';if(parteId==='__novo__'){if(!form.nova_parte_nome?.trim())return alert('Informe o nome da nova parte.');const {data:nova,error:parteErr}=await supabase.from('partes_crm').insert({escritorio_id:profile.escritorio_id,nome:form.nova_parte_nome.trim(),cnpj:form.nova_parte_cnpj||null,grupo_economico:form.nova_parte_grupo||null,tipo:'parte_contraria',status:'ativo',created_by:profile.id}).select().single();if(parteErr)return alert(parteErr.message);parteId=nova.id;parteNome=nova.nome}else if(parteId){parteNome=partes.find(x=>x.id===parteId)?.nome||parteNome}const valorAcao=Number(form.valor_acao||0);const resumoAtual=resumoFinanceiroProcesso({...form,valor_acao:valorAcao},procFin);const payload={...form,parte_contraria_id:parteId,parte_contraria:parteNome,escritorio_id:profile.escritorio_id,data_ajuizamento:form.data_ajuizamento||null,valor_acao:form.valor_acao===''?null:valorAcao,valor_gasto:resumoAtual.totalGasto,valor_economizado:resumoAtual.valorEconomizado,responsavel_id:form.responsavel_id||null,created_by:form.created_by||profile.id}; delete payload.tipo; delete payload.prazo; delete payload.nova_parte_nome; delete payload.nova_parte_cnpj; delete payload.nova_parte_grupo;if(payload.status==='encerrado')payload.fase='arquivo_definitivo';const r=form.id?await supabase.from('processos').update(payload).eq('id',form.id):await supabase.from('processos').insert(payload);if(r.error)return alert(r.error.message);if(form.id){await atualizarResumoFinanceiroProcesso(form.id,{...payload,id:form.id},procFin)}setModal(false);load()}
  const saveTask=async()=>{if(!canCreateAtividade)return alert('Visitante possui acesso somente leitura.');if(!task.titulo)return alert('Informe o título da atividade.');const payload={escritorio_id:profile.escritorio_id,tipo:task.tipo||'tarefa',status:task.status||'a_fazer',titulo:task.titulo,descricao:task.descricao||'',prioridade:task.prioridade||'media',processo_id:form.id,contrato_id:null,responsavel_id:task.responsavel_id||null,prazo:task.prazo||null,horario:task.horario||null,local:task.local||'',audiencia_modalidade:task.tipo==='audiencia'?(task.audiencia_modalidade||'presencial'):null,audiencia_tipo:task.tipo==='audiencia'?(task.audiencia_tipo||'inicial'):null,criado_por:profile.id};const {data,error}=await supabase.from('atividades').insert(payload).select().single();if(error)return alert(error.message);if(payload.responsavel_id){await supabase.from('atividade_atribuicoes').insert({escritorio_id:profile.escritorio_id,atividade_id:data.id,usuario_novo_id:payload.responsavel_id,atribuido_por:profile.id,tipo_evento:'atribuicao',observacao:'Atividade criada dentro do processo'});if(payload.responsavel_id!==profile.id){await supabase.from('notificacoes').insert({escritorio_id:profile.escritorio_id,usuario_id:payload.responsavel_id,tipo:'nova_atividade',titulo:'Nova atividade atribuída a você',descricao:`${data.titulo} — por ${profile.nome || 'Usuário'} em ${new Date().toLocaleString('pt-BR')}`,origem_tipo:'atividade',origem_id:String(data.id)})}}window.dispatchEvent(new Event('jurisbpo:notificacoes-atualizadas'));setTask({tipo:'tarefa',status:'a_fazer',titulo:'',descricao:'',prioridade:'media',responsavel_id:profile.id,prazo:'',horario:'',local:'',audiencia_modalidade:'presencial',audiencia_tipo:'inicial'});load()}

  const atualizarResumoFinanceiroProcesso=async(processoId, processoOverride=null, financeirosOverride=null)=>{
    if(!processoId)return
    let procBase=processoOverride
    if(!procBase){
      const {data}=await supabase.from('processos').select('*').eq('id',processoId).single()
      procBase=data
    }
    let fins=financeirosOverride
    if(!fins){
      const {data}=await supabase.from('financeiro_processos').select('*').eq('processo_id',processoId).eq('escritorio_id',profile.escritorio_id)
      fins=data||[]
    }
    const resumo=resumoFinanceiroProcesso(procBase,(fins||[]).filter(f=>!financeiroExcluido(f)))
    await supabase.from('processos').update({valor_gasto:resumo.totalGasto,valor_economizado:resumo.valorEconomizado}).eq('id',processoId)
    setForm(f=>f.id===processoId?{...f,valor_gasto:resumo.totalGasto,valor_economizado:resumo.valorEconomizado}:f)
  }

  const persistFinance=async(finBase=fin,{manterFormulario=false,acao=null}={})=>{const ehEdicao=!!(editingFinanceId||finBase.id);if(ehEdicao&&!canEditFinanceiro){alert('Visitante possui acesso somente leitura.');return false;}if(!ehEdicao&&!canCreateFinanceiro){alert('Visitante possui acesso somente leitura.');return false;}const auditBase=usuarioAuditoria(profile);const auditoriaAtual=[...(finBase.auditoria_pagamentos||[])];auditoriaAtual.push({acao:acao||(editingFinanceId?'edicao_registro_financeiro':'criacao_registro_financeiro'),...auditBase,registro_id:editingFinanceId||finBase.id||null});const qtd=finBase.forma_pagamento==='parcelado'?Math.max(2,Number(finBase.numero_parcelas||2)):1;const dividir=finBase.forma_pagamento!=='parcelado'||finBase.dividir_valor_parcelas!==false;const vencs=Array.from({length:qtd},(_,i)=>(finBase.vencimentos_parcelas?.[i]||(i===0?finBase.primeiro_vencimento:'')||''));const valores=dividir?[]:Array.from({length:qtd},(_,i)=>parseMoney(finBase.valores_parcelas?.[i]||0));const obsBase=hasValorRestituidoColumn?limparValorRestituido(finBase.observacoes):juntarValorRestituido(finBase.observacoes,finBase.valor_restituido);const obsParcelas=juntarObservacoesParcelas(obsBase,vencs,valores,dividir);const payload={...finBase,forma_pagamento:finBase.forma_pagamento==='parcelado'?'parcelado':'avista',escritorio_id:profile.escritorio_id,processo_id:form.id,criado_por:finBase.criado_por||profile.id,numero_parcelas:qtd,primeiro_vencimento:vencs[0]||null,observacoes:juntarAuditoriaPagamentos(juntarPagamentosCampos(obsParcelas,finBase.pagamentos_campos),auditoriaAtual),seguro_garantia:!!finBase.seguro_garantia};['id','created_at','updated_at','processos','vencimentos_parcelas','valores_parcelas','dividir_valor_parcelas','pagamentos_campos','auditoria_pagamentos'].forEach(k=>delete payload[k]);if(!hasValorRestituidoColumn)delete payload.valor_restituido;['valor_bruto','deposito_ro','deposito_rr','deposito_embargos','custas','fgts','honorarios_sucumbenciais','honorarios_periciais','inss_reclamante','inss_reclamada','multa_inadimplemento','valor_assegurado','seguro_premio'].forEach(k=>payload[k]=finBase[k]===''?0:parseMoney(finBase[k]));if(hasValorRestituidoColumn)payload.valor_restituido=parseMoney(finBase.valor_restituido);['data_referencia','apolice_inicio','apolice_fim'].forEach(k=>payload[k]=finBase[k]||null);if(!payload.seguro_garantia){payload.apolice_numero=null;payload.apolice_inicio=null;payload.apolice_fim=null;payload.valor_assegurado=0;payload.seguro_premio=0}const idAlvo=editingFinanceId||finBase.id;const query=idAlvo?supabase.from('financeiro_processos').update(payload).eq('id',idAlvo).eq('escritorio_id',profile.escritorio_id):supabase.from('financeiro_processos').insert(payload);const {error}=await query;if(error){alert(error.message);return false}if(!manterFormulario){setFin(emptyFinance);setEditingFinanceId(null)}await atualizarResumoFinanceiroProcesso(form.id);await load();return true}
  const saveFinance=async()=>{await persistFinance(fin,{manterFormulario:false})}
  const editFinance=(f)=>{setFin({...emptyFinance,...f,observacoes:limparValorRestituido(limparObservacoesParcelas(f.observacoes||'')),pagamentos_campos:extrairPagamentosCampos(f),auditoria_pagamentos:extrairAuditoriaPagamentos(f),vencimentos_parcelas:extrairVencimentosParcelas(f),dividir_valor_parcelas:extrairDividirParcelas(f),valores_parcelas:extrairValoresParcelas(f).map(v=>Number(v||0).toFixed(2)),numero_parcelas:f.numero_parcelas||1,seguro_garantia:!!f.seguro_garantia,valor_bruto:f.valor_bruto??'',deposito_ro:f.deposito_ro??'',deposito_rr:f.deposito_rr??'',deposito_embargos:f.deposito_embargos??'',custas:f.custas??'',fgts:f.fgts??'',honorarios_sucumbenciais:f.honorarios_sucumbenciais??'',honorarios_periciais:f.honorarios_periciais??'',inss_reclamante:f.inss_reclamante??'',inss_reclamada:f.inss_reclamada??'',multa_inadimplemento:f.multa_inadimplemento??'',valor_assegurado:f.valor_assegurado??'',seguro_premio:f.seguro_premio??'',valor_restituido:valorRestituidoFinanceiro(f)||''});setEditingFinanceId(f.id);setTab('financeiro');setTimeout(()=>document.getElementById('financeiro-form')?.scrollIntoView({behavior:'smooth',block:'start'}),50)}
  const cancelEditFinance=()=>{setFin(emptyFinance);setEditingFinanceId(null)}
  const abrirPagamentoCampo=(campo,labelCampo)=>{const atual=fin.pagamentos_campos?.[campo];setPaidModal({campo,label:labelCampo,jaPago:!!atual?.pago,observacao:atual?.observacao||'',comprovante:atual?.comprovante||'',data_pagamento:atual?.data_pagamento||new Date().toISOString().slice(0,10),cancelObs:''})}
  const gerenciarPagamentoRegistro=(f)=>{editFinance(f);const pagos=extrairPagamentosCampos(f);const entrada=Object.entries(pagos).find(([,v])=>v?.pago);if(!entrada)return;const [campo,atual]=entrada;const labelCampo=(CAMPOS_AP.find(([k])=>k===campo)?.[1])||campo;setPaidModal({campo,label:labelCampo,jaPago:true,observacao:atual?.observacao||'',comprovante:atual?.comprovante||'',data_pagamento:atual?.data_pagamento||new Date().toISOString().slice(0,10),cancelObs:''})}
  const salvarPagamentoCampo=async()=>{if(!paidModal)return;const atualizado={...fin,pagamentos_campos:{...(fin.pagamentos_campos||{}),[paidModal.campo]:{pago:true,observacao:paidModal.observacao||'',comprovante:paidModal.comprovante||'',data:new Date().toISOString(),data_pagamento:paidModal.data_pagamento||new Date().toISOString().slice(0,10),usuario_id:profile.id,usuario_nome:profile.nome||profile.email||profile.id}}};setFin(atualizado);const ok=await persistFinance(atualizado,{manterFormulario:true,acao:'marcacao_campo_pago'});if(ok)setPaidModal(null)}
  const cancelarRegistroPagamento=async()=>{if(!paidModal)return;const ok=window.confirm('Esta ação será registrada no histórico de auditoria com os dados do usuário executor. Tem certeza que deseja remover este registro de pagamento?');if(!ok)return;const pagos={...(fin.pagamentos_campos||{})};const anterior=pagos[paidModal.campo]||{};delete pagos[paidModal.campo];const evento={acao:'cancelamento_registro_pagamento',campo:paidModal.campo,label:paidModal.label,data:new Date().toISOString(),data_pagamento:paidModal.data_pagamento||new Date().toISOString().slice(0,10),usuario_id:profile.id,usuario_nome:profile.nome||profile.email||profile.id,registro_anterior:anterior,observacao:paidModal.cancelObs||''};const atualizado={...fin,pagamentos_campos:pagos,auditoria_pagamentos:[...(fin.auditoria_pagamentos||[]),evento]};setFin(atualizado);const okPersist=await persistFinance(atualizado,{manterFormulario:true,acao:'cancelamento_registro_pagamento'});if(okPersist)setPaidModal(null)}
  const deleteFinance=async(f)=>{if(!canDeleteFinanceiro)return alert('Visitante possui acesso somente leitura.');if(!f?.id)return;if(temPagamentoCampoAtivo(f))return alert('Este registro possui campo marcado como pago. Cancele o registro de pagamento antes de editar ou excluir.');const ok=window.confirm('Excluir este pagamento/parcelamento? A exclusão será registrada no histórico com usuário, data e hora e o registro será ocultado da lista.');if(!ok)return;const auditoria=[...extrairAuditoriaPagamentos(f),{acao:'exclusao_registro_financeiro',...usuarioAuditoria(profile),registro_id:f.id,resumo:tituloAPFinanceiro(f),valor_total:totalAP(f)}];const obs=juntarRegistroExcluido(juntarAuditoriaPagamentos(f.observacoes||'',auditoria),{...usuarioAuditoria(profile),acao:'registro_financeiro_ocultado',registro_id:f.id});const {error}=await supabase.from('financeiro_processos').update({observacoes:obs}).eq('id',f.id).eq('escritorio_id',profile.escritorio_id);if(error)return alert('Erro ao excluir pagamento/parcelamento: '+error.message);if(editingFinanceId===f.id)cancelEditFinance();await atualizarResumoFinanceiroProcesso(form.id);load()}
  const gerarAutorizacao=(f)=>setApFinanceiro(f)
  const del=async(p)=>{if(confirm('Excluir processo?')){await supabase.from('processos').delete().eq('id',p.id);load()}}
  if(loading)return <div style={{padding:40,color:C.muted}}>Carregando processos...</div>
  return <div style={{padding:24}}><AndamentosProcessuaisPush profile={profile} compact /><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h1 style={{margin:0,fontSize:22}}>Processos</h1><p style={{color:C.muted}}>{active.length} ativos · {closed.length} arquivados/encerrados</p></div>{can(profile,'processos.criar')&&<button onClick={()=>open()} style={{background:C.navy,color:'white',border:0,borderRadius:8,padding:'10px 16px',fontWeight:800,display:'flex',gap:8,alignItems:'center'}}><Plus size={16}/>Novo Processo</button>}</div>
    <div style={{display:'flex',gap:10,margin:'18px 0 8px',flexWrap:'wrap'}}><div style={{position:'relative',flex:1,minWidth:260}}><Search size={15} style={{position:'absolute',left:10,top:13,color:C.muted}}/><input style={{...INP,paddingLeft:34}} placeholder="Buscar por número, parte, resumo, tribunal ou órgão administrativo" value={q} onChange={e=>setQ(e.target.value)}/></div><button onClick={()=>setAdvOpen(v=>!v)} style={{background:advOpen?C.navy:C.white,color:advOpen?'white':C.navy,border:'1px solid '+C.border,borderRadius:8,padding:'10px 14px',fontWeight:900,cursor:'pointer'}}>Busca avançada</button></div>
    {advOpen&&<section style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,padding:14,marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginBottom:10}}><b>Busca avançada</b><button onClick={()=>setAdv({transito:'todos',audiencia:'todos',deposito_ro:'todos',deposito_rr:'todos',deposito_embargos:'todos',custas:'todos',honorarios:'todos',multa:'todos',apolice:'todos',acordo:'todos',execucao:'todos'})} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'7px 10px',fontWeight:800,cursor:'pointer'}}>Limpar filtros</button></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12}}>
        <F label="Trânsito em julgado"><select style={INP} value={adv.transito} onChange={e=>setAdv({...adv,transito:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Audiência realizada/vinculada"><select style={INP} value={adv.audiencia} onChange={e=>setAdv({...adv,audiencia:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Depósito RO"><select style={INP} value={adv.deposito_ro} onChange={e=>setAdv({...adv,deposito_ro:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Depósito RR"><select style={INP} value={adv.deposito_rr} onChange={e=>setAdv({...adv,deposito_rr:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Depósito embargos"><select style={INP} value={adv.deposito_embargos} onChange={e=>setAdv({...adv,deposito_embargos:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Custas"><select style={INP} value={adv.custas} onChange={e=>setAdv({...adv,custas:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Honorários"><select style={INP} value={adv.honorarios} onChange={e=>setAdv({...adv,honorarios:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Multa"><select style={INP} value={adv.multa} onChange={e=>setAdv({...adv,multa:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Apólice / seguro-garantia"><select style={INP} value={adv.apolice} onChange={e=>setAdv({...adv,apolice:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Acordo realizado"><select style={INP} value={adv.acordo} onChange={e=>setAdv({...adv,acordo:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        <F label="Execução / pagamento execução"><select style={INP} value={adv.execucao} onChange={e=>setAdv({...adv,execucao:e.target.value})}>{[['todos','Todos'],['sim','Sim'],['nao','Não']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
      </div>
    </section>}
    {(q.trim()||Object.values(adv).some(v=>v!=='todos'))&&<section style={{marginBottom:18}}><h3 style={{fontSize:14,margin:'0 0 8px'}}>Resultados da busca</h3><div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,overflow:'hidden'}}>{list.slice(0,20).map(p=><div key={p.id} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:14,borderBottom:'1px solid '+C.border}}><div><div style={{fontFamily:'monospace',fontSize:12,color:C.muted}}>{p.numero||'sem número'}</div><b>{p.titulo}</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{p.tribunal||p.orgao||'—'} · {label(CATEGORIAS,p.categoria||'trabalhista')} · {label(STATUS,p.status)} · {label(FASES,p.fase)}</div></div>{canEditProcesso&&<button onClick={()=>open(p)} style={{border:0,background:'none',color:C.blue,cursor:'pointer'}}><Edit2 size={16}/></button>}</div>)}{!list.length&&<div style={{padding:30,textAlign:'center',color:C.muted}}>Nenhum processo encontrado.</div>}</div></section>}
    <MiniSection title="Últimos 5 cadastrados" items={latestCreated} onOpen={open} icon={<Plus size={14}/>}/><MiniSection title="Últimos 5 acessados" items={latestAccessed} onOpen={open} icon={<FolderOpen size={14}/>}/>
    <div style={{margin:'22px 0'}}><button onClick={()=>setShowAll(v=>!v)} style={{background:C.white,color:C.navy,border:'1px solid '+C.border,borderRadius:8,padding:'10px 16px',fontWeight:900,cursor:'pointer'}}>{showAll?'Ocultar todos':'Acessar todos'}</button></div>
    {showAll&&<section style={{marginTop:10}}><div style={{display:'flex',gap:10,alignItems:'end',flexWrap:'wrap',marginBottom:12}}><F label="Visualização"><select style={INP} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ativos">Ativos</option><option value="arquivados">Arquivados/encerrados</option><option value="todos">Todos</option></select></F><F label="Categoria"><select style={INP} value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option value="todas">Todas</option>{CATEGORIAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F></div><div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,overflow:'hidden'}}>{list.map(p=><div key={p.id} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:14,borderBottom:'1px solid '+C.border}}><div><div style={{fontFamily:'monospace',fontSize:12,color:C.muted}}>{p.numero||'sem número'}</div><b>{p.titulo}</b><div style={{fontSize:12,color:C.muted,marginTop:3}}>{p.tribunal||p.orgao||'—'} · {label(CATEGORIAS,p.categoria||'trabalhista')} · {label(STATUS,p.status)} · {label(FASES,p.fase)}{p.data_ajuizamento ? ' · ajuiz. '+dateBR(p.data_ajuizamento) : ''}{p.valor_acao ? ' · causa '+money(p.valor_acao) : ''}{p.valor_gasto ? ' · gasto '+money(p.valor_gasto) : ''}</div></div><div>{canEditProcesso&&<button onClick={()=>open(p)} style={{border:0,background:'none',color:C.blue,cursor:'pointer'}}><Edit2 size={16}/></button>}{can(profile,'processos.excluir')&&<button onClick={()=>del(p)} style={{border:0,background:'none',color:C.red,cursor:'pointer'}}><Trash2 size={16}/></button>}</div></div>)}{!list.length&&<div style={{padding:30,textAlign:'center',color:C.muted}}>Nenhum processo encontrado.</div>}</div></section>}
    {modal&&<Modal title={form.id?'Processo completo':'Novo processo'} onClose={()=>setModal(false)}><div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>{['dados','atividades','documentos','financeiro','andamentos'].map(t=><button key={t} onClick={()=>setTab(t)} disabled={!form.id&&t!=='dados'} style={{border:'1px solid '+C.border,borderRadius:20,padding:'7px 12px',background:tab===t?C.navy:C.white,color:tab===t?'white':C.text,cursor:'pointer',fontWeight:800,textTransform:'capitalize'}}>{t}</button>)}</div>
      {tab==='dados'&&<><F label="Número"><input style={INP} value={form.numero||''} onChange={e=>setForm({...form,numero:e.target.value})}/></F><F label="Título / parte principal"><input style={INP} value={form.titulo||''} onChange={e=>setForm({...form,titulo:e.target.value})}/></F><F label="Parte contrária / reclamada"><select style={INP} value={form.parte_contraria_id||''} onChange={e=>{const v=e.target.value;const parte=partes.find(x=>x.id===v);setForm({...form,parte_contraria_id:v,parte_contraria:parte?.nome||form.parte_contraria||''})}}><option value="">Selecione</option>{partes.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}<option value="__novo__">Outro / cadastrar nova parte...</option></select></F>{form.parte_contraria_id==='__novo__'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,background:C.grayBg,border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:12}}><F label="Nome da nova parte"><input style={INP} value={form.nova_parte_nome||''} onChange={e=>setForm({...form,nova_parte_nome:e.target.value,parte_contraria:e.target.value})} placeholder="Razão social"/></F><F label="CNPJ"><input style={INP} value={form.nova_parte_cnpj||''} onChange={e=>setForm({...form,nova_parte_cnpj:e.target.value})}/></F><F label="Grupo econômico"><input style={INP} value={form.nova_parte_grupo||''} onChange={e=>setForm({...form,nova_parte_grupo:e.target.value})}/></F></div>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><F label="Tribunal"><input style={INP} value={form.tribunal||''} onChange={e=>setForm({...form,tribunal:e.target.value})}/></F><F label="Órgão administrativo"><input style={INP} value={form.orgao||''} onChange={e=>setForm({...form,orgao:e.target.value})}/></F><F label="Categoria"><select style={INP} value={form.categoria||'trabalhista'} onChange={e=>setForm({...form,categoria:e.target.value})}>{CATEGORIAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Data de ajuizamento"><input type="date" style={INP} value={form.data_ajuizamento||''} onChange={e=>setForm({...form,data_ajuizamento:e.target.value})}/></F><F label="Valor da ação"><input type="number" step="0.01" min="0" style={INP} value={form.valor_acao ?? ''} onChange={e=>{const resumo=resumoFinanceiroProcesso({...form,valor_acao:e.target.value},procFin);setForm({...form,valor_acao:e.target.value,valor_gasto:resumo.totalGasto,valor_economizado:resumo.valorEconomizado})}} placeholder="0,00"/></F><F label="Valor efetivamente gasto"><div style={{display:'flex',gap:8}}><input style={INP} value={money(resumoFinanceiroProcesso(form,procFin).totalGasto)} disabled/><button type="button" onClick={()=>setGastoModal(true)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'0 12px',fontWeight:800,cursor:'pointer'}}>Ver</button></div></F><F label="Valor economizado"><input style={INP} value={money(resumoFinanceiroProcesso(form,procFin).valorEconomizado)} disabled title={resumoFinanceiroProcesso(form,procFin).elegivel?'Economia contabilizada':'Economia ainda não contabilizada: exige trânsito em julgado ou acordo/execução pago.'}/></F></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><F label="Status"><select style={INP} value={form.status||'ativo'} onChange={e=>setForm({...form,status:e.target.value,fase:e.target.value==='encerrado'?'arquivo_definitivo':form.fase})}>{STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><TransitoJulgadoCampo form={form} setForm={setForm}/><F label="Fase processual"><select style={INP} value={form.fase||'conhecimento'} onChange={e=>setForm({...form,fase:e.target.value})} disabled={form.status==='encerrado'}>{FASES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F></div><F label="Responsável"><select style={INP} value={form.responsavel_id||''} onChange={e=>setForm({...form,responsavel_id:e.target.value||null})}><option value="">Sem responsável</option>{team.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></F><F label="Resumo do processo"><textarea style={{...INP,minHeight:110}} value={form.resumo_processo||''} onChange={e=>setForm({...form,resumo_processo:e.target.value})} placeholder="Resumo executivo: objeto, riscos, andamento e estratégia."/></F><F label="Observações"><textarea style={{...INP,minHeight:90}} value={form.observacoes||''} onChange={e=>setForm({...form,observacoes:e.target.value})}/></F><button onClick={save} style={{background:C.navy,color:'white',border:0,borderRadius:8,padding:'11px 18px',fontWeight:800}}>Salvar</button></>}
      {tab==='atividades'&&<><h3 style={{marginTop:0}}>Atividades do processo</h3><div style={{border:'1px solid '+C.border,borderRadius:12,padding:12,marginBottom:14,background:C.white}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          <F label="Tipo"><select style={INP} value={task.tipo} onChange={e=>setTask({...task,tipo:e.target.value,audiencia_modalidade:e.target.value==='audiencia'?(task.audiencia_modalidade||'presencial'):task.audiencia_modalidade,audiencia_tipo:e.target.value==='audiencia'?(task.audiencia_tipo||'inicial'):task.audiencia_tipo})}>{ATIV_TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
          <F label="Status"><select style={INP} value={task.status} onChange={e=>setTask({...task,status:e.target.value})}>{ATIV_STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        </div>
        {task.tipo==='audiencia'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          <F label="Modalidade da audiência"><select style={INP} value={task.audiencia_modalidade||'presencial'} onChange={e=>setTask({...task,audiencia_modalidade:e.target.value})}>{AUDIENCIA_MODALIDADES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
          <F label="Tipo de audiência"><select style={INP} value={task.audiencia_tipo||'inicial'} onChange={e=>setTask({...task,audiencia_tipo:e.target.value})}>{AUDIENCIA_TIPOS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
        </div>}
        <F label="Título"><input style={INP} value={task.titulo||''} onChange={e=>setTask({...task,titulo:e.target.value})}/></F>
        <F label="Descrição"><textarea style={{...INP,minHeight:90}} value={task.descricao||''} onChange={e=>setTask({...task,descricao:e.target.value})}/></F>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          <F label="Prioridade"><select style={INP} value={task.prioridade||'media'} onChange={e=>setTask({...task,prioridade:e.target.value})}>{ATIV_PRIOR.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F>
          <F label="Responsável"><select style={INP} value={task.responsavel_id||''} onChange={e=>setTask({...task,responsavel_id:e.target.value||null})}><option value="">Sem responsável</option>{team.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select></F>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
          <F label="Data / prazo"><input type="date" style={INP} value={task.prazo||''} onChange={e=>setTask({...task,prazo:e.target.value})}/></F>
          <F label="Horário"><input type="time" style={INP} value={task.horario||''} onChange={e=>setTask({...task,horario:e.target.value})}/></F>
        </div>
        <F label="Local / link"><input style={INP} value={task.local||''} onChange={e=>setTask({...task,local:e.target.value})}/></F>
        <div style={{fontSize:12,color:C.muted,margin:'4px 0 12px'}}>Vinculado automaticamente ao processo: <b>{form.numero||form.titulo}</b></div>
        <div style={{display:'flex',justifyContent:'flex-end'}}>{canCreateAtividade&&<button onClick={saveTask} style={{background:C.navy,color:'white',border:0,borderRadius:8,padding:'11px 16px',fontWeight:800}}>Adicionar atividade</button>}</div>
      </div>{procActs.map(a=><div key={a.id} style={{border:'1px solid '+C.border,borderRadius:10,padding:12,marginBottom:8}}><div style={{fontSize:12,color:C.muted,textTransform:'uppercase'}}><CheckSquare size={12}/> {label(ATIV_TIPOS,a.tipo)} · {a.prazo||'sem prazo'}{a.horario?` · ${a.horario}`:''} · {label(ATIV_STATUS,a.status)}</div><b>{a.titulo}</b>{a.descricao&&<div style={{fontSize:13,color:C.muted,marginTop:4}}>{a.descricao}</div>}</div>)}{!procActs.length&&<div style={{color:C.muted,border:'1px dashed '+C.border,borderRadius:10,padding:18}}>Nenhuma atividade vinculada.</div>}</>}
      {tab==='andamentos'&&<AndamentosProcessuaisPush profile={profile} processo={form} />}{tab==='documentos'&&<DocumentosVinculados profile={profile} processoId={form.id} title="Documentos do processo"/>}
      {tab==='financeiro'&&<><h3 style={{display:'flex',gap:8,alignItems:'center',marginTop:0}}><DollarSign size={18}/>Financeiro do processo</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><F label="Natureza"><select style={INP} value={fin.natureza} onChange={e=>setFin({...fin,natureza:e.target.value})}>{NATUREZAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Data do acordo/homologação"><input type="date" style={INP} value={fin.data_referencia} onChange={e=>setFin({...fin,data_referencia:e.target.value})}/></F><F label="Valor bruto / total do acordo"><input type="text" inputMode="numeric" style={INP} value={moeda(fin.valor_bruto)} onChange={e=>moedaChange(e.target.value,v=>setFin(f=>({...f,valor_bruto:v})))} placeholder="R$ 0,00"/></F><F label="Forma de pagamento"><select style={INP} value={fin.forma_pagamento} onChange={e=>{const v=e.target.value;setFin(f=>({...f,forma_pagamento:v,numero_parcelas:v==='avista'?1:Math.max(2,Number(f.numero_parcelas||2)),dividir_valor_parcelas:v==='avista'?true:f.dividir_valor_parcelas!==false,vencimentos_parcelas:v==='avista'?[f.vencimentos_parcelas?.[0]||f.primeiro_vencimento||'']:f.vencimentos_parcelas?.length?f.vencimentos_parcelas:['',''],valores_parcelas:v==='avista'?['']:f.valores_parcelas?.length?f.valores_parcelas:['','']}))}}>{FORMAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></F><F label="Nº parcelas"><input type="number" min={fin.forma_pagamento==='parcelado'?2:1} style={INP} value={fin.forma_pagamento==='avista'?1:fin.numero_parcelas} disabled={fin.forma_pagamento==='avista'} onChange={e=>{const n=Math.max(2,Number(e.target.value||2));setFin(f=>({...f,numero_parcelas:n,vencimentos_parcelas:Array.from({length:n},(_,i)=>f.vencimentos_parcelas?.[i]||''),valores_parcelas:Array.from({length:n},(_,i)=>f.valores_parcelas?.[i]||'')}))}}/></F>{fin.forma_pagamento==='parcelado'&&<F label="Dividir valor total do acordo em parcelas iguais?"><select style={INP} value={fin.dividir_valor_parcelas===false?'nao':'sim'} onChange={e=>setFin(f=>({...f,dividir_valor_parcelas:e.target.value==='sim'}))}><option value="sim">Sim</option><option value="nao">Não</option></select></F>}</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{Array.from({length:fin.forma_pagamento==='parcelado'?Math.max(2,Number(fin.numero_parcelas||2)):1}).map((_,i)=><F key={i} label={`${ordinalParcela(i+1)} vencimento`}><input type="date" style={INP} value={fin.vencimentos_parcelas?.[i]||(i===0?fin.primeiro_vencimento:'')||''} onChange={e=>setFin(f=>{const arr=Array.from({length:f.forma_pagamento==='parcelado'?Math.max(2,Number(f.numero_parcelas||2)):1},(_,j)=>f.vencimentos_parcelas?.[j]||(j===0?f.primeiro_vencimento:'')||'');arr[i]=e.target.value;return {...f,vencimentos_parcelas:arr,primeiro_vencimento:arr[0]||''}})}/></F>)}</div>{fin.forma_pagamento==='parcelado'&&fin.dividir_valor_parcelas===false&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>{Array.from({length:Math.max(2,Number(fin.numero_parcelas||2))}).map((_,i)=><F key={i} label={`Valor da parcela ${i+1}`}><input type="text" inputMode="numeric" style={INP} value={moeda(fin.valores_parcelas?.[i])} onChange={e=>moedaChange(e.target.value,v=>setFin(f=>{const arr=Array.from({length:Math.max(2,Number(f.numero_parcelas||2))},(_,j)=>f.valores_parcelas?.[j]||'');arr[i]=v;return {...f,valores_parcelas:arr}}))} placeholder="R$ 0,00"/></F>)}</div>}<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}><PaidValueField label="Depósito RO" field="deposito_ro" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="Depósito RR" field="deposito_rr" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="Depósito embargos" field="deposito_embargos" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}><F label="Valor restituido / devolvido"><input type="text" inputMode="numeric" style={INP} value={moeda(fin.valor_restituido)} onChange={e=>moedaChange(e.target.value,v=>setFin(f=>({...f,valor_restituido:v})))} placeholder="R$ 0,00"/></F></div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}><PaidValueField label="Custas" field="custas" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="FGTS" field="fgts" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="Honorários sucumbenciais" field="honorarios_sucumbenciais" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="Honorários periciais" field="honorarios_periciais" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="INSS reclamante" field="inss_reclamante" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="INSS reclamada" field="inss_reclamada" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/><PaidValueField label="Multa por inadimplemento" field="multa_inadimplemento" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/></div><div style={{border:'1px solid '+C.border,borderRadius:12,padding:12,margin:'12px 0'}}><b>Apólice / Seguro-garantia</b><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:10}}><F label="Possui seguro-garantia?"><select style={INP} value={fin.seguro_garantia?'sim':'nao'} onChange={e=>setFin({...fin,seguro_garantia:e.target.value==='sim'})}><option value="nao">Não</option><option value="sim">Sim</option></select></F><F label="Número da apólice"><input style={INP} value={fin.apolice_numero||''} onChange={e=>setFin({...fin,apolice_numero:e.target.value})}/></F><F label="Início da vigência"><input type="date" style={INP} value={fin.apolice_inicio||''} onChange={e=>setFin({...fin,apolice_inicio:e.target.value})}/></F><F label="Fim da vigência"><input type="date" style={INP} value={fin.apolice_fim||''} onChange={e=>setFin({...fin,apolice_fim:e.target.value})}/></F><F label="Valor assegurado"><input type="text" inputMode="numeric" style={INP} value={moeda(fin.valor_assegurado)} onChange={e=>moedaChange(e.target.value,v=>setFin(f=>({...f,valor_assegurado:v})))} placeholder="R$ 0,00"/></F><PaidValueField label="Prêmio pago" field="seguro_premio" fin={fin} setFin={setFin} onPaid={abrirPagamentoCampo}/></div></div><F label="Observações financeiras"><textarea style={{...INP,minHeight:70}} value={fin.observacoes} onChange={e=>setFin({...fin,observacoes:e.target.value})}/></F><div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>{(editingFinanceId?canEditFinanceiro:canCreateFinanceiro)&&<button onClick={saveFinance} style={{background:editingFinanceId?C.blue:C.navy,color:'white',border:0,borderRadius:8,padding:'11px 18px',fontWeight:800}}>{editingFinanceId?'Salvar alterações':'Adicionar pagamento/parcelamento'}</button>}{editingFinanceId&&<button onClick={cancelEditFinance} style={{background:C.white,color:C.text,border:'1px solid '+C.border,borderRadius:8,padding:'11px 18px',fontWeight:800}}>Cancelar edição</button>} {editingFinanceId&&<span style={{fontSize:12,color:C.muted}}>Editando pagamento selecionado.</span>}</div><h4 style={{marginTop:22}}>Pagamentos e parcelamentos registrados</h4>{procFin.map(f=><div key={f.id} style={{border:'1px solid '+C.border,borderRadius:10,padding:12,marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><div><b>{tituloAPFinanceiro(f)} · total {money(totalAP(f))}</b><div style={{fontSize:12,color:C.muted}}>Referência: {dateBR(f.data_referencia)} · {label(FORMAS,f.forma_pagamento)} · {f.numero_parcelas||1} parcela(s) · valores: {extrairValoresParcelas(f).map((v,i)=>`${i+1}/${f.numero_parcelas||1}: ${money(v)}`).join(' · ')} · venc.: {extrairVencimentosParcelas(f).map((v,i)=>`${i+1}/${f.numero_parcelas||1}: ${dateBR(v)}`).join(' · ')}{(f.seguro_garantia||f.apolice_numero||Number(f.seguro_premio||0)>0)?` · Seguro-garantia: ${f.seguro_garantia?'sim':'não'} · Apólice ${f.apolice_numero||'sem número'} · vigência ${dateBR(f.apolice_inicio)} a ${dateBR(f.apolice_fim)} · assegurado ${money(f.valor_assegurado)} · prêmio ${money(f.seguro_premio)}`:''}{valorRestituidoFinanceiro(f)>0?` · Restituido ${money(valorRestituidoFinanceiro(f))}`:''}</div></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{temPagamentoCampoAtivo(f)&&<span style={{fontSize:12,color:C.green,fontWeight:800,alignSelf:'center'}}>Pagamento marcado como pago</span>}{canEditFinanceiro&&<button onClick={()=>editFinance(f)} style={{border:'1px solid '+C.border,background:editingFinanceId===f.id?C.blueBg:C.white,color:editingFinanceId===f.id?C.blue:C.text,borderRadius:8,padding:'8px 10px',cursor:'pointer',fontWeight:800,display:'inline-flex',alignItems:'center',gap:6}}><Edit2 size={14}/> Editar</button>}{temPagamentoCampoAtivo(f)&&canEditFinanceiro&&<button onClick={()=>gerenciarPagamentoRegistro(f)} style={{border:'1px solid '+C.green,background:C.greenBg,color:C.green,borderRadius:8,padding:'8px 10px',cursor:'pointer',fontWeight:800,display:'inline-flex',alignItems:'center',gap:6}}>Gerenciar pagamento</button>}{!temPagamentoCampoAtivo(f)&&<button onClick={()=>gerarAutorizacao(f)} style={{border:'1px solid '+C.border,background:C.white,borderRadius:8,padding:'8px 10px',cursor:'pointer',fontWeight:800,display:'inline-flex',alignItems:'center',gap:6}}><Download size={14}/> Autorização</button>}{!temPagamentoCampoAtivo(f)&&canDeleteFinanceiro&&<button onClick={()=>deleteFinance(f)} style={{border:'1px solid '+C.red,background:C.redBg,color:C.red,borderRadius:8,padding:'8px 10px',cursor:'pointer',fontWeight:800,display:'inline-flex',alignItems:'center',gap:6}}><Trash2 size={14}/> Excluir</button>}</div></div></div>)}{!procFin.length&&<div style={{color:C.muted,border:'1px dashed '+C.border,borderRadius:10,padding:18,marginTop:12}}>Nenhum pagamento registrado.</div>}</>}
    </Modal>}
    {gastoModal&&<Modal title="Detalhamento do valor efetivamente gasto" onClose={()=>setGastoModal(false)}>
      {(()=>{const det=detalharGastosFinanceiros(procFin);return <><div style={{border:'1px solid '+C.border,borderRadius:10,overflow:'hidden'}}>{det.linhas.map((x,i)=><div key={i} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:10,borderBottom:'1px solid '+C.border}}><div><b>{x.label}</b><div style={{fontSize:12,color:C.muted}}>{tituloAPFinanceiro(x.registro)} · referência {dateBR(x.registro?.data_referencia)}</div></div><b>{money(x.valor)}</b></div>)}{!det.linhas.length&&<div style={{padding:18,color:C.muted}}>Nenhum gasto financeiro registrado.</div>}</div><div style={{display:'flex',justifyContent:'flex-end',marginTop:14,fontWeight:900,fontSize:16}}>Total: {money(det.total)}</div><p style={{fontSize:12,color:C.muted}}>Observação: este total inclui valores registrados no financeiro, como depósitos, honorários, encargos e prêmio de seguro-garantia. Valores restituidos/devolvidos ja reduzem o total efetivamente gasto.</p></>})()}
    </Modal>}
    {paidModal&&<Modal title={`${paidModal.jaPago?'Registro de pagamento':'Marcar como pago'} — ${paidModal.label}`} onClose={()=>setPaidModal(null)}>
      {paidModal.jaPago&&<div style={{background:C.amberBg,color:C.amber,border:'1px solid #fde68a',borderRadius:10,padding:12,marginBottom:12,fontSize:13,fontWeight:700}}>Este campo já está marcado como pago. É possível revisar os dados ou cancelar o registro; o cancelamento ficará armazenado no histórico de auditoria.</div>}
      <F label="Observações sobre pagamento"><textarea style={{...INP,minHeight:90}} value={paidModal.observacao} onChange={e=>setPaidModal({...paidModal,observacao:e.target.value})} placeholder="Informe dados do pagamento, autenticação, data, responsável, observações etc."/></F><F label="Data do pagamento"><input type="date" style={INP} value={paidModal.data_pagamento||""} onChange={e=>setPaidModal({...paidModal,data_pagamento:e.target.value})}/></F>
      <F label="Comprovante / documento"><input type="file" style={INP} onChange={e=>setPaidModal({...paidModal,comprovante:e.target.files?.[0]?.name||''})}/>{paidModal.comprovante&&<div style={{fontSize:12,color:C.muted,marginTop:6}}>Arquivo selecionado: {paidModal.comprovante}</div>}</F>
      {paidModal.jaPago&&<F label="Observação para cancelamento do registro"><textarea style={{...INP,minHeight:70}} value={paidModal.cancelObs||''} onChange={e=>setPaidModal({...paidModal,cancelObs:e.target.value})} placeholder="Informe o motivo do cancelamento, se desejar."/></F>}
      <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
        <div>{paidModal.jaPago&&<button onClick={cancelarRegistroPagamento} style={{background:C.redBg,color:C.red,border:'1px solid '+C.red,borderRadius:8,padding:'10px 14px',fontWeight:800}}>Cancelar registro de pagamento</button>}</div>
        <div style={{display:'flex',gap:10}}><button onClick={()=>setPaidModal(null)} style={{background:C.white,border:'1px solid '+C.border,borderRadius:8,padding:'10px 14px',fontWeight:800}}>Fechar</button><button onClick={salvarPagamentoCampo} style={{background:C.green,color:'white',border:0,borderRadius:8,padding:'10px 14px',fontWeight:800}}>Salvar pagamento</button></div>
      </div>
    </Modal>}
    {apFinanceiro&&<AutorizacaoPagamentoModal processo={form} financeiro={apFinanceiro} profile={profile} onClose={()=>setApFinanceiro(null)}/>}
  </div>
}
