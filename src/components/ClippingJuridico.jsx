import { useState } from 'react'
import { Search, ExternalLink, RefreshCw, Newspaper, AlertTriangle, Globe, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { C } from '../lib/theme'

// ── API Querido Diário (municípios) — chamada direta, tem CORS ──
const QD_BASE = 'https://api.queridodiario.ok.org.br'

// ── API DOU Federal — via Edge Function (sem CORS no portal in.gov.br) ──
const EDGE_FN = 'clipping-juridico'

function today()    { return new Date().toISOString().slice(0, 10) }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
function dateBR(s)  { if (!s) return '—'; try { return new Date(s + (s.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') } catch { return s } }

const INP = {
  padding: '9px 12px', border: '1px solid ' + C.border,
  borderRadius: 8, fontSize: 13, background: C.white,
  color: C.text, width: '100%', boxSizing: 'border-box',
}

function SourceBadge({ label, color = C.navy, bg = '#dbeafe' }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 900, color, background: bg, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.03em', flexShrink: 0 }}>
      {label}
    </span>
  )
}

function ResultCard({ item, source }) {
  const isFederal = source === 'federal'
  return (
    <div style={{ border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', background: C.grayBg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isFederal
            ? <SourceBadge label={item.section || 'DOU Federal'} color="#1e40af" bg="#dbeafe" />
            : <SourceBadge label={item.territory_name || 'Município'} color="#065f46" bg="#d1fae5" />}
          <span style={{ fontSize: 11, color: C.muted }}>
            {isFederal ? dateBR(item.publishDate) : dateBR(item.date)}
          </span>
          {isFederal && item.hierarchy && (
            <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.hierarchy}
            </span>
          )}
        </div>
        {(isFederal ? item.url : item.url) && (
          <a href={isFederal ? item.url : item.url} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: C.green, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', flexShrink: 0 }}>
            Ver publicação <ExternalLink size={11} />
          </a>
        )}
      </div>

      {isFederal && item.title && (
        <b style={{ display: 'block', fontSize: 13, color: C.text, marginBottom: 6 }}>{item.title}</b>
      )}

      <div
        style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: isFederal ? (item.excerpt || '') : '' }}
      />
      {!isFederal && (item.excerpts || []).map((ex, ei) => (
        <div key={ei} style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginTop: ei > 0 ? 8 : 0, paddingTop: ei > 0 ? 8 : 0, borderTop: ei > 0 ? '1px dashed ' + C.border : 'none' }}
          dangerouslySetInnerHTML={{ __html: ex }} />
      ))}
    </div>
  )
}

