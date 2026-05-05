const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Body = {
  prompt?: string
  mode?: 'chat' | 'contract_analysis' | 'document_compare' | 'report_html'
  maxTokens?: number
  format?: 'text' | 'html'
  context?: Record<string, unknown> | null
}

const modeInstruction = (mode: string, format: string) => {
  const base = `Você é o assistente jurídico interno do JurisBPO, usado por advogados no Brasil. Responda em português do Brasil. Seja útil, técnico quando necessário e cauteloso. Não invente fatos, jurisprudência, artigos ou prazos. Quando faltar informação, diga o que falta. Não diga que é advogado; diga que é uma ferramenta de apoio.`
  const map: Record<string,string> = {
    chat: `${base} Ajude com organização, rascunhos, revisão, estruturação de argumentos, checklists e explicações jurídicas gerais.`,
    contract_analysis: `${base} Atue como revisor de contratos. Identifique riscos, lacunas, ambiguidades, sugestões de redação e próximos passos.`,
    document_compare: `${base} Compare documentos jurídicos com precisão. Aponte diferenças materiais, omissões, riscos e recomendações.`,
    report_html: `${base} Gere relatório executivo jurídico. Responda somente com HTML de corpo, sem markdown, sem \`\`\`, sem <html>, sem <head> e sem <body>. Use tags simples: h1, h2, h3, p, table, thead, tbody, tr, th, td, ul, li, strong.`,
  }
  return map[mode] || (format === 'html' ? map.report_html : map.chat)
}

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) return json({ error: 'OPENAI_API_KEY não configurada nos secrets da Edge Function.' }, 500)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Usuário não autenticado.' }, 401)

    const body = await req.json() as Body
    const prompt = (body.prompt || '').trim()
    const mode = body.mode || 'chat'
    const format = body.format || 'text'
    const maxTokens = Math.min(Math.max(Number(body.maxTokens || 2200), 200), 6000)

    if (!prompt) return json({ error: 'Prompt vazio.' }, 400)
    if (prompt.length > 60000) return json({ error: 'Texto muito longo para esta versão básica. Reduza o conteúdo e tente novamente.' }, 413)

    const contextText = body.context ? `\nContexto do JurisBPO: ${JSON.stringify(body.context)}\n` : ''

    const openaiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini',
        instructions: modeInstruction(mode, format) + contextText,
        input: prompt,
        max_output_tokens: maxTokens,
        temperature: 0.2,
      }),
    })

    const data = await openaiRes.json()
    if (!openaiRes.ok) {
      const msg = data?.error?.message || `Erro OpenAI ${openaiRes.status}`
      return json({ error: msg }, openaiRes.status)
    }

    const text = data.output_text
      || data.output?.flatMap((o: any) => o.content || []).map((c: any) => c.text || '').join('\n').trim()
      || ''

    return json({ text, model: data.model || 'openai' })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado na função de IA.' }, 500)
  }
})
