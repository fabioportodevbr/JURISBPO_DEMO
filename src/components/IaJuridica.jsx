import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { Brain, Zap, Printer, AlertTriangle, Loader, Send, UploadCloud, Copy, Check } from 'lucide-react'
import mammoth from 'mammoth'

import { C as GlobalC } from '../lib/theme'
const C = {
  ...GlobalC
}
const INP = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid '+C.border, fontSize:14, color:C.text, background:C.white, boxSizing:'border-box', outline:'none', fontFamily:'inherit', lineHeight:1.6, resize:'vertical' }

const ensurePromiseWithResolvers = () => {
  if (typeof Promise.withResolvers === 'function') return

  Promise.withResolvers = () => {
    let resolve
    let reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

let pdfjsLibPromise
const getPdfjsLib = async () => {
  ensurePromiseWithResolvers()
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
  }
  const pdfjsLib = await pdfjsLibPromise
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'
  return pdfjsLib
}

const callAI = async ({ prompt, mode='chat', maxTokens=2500, format='text', context=null }) => {
  const { data, error } = await supabase.functions.invoke('ia-juridica', {
    body: {
      mensagem:
        `Modo: ${mode}\nFormato solicitado: ${format}\nLimite sugerido: ${maxTokens} tokens\n` +
        (context ? `Contexto: ${JSON.stringify(context)}\n\n` : '\n') +
        prompt,
    },
  })

  if (error) throw new Error(error.message || 'Erro ao chamar a função de IA')
  if (data?.error) throw new Error(data.error)
  const resposta = data?.resposta || data?.text || data?.output_text
  if (!resposta) throw new Error('A IA não retornou resposta.')
  return resposta
}

const extrairTextoDoArquivo = async (file) => {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } else if (fileName.endsWith('.pdf')) {
    const pdfjsLib = await getPdfjsLib()
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise;
    try {
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str || '').join(' ');
        fullText += pageText + '\n\n';
      }
      return fullText;
    } finally {
      pdf.destroy?.();
    }
  }
  throw new Error('Formato não suportado. Use .pdf ou .docx');
}

function FileUploadText({ onExtract, loading, setLoading, setError }) {
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setLoading(true); setError('')
      const text = await extrairTextoDoArquivo(file)
      onExtract(text)
    } catch (err) {
      setError('Erro ao ler arquivo: ' + err.message)
    } finally {
      setLoading(false)
      e.target.value = '' 
    }
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: C.grayBg, border: '1px solid ' + C.border, borderRadius: 8, cursor: loading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, color: C.muted, transition: 'all 0.2s' }}>
      <UploadCloud size={16} />
      {loading ? 'Extraindo...' : 'Anexar PDF / Word'}
      <input type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={handleFile} disabled={loading} />
    </label>
  )
}

function AIBox({ result, loading, error }) {
  if (loading) return <div style={{ padding:32, textAlign:'center', color:C.muted }}>
    <div style={{ width:32, height:32, border:'3px solid '+C.purple, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }}/>
    <p style={{ fontSize:14 }}>A IA está processando…</p>
  </div>
  if (error) return <div style={{ padding:14, background:C.redBg, borderRadius:10, color:C.red, fontSize:13, whiteSpace:'pre-wrap' }}><AlertTriangle size={14} style={{ display:'inline', marginRight:6 }}/>{error}</div>
  if (!result) return null
  return <div style={{ background:C.grayBg, borderRadius:10, padding:'16px 18px', fontSize:14, color:C.text, lineHeight:1.8, whiteSpace:'pre-wrap', maxHeight:520, overflowY:'auto', border:'1px solid '+C.border }}>{result}</div>
}

