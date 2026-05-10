/**
 * saveAttachments.ts
 * Percorre a estrutura MIME de um e-mail (ImapFlow bodyStructure),
 * faz download de cada parte de anexo e salva no Supabase Storage +
 * metadados em compliance_anexos.
 */
import { randomUUID } from 'crypto'
import { supabase }   from '../db/supabase.js'

const MAX_ATTACHMENT_BYTES = 10 * 1_048_576   // 10 MB por arquivo
const BUCKET               = 'compliance-anexos'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface AttachmentPart {
  part:        string   // número da parte MIME, ex: '2', '1.2'
  filename:    string
  contentType: string
  size:        number
}

// ---------------------------------------------------------------------------
// Decodificação de nomes de arquivo RFC 2047
// ---------------------------------------------------------------------------

function decodeMimeWord(value: string): string {
  return value
    .replace(/=\?utf-8\?q\?([^?]+)\?=/gi, (_, e) =>
      decodeURIComponent(String(e).replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1'))
    )
    .replace(/=\?utf-8\?b\?([^?]+)\?=/gi, (_, e) => {
      try { return Buffer.from(String(e), 'base64').toString('utf8') } catch { return e }
    })
    .replace(/=\?iso-8859-1\?q\?([^?]+)\?=/gi, (_, e) =>
      decodeURIComponent(String(e).replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1'))
    )
    .replace(/=\?windows-1252\?q\?([^?]+)\?=/gi, (_, e) =>
      decodeURIComponent(String(e).replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, '%$1'))
    )
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-() ]/g, '_').replace(/_{2,}/g, '_').slice(0, 200)
}

// ---------------------------------------------------------------------------
// Percorre bodyStructure do ImapFlow e coleta partes de anexo
// ---------------------------------------------------------------------------

export function findAttachmentParts(struct: any, result: AttachmentPart[] = []): AttachmentPart[] {
  if (!struct) return result

  const type    = (struct.type    || '').toLowerCase()
  const subtype = (struct.subtype || '').toLowerCase()
  const disp    = struct.disposition
  const dispVal = (disp?.value || '').toLowerCase()

  // Nome do arquivo: preferência ao Content-Disposition, depois Content-Type params
  const rawName = disp?.parameters?.filename
    ?? disp?.parameters?.['filename*']
    ?? struct.parameters?.name
    ?? struct.parameters?.['name*']

  // É anexo se: disposition=attachment OU tem filename E não é text/html ou text/plain
  const isAttachment = dispVal === 'attachment' ||
    (rawName && type !== 'text' && type !== 'multipart')

  if (struct.part && rawName && isAttachment) {
    result.push({
      part:        String(struct.part),
      filename:    sanitizeName(decodeMimeWord(String(rawName))),
      contentType: `${type}/${subtype}`,
      size:        struct.size ?? 0,
    })
  }

  // Recursão em filhos (multipart)
  if (Array.isArray(struct.childNodes)) {
    for (const child of struct.childNodes) findAttachmentParts(child, result)
  }

  return result
}

// ---------------------------------------------------------------------------
// Download de uma parte MIME como Buffer
// ---------------------------------------------------------------------------

async function partToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    stream.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += buf.length
      if (total > MAX_ATTACHMENT_BYTES) {
        reject(new Error(`Tamanho excede limite (${MAX_ATTACHMENT_BYTES} bytes)`))
        return
      }
      chunks.push(buf)
    })
    stream.on('end',   () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Função principal: baixa anexos do e-mail e sobe no Storage
// ---------------------------------------------------------------------------

export async function saveEmailAttachments(opts: {
  imapClient:    any
  uid:           number | string
  bodyStructure: any
  denunciaId:    string
  mensagemId:    string
  escritorioId:  string
  direcao:       'recebido' | 'enviado'
}): Promise<number> {
  const { imapClient, uid, bodyStructure, denunciaId, mensagemId, escritorioId, direcao } = opts
  const parts = findAttachmentParts(bodyStructure)
  if (parts.length === 0) return 0

  let saved = 0

  for (const att of parts) {
    if (att.size > MAX_ATTACHMENT_BYTES) {
      console.warn(`[compliance-anexos] "${att.filename}" muito grande (${att.size} bytes) — ignorado`)
      continue
    }

    try {
      const dl  = await imapClient.download(uid, att.part, { uid: true })
      const buf = await partToBuffer(dl.content)

      const ext  = att.filename.includes('.') ? att.filename.split('.').pop()! : 'bin'
      const path = `${escritorioId}/${denunciaId}/${mensagemId}/${randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: att.contentType, upsert: false })

      if (upErr) {
        console.warn(`[compliance-anexos] Upload falhou para "${att.filename}":`, upErr.message)
        continue
      }

      const { error: dbErr } = await supabase.from('compliance_anexos').insert({
        denuncia_id:   denunciaId,
        mensagem_id:   mensagemId,
        escritorio_id: escritorioId,
        nome_arquivo:  att.filename,
        storage_path:  path,
        tamanho_bytes: buf.length,
        content_type:  att.contentType,
        direcao,
      })

      if (dbErr) {
        console.warn(`[compliance-anexos] Metadado falhou para "${att.filename}":`, dbErr.message)
      } else {
        saved++
        console.log(`[compliance-anexos] ✓ "${att.filename}" (${buf.length} bytes) salvo`)
      }
    } catch (e) {
      console.warn(`[compliance-anexos] Erro ao processar "${att.filename}":`, e)
    }
  }

  return saved
}
