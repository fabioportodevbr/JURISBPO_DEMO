import type { ParsedAndamento } from '../types'
import { sha256 } from '../utils/hash'
import { excerpt, normalizeForSearch, normalizeText } from '../utils/text'
import { extractProcessNumber } from './processNumber'
import { detectTribunal } from './tribunal'
import { extractBrazilianDate } from './date'

function detectMovement(subject: string, body: string): string {
  const text = normalizeForSearch(`${subject}\n${body}`)
  const candidates: Array<[RegExp, string]> = [
    [/intimacao/i, 'Intima\u00e7\u00e3o eletr\u00f4nica'],
    [/citacao/i, 'Cita\u00e7\u00e3o'],
    [/publicacao|diario de justica|dje/i, 'Publica\u00e7\u00e3o no Di\u00e1rio de Justi\u00e7a'],
    [/movimentacao|andamento/i, 'Movimenta\u00e7\u00e3o processual'],
    [/audiencia/i, 'Audi\u00eancia designada/alterada'],
    [/sentenca/i, 'Senten\u00e7a'],
    [/despacho/i, 'Despacho'],
    [/decisao/i, 'Decis\u00e3o'],
    [/acordao/i, 'Ac\u00f3rd\u00e3o'],
    [/prazo/i, 'Prazo processual'],
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
  const searchable = normalizeForSearch(full)

  const numeroProcesso = extractProcessNumber(full)
  const tribunal = detectTribunal(full)
  const dataMovimento = extractBrazilianDate(full) ?? input.date?.toISOString().slice(0, 10)
  const movimento = detectMovement(subject, body)
  const rawTextHash = sha256(full)

  if (!numeroProcesso && !/(process|pje|e-saj|esaj|tribunal|intima)/i.test(searchable)) {
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
    rawTextHash,
  }
}
