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

function extractDocumentId(text: string): string | undefined {
  return text.match(/Identificador do documento[:\s]+(\d+)/i)?.[1]
}

function splitIntoPublicacaoSections(text: string): string[] {
  const CNJ = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/
  const parts = text.split(/\n(?=Publica[çc][aã]o:\s*\n)/i)
  return parts.filter(s => /Publica[çc][aã]o:\s*\n/i.test(s) && CNJ.test(s))
}

export function parseCourtEmailMultiple(input: {
  from?: string
  subject?: string
  text?: string
  htmlAsText?: string
  date?: Date
}): ParsedAndamento[] {
  const subject = input.subject ?? ''
  const body = normalizeText(input.text || input.htmlAsText || '')
  const full = normalizeText(`${subject}\n${body}`)

  const sections = splitIntoPublicacaoSections(full)

  if (sections.length > 1) {
    return sections.flatMap(section => {
      const numeroProcesso = extractProcessNumber(section)
      if (!numeroProcesso) return []

      const documentId = extractDocumentId(section)
      const rawTextHash = sha256(documentId ? `doc:${documentId}` : section)
      const sectionWithSubject = normalizeText(`${subject}\n${section}`)

      return [{
        numeroProcesso,
        tribunal: detectTribunal(sectionWithSubject),
        assunto: subject || undefined,
        movimento: detectMovement(subject, section),
        dataMovimento: extractBrazilianDate(section) ?? input.date?.toISOString().slice(0, 10),
        urlOrigem: extractFirstUrl(section),
        fonte: 'email' as const,
        remetente: input.from,
        assuntoEmail: subject,
        corpoResumo: excerpt(section),
        corpoEmail: section || undefined,
        rawTextHash,
      }]
    })
  }

  const parsed = parseCourtEmail(input)
  return parsed ? [parsed] : []
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
