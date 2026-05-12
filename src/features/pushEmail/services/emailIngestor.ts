import { ImapFlow } from 'imapflow'
import { getPushEmailConfig, resolveRuntimePushEmailConfig } from '../config'
import { createPushEmailSupabase } from '../db/supabaseServer'
import { parseCourtEmail } from '../parsers/emailParser'
import type { PushEmailResult } from '../types'
import { persistAndamento } from './persistAndamento'

const PROCESS_HINT = /(processo|intimacao|intimacao|andamento|movimentacao|pje|e-saj|esaj|projudi|dje|diario|tribunal|tj|trf|tst|stj|stf|cnj|\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i
const IGNORE_HINT = /(security alert|2-step verification|verificacao em duas etapas|google|apple|icloud|microsoft|adobe|gemini)/i
const BODY_DOWNLOAD_TIMEOUT_MS = 20000
const MAX_BODY_BYTES = 250000

type DestroyableReadableStream = NodeJS.ReadableStream & { destroy?: () => void }

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeQuotedPrintable(value: string): string {
  const normalized = value.replace(/=\r?\n/g, '')
  if (!/=([0-9A-F]{2})/i.test(normalized)) return normalized

  const binary = normalized.replace(/=([0-9A-F]{2})/gi, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  )

  try {
    return Buffer.from(binary, 'binary').toString('utf8')
  } catch {
    return binary
  }
}

function decodeMimeWords(value: string): string {
  return value
    .replace(/=\?utf-8\?q\?([^?]+)\?=/gi, (_, encoded) => {
      return decodeQuotedPrintable(String(encoded).replace(/_/g, ' '))
    })
    .replace(/=\?utf-8\?b\?([^?]+)\?=/gi, (_, encoded) => {
      try {
        return Buffer.from(String(encoded), 'base64').toString('utf8')
      } catch {
        return encoded
      }
    })
}

function removePartHeaders(value: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const split = normalized.split(/\n\s*\n/)
  if (split.length > 1 && /content-type|content-transfer-encoding|content-disposition/i.test(split[0])) {
    return split.slice(1).join('\n\n')
  }
  return normalized
}

function htmlEntityDecode(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function stripMimeNoise(value: string): string {
  return value
    .replace(/^--[^\n]+--?$/gm, '')
    .replace(/^Content-Type:.*$/gim, '')
    .replace(/^Content-Transfer-Encoding:.*$/gim, '')
    .replace(/^Content-Disposition:.*$/gim, '')
    .replace(/^MIME-Version:.*$/gim, '')
}

function extractBestMimeText(rawValue: string): string {
  const raw = rawValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const parts = raw.split(/\n--[^\n]+/g)
  const plainParts: string[] = []
  const htmlParts: string[] = []

  for (const part of parts) {
    if (/Content-Type:\s*text\/plain/i.test(part)) {
      plainParts.push(removePartHeaders(part))
    } else if (/Content-Type:\s*text\/html/i.test(part)) {
      htmlParts.push(stripHtml(removePartHeaders(part)))
    }
  }

  const candidate = plainParts.find((part) => part.trim().length > 0)
    ?? htmlParts.find((part) => part.trim().length > 0)
    ?? removePartHeaders(raw)

  return candidate
}

function cleanLegalEmailText(rawValue: string): string {
  const mimeText = extractBestMimeText(rawValue)
  const decoded = decodeMimeWords(decodeQuotedPrintable(mimeText))
  const withoutNoise = stripMimeNoise(decoded)
  const withoutHtml = stripHtml(withoutNoise)

  return htmlEntityDecode(withoutHtml)
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function shouldInspectEmail(subject?: string, from?: string): boolean {
  const haystack = normalizeSearch(`${subject ?? ''} ${from ?? ''}`)
  if (!haystack.trim()) return false
  if (IGNORE_HINT.test(haystack) && !PROCESS_HINT.test(haystack)) return false
  return PROCESS_HINT.test(haystack)
}

async function streamToString(
  stream: DestroyableReadableStream,
  timeoutMs = BODY_DOWNLOAD_TIMEOUT_MS,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    let finished = false

    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      try {
        stream.destroy?.()
      } catch {
        // ignore
      }
      reject(new Error(`Timeout ao ler corpo do e-mail apos ${timeoutMs}ms`))
    }, timeoutMs)

    stream.on('data', (chunk) => {
      if (finished) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buffer.length

      if (total > MAX_BODY_BYTES) {
        const remaining = Math.max(0, MAX_BODY_BYTES - (total - buffer.length))
        if (remaining > 0) chunks.push(buffer.subarray(0, remaining))
        finished = true
        clearTimeout(timer)
        try {
          stream.destroy?.()
        } catch {
          // ignore
        }
        resolve(Buffer.concat(chunks).toString('utf8'))
        return
      }

      chunks.push(buffer)
    })

    stream.on('end', () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve(Buffer.concat(chunks).toString('utf8'))
    })

    stream.on('error', (err) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      reject(err)
    })
  })
}

async function downloadTextPart(client: ImapFlow, uid: number): Promise<string> {
  const response = await client.download(uid, 'TEXT', { uid: true })
  const rawText = await streamToString(response.content as DestroyableReadableStream)
  return cleanLegalEmailText(rawText)
}

export async function ingestUnreadEmails(): Promise<PushEmailResult> {
  const baseConfig = getPushEmailConfig()
  const supabase = createPushEmailSupabase(baseConfig)
  const config = await resolveRuntimePushEmailConfig(supabase, baseConfig)
  const client = new ImapFlow({
    host: config.IMAP_HOST,
    port: config.IMAP_PORT,
    secure: config.IMAP_SECURE,
    auth: {
      user: config.IMAP_USER,
      pass: config.IMAP_PASSWORD,
    },
    logger: false,
  })

  let processed = 0
  let saved = 0
  let ignored = 0
  let failed = 0

  await client.connect()

  try {
    const lock = await client.getMailboxLock(config.IMAP_MAILBOX || 'INBOX')

    try {
      const unseenUidsResult = await client.search({ seen: false }, { uid: true })
      const unseenUids = Array.isArray(unseenUidsResult) ? unseenUidsResult : []

      for (const uid of unseenUids) {
        try {
          const headerMsg = await client.fetchOne(uid, { envelope: true, uid: true }, { uid: true })
          if (!headerMsg) {
            ignored++
            continue
          }
          const subject = headerMsg?.envelope?.subject ?? ''
          const from = headerMsg?.envelope?.from
            ?.map((item) => item.address || item.name)
            .filter(Boolean)
            .join(', ') ?? ''

          if (!shouldInspectEmail(subject, from)) {
            ignored++
            continue
          }

          processed++

          const text = await downloadTextPart(client, uid)
          const parsed = parseCourtEmail({
            from,
            subject,
            text,
            htmlAsText: text,
            date: headerMsg?.envelope?.date ?? undefined,
          })

          if (!parsed) {
            ignored++
            continue
          }

          await persistAndamento(supabase, config, parsed)
          saved++

          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
        } catch (err) {
          failed++
          console.error('[push-email] Falha ao processar mensagem UID', uid, err)
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await Promise.race([
      client.logout(),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ])
    try {
      client.close()
    } catch {
      // ignore
    }
  }

  return { processed, saved, ignored, failed }
}
