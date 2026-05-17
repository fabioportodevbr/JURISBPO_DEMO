import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'
import { Scale, Search, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Info, X, RotateCcw, FolderOpen } from 'lucide-react'
import { C } from '../lib/theme'
import { Prv } from '../lib/PrivacyContext'

/* ── Helpers ── */
function parseData(s) {
  if (!s) return null
  const d = new Date(String(s).includes('T') ? s : s + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}
function dataBR(s) {
  const d = parseData(s)
  if (!d) return '—'
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function dataSimples(s) {
  const d = parseData(s)
  return d ? d.toLocaleDateString('pt-BR') : '—'
}

const STATUS_LABEL = { ativo: 'Ativo', arquivo_temporario: 'Arquivo temp.', encerrado: 'Encerrado' }
const STATUS_STYLE = {
  ativo:              { background: '#dbeafe', color: '#1e40af' },
  arquivo_temporario: { background: '#fef3c7', color: '#92400e' },
  encerrado:          { background: 'var(--c-purpleBg)', color: 'var(--c-purple)' },
}

// Códigos de movimentação que indicam publicação no DJe
const DJE_CODES = new Set([11009, 11010, 11011, 11012, 11408, 12188, 12189])
// Códigos de julgamento relevantes
const JULGAMENTO_CODES = new Set([132, 193, 848, 904, 11010, 11803])

function movBadge(codigo) {
  const c = Number(codigo)
  if (DJE_CODES.has(c))       return { label: 'DJe', bg: '#dbeafe', color: '#1e40af' }
  if (JULGAMENTO_CODES.has(c)) return { label: 'Julgamento', bg: '#d1fae5', color: '#065f46' }
  return null
}

const TRIBUNAIS = [
  { group: 'Superiores', items: [
    ['TST','TST — Tribunal Superior do Trabalho'],
    ['STJ','STJ — Superior Tribunal de Justiça'],
    ['STF','STF — Supremo Tribunal Federal'],
    ['TSE','TSE — Tribunal Superior Eleitoral'],
    ['STM','STM — Superior Tribunal Militar'],
  ]},
  { group: 'Justiça do Trabalho', items: [
    ['TRT1','TRT 1ª — Rio de Janeiro'],
    ['TRT2','TRT 2ª — São Paulo'],
    ['TRT3','TRT 3ª — Minas Gerais'],
    ['TRT4','TRT 4ª — Rio Grande do Sul'],
    ['TRT5','TRT 5ª — Bahia'],
    ['TRT6','TRT 6ª — Pernambuco'],
    ['TRT7','TRT 7ª — Ceará'],
    ['TRT8','TRT 8ª — Pará e Amapá'],
    ['TRT9','TRT 9ª — Paraná'],
    ['TRT10','TRT 10ª — DF e Tocantins'],
    ['TRT11','TRT 11ª — Amazonas e Roraima'],
    ['TRT12','TRT 12ª — Santa Catarina'],
    ['TRT13','TRT 13ª — Paraíba'],
    ['TRT14','TRT 14ª — Rondônia e Acre'],
    ['TRT15','TRT 15ª — Campinas/SP'],
    ['TRT16','TRT 16ª — Maranhão'],
    ['TRT17','TRT 17ª — Espírito Santo'],
    ['TRT18','TRT 18ª — Goiás'],
    ['TRT19','TRT 19ª — Alagoas'],
    ['TRT20','TRT 20ª — Sergipe'],
    ['TRT21','TRT 21ª — Rio Grande do Norte'],
    ['TRT22','TRT 22ª — Piauí'],
    ['TRT23','TRT 23ª — Mato Grosso'],
    ['TRT24','TRT 24ª — Mato Grosso do Sul'],
  ]},
  { group: 'Justiça Federal', items: [
    ['TRF1','TRF 1ª — Centro-Oeste e Norte'],
    ['TRF2','TRF 2ª — RJ e ES'],
    ['TRF3','TRF 3ª — SP e MS'],
    ['TRF4','TRF 4ª — Sul'],
    ['TRF5','TRF 5ª — Nordeste'],
    ['TRF6','TRF 6ª — Minas Gerais'],
  ]},
  { group: 'Justiça Estadual', items: [
    ['TJSP','TJSP — São Paulo'],['TJRJ','TJRJ — Rio de Janeiro'],
    ['TJMG','TJMG — Minas Gerais'],['TJRS','TJRS — Rio Grande do Sul'],
    ['TJPR','TJPR — Paraná'],['TJSC','TJSC — Santa Catarina'],
    ['TJBA','TJBA — Bahia'],['TJCE','TJCE — Ceará'],
    ['TJPE','TJPE — Pernambuco'],['TJGO','TJGO — Goiás'],
    ['TJDFT','TJDFT — Distrito Federal e Territórios'],
    ['TJES','TJES — Espírito Santo'],['TJMT','TJMT — Mato Grosso'],
    ['TJMS','TJMS — Mato Grosso do Sul'],['TJPA','TJPA — Pará'],
    ['TJAM','TJAM — Amazonas'],['TJMA','TJMA — Maranhão'],
    ['TJRN','TJRN — Rio Grande do Norte'],['TJPB','TJPB — Paraíba'],
    ['TJAL','TJAL — Alagoas'],['TJPI','TJPI — Piauí'],
    ['TJSE','TJSE — Sergipe'],['TJTO','TJTO — Tocantins'],
    ['TJRO','TJRO — Rondônia'],['TJAC','TJAC — Acre'],
    ['TJAP','TJAP — Amapá'],['TJRR','TJRR — Roraima'],
  ]},
]

const INP = {
  padding: '9px 12px', border: '1px solid ' + C.border,
  borderRadius: 8, fontSize: 13, background: C.white,
  color: C.text, width: '100%', boxSizing: 'border-box',
}

function MovimentoRow({ mov }) {
  const badge = movBadge(mov.codigo)
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid ' + C.border, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, width: 130, fontSize: 11, color: C.muted, paddingTop: 1 }}>
        {dataBR(mov.dataHora)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 900, background: badge.bg, color: badge.color, padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>
              {badge.label}
            </span>
          )}
          <span className="prv" style={{ fontSize: 13, fontWeight: badge ? 700 : 400, color: C.text }}>
            {mov.nome || `Código ${mov.codigo}`}
          </span>
        </div>
        {mov.complemento && (
          <div className="prv" style={{ fontSize: 12, color: C.muted, marginTop: 2, fontStyle: 'italic' }}>
            {mov.complemento}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, fontSize: 11, color: C.muted, paddingTop: 1 }}>
        #{mov.codigo}
      </div>
    </div>
  )
}

