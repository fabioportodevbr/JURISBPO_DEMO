import React from 'react'

import { C } from '../lib/theme'
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}

function F({label,children}) {
  return <div style={{marginBottom:12,flex:1}}>
    <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>
    {children}
  </div>
}

function parseMoney(v) {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = String(v).replace(/[^\d,.-]/g, '')
  if (!s) return 0
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  return Number(s) || 0
}
function moeda(v){if(v===null||v===undefined||v==='')return '';return parseMoney(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function moedaChange(valor,setter){const digits=String(valor||'').replace(/\D/g,'');setter(digits?(Number(digits)/100).toFixed(2):'')}

function financeiroExcluido(f = {}) {
  return String(f?.observacoes || '').includes('[REGISTRO_FINANCEIRO_EXCLUIDO:')
}

function valorRestituidoFinanceiro(f = {}) {
  const direto = parseMoney(f.valor_restituido)
  if (direto > 0) return direto
  const match = String(f?.observacoes || '').match(/\[VALOR_RESTITUIDO:([^\]]*)\]/)
  return match ? parseMoney(match[1]) : 0
}

export function SeguroGarantiaCampos({financeiroForm,setFinanceiroForm}) {
  return (
    <div style={{border:'1px solid '+C.border,borderRadius:12,padding:12,margin:'12px 0'}}>
      <b>Apólice / Seguro-garantia</b>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:10}}>
        <F label="Possui seguro-garantia?">
          <select style={INP} value={financeiroForm.seguro_garantia?'sim':'nao'} onChange={e=>setFinanceiroForm({...financeiroForm,seguro_garantia:e.target.value==='sim'})}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </F>
        <F label="Número da apólice">
          <input style={INP} value={financeiroForm.apolice_numero||''} onChange={e=>setFinanceiroForm({...financeiroForm,apolice_numero:e.target.value})}/>
        </F>
        <F label="Início da vigência">
          <input type="date" style={INP} value={financeiroForm.apolice_inicio||''} onChange={e=>setFinanceiroForm({...financeiroForm,apolice_inicio:e.target.value})}/>
        </F>
        <F label="Fim da vigência">
          <input type="date" style={INP} value={financeiroForm.apolice_fim||''} onChange={e=>setFinanceiroForm({...financeiroForm,apolice_fim:e.target.value})}/>
        </F>
        <F label="Valor assegurado">
          <input type="text" inputMode="numeric" style={INP} value={moeda(financeiroForm.valor_assegurado)} onChange={e=>moedaChange(e.target.value,v=>setFinanceiroForm({...financeiroForm,valor_assegurado:v}))} placeholder="R$ 0,00"/>
        </F>
        <F label="Prêmio pago">
          <input type="text" inputMode="numeric" style={INP} value={moeda(financeiroForm.seguro_premio)} onChange={e=>moedaChange(e.target.value,v=>setFinanceiroForm({...financeiroForm,seguro_premio:v}))} placeholder="R$ 0,00"/>
        </F>
      </div>
    </div>
  )
}

export function TransitoJulgadoCampo({form,setForm}) {
  return (
    <F label="Trânsito em julgado">
      <select style={INP} value={form.transito_julgado?'sim':'nao'} onChange={e=>setForm({...form,transito_julgado:e.target.value==='sim'})}>
        <option value="nao">Não</option>
        <option value="sim">Sim</option>
      </select>
    </F>
  )
}

export function calcularResumoFinanceiroProcesso(proc, financeiros = []) {
  const valorCausa = Number(proc?.valor_acao || 0)
  const transito = proc?.transito_julgado === true || proc?.transito_julgado === 'sim'
  const acordoOuExecucaoPago = financeiros.some(f =>
    ['pago','quitado','concluido','concluído'].includes(String(f.status_pagamento || f.status || '').toLowerCase()) &&
    ['acordo','execucao','execução'].includes(String(f.natureza || '').toLowerCase())
  )

  const totalGasto = financeiros.filter(f => !financeiroExcluido(f)).reduce((s, f) => s + Math.max(
    parseMoney(f.valor_bruto) +
    parseMoney(f.deposito_ro) +
    parseMoney(f.deposito_rr) +
    parseMoney(f.deposito_embargos) +
    parseMoney(f.agravo_instrumento) +
    parseMoney(f.custas) +
    parseMoney(f.custas_processuais) +
    parseMoney(f.fgts) +
    parseMoney(f.honorarios_sucumbenciais) +
    parseMoney(f.honorarios_periciais) +
    parseMoney(f.honorarios_e_custos) +
    parseMoney(f.inss_reclamante) +
    parseMoney(f.inss_reclamada) +
    parseMoney(f.multa_inadimplemento) +
    parseMoney(f.seguro_premio) -
    valorRestituidoFinanceiro(f), 0), 0)

  const economiaContabilizada = transito || acordoOuExecucaoPago

  return {
    totalGasto,
    economiaContabilizada,
    valorEconomizado: economiaContabilizada ? Math.max(valorCausa - totalGasto, 0) : 0
  }
}