function ChatBasico({ profile }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role:'assistant', content:'Olá! Sou o assistente jurídico do JurisBPO. Posso ajudar a resumir fatos, estruturar minutas, revisar textos, sugerir próximos passos e organizar atividades. Não substituo sua análise profissional.' }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const enviar = async () => {
    const prompt = input.trim()
    if (!prompt) return
    const historico = [...messages, { role:'user', content:prompt }]
    setMessages(historico)
    setInput('')
    setLoading(true); setError('')
    try {
      const contexto = historico.slice(-8).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n\n')
      const text = await callAI({
        mode:'chat',
        prompt:`Contexto da conversa:\n${contexto}\n\nResponda à última mensagem do usuário de forma útil, objetiva e juridicamente cautelosa.`,
        maxTokens:2200,
        context:{ escritorio_nome:profile?.escritorio_nome, usuario:profile?.nome }
      })
      setMessages([...historico, { role:'assistant', content:text }])
    } catch(e) { setError('Erro: '+e.message) }
    finally { setLoading(false) }
  }

  return <div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20 }}>
    <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:6 }}>💬 Assistente jurídico básico</div>
    <p style={{ fontSize:13, color:C.muted, margin:'0 0 16px' }}>Use para perguntas gerais, estruturação de ideias, revisão de texto e rascunhos. Não cole dados sensíveis desnecessários.</p>
    <div style={{ border:'1px solid '+C.border, borderRadius:12, padding:14, background:C.grayBg, height:420, overflowY:'auto', marginBottom:12 }}>
      {messages.map((m,i)=>(
        <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start', marginBottom:10 }}>
          <div style={{ maxWidth:'82%', padding:'10px 12px', borderRadius:12, background:m.role==='user'?C.purple:C.white, color:m.role==='user'?'white':C.text, border:m.role==='user'?'none':'1px solid '+C.border, whiteSpace:'pre-wrap', lineHeight:1.6, fontSize:14 }}>
            {m.content}
          </div>
        </div>
      ))}
      {loading && <div style={{ fontSize:13, color:C.muted, display:'flex', gap:8, alignItems:'center' }}><Loader size={14} style={{ animation:'spin 0.8s linear infinite' }}/> respondendo…</div>}
    </div>
    {error && <div style={{ marginBottom:10 }}><AIBox error={error}/></div>}
    <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
      <textarea style={{ ...INP, minHeight:52, maxHeight:140 }} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); enviar() } }} placeholder="Digite sua pergunta ou pedido…" />
      <button onClick={enviar} disabled={loading || !input.trim()} style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 16px', background:loading||!input.trim()?C.muted:C.navy, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:loading||!input.trim()?'not-allowed':'pointer' }}><Send size={15}/>Enviar</button>
    </div>
  </div>
}

function Analise() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const analisar = async () => {
    if (!text.trim()) { setError('Cole ou anexe o texto do documento.'); return }
    setLoading(true); setError(''); setResult('')
    try {
      setResult(await callAI({
        mode:'contract_analysis',
        maxTokens:3200,
        prompt:'Analise o documento abaixo e forneça:\n1. PONTOS CRÍTICOS IDENTIFICADOS: RISCO (BAIXO/MÉDIO/ALTO), descrição do problema e sugestão de melhoria.\n2. PONTOS AUSENTES OU INCOMPLETOS.\n3. PARECER EXECUTIVO: resumo e recomendações.\n\nDOCUMENTO:\n'+text.slice(0,16000)
      }))
    } catch(e) { setError('Erro: '+e.message) }
    finally { setLoading(false) }
  }

  return <div>
    <div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20, marginBottom:16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>📄 Análise de Documentos</div>
        <FileUploadText onExtract={(t) => setText(t)} loading={loading} setLoading={setLoading} setError={setError} />
      </div>
      <textarea style={{ ...INP, minHeight:180 }} value={text} onChange={e=>setText(e.target.value)} placeholder="Cole aqui ou anexe o documento que deseja analisar…"/>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
        <button onClick={analisar} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:loading?C.muted:C.navy, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer' }}>
          {loading?<Loader size={15} style={{ animation:'spin 0.8s linear infinite' }}/>:<Zap size={15}/>}{loading?'Analisando…':'Analisar com IA'}
        </button>
      </div>
    </div>
    {(result||loading||error)&&<div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20 }}>
      <div style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>Resultado</div>
      <AIBox result={result} loading={loading} error={error}/>
    </div>}
  </div>
}