function normParteSearch(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function nomesReclamadasProcesso(p) {
  if (Array.isArray(p?.partes_contrarias) && p.partes_contrarias.length) {
    return p.partes_contrarias.map(r => String(r?.nome || r?.parte_contraria || '')).filter(Boolean)
  }
  const texto = String(p?.parte_contraria || '')
  return texto ? texto.split(/\s+\|\s+|;\s*/).map(s => s.trim()).filter(Boolean) : []
}

export default function DataJudConsulta({ profile, processos = [], onOpenProcess }) {
  // Lista de processos com número CNJ cadastrado
  const processosComNumero = useMemo(() =>
    processos.filter(p => String(p.numero || '').replace(/\D/g, '').length >= 7)
  , [processos])

  const [selectedId,    setSelectedId]    = useState('')
  const [parteSearch,   setParteSearch]   = useState('')
  const [manualNumero,  setManualNumero]  = useState('')
  const [manualTribunal,setManualTribunal]= useState('')
  const [loading,       setLoading]       = useState(false)
  const [resultado,     setResultado]     = useState(null)
  const [erro,          setErro]          = useState('')
  const [expandidos,    setExpandidos]    = useState({})

  // Processo selecionado
  const procSelecionado = useMemo(() =>
    processos.find(p => p.id === selectedId) || null
  , [selectedId, processos])

  // Índice: número limpo → processo cadastrado (para cruzar com resultados DataJud)
  const processosByNumero = useMemo(() => {
    const map = new Map()
    processos.forEach(p => {
      const num = String(p.numero || '').replace(/\D/g, '')
      if (num) map.set(num, p)
    })
    return map
  }, [processos])

  // Filtra processos com número pela busca de parte
  const processosFiltrados = useMemo(() => {
    const term = normParteSearch(parteSearch)
    if (!term) return processosComNumero
    return processosComNumero.filter(p => {
      const campos = [p.numero, p.titulo, p.tribunal, p.orgao, ...nomesReclamadasProcesso(p)]
      return campos.some(v => normParteSearch(v).includes(term))
    })
  }, [processosComNumero, parteSearch])

  const numeroFinal   = selectedId ? (procSelecionado?.numero || '') : manualNumero
  const tribunalFinal = selectedId ? (procSelecionado?.tribunal || '') : manualTribunal

  // Detecta tribunal pelo código TT do número CNJ (NNNNNNN-DD.AAAA.J.TT.OOOO)
  function detectarTribunalCNJ(num) {
    if (num.length !== 20) return null
    const j = num[13]
    const tt = parseInt(num.slice(14, 16), 10)
    const segmentos = {
      '1': 'STF', '3': 'STJ', '7': 'STM',
    }
    if (segmentos[j]) return segmentos[j]
    if (j === '4') return tt >= 1 && tt <= 6 ? `TRF${tt}` : null
    if (j === '5') return tt === 0 ? 'TST' : (tt >= 1 && tt <= 24 ? `TRT${tt}` : null)
    if (j === '8') {
      const UF = ['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','SP','TO']
      return tt >= 1 && tt <= 27 ? `TJ${UF[tt]}` : null
    }
    if (j === '6') {
      const UF = ['','AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','SP','TO']
      return tt >= 1 && tt <= 27 ? `TRE-${UF[tt]}` : null
    }
    return null
  }

  const consultar = async () => {
    const num = String(numeroFinal || '').replace(/\D/g, '')
    const trib = String(tribunalFinal || '').trim()
    if (num.length < 7) { setErro('Informe um número de processo válido (mínimo 7 dígitos).'); return }
    // Tribunal só é obrigatório se o número CNJ não tiver 20 dígitos (auto-detecção impossível)
    if (!trib && num.length !== 20) { setErro('Informe o tribunal (ou use o número CNJ completo para detecção automática).'); return }

    setLoading(true); setErro(''); setResultado(null); setExpandidos({})
    try {
      const { data, error } = await supabase.functions.invoke('datajud-consulta', {
        body: { numeroProcesso: num, tribunal: trib, size: 100 },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setResultado(data)
    } catch (e) {
      console.error('DataJud error:', e)
      setErro(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  const novaConsulta = () => {
    setSelectedId('')
    setParteSearch('')
    setManualNumero('')
    setManualTribunal('')
    setResultado(null)
    setErro('')
    setExpandidos({})
  }

  const toggleExpandido = (idx) =>
    setExpandidos(prev => ({ ...prev, [idx]: !prev[idx] }))

  return (
    <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid ' + C.border, background: C.grayBg, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scale size={16} color={C.navy} /> Movimentações Processuais — DataJud / CNJ
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
            Consulta em tempo real em +100 tribunais (TST, TRTs, TRFs, TJs) via API pública do CNJ
          </p>
        </div>
        <span style={{ fontSize: 11, border: '1px solid ' + C.border, borderRadius: 20, padding: '3px 10px', color: C.muted, fontWeight: 700, background: C.white }}>
          api-publica.datajud.cnj.jus.br
        </span>
      </div>

      {/* ── Barra de resultado ativo (substitui formulário após consulta) ── */}
      {resultado && !loading && (
        <div style={{ padding: '10px 18px', borderBottom: '1px solid ' + C.border, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: C.muted, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Search size={13} />
            {selectedId && procSelecionado ? (
              <>
                <span className="prv" style={{ fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{procSelecionado.numero}</span>
                <span className="prv">{procSelecionado.titulo || procSelecionado.parte_contraria || '—'}</span>
                {resultado.index && (
                  <span style={{ fontSize: 10, fontWeight: 900, background: '#dbeafe', color: '#1e40af', padding: '1px 7px', borderRadius: 8 }}>
                    {resultado.index.replace('api_publica_', '').toUpperCase()}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="prv" style={{ fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{manualNumero}</span>
                {resultado.index && (
                  <span style={{ fontSize: 10, fontWeight: 900, background: '#dbeafe', color: '#1e40af', padding: '1px 7px', borderRadius: 8 }}>
                    {resultado.index.replace('api_publica_', '').toUpperCase()}
                  </span>
                )}
              </>
            )}
            <span style={{ color: C.green, fontWeight: 700 }}>{resultado.total} resultado(s)</span>
          </div>
          <button
            onClick={novaConsulta}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
          >
            <RotateCcw size={13} />
            Nova consulta
          </button>
        </div>
      )}

      {/* ── Formulário ── */}
      {!resultado && (
      <div style={{ padding: '14px 18px', borderBottom: '1px solid ' + C.border }}>

        {/* ── Busca de processo cadastrado ── */}
        {!selectedId && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
              {processosComNumero.length > 0
                ? `Buscar processo cadastrado (${processosComNumero.length} com número CNJ)`
                : 'Buscar processo cadastrado'}
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={15} color={C.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                style={{ ...INP, paddingLeft: 32 }}
                placeholder="Buscar por número, parte contrária, tribunal ou título…"
                value={parteSearch}
                onChange={e => { setParteSearch(e.target.value); setErro('') }}
                disabled={processosComNumero.length === 0}
              />
              {parteSearch && (
                <button
                  onClick={() => setParteSearch('')}
                  style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', padding: 4 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {processosComNumero.length === 0 && (
              <div style={{ background: C.amberBg, color: C.amber, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                <Info size={13} /> Nenhum processo com número CNJ cadastrado. Preencha o campo "Número" nos processos para usar a busca automática.
              </div>
            )}

            {/* Lista de resultados */}
            {processosComNumero.length > 0 && (
              <div style={{ marginTop: 6, border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                {processosFiltrados.length === 0 ? (
                  <div style={{ padding: '12px 14px', color: C.muted, fontSize: 13, textAlign: 'center' }}>
                    Nenhum processo encontrado para "{parteSearch}".
                  </div>
                ) : (
                  processosFiltrados.slice(0, 30).map((p, idx) => {
                    const reclamadas = nomesReclamadasProcesso(p)
                    const auto = detectarTribunalCNJ(String(p.numero || '').replace(/\D/g, ''))
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedId(p.id); setParteSearch(''); setErro(''); setResultado(null) }}
                        style={{
                          width: '100%', textAlign: 'left', background: 'none', border: 'none',
                          borderBottom: idx < processosFiltrados.length - 1 ? '1px solid ' + C.border : 'none',
                          padding: '10px 14px', cursor: 'pointer', transition: 'background .1s', color: C.text,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                          <span className="prv" style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted }}>{p.numero || 'sem número'}</span>
                          {auto && (
                            <span style={{ fontSize: 10, fontWeight: 900, background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 8 }}>
                              {auto}
                            </span>
                          )}
                        </div>
                        <b className="prv" style={{ fontSize: 13, color: C.text }}>{p.titulo || '(sem título)'}</b>
                        {reclamadas.length > 0 && (
                          <div className="prv" style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                            Parte: {reclamadas.slice(0, 2).join(' · ')}{reclamadas.length > 2 ? ` +${reclamadas.length - 2}` : ''}
                          </div>
                        )}
                        {(p.tribunal || p.orgao) && (
                          <div style={{ fontSize: 11, color: C.muted }}>
                            {p.tribunal || p.orgao}
                          </div>
                        )}
                      </button>
                    )
                  })
                )}
                {processosFiltrados.length > 30 && (
                  <div style={{ padding: '8px 14px', fontSize: 11, color: C.muted, background: C.bg, textAlign: 'center' }}>
                    Mostrando 30 de {processosFiltrados.length}. Refine a busca para ver mais resultados.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Campos manuais (aparecem sempre que não há processo selecionado) */}
        {!selectedId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                Número do processo (CNJ)
              </label>
              <input
                style={INP}
                placeholder="Ex: 0001234-56.2023.5.15.0001"
                value={manualNumero}
                onChange={e => { setManualNumero(e.target.value); setErro('') }}
              />
              {(() => {
                const num = manualNumero.replace(/\D/g, '')
                const auto = num.length === 20 ? detectarTribunalCNJ(num) : null
                if (!auto) return null
                return (
                  <div style={{ marginTop: 5, fontSize: 11, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 900 }}>✓</span> Tribunal detectado automaticamente: <b>{auto}</b> — campo tribunal opcional.
                  </div>
                )
              })()}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
                Tribunal {manualNumero.replace(/\D/g,'').length === 20 && detectarTribunalCNJ(manualNumero.replace(/\D/g,'')) ? '(opcional — detectado pelo número)' : ''}
              </label>
              <select style={INP} value={manualTribunal} onChange={e => { setManualTribunal(e.target.value); setErro('') }}>
                <option value="">Selecione o tribunal</option>
                {TRIBUNAIS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Info do processo selecionado */}
        {selectedId && procSelecionado && (
          <div style={{ background: C.grayBg, border: '1px solid ' + C.border, borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
            <span className="prv" style={{ fontWeight: 700, color: C.text }}>{procSelecionado.numero}</span>
            <span className="prv" style={{ color: C.muted, marginLeft: 8 }}>{procSelecionado.titulo || procSelecionado.parte_contraria}</span>
            <span style={{ color: C.muted, marginLeft: 8 }}>· {procSelecionado.tribunal || 'Tribunal não informado'}</span>
            {(() => {
              const num = String(procSelecionado.numero || '').replace(/\D/g, '')
              const auto = detectarTribunalCNJ(num)
              // Mostra badge de auto-detecção quando o tribunal cadastrado não é código padrão
              if (auto && !/^(TRT|TRF|TJ|TRE|TST|STF|STJ|STM|TSE)\d*/.test((procSelecionado.tribunal || '').toUpperCase().trim())) {
                return (
                  <span title="Tribunal identificado automaticamente pelo número CNJ" style={{ marginLeft: 8, fontSize: 10, fontWeight: 900, background: '#dbeafe', color: '#1e40af', padding: '2px 7px', borderRadius: 10 }}>
                    {auto} ✓ auto
                  </span>
                )
              }
              return null
            })()}
            <button onClick={() => { setSelectedId(''); setResultado(null) }} style={{ marginLeft: 10, fontSize: 11, color: C.green, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              trocar
            </button>
          </div>
        )}

        <button
          onClick={consultar}
          disabled={loading || (!numeroFinal && !selectedId)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
            background: loading ? C.muted : C.navy, color: 'white',
            border: 0, borderRadius: 8, fontWeight: 800, fontSize: 13,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
          {loading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
          {loading ? 'Consultando DataJud…' : 'Consultar movimentações'}
        </button>
      </div>
      )}

      {/* ── Resultados ── */}
      <div style={{ padding: '14px 18px' }}>

        {erro && (
          <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{erro}</span>
          </div>
        )}

        {!resultado && !loading && !erro && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 10 }}>
            <Scale size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              Selecione um processo ou informe o número e o tribunal e clique em <b>Consultar movimentações</b>
            </p>
          </div>
        )}

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
            Consultando DataJud…
          </div>
        )}

        {resultado && !loading && (
          <>
            {resultado.processos.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 10 }}>
                <p style={{ margin: 0, fontSize: 13 }}>
                  Nenhum processo encontrado no DataJud para este número no tribunal <b>{resultado.tribunalRaw}</b>.
                  <br />
                  <span style={{ fontSize: 12 }}>Verifique se o número está no formato CNJ e se o tribunal está correto.</span>
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
                  <b style={{ color: C.green }}>{resultado.total}</b> processo(s) encontrado(s) no índice <code style={{ fontSize: 11, background: C.grayBg, padding: '1px 5px', borderRadius: 4 }}>{resultado.index}</code>
                </p>

                {resultado.processos.map((proc, idx) => {
                  const aberto = expandidos[idx] !== false // aberto por padrão
                  const djeCount = (proc.movimentos || []).filter(m => DJE_CODES.has(Number(m.codigo))).length
                  // Cruzamento com processo cadastrado no sistema
                  const numLimpo = String(proc.numeroProcesso || '').replace(/\D/g, '')
                  const procCadastrado = processosByNumero.get(numLimpo) || (procSelecionado && String(procSelecionado.numero || '').replace(/\D/g,'') === numLimpo ? procSelecionado : null)
                  const statusKey = procCadastrado?.status
                  const statusStyle = STATUS_STYLE[statusKey]
                  const statusLabel = STATUS_LABEL[statusKey]
                  // Data de ajuizamento: tenta DataJud primeiro, usa cadastro como fallback
                  const dataAjuiz = dataSimples(proc.dataAjuizamento) !== '—'
                    ? dataSimples(proc.dataAjuizamento)
                    : dataSimples(procCadastrado?.data_ajuizamento)

                  return (
                    <div key={idx} style={{ border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden' }}>

                      {/* Cabeçalho do processo */}
                      <div style={{ background: C.grayBg, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <button
                          onClick={() => toggleExpandido(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', flexShrink: 0, color: C.muted, display: 'flex' }}
                          title={aberto ? 'Recolher' : 'Expandir'}
                        >
                          {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                            <b className="prv" style={{ fontSize: 13, color: C.text, fontFamily: 'monospace' }}>
                              {String(proc.numeroProcesso || '').replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6')}
                            </b>
                            {proc.tribunal && (
                              <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 10, fontWeight: 900 }}>
                                {proc.tribunal}
                              </span>
                            )}
                            {proc.grau && (
                              <span style={{ fontSize: 11, color: C.muted }}>{proc.grau}</span>
                            )}
                            {statusLabel && statusStyle && (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 900, ...statusStyle }}>
                                {statusLabel}
                              </span>
                            )}
                            {djeCount > 0 && (
                              <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 10, fontWeight: 900 }}>
                                {djeCount} pub. DJe
                              </span>
                            )}
                          </div>
                          <div className="prv" style={{ display: 'flex', gap: 14, fontSize: 12, color: C.muted, flexWrap: 'wrap' }}>
                            {proc.classe        && <span><b>Classe:</b> {proc.classe}</span>}
                            {proc.orgaoJulgador && <span><b>Órgão:</b> {proc.orgaoJulgador}</span>}
                            {dataAjuiz !== '—'  && <span><b>Ajuizamento:</b> {dataAjuiz}</span>}
                            {proc.assuntos?.length > 0 && <span><b>Assunto:</b> {proc.assuntos.slice(0,2).join(', ')}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {procCadastrado && onOpenProcess && (
                            <button
                              onClick={() => onOpenProcess(procCadastrado.id)}
                              title="Abrir cadastro deste processo no sistema"
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: '1px solid ' + C.border, borderRadius: 7, background: C.white, color: C.text, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}
                            >
                              <FolderOpen size={12} /> Abrir
                            </button>
                          )}
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {(proc.movimentos || []).length} mov.
                          </span>
                        </div>
                      </div>

                      {/* Movimentações */}
                      {aberto && (
                        <div style={{ padding: '0 14px 4px' }}>
                          {(proc.movimentos || []).length === 0 ? (
                            <p style={{ padding: '12px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Nenhuma movimentação registrada.</p>
                          ) : (
                            (proc.movimentos || []).map((mov, mi) => (
                              <MovimentoRow key={mi} mov={mov} />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: 11, color: C.muted, margin: '14px 0 0' }}>
          Dados fornecidos pelo{' '}
          <a href="https://datajud-wiki.cnj.jus.br" target="_blank" rel="noreferrer" style={{ color: C.green }}>DataJud / CNJ</a>
          {' '}· API pública com chave divulgada na documentação oficial · informações de caráter processual (não inclui texto integral do DJe)
        </p>
      </div>
    </div>
  )
}
