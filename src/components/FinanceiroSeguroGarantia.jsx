import React from 'react'

const C={border:'#e5e7eb',white:'#fff',text:'#0f172a',muted:'#64748b'}
const INP={width:'100%',padding:'10px 12px',border:'1px solid '+C.border,borderRadius:8,boxSizing:'border-box',fontSize:14,background:C.white,color:C.text}

function F({label,children}) {
  return <div style={{marginBottom:12,flex:1}}>
    <label style={{fontSize:11,fontWeight:800,color:C.muted,textTransform:'uppercase',display:'block',marginBottom:5}}>{label}</label>
    {children}
  </div>
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
          <input type="number" step="0.01" style={INP} value={financeiroForm.valor_assegurado||''} onChange={e=>setFinanceiroForm({...financeiroForm,valor_assegurado:e.target.value})}/>
        </F>
        <F label="Prêmio pago">
          <input type="number" step="0.01" style={INP} value={financeiroForm.seguro_premio||''} onChange={e=>setFinanceiroForm({...financeiroForm,seguro_premio:e.target.value})}/>
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

  const totalGasto = financeiros.reduce((s, f) => s +
    Number(f.valor_bruto || 0) +
    Number(f.custas_processuais || 0) +
    Number(f.fgts || 0) +
    Number(f.honorarios_sucumbenciais || 0) +
    Number(f.honorarios_periciais || 0) +
    Number(f.inss_reclamante || 0) +
    Number(f.inss_reclamada || 0) +
    Number(f.multa_inadimplemento || 0) +
    Number(f.seguro_premio || 0), 0)

  const economiaContabilizada = transito || acordoOuExecucaoPago

  return {
    totalGasto,
    economiaContabilizada,
    valorEconomizado: economiaContabilizada ? Math.max(valorCausa - totalGasto, 0) : 0
  }
}
