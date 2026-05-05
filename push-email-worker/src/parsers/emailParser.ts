import { ParsedAndamento } from '../types.js'
import { sha256 } from '../utils/hash.js'
import { excerpt, normalizeText } from '../utils/text.js'
import { extractProcessNumber } from './processNumber.js'
import { detectTribunal } from './tribunal.js'
import { extractBrazilianDate } from './date.js'

function detectMovement(subject: string, body: string): string {
  const text = `${subject}\n${body}`
  const candidates: Array<[RegExp, string]> = [
    [/intima[cç][aã]o/i, 'Intimação eletrônica'],
    [/cita[cç][aã]o/i, 'Citação'],
    [/publica[cç][aã]o|di[aá]rio de justi[cç]a|dje/i, 'Publicação no Diário de Justiça'],
    [/movimenta[cç][aã]o|andamento/i, 'Movimentação processual'],
    [/audi[eê]ncia/i, 'Audiência designada/alterada'],
    [/senten[cç]a/i, 'Sentença'],
    [/despacho/i, 'Despacho'],
    [/decis[aã]o/i, 'Decisão'],
    [/ac[oó]rd[aã]o/i, 'Acórdão'],
    [/prazo/i, 'Prazo processual']
  ]
  return candidates.find(([pattern]) => pattern.test(text))?.[1] ?? 'Aviso processual recebido por e-mail'
}

function extractFirstUrl(text: string): string | undefined {
  return text.match(/https?:\/\/[^\s)\]]+/i)?.[0]
}

export function parseCourtEmail(input: {
  from?: string
  subject?: string
  text?: string
  htmlAsText?: string
  date?: Date
}): ParsedAndamento | null {
  const subject = input.subject ?? ''
  const body = normalizeText(input.text || input.htmlAsText || '')
  const full = normalizeText(`${subject}\n${body}`)

  const numeroProcesso = extractProcessNumber(full)
  const tribunal = detectTribunal(full)
  const dataMovimento = extractBrazilianDate(full) ?? input.date?.toISOString().slice(0, 10)
  const movimento = detectMovement(subject, body)
  const rawTextHash = sha256(full)

  if (!numeroProcesso && !/process|pje|e-saj|esaj|tribunal|intima/i.test(full)) {
    return null
  }

  return {
    numeroProcesso,
    tribunal,
    assunto: subject || undefined,
    movimento,
    dataMovimento,
    urlOrigem: extractFirstUrl(full),
    fonte: 'email',
    remetente: input.from,
    assuntoEmail: subject,
    corpoResumo: excerpt(body),
    corpoEmail: body || undefined,
    rawTextHash
  }
}
