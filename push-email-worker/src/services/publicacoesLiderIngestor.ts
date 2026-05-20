import { XMLParser } from 'fast-xml-parser'
import { createHash } from 'crypto'
import { supabase } from '../db/supabase.js'
import { config } from '../config.js'
import { findProcessByNumber, resolveEscritorioId } from './processMatcher.js'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  isArray: (tagName) => tagName === 'publicacao',
})

// ── SOAP helpers ──────────────────────────────────────────────────────────────

function buildEnvelope(method: string, params: Record<string, string | number>): string {
  const body = Object.entries(params)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('')
  return `<?xml version="1.0" encoding="utf-8"?>\
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \
xmlns:xsd="http://www.w3.org/2001/XMLSchema" \
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\
<soap:Body>\
<${method} xmlns="${config.LIDER_WS_NAMESPACE}">${body}</${method}>\
</soap:Body></soap:Envelope>`
}

async function callSOAP(method: string, params: Record<string, string | number>): Promise<unknown> {
  const envelope = buildEnvelope(method, params)
  const res = await fetch(config.LIDER_WS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `"${config.LIDER_WS_NAMESPACE}${method}"`,
    },
    body: envelope,
  })
  if (!res.ok) throw new Error(`[lider] HTTP ${res.status} ${res.statusText}`)
  const xml = await res.text()
  return xmlParser.parse(xml)
}

function extractList(parsed: unknown): Record<string, unknown>[] {
  // Navega pelo envelope: ...Body.<MethodResponse>.<MethodResult>.publicacao
  const env = (parsed as any)?.['soap:Envelope'] ?? (parsed as any)?.Envelope
  const body = env?.['soap:Body'] ?? env?.Body
  if (!body) return []

  const responseKey = Object.keys(body as object).find((k) => k.includes('Response'))
  if (!responseKey) return []

  const response = (body as any)[responseKey]
  const resultKey = Object.keys(response as object).find((k) => k.includes('Result'))
  if (!resultKey) return []

  const result = (response as any)[resultKey]
  const pubs = result?.publicacao
  if (!pubs) return []
  return Array.isArray(pubs) ? pubs : [pubs]
}

// ── Normalização de campos ─────────────────────────────────────────────────────