function Comparacao() {
  const [t1,setT1]=useState(''); const [t2,setT2]=useState('')
  const [loading,setLoading]=useState(false); const [result,setResult]=useState(''); const [error,setError]=useState('')

  const comparar = async () => {
    if (!t1.trim()||!t2.trim()) { setError('Forneça os dois documentos.'); return }
    setLoading(true); setError(''); setResult('')
    try {
      setResult(await callAI({
        mode:'document_compare',
        maxTokens:3500,
        prompt:'Compare os dois documentos abaixo em português:\n1. RESUMO EXECUTIVO\n2. ELEMENTOS EM COMUM\n3. DIFERENÇAS RELEVANTES\n4. AUSÊNCIAS\n5. ANÁLISE DE RISCO\n6. RECOMENDAÇÕES\n\nDOCUMENTO 1:\n'+t1.slice(0,9000)+'\n\n---\n\nDOCUMENTO 2:\n'+t2.slice(0,9000)
      }))
    } catch(e) { setError('Erro: '+e.message) }
    finally { setLoading(false) }
  }

  return <div>
    <div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20, marginBottom:16 }}>
      <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:14 }}>⚖️ Comparação de Documentos</div>
      <div className="ai-compare-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase' }}>Documento 1</label>
            <FileUploadText onExtract={setT1} loading={loading} setLoading={setLoading} setError={setError} />
          </div>
          <textarea style={{ ...INP, minHeight:220 }} value={t1} onChange={e=>setT1(e.target.value)} placeholder="Cole ou anexe o primeiro documento…"/>
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:'uppercase' }}>Documento 2</label>
            <FileUploadText onExtract={setT2} loading={loading} setLoading={setLoading} setError={setError} />
          </div>
          <textarea style={{ ...INP, minHeight:220 }} value={t2} onChange={e=>setT2(e.target.value)} placeholder="Cole ou anexe o segundo documento…"/>
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
        <button onClick={comparar} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:loading?C.muted:C.navy, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer' }}>
          {loading?<Loader size={15} style={{ animation:'spin 0.8s linear infinite' }}/>:null}{loading?'Comparando…':'Comparar com IA'}
        </button>
      </div>
    </div>
    {(result||loading||error)&&<div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20 }}><AIBox result={result} loading={loading} error={error}/></div>}
  </div>
}

function Anonimizador() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const anonimizar = async () => {
    if (!text.trim()) { setError('Cole ou anexe o documento.'); return }
    setLoading(true); setError(''); setResult(''); setCopied(false)
    try {
      setResult(await callAI({
        mode:'document_anonymization',
        maxTokens:3500,
        prompt:'Aja como um redator estrito. Oculte TODOS os dados pessoais do texto a seguir (Nomes de pessoas, CPFs, RGs, Endereços completos, Telefones, E-mails e Placas de veículos). Substitua esses dados EXATAMENTE por "[***]". Não altere NENHUMA outra palavra, formatação ou significado do texto original. Apenas aplique as substituições. Não adicione saudações ou comentários. TEXTO:\n\n'+text.slice(0,16000)
      }))
    } catch(e) { setError('Erro: '+e.message) }
    finally { setLoading(false) }
  }

  const handleCopy = () => {
    if(!result) return
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return <div>
    <div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20, marginBottom:16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:12 }}>
        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>🕵️ Anonimizador de Documentos</div>
        <FileUploadText onExtract={(t) => setText(t)} loading={loading} setLoading={setLoading} setError={setError} />
      </div>
      <p style={{ fontSize:13, color:C.muted, marginBottom:12 }}>Cole o texto ou anexe um PDF/Word. A IA ocultará dados sensíveis substituindo-os por [***].</p>
      <textarea style={{ ...INP, minHeight:180 }} value={text} onChange={e=>setText(e.target.value)} placeholder="Cole aqui ou anexe o documento que deseja anonimizar…"/>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
        <button onClick={anonimizar} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:loading?C.muted:C.navy, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer' }}>
          {loading?<Loader size={15} style={{ animation:'spin 0.8s linear infinite' }}/>:<Zap size={15}/>}{loading?'Anonimizando…':'Anonimizar Documento'}
        </button>
      </div>
    </div>

    {(result||loading||error)&&<div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em' }}>Texto Anonimizado</div>
        {result && (
          <button onClick={handleCopy} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:C.grayBg, color:copied?C.green:C.text, border:'1px solid '+C.border, borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiado!' : 'Copiar Texto'}
          </button>
        )}
      </div>
      <AIBox result={result} loading={loading} error={error}/>
    </div>}
  </div>
}

