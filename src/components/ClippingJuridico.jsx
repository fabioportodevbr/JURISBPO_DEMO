import { useState } from 'react'
import { Search, ExternalLink, RefreshCw, Newspaper, AlertTriangle, Globe } from 'lucide-react'
import { C } from '../lib/theme'

const API_BASE = 'https://api.queridodiario.ok.org.br'

function today() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function dateBR(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

const INP = {
  padding: '9px 12px', border: '1px solid ' + C.border,
  borderRadius: 8, fontSize: 13, background: C.white,
  color: C.text, width: '100%', boxSizing: 'border-box',
}

export default function ClippingJuridico({ profile }) {
  const [query,   setQuery]   = useState('')
  const [since,   setSince]   = useState(daysAgo(30))
  const [until,   setUntil]   = useState(today())
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [erro,    setErro]    = useState('')
  const [total,   setTotal]   = useState(0)

  const buscar = async (e) => {
    if (e) e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true); setErro(''); setResults(null)
    try {
      const params = new URLSearchParams({
        querystring: q,
        published_since: since,
        published_until: until,
        size: 20,
        sort_by: 'descending_date',
        excerpt_size: 600,
        number_of_excerpts: 2,
        pre_tags: '<mark>',
        post_tags: '</mark>',
      })
      const res = await fetch(`${API_BASE}/gazettes?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResults(data.gazettes || [])
      setTotal(data.total_gazettes || 0)
    } catch (err) {
      setErro('Não foi possível consultar o Diário Oficial. Verifique sua conexão e tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
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
            Diários municipais via{' '}
            <a href="https://queridodiario.ok.org.br" target="_blank" rel="noreferrer" style={{ color: C.green }}>Querido Diário</a>
            {' · '}
            DOU Federal:{' '}
            <a href="https://www.in.gov.br/servicos/pesquisar-no-diario-oficial" target="_blank" rel="noreferrer" style={{ color: C.green }}>in.gov.br</a>
          </p>
        </div>
        <span style={{ fontSize: 11, border: '1px solid ' + C.border, borderRadius: 20, padding: '3px 10px', color: C.muted, fontWeight: 700, background: C.white }}>
          Ro-DOU / Querido Diário
        </span>
      </div>

      {/* ── Formulário ── */}
      <form onSubmit={buscar} style={{ padding: '14px 18px', borderBottom: '1px solid ' + C.border }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>
              Palavra-chave, nome, CNPJ ou número do processo
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: 11, color: C.muted }} />
              <input
                style={{ ...INP, paddingLeft: 32 }}
                placeholder='Ex: "Prefeitura de Campinas" ou 00.000.000/0001-00'
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
            disabled={loading || !query.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 18px',
              background: loading || !query.trim() ? C.muted : C.navy,
              color: 'white', border: 0, borderRadius: 8,
              fontWeight: 800, fontSize: 13,
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}>
            {loading
              ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
              : <Search size={13} />}
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      {/* ── Resultados ── */}
      <div style={{ padding: '14px 18px' }}>

        {erro && (
          <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <AlertTriangle size={14} /> {erro}
          </div>
        )}

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
            Consultando o Diário Oficial…
          </div>
        )}

        {!loading && results === null && !erro && (
          <div style={{ padding: 40, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 10 }}>
            <Globe size={28} style={{ opacity: 0.25, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: 13 }}>
              Digite um termo e clique em <b>Buscar</b> para pesquisar publicações em diários oficiais municipais
            </p>
          </div>
        )}

        {!loading && results !== null && results.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: C.muted, border: '1px dashed ' + C.border, borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              Nenhuma publicação encontrada para "<b>{query}</b>" no período selecionado.
            </p>
          </div>
        )}

        {!loading && results && results.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px' }}>
              <b style={{ color: C.green }}>{total.toLocaleString('pt-BR')}</b> publicação(ões) encontrada(s) · exibindo as 20 mais recentes
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((g, idx) => (
                <div key={idx} style={{ border: '1px solid ' + C.border, borderRadius: 10, padding: '12px 14px', background: C.grayBg }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: C.navy, background: '#dbeafe', padding: '2px 8px', borderRadius: 10 }}>
                        {g.territory_name || 'Município'}
                      </span>
                      <span style={{ fontSize: 11, color: C.muted }}>{dateBR(g.date)}</span>
                      {g.edition && (
                        <span style={{ fontSize: 11, color: C.muted }}>Edição {g.edition}</span>
                      )}
                    </div>
                    {g.url && (
                      <a href={g.url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: C.green, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', flexShrink: 0 }}>
                        Ver diário <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  {(g.excerpts || []).map((ex, ei) => (
                    <div
                      key={ei}
                      style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginTop: ei > 0 ? 8 : 0, paddingTop: ei > 0 ? 8 : 0, borderTop: ei > 0 ? '1px dashed ' + C.border : 'none' }}
                      dangerouslySetInnerHTML={{ __html: ex }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        <p style={{ fontSize: 11, color: C.muted, margin: '14px 0 0' }}>
          Dados fornecidos pelo <a href="https://queridodiario.ok.org.br" target="_blank" rel="noreferrer" style={{ color: C.green }}>Querido Diário</a> (Open Knowledge Brasil) ·
          abrange diários municipais indexados · integração Ro-DOU
        </p>
      </div>

      <style>{`mark { background: #fef08a; padding: 0 2px; border-radius: 2px; font-style: normal; }`}</style>
    </div>
  )
}