function toDate(v: unknown): string | null {
  if (!v) return null
  const s = String(v).split('T')[0]
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function toTs(v: unknown): string | null {
  if (!v) return null
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = parseInt(String(v), 10)
  return isNaN(n) ? null : n
}

function str(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return String(v)
}

// ── Persistência ──────────────────────────────────────────────────────────────

async function persistPublicacao(pub: Record<string, unknown>): Promise<{ saved: boolean }> {
  const codPublicacao = toInt(pub.codPublicacao)
  if (!codPublicacao) return { saved: false }

  const numeroProcesso = str(pub.numeroProcesso)
  const match = await findProcessByNumber(numeroProcesso ?? undefined)
  const escritorioId = resolveEscritorioId(match) ?? null

  const liderRow = {
    cod_publicacao:         codPublicacao,
    escritorio_id:          escritorioId,
    cliente_id:             match?.cliente_id ?? null,
    processo_id:            match?.id ?? null,
    status_associacao:      match ? 'associado' : 'pendente',
    ano_publicacao:         toInt(pub.anoPublicacao),
    edicao_diario:          toInt(pub.edicaoDiario),
    descricao_diario:       str(pub.descricaoDiario),
    pagina_inicial:         toInt(pub.paginaInicial),
    pagina_final:           toInt(pub.paginalFinal),
    data_publicacao:        toDate(pub.dataPublicacao),
    data_divulgacao:        toDate(pub.dataDivulgacao),
    data_cadastro_lider:    toTs(pub.dataCadastro),
    numero_processo:        numeroProcesso,
    uf_publicacao:          str(pub.ufPublicacao),
    cidade_publicacao:      str(pub.cidadePublicacao),
    orgao_descricao:        str(pub.orgaoDescricao),
    vara_descricao:         str(pub.varaDescricao),
    despacho_publicacao:    str(pub.despachoPublicacao),
    processo_publicacao:    str(pub.processoPublicacao),
    publicacao_corrigida:   toInt(pub.publicacaoCorrigida) ?? 0,
    cod_vinculo:            toInt(pub.codVinculo),
    nome_vinculo:           str(pub.nomeVinculo),
    oab_numero:             toInt(pub.OABNumero),
    oab_estado:             str(pub.OABEstado),
    identificacao_cadastro: str(pub.identicacaoCadastro),
    cod_integracao:         str(pub.codIntegracao),
    natureza:               str(pub.natureza),
    complemento1:           str(pub.complemento1),
    orgao_descricao_comp:   str(pub.orgaoDescricaoComp),
    diario_sigla_wj:        str(pub.diarioSiglaWj),
    publicacao_exportada:   toInt(pub.publicacaoExportada) ?? 0,
    cod_grupo:              toInt(pub.codGrupo),
    anexo:                  str(pub.anexo),
  }

  const { error: liderErr } = await supabase
    .from('publicacoes_lider')
    .upsert(liderRow, { onConflict: 'cod_publicacao' })

  if (liderErr) {
    console.error(`[lider] Erro ao salvar publicacao ${codPublicacao}:`, liderErr)
    return { saved: false }
  }

  // Insere também em andamentos_processuais_push para aparecer no painel de push
  const rawHash = createHash('sha256').update(`lider:${codPublicacao}`).digest('hex')
  const orgao = [str(pub.orgaoDescricao), str(pub.varaDescricao)].filter(Boolean).join(' — ')
  const movimento = str(pub.despachoPublicacao) || str(pub.processoPublicacao)?.slice(0, 200) || 'Publicação no Diário'
  const dataMovimento = toDate(pub.dataPublicacao)

  const andamentoRow = {
    escritorio_id:       escritorioId,
    cliente_id:          match?.cliente_id ?? null,
    processo_id:         match?.id ?? null,
    numero_processo:     numeroProcesso,
    tribunal:            str(pub.ufPublicacao) ? `DJE/${str(pub.ufPublicacao)}` : null,
    movimento,
    data_movimento:      dataMovimento,
    fonte:               'lider',
    remetente:           str(pub.descricaoDiario),
    assunto_email:       orgao || null,
    corpo_resumo:        str(pub.despachoPublicacao)?.slice(0, 800) ?? null,
    corpo_email:         str(pub.processoPublicacao),
    corpo_email_limpo:   str(pub.processoPublicacao),
    corpo_email_resumo:  str(pub.processoPublicacao)?.slice(0, 800) ?? null,
    url_origem:          null,
    raw_text_hash:       rawHash,
    status_associacao:   match ? 'associado' : 'pendente',
  }

  const { error: andErr } = await supabase
    .from('andamentos_processuais_push')
    .upsert(andamentoRow, { onConflict: 'raw_text_hash' })

  if (andErr) {
    console.warn(`[lider] Aviso ao salvar andamento para publicacao ${codPublicacao}:`, andErr)
  }

  return { saved: true }
}

// ── Marcar como exportadas no WS Lider ───────────────────────────────────────

async function marcarExportadas(codigos: number[]): Promise<void> {
  if (codigos.length === 0) return
  const strPublicacoes = codigos.join('|')
  const parsed = await callSOAP('setPublicacoes', {
    strUsuario:     config.LIDER_LOGIN,
    strSenha:       config.LIDER_SENHA,
    strPublicacoes,
  })
  // Navega para o resultado (0 = sucesso)
  const env = (parsed as any)?.['soap:Envelope'] ?? (parsed as any)?.Envelope
  const body = env?.['soap:Body'] ?? env?.Body
  const responseKey = Object.keys(body as object).find((k) => k.includes('Response'))
  const resultado = responseKey ? (body as any)[responseKey]?.setPublicacoesResult : undefined
  if (resultado !== 0 && resultado !== '0') {
    console.warn(`[lider] setPublicacoes retornou: ${resultado}`)
  }

  await supabase
    .from('publicacoes_lider')
    .update({ publicacao_exportada: 1, marcado_exportado_em: new Date().toISOString() })
    .in('cod_publicacao', codigos)
}

// ── Entrypoint público ────────────────────────────────────────────────────────

export async function ingestPublicacoesLider(): Promise<{ processed: number; saved: number }> {
  let totalProcessed = 0
  let totalSaved = 0

  // Repete até receber menos de 3000 publicações (paginação do WS)
  while (true) {
    const parsed = await callSOAP('getPublicacoesNaoExportadasV', {
      strUsuario:  config.LIDER_LOGIN,
      strSenha:    config.LIDER_SENHA,
      intCodGrupo: config.LIDER_GRUPO,
      NumVersao:   config.LIDER_WS_VERSION,
    })

    const publicacoes = extractList(parsed)
    if (publicacoes.length === 0) break

    const savedCodigos: number[] = []
    for (const pub of publicacoes) {
      const { saved } = await persistPublicacao(pub)
      totalProcessed++
      if (saved) {
        totalSaved++
        const cod = toInt(pub.codPublicacao)
        if (cod) savedCodigos.push(cod)
      }
    }

    // Marca como exportadas antes do próximo lote
    await marcarExportadas(savedCodigos)

    if (publicacoes.length < 3000) break
  }

  return { processed: totalProcessed, saved: totalSaved }
}
