import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Newspaper, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react'

const C = {
  white:'#fff',
  border:'#e5e7eb',
  text:'#0f172a',
  muted:'#64748b',
  green:'#064e3b',
  amber:'#b45309',
  amberBg:'#fef3c7',
  red:'#dc2626',
  redBg:'#fee2e2'
}

const FALLBACK_URL = 'https://stemzefgvtpaldvjtvmt.supabase.co/functions/v1/clipping-juridico'

function formatDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleDateString('pt-BR')
  } catch {
    return ''
  }
}

export default function ClippingJuridico() {
  const [noticias, setNoticias] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null)

  async function carregarClipping() {
    setLoading(true)
    setErro('')

    try {
      let payload = null

      // 1) Caminho preferencial: cliente Supabase, usando a config do app.
      const { data, error } = await supabase.functions.invoke('clipping-juridico', {
        body: {}
      })

      if (!error && data) {
        payload = data
      }

      // 2) Fallback direto: útil quando invoke falha por configuração/local cache.
      if (!payload) {
        const response = await fetch(FALLBACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        payload = await response.json()
      }

      const lista = Array.isArray(payload?.noticias) ? payload.noticias : []
      setNoticias(lista)
      setUltimaAtualizacao(new Date())

      if (lista.length === 0) {
        setErro('A função respondeu, mas não trouxe notícias. Verifique o teste da Edge Function.')
      }
    } catch (error) {
      console.error('Erro ao carregar clipping:', error)
      setErro('Não foi possível carregar o clipping jurídico.')
      setNoticias([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarClipping()
  }, [])

  return (
    <div style={{background:C.white,border:'1px solid '+C.border,borderRadius:12,marginTop:22,overflow:'hidden'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'16px 18px',borderBottom:'1px solid '+C.border,flexWrap:'wrap'}}>
        <div>
          <h2 style={{fontSize:15,margin:0,display:'flex',alignItems:'center',gap:8}}>
            <Newspaper size={16}/> Clipping jurídico
          </h2>
          {ultimaAtualizacao && (
            <div style={{fontSize:11,color:C.muted,marginTop:4}}>
              Atualizado em {ultimaAtualizacao.toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        <button
          onClick={carregarClipping}
          disabled={loading}
          style={{
            border:'1px solid '+C.border,
            background:C.white,
            borderRadius:8,
            padding:'8px 12px',
            cursor:loading?'not-allowed':'pointer',
            display:'flex',
            gap:8,
            alignItems:'center',
            fontWeight:800
          }}
        >
          <RefreshCw size={14}/> {loading ? 'Atualizando...' : 'Atualizar clipping'}
        </button>
      </div>

      <div style={{padding:16}}>
        {erro && (
          <div style={{background:C.amberBg,color:C.amber,borderRadius:10,padding:12,fontSize:13,fontWeight:700,display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
            <AlertTriangle size={15}/> {erro}
          </div>
        )}

        {loading && (
          <div style={{padding:20,textAlign:'center',color:C.muted}}>
            Carregando notícias jurídicas...
          </div>
        )}

        {!loading && noticias.length === 0 && (
          <div style={{padding:20,textAlign:'center',color:C.muted,border:'1px dashed '+C.border,borderRadius:10}}>
            Nenhuma notícia disponível no momento.
          </div>
        )}

        {!loading && noticias.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>
            {noticias.slice(0,8).map((n,idx)=>(
              <a
                key={`${n.link || n.titulo}-${idx}`}
                href={n.link}
                target="_blank"
                rel="noreferrer"
                style={{
                  display:'block',
                  textDecoration:'none',
                  color:C.text,
                  border:'1px solid '+C.border,
                  borderRadius:12,
                  padding:14,
                  background:'#fff'
                }}
              >
                <div style={{fontSize:11,fontWeight:900,color:C.green,textTransform:'uppercase',marginBottom:6}}>
                  {n.fonte || 'Fonte jurídica'} {n.data ? `· ${formatDate(n.data)}` : ''}
                </div>
                <b style={{fontSize:14,lineHeight:1.35}}>{n.titulo}</b>
                {n.resumo && (
                  <p style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:'8px 0 0'}}>
                    {n.resumo}
                  </p>
                )}
                <div style={{fontSize:12,color:C.green,marginTop:10,fontWeight:800,display:'flex',alignItems:'center',gap:5}}>
                  Abrir notícia <ExternalLink size={12}/>
                </div>
              </a>
            ))}
          </div>
        )}

        <p style={{fontSize:11,color:C.muted,margin:'12px 0 0'}}>
          Clipping obtido de fontes públicas. As notícias são exibidas como apoio informativo e devem ser verificadas na fonte original.
        </p>
      </div>
    </div>
  )
}