export default function ClippingJuridico({ profile }) {
  const [query,   setQuery]   = useState('')
  const [since,   setSince]   = useState(daysAgo(30))
  const [until,   setUntil]   = useState(today())

  // fontes selecionadas
  const [srcFederal,   setSrcFederal]   = useState(true)
  const [srcMunicipal, setSrcMunicipal] = useState(true)

  // estados de busca por fonte
  const [fedResults, setFedResults] = useState(null)
  const [fedTotal,   setFedTotal]   = useState(0)
  const [fedLoading, setFedLoading] = useState(false)
  const [fedError,   setFedError]   = useState('')

  const [munResults, setMunResults] = useState(null)
  const [munTotal,   setMunTotal]   = useState(0)
  const [munLoading, setMunLoading] = useState(false)
  const [munError,   setMunError]   = useState('')

  const isLoading = fedLoading || munLoading
  const hasResults = fedResults !== null || munResults !== null

  const buscarFederal = async (q, from, to) => {
    setFedLoading(true); setFedError(''); setFedResults(null)
    try {
      const { data, error } = await supabase.functions.invoke(EDGE_FN, {
        body: { q, publishFrom: from, publishTo: to, sections: ['do1', 'do2', 'do3'], size: 20 },
      })
      if (error) throw error
      if (data?.error && !data?.results?.length) throw new Error(data.error)
      setFedResults(data?.results || [])
      setFedTotal(data?.total || 0)
    } catch (err) {
      console.error('DOU Federal error:', err)
      setFedError('Não foi possível consultar o DOU Federal. Verifique se a Edge Function está publicada.')
    } finally {
      setFedLoading(false)
    }
  }

  const buscarMunicipal = async (q, from, to) => {
    setMunLoading(true); setMunError(''); setMunResults(null)
    try {
      const params = new URLSearchParams({
        querystring: q, published_since: from, published_until: to,
        size: 20, sort_by: 'descending_date', excerpt_size: 600,
        number_of_excerpts: 2, pre_tags: '<mark>', post_tags: '</mark>',
      })
      const res = await fetch(`${QD_BASE}/gazettes?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMunResults(data.gazettes || [])
      setMunTotal(data.total_gazettes || 0)
    } catch (err) {
      console.error('Querido Diário error:', err)
      setMunError('Não foi possível consultar os diários municipais.')
    } finally {
      setMunLoading(false)
    }
  }

  const buscar = async (e) => {
    if (e) e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (!srcFederal && !srcMunicipal) return
    if (srcFederal)   buscarFederal(q, since, until)
    if (srcMunicipal) buscarMunicipal(q, since, until)
  }

  return (
    <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid ' + C.border, background: C.grayBg, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Newspaper size={16} color={C.navy} /> Busca no Diário Oficial
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
            DOU Federal (in.gov.br) · Diários municipais via Querido Diário
          </p>
        </div>
        <span style={{ fontSize: 11, border: '1px solid ' + C.border, borderRadius: 20, padding: '3px 10px', color: C.muted, fontWeight: 700, background: C.white }}>
          Integração Ro-DOU
        </span>
      </div>

      {/* ── Formulário ── */}
      <form onSubmit={buscar} style={{ padding: '14px 18px', borderBottom: '1px solid ' + C.border }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px auto', gap: 10, alignItems: 'end', marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
              Palavra-chave, nome, CNPJ ou número do processo
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: C.muted }} />
              <input
                style={{ ...INP, paddingLeft: 32 }}
                placeholder='Ex: "Prefeitura de Campinas" ou 12.345.678/0001-99'
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>Início</label>
            <input type="date" style={INP} value={since} onChange={e => setSince(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>Fim</label>
            <input type="date" style={INP} value={until} onChange={e => setUntil(e.target.value)} />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim() || (!srcFederal && !srcMunicipal)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
              background: isLoading || !query.trim() || (!srcFederal && !srcMunicipal) ? C.muted : C.navy,
              color: 'white', border: 0, borderRadius: 8, fontWeight: 800, fontSize: 13,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {isLoading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={13} />}
            {isLoading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {/* Seleção de fontes */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Fontes:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.text }}>
            <input type="checkbox" checked={srcFederal} onChange={e => setSrcFederal(e.target.checked)} />
            <Building2 size={13} color="#1e40af" />
            DOU Federal (Seções 1, 2 e 3)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.text }}>
            <input type="checkbox" checked={srcMunicipal} onChange={e => setSrcMunicipal(e.target.checked)} />
            <Globe size={13} color="#065f46" />
            Diários municipais
          </label>
        </div>
      </form>

      {/* ── Resultados ── */}
      <div style={{ padding: '14px 18px' }}>

        {!hasResults && !isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 10 }}>
            <Globe size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              Selecione as fontes, informe um termo e clique em <b>Buscar</b>
            </p>
          </div>
        )}

        {/* DOU Federal */}
        {srcFederal && (fedLoading || fedResults !== null || fedError) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Building2 size={15} color="#1e40af" />
              <b style={{ fontSize: 14, color: C.text }}>DOU Federal</b>
              {fedLoading && <span style={{ fontSize: 12, color: C.muted }}>— consultando…</span>}
              {!fedLoading && fedResults !== null && (
                <span style={{ fontSize: 12, color: C.muted }}>
                  — <b style={{ color: C.green }}>{fedTotal.toLocaleString('pt-BR')}</b> resultado(s) · exibindo até 20
                </span>
              )}
            </div>

            {fedError && (
              <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={14} /> {fedError}
              </div>
            )}
            {fedLoading && <div style={{ padding: 20, textAlign: 'center', color: C.muted }}>Consultando in.gov.br…</div>}
            {!fedLoading && fedResults !== null && fedResults.length === 0 && !fedError && (
              <div style={{ padding: 16, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 8, fontSize: 13 }}>
                Nenhuma publicação encontrada no DOU Federal para "<b>{query}</b>" no período.
              </div>
            )}
            {!fedLoading && fedResults && fedResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {fedResults.map((item, idx) => <ResultCard key={item.id || idx} item={item} source="federal" />)}
              </div>
            )}
          </div>
        )}

        {/* Diários Municipais */}
        {srcMunicipal && (munLoading || munResults !== null || munError) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Globe size={15} color="#065f46" />
              <b style={{ fontSize: 14, color: C.text }}>Diários Municipais</b>
              {munLoading && <span style={{ fontSize: 12, color: C.muted }}>— consultando…</span>}
              {!munLoading && munResults !== null && (
                <span style={{ fontSize: 12, color: C.muted }}>
                  — <b style={{ color: C.green }}>{munTotal.toLocaleString('pt-BR')}</b> resultado(s) · exibindo até 20
                </span>
              )}
            </div>

            {munError && (
              <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertTriangle size={14} /> {munError}
              </div>
            )}
            {munLoading && <div style={{ padding: 20, textAlign: 'center', color: C.muted }}>Consultando Querido Diário…</div>}
            {!munLoading && munResults !== null && munResults.length === 0 && !munError && (
              <div style={{ padding: 16, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 8, fontSize: 13 }}>
                Nenhuma publicação encontrada em diários municipais para "<b>{query}</b>" no período.
              </div>
            )}
            {!munLoading && munResults && munResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {munResults.map((item, idx) => <ResultCard key={item.file_url || idx} item={item} source="municipal" />)}
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 11, color: C.muted, margin: '14px 0 0' }}>
          Fontes: <a href="https://www.in.gov.br" target="_blank" rel="noreferrer" style={{ color: C.green }}>Imprensa Nacional</a> (DOU Federal) ·{' '}
          <a href="https://queridodiario.ok.org.br" target="_blank" rel="noreferrer" style={{ color: C.green }}>Querido Diário</a> (OK Brasil) · integração Ro-DOU
        </p>
      </div>

      <style>{`mark { background: #fef08a; padding: 0 2px; border-radius: 2px; }`}</style>
    </div>
  )
}