function Relatorio({ profile }) {
  const [obs, setObs] = useState('')
  const [incP, setIncP] = useState(true)
  const [incC, setIncC] = useState(true)
  const [incA, setIncA] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const gerar = async () => {
    setLoading(true); setError('')
    try {
      const escritorio = profile?.escritorio_id
      const [{ data: proc }, { data: contr }, { data: ativ }] = await Promise.all([
        supabase.from('processos').select('numero,titulo,parte_contraria,tribunal,orgao,status,fase,data_ajuizamento,valor_acao,updated_at').eq('escritorio_id', escritorio).order('updated_at',{ascending:false}).limit(30),
        supabase.from('contratos').select('titulo,parte,tipo,status,data_inicio,data_fim,observacoes,updated_at').eq('escritorio_id', escritorio).order('updated_at',{ascending:false}).limit(30),
        supabase.from('atividades').select('titulo,tipo,status,prioridade,prazo,horario,local,descricao').eq('escritorio_id', escritorio).order('prazo',{ascending:true}).limit(40),
      ])
      const fd = (d) => d ? new Date(d+'T12:00').toLocaleDateString('pt-BR') : '—'
      const fm = (v) => v ? 'R$ '+Number(v).toLocaleString('pt-BR') : '—'
      const content = 'Elabore um RELATÓRIO JURÍDICO EXECUTIVO profissional em HTML (apenas o corpo). Use h1, h2, h3, p, table, ul, li, strong. Analise e interprete os dados; não invente informações.\n'
        + (obs?'INSTRUÇÕES: '+obs+'\n':'')
        + (incP&&proc?'\nPROCESSOS:\n'+proc.map(p=>`- ${p.numero||'s/n'} | ${p.titulo} | Parte contrária: ${p.parte_contraria||'—'} | ${p.tribunal||p.orgao||'—'} | ${p.status} | Fase: ${p.fase||'—'} | Ajuizamento: ${fd(p.data_ajuizamento)} | Valor: ${fm(p.valor_acao)}`).join('\n'):'')
        + (incC&&contr?'\nCONTRATOS:\n'+contr.map(c=>`- ${c.titulo} | Parte: ${c.parte||'—'} | Tipo: ${c.tipo||'—'} | ${c.status} | Início: ${fd(c.data_inicio)} | Fim: ${fd(c.data_fim)}`).join('\n'):'')
        + (incA&&ativ?'\nATIVIDADES:\n'+ativ.map(a=>`- ${a.titulo} | ${a.tipo} | ${a.status} | Pri: ${a.prioridade} | Prazo: ${fd(a.prazo)} ${a.horario||''} | Local: ${a.local||'—'}`).join('\n'):'')

      const html = await callAI({ mode:'report_html', prompt:content, maxTokens:4500, format:'html' })
      const win = window.open('','_blank')
      if (!win) { setError('Pop-up bloqueado. Permita pop-ups para este site.'); return }
      win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório Jurídico</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;font-size:13px;color:#1a1a1a;padding:40px;max-width:900px;margin:0 auto;line-height:1.7}h1{font-size:22px;color:#022c22;border-bottom:3px solid #064e3b;padding-bottom:10px;margin:28px 0 16px}h2{font-size:17px;color:#022c22;margin:22px 0 10px;border-left:4px solid #064e3b;padding-left:10px}p{margin-bottom:10px}table{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px}th{background:#022c22;color:white;padding:8px 10px;text-align:left}td{border:1px solid #e0e0e0;padding:7px 10px}ul{padding-left:20px;margin-bottom:10px}li{margin-bottom:4px}.hdr{background:#022c22;color:white;padding:24px 30px;margin:-40px -40px 30px;display:flex;justify-content:space-between}.btn{background:#064e3b;color:#022c22;border:none;padding:12px 24px;font-size:14px;font-weight:800;border-radius:8px;cursor:pointer;margin:20px 0;display:block}@media print{.btn{display:none}}</style></head><body><div class="hdr"><div style="font-size:20px;font-weight:800">JurisBPO — Relatório Jurídico</div><div style="opacity:0.7;font-size:12px">${new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})}</div></div><button class="btn" onclick="window.print()">🖨 Imprimir / Salvar como PDF</button>${html}</body></html>`)
      win.document.close()
    } catch(e) { setError('Erro: '+e.message) }
    finally { setLoading(false) }
  }

  const Chk = ({ label, checked, onChange }) => (
    <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'10px 14px', borderRadius:8, border:'1px solid '+(checked?C.purple:C.border), background:checked?C.purpleBg:C.white, transition:'all 0.12s' }}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{ width:16, height:16, accentColor:C.purple }}/>
      <span style={{ fontSize:13, fontWeight:checked?700:400, color:checked?C.purple:C.text }}>{label}</span>
    </label>
  )

  return <div style={{ background:C.white, borderRadius:12, border:'1px solid '+C.border, padding:20 }}>
    <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:4 }}>🖨️ Gerador de Relatório em PDF</div>
    <p style={{ fontSize:13, color:C.muted, marginBottom:18 }}>A IA elabora um relatório executivo com os dados do sistema. Salve como PDF pelo navegador.</p>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:10, marginBottom:16 }}>
      <Chk label="📁 Processos judiciais" checked={incP} onChange={setIncP}/>
      <Chk label="📄 Contratos" checked={incC} onChange={setIncC}/>
      <Chk label="✅ Atividades" checked={incA} onChange={setIncA}/>
    </div>
    <div style={{ marginBottom:16 }}>
      <label style={{ fontSize:11, fontWeight:700, color:C.muted, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>Instruções especiais (opcional)</label>
      <textarea style={{ ...INP, minHeight:80 }} value={obs} onChange={e=>setObs(e.target.value)} placeholder="Ex: destaque prazos urgentes, contratos vencidos ou processos em execução…"/>
    </div>
    {error&&<div style={{ padding:12, background:C.redBg, borderRadius:8, color:C.red, fontSize:13, marginBottom:12 }}><AlertTriangle size={14} style={{ display:'inline', marginRight:6 }}/>{error}</div>}
    <div style={{ display:'flex', justifyContent:'flex-end' }}>
      <button onClick={gerar} disabled={loading} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:loading?C.muted:C.navy, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer' }}>
        {loading?<Loader size={15} style={{ animation:'spin 0.8s linear infinite' }}/>:<Printer size={15}/>}{loading?'Gerando…':'Gerar Relatório em PDF'}
      </button>
    </div>
    {loading&&<div style={{ marginTop:16, padding:20, background:C.purpleBg, borderRadius:10, textAlign:'center', fontSize:14, color:C.purple, fontWeight:600 }}>Elaborando o relatório com IA…</div>}
  </div>
}

export default function IaJuridica({ profile }) {
  const [sub, setSub] = useState('chat')
  return (
    <div style={{ padding:24 }}>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontSize:20, fontWeight:800, color:C.text, margin:0, display:'flex', alignItems:'center', gap:10 }}><Brain size={22} color={C.purple}/>IA Jurídica</h1>
        <p style={{ fontSize:13, color:C.muted, margin:'4px 0 0' }}>Assistente conectado à OpenAI via Supabase Edge Function</p>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ display:'flex', gap:8, marginBottom:24, background:C.white, padding:6, borderRadius:10, border:'1px solid '+C.border, flexWrap:'wrap' }}>
        {[
          {id:'chat',label:'Assistente'},
          {id:'analise',label:'Análise de Documentos'},
          {id:'comparacao',label:'Comparação de Docs'},
          {id:'anonimizador',label:'Anonimizador de Docs'},
          {id:'relatorio',label:'Relatório em PDF'}
        ].map(({id,label})=>(
          <button key={id} onClick={()=>setSub(id)} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 18px', border:'none', borderRadius:8, cursor:'pointer', background:sub===id?C.navy:'transparent', color:sub===id?'white':C.muted, fontSize:13, fontWeight:sub===id?700:400, flex:'1 1 auto', justifyContent:'center' }}>{label}</button>
        ))}
      </div>
      {sub==='chat' && <ChatBasico profile={profile}/>}
      {sub==='analise' && <Analise/>}
      {sub==='comparacao' && <Comparacao/>}
      {sub==='anonimizador' && <Anonimizador/>}
      {sub==='relatorio' && <Relatorio profile={profile}/>}
    </div>
  )
}
