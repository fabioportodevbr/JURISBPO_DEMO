/**
 * Compliance.jsx
 * Módulo de Canal de Compliance — visível apenas para gerentes (nivel 4).
 *
 * Funcionalidades:
 * - Dashboard com cards de contadores por status
 * - Lista de denúncias com filtros de status/categoria e busca textual
 * - Modal de detalhes com abas Dados e Mensagens
 * - Workflow visual de status (stepper)
 * - Composer de mensagens (officer_reply, diligência, nota interna)
 * - Anonimização do remetente (UI nunca exibe remetente_email)
 * - Aba Configurações: gerente configura IMAP + SMTP diretamente na UI
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ShieldAlert, Search, RefreshCw, ChevronRight,
  MessageSquare, Send, FileText, CheckCircle,
  X, Lock, Inbox, Activity, Tag,
  Calendar, ArrowRight, Loader,
  Eye, AlertCircle, CheckCircle2, HelpCircle, Reply,
  Archive, RotateCcw, Paperclip, Download, Upload,
  BarChart2, Printer, Filter, AlertTriangle, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { C } from '../lib/theme.js'

// ── Constantes de domínio ─────────────────────────────────────────────────────

const STATUS_LABELS = {
  recebido:         { label: 'Recebido',        color: C.blue,   bg: C.blueBg   },
  em_investigacao:  { label: 'Em investigação', color: C.amber,  bg: C.amberBg  },
  em_diligencia:    { label: 'Em diligência',   color: C.purple, bg: C.purpleBg },
  concluido:        { label: 'Concluído',        color: C.green,  bg: C.greenBg  },
  arquivado:        { label: 'Arquivado',        color: C.gray,   bg: C.grayBg   },
}

const STATUS_ORDER = ['recebido','em_investigacao','em_diligencia','concluido','arquivado']

const CATEGORIA_LABELS = {
  nao_classificado:    'Não classificado',
  assedio_moral:       'Assédio moral',
  assedio_sexual:      'Assédio sexual',
  discriminacao:       'Discriminação',
  corrupcao:           'Corrupção',
  fraude_financeira:   'Fraude financeira',
  desvio_conduta:      'Desvio de conduta',
  violacao_lgpd:       'Violação LGPD',
  conflito_interesses: 'Conflito de interesses',
  concorrencia_desleal:'Concorrência desleal',
  outro:               'Outro',
  encaminhar:          'Encaminhar',
}

const TIPO_MSG_LABELS = {
  recebida:            { label: 'E-mail recebido',        icon: Inbox,       color: C.blue   },
  auto_resposta:       { label: 'Protocolo automático',   icon: CheckCircle, color: C.green  },
  officer_reply:       { label: 'Resposta ao denunciante', icon: Send,       color: C.navy   },
  diligencia:          { label: 'Diligência',              icon: FileText,   color: C.purple },
  interna:             { label: 'Nota interna',            icon: Lock,       color: C.gray   },
  resposta_diligencia: { label: 'Resposta do setor',       icon: Reply,      color: C.green  },
}

const SANCAO_OPCOES = [
  { value: 'feedback',                 label: 'Encaminhar ao Setor competente para aplicar feedback',                            color: C.blue   },
  { value: 'advertencia',              label: 'Encaminhar ao Setor competente para aplicar advertência',                         color: C.amber  },
  { value: 'suspensao',                label: 'Encaminhar ao Setor competente para aplicar suspensão',                           color: C.purple },
  { value: 'desligamento_justa_causa', label: 'Encaminhar ao Departamento de Pessoal para desligamento por justa causa',         color: '#dc2626' },
]

const SANCAO_LABELS = Object.fromEntries(SANCAO_OPCOES.map(o => [o.value, o]))

const STATUS_FLOW = [
  { key: 'recebido',        label: 'Recebido'        },
  { key: 'em_investigacao', label: 'Investigação'    },
  { key: 'em_diligencia',   label: 'Diligência'      },
  { key: 'concluido',       label: 'Concluído'       },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (ts) => ts
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(ts))
  : '—'

const fmtDate = (ts) => ts
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(ts))
  : '—'

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1_048_576)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

const COMPLIANCE_ANEXOS_BUCKET = 'compliance-anexos'
const CONFLITO_PDF_MAX_BYTES = 50 * 1024 * 1024

const sanitizeFileName = (name) =>
  name.replace(/[^\w.\-() ]/g, '_').replace(/_{2,}/g, '_').slice(0, 200)

const RISCO_CONFLITO_META = {
  BAIXO: { flag: 'VERDE', label: 'Risco baixo', status: 'analisado_sem_conflito', statusLabel: 'Analisado - Sem Conflito', color: C.green, bg: C.greenBg },
  MEDIO: { flag: 'AMARELA', label: 'Risco medio', status: 'pendente_revisao', statusLabel: 'Pendente de Revisao', color: C.amber, bg: C.amberBg },
  ALTO:  { flag: 'VERMELHA', label: 'Risco alto', status: 'alerta_critico', statusLabel: 'Alerta Critico', color: C.red, bg: C.redBg },
}

const CHECKBOX_CONFLITO_ROWS = [
  { key: 'hasInternalRelationship', y: 986, label: 'Parentesco/relacionamento com colaborador interno' },
  { key: 'hasExternalRelationship', y: 1048, label: 'Parentesco/relacionamento com clientes, fornecedores ou concorrentes' },
  { key: 'hasParallelActivity', y: 1250, label: 'Atividade profissional paralela' },
  { key: 'parallelCompetes', y: 1432, label: 'Atividade paralela concorre ou se relaciona com a empresa' },
  { key: 'parallelUsesResources', y: 1494, label: 'Atividade paralela usa recursos corporativos' },
  { key: 'parallelConflictHours', y: 1556, label: 'Atividade paralela ocorre no horario de trabalho' },
  { key: 'societarySuppliersClients', y: 1778, label: 'Participacao societaria em clientes ou fornecedores' },
  { key: 'societaryCompetitors', y: 1840, label: 'Participacao societaria em concorrentes' },
  { key: 'makesDecisionsForRelatedParties', y: 2142, label: 'Participa de decisoes envolvendo partes relacionadas' },
]

function avaliarRiscoConflito(respostas = {}) {
  const parallelCompetesOrUsesResources = !!(respostas.parallelCompetes || respostas.parallelUsesResources || respostas.parallelConflictHours)
  const hasSocietaryParticipation = !!(respostas.societarySuppliersClients || respostas.societaryCompetitors)
  if (respostas.hasExternalRelationship || hasSocietaryParticipation || parallelCompetesOrUsesResources || respostas.makesDecisionsForRelatedParties) return 'ALTO'
  if (respostas.hasInternalRelationship) return 'MEDIO'
  return 'BAIXO'
}

function resumoRiscoConflito(risco, respostas = {}) {
  if (risco === 'ALTO') {
    const motivos = []
    if (respostas.hasExternalRelationship) motivos.push('relacao externa sensivel')
    if (respostas.societarySuppliersClients || respostas.societaryCompetitors) motivos.push('participacao societaria/interesse financeiro')
    if (respostas.parallelCompetes || respostas.parallelUsesResources || respostas.parallelConflictHours) motivos.push('atividade paralela com conflito operacional')
    if (respostas.makesDecisionsForRelatedParties) motivos.push('influencia em decisoes relacionadas')
    return `Exige plano de mitigacao imediato${motivos.length ? ': ' + motivos.join(', ') : '.'}`
  }
  if (risco === 'MEDIO') return 'Encaminhar para revisao do analista e validacao de hierarquia/departamento ou ciencia da atividade paralela.'
  return 'Todas as respostas criticas foram negativas. Aprovacao automatica sem conflito identificado.'
}

function contarBrilhoImagem(img, cx, cy, baseW = 920, baseH = 3034) {
  const channels = Math.max(1, Math.round((img.data?.length || 0) / (img.width * img.height)))
  if (!img?.data?.length || channels < 3) return null
  const x = Math.round(cx * img.width / baseW)
  const y = Math.round(cy * img.height / baseH)
  const r = Math.max(4, Math.round(5 * img.width / baseW))
  let count = 0
  for (let yy = y - r; yy <= y + r; yy += 1) {
    if (yy < 0 || yy >= img.height) continue
    for (let xx = x - r; xx <= x + r; xx += 1) {
      if (xx < 0 || xx >= img.width) continue
      const i = (yy * img.width + xx) * channels
      const alpha = channels >= 4 ? img.data[i + 3] : 255
      const bright = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3
      if (alpha > 160 && bright > 180) count += 1
    }
  }
  return count
}

function respostaRadioImagem(img, y) {
  const yes = contarBrilhoImagem(img, 15, y)
  const no = contarBrilhoImagem(img, 80, y)
  if (yes == null || no == null) return null
  const delta = Math.max(6, (yes + no) * 0.06)
  if (yes + delta < no) return true
  if (no + delta < yes) return false
  return null
}

function respostasPorImagemPrincipal(img) {
  const respostas = {}
  let encontradas = 0
  CHECKBOX_CONFLITO_ROWS.forEach(row => {
    const value = respostaRadioImagem(img, row.y)
    respostas[row.key] = value
    if (value !== null) encontradas += 1
  })
  return { respostas, confianca: CHECKBOX_CONFLITO_ROWS.length ? encontradas / CHECKBOX_CONFLITO_ROWS.length : 0 }
}

function normConflitoTexto(texto = '') {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .toLowerCase()
}

function trechoEntre(texto, inicio, fim) {
  const from = texto.indexOf(inicio)
  if (from < 0) return ''
  const start = from + inicio.length
  const to = fim ? texto.indexOf(fim, start) : -1
  return texto.slice(start, to >= 0 ? to : undefined)
}

function descricaoDepoisDe(bloco, marcador) {
  const idx = bloco.lastIndexOf(marcador)
  if (idx < 0) return ''
  return bloco.slice(idx + marcador.length)
}

function limparDescricaoConflito(texto = '') {
  const limpo = texto
    .replace(/\d{2}\/\d{2}\/\d{4},?\s*\d{2}:\d{2}/g, ' ')
    .replace(/workforce\s*-\s*documento eletronico/g, ' ')
    .replace(/workforce\.brbpo\.com\.br\S*/g, ' ')
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/nome da empresa:/g, ' ')
    .replace(/natureza da participacao\/interesse:/g, ' ')
    .replace(/[•*_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const apenasVazio = limpo.replace(/[-–—./\\,;:()\s]/g, '')
  if (!apenasVazio) return ''
  if (/^(nao|n\/a|naoseaplica|nenhum|nenhuma|sem|naoinformado)+$/.test(apenasVazio)) return ''
  return limpo
}

function respostasPorTextoConflito(texto = '') {
  const respostas = Object.fromEntries(CHECKBOX_CONFLITO_ROWS.map(row => [row.key, false]))
  const norm = normConflitoTexto(texto)
  if (!norm.includes('situacoes potenciais') && !norm.includes('declaracoes especificas')) {
    return { respostas: {}, confianca: 0 }
  }

  const relacoes = trechoEntre(norm, 'relacoes pessoais, familiares ou afetivas:', 'atividades profissionais paralelas:')
  const atividade = trechoEntre(norm, 'atividades profissionais paralelas:', 'participacao societaria')
  const societario = trechoEntre(norm, 'participacao societaria', 'situacoes especificas')
  const decisao = trechoEntre(norm, 'situacoes especificas', 'compromisso do colaborador')

  const relDesc = limparDescricaoConflito(descricaoDepoisDe(relacoes, 'se sim, descreva:'))
  const atividadeDesc = limparDescricaoConflito(descricaoDepoisDe(atividade, 'se sim, descreva:'))
  const societarioDesc = limparDescricaoConflito(descricaoDepoisDe(societario, 'se sim, informe:'))
  const decisaoDesc = limparDescricaoConflito(descricaoDepoisDe(decisao, 'se sim, descreva:'))

  if (relDesc) {
    const mencionaExterno = /\b(cliente|fornecedor|prestador|parceiro|concorrent|comercial)\b/.test(relDesc)
    respostas[mencionaExterno ? 'hasExternalRelationship' : 'hasInternalRelationship'] = true
  }
  if (atividadeDesc) {
    respostas.hasParallelActivity = true
  }
  if (societarioDesc) respostas.societarySuppliersClients = true
  if (decisaoDesc) respostas.makesDecisionsForRelatedParties = true

  const blocosReconhecidos = [relacoes, atividade, societario, decisao].filter(Boolean).length
  return { respostas, confianca: blocosReconhecidos >= 3 ? 0.95 : 0.5 }
}

async function getObjetoPdf(page, id) {
  try { return page.objs.get(id) } catch {}
  return await new Promise(resolve => {
    try { page.objs.get(id, resolve) } catch { resolve(null) }
  })
}

function criarCanvasLeitura(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) }
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) }
  }
  return { canvas: null, ctx: null }
}

function normalizarImagemPdf(img) {
  if (!img) return null
  if (img.data?.length && img.width && img.height) return img

  const bitmap = img.bitmap || img
  const width = img.width || bitmap?.width
  const height = img.height || bitmap?.height
  if (!bitmap || !width || !height) return null

  try {
    const { ctx } = criarCanvasLeitura(width, height)
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)
    return { width, height, data: imageData.data }
  } catch {
    return null
  }
}

async function renderizarPaginaComoImagem(page, scale = 2) {
  const viewport = page.getViewport({ scale })
  const width = Math.ceil(viewport.width)
  const height = Math.ceil(viewport.height)
  const { ctx } = criarCanvasLeitura(width, height)
  if (!ctx) return null
  await page.render({ canvasContext: ctx, viewport }).promise
  const imageData = ctx.getImageData(0, 0, width, height)
  return { width, height, data: imageData.data, viewport }
}

function radioScoreRenderizado(img, pdfX, pdfY) {
  if (!img?.viewport || !img.data?.length) return 0
  const [vx, vy] = img.viewport.convertToViewportPoint(pdfX, pdfY)
  const x = Math.round(vx)
  const y = Math.round(vy)
  const r = 3
  let score = 0
  let total = 0
  for (let yy = y - r; yy <= y + r; yy += 1) {
    if (yy < 0 || yy >= img.height) continue
    for (let xx = x - r; xx <= x + r; xx += 1) {
      if (xx < 0 || xx >= img.width) continue
      const i = (yy * img.width + xx) * 4
      const alpha = img.data[i + 3]
      const bright = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3
      if (alpha > 120 && bright < 170) score += 1
      total += 1
    }
  }
  return total ? score / total : 0
}

function respostaRadioTextualRenderizado(img, simItem, naoItem) {
  const simScore = radioScoreRenderizado(img, simItem.x - 9, simItem.y + 6)
  const naoScore = radioScoreRenderizado(img, naoItem.x - 9, naoItem.y + 6)
  const delta = 0.08
  if (simScore > naoScore + delta) return true
  if (naoScore > simScore + delta) return false
  return null
}

function paresRadioTexto(items = []) {
  const allNorm = items.map(item => ({
    str: normConflitoTexto(item.str || '').replace(/\s+/g, ''),
    x: item.transform?.[4] || 0,
    y: item.transform?.[5] || 0,
  }))
  const labels = allNorm
    .filter(item => item.str === 'sim' || item.str === 'nao')
    // Exclui SIM/NÃO que aparecem junto a outro texto na mesma linha (texto instrucional,
    // ex: "assinalando SIM ou NÃO") — rótulos de radio button ficam isolados em sua linha.
    .filter(item => !allNorm.some(other =>
      Math.abs(other.y - item.y) <= 1.5 &&
      other.str !== 'sim' && other.str !== 'nao' && other.str.length > 0
    ))
    .sort((a, b) => Math.abs(b.y - a.y) > 1.5 ? b.y - a.y : a.x - b.x)

  const usados = new Set()
  const pares = []
  labels.forEach((item, idx) => {
    if (usados.has(idx) || item.str !== 'sim') return
    const naoIdx = labels.findIndex((cand, cidx) =>
      cidx !== idx && !usados.has(cidx) && cand.str === 'nao' && Math.abs(cand.y - item.y) <= 1.5 && cand.x > item.x
    )
    if (naoIdx >= 0) {
      usados.add(idx)
      usados.add(naoIdx)
      pares.push({ sim: item, nao: labels[naoIdx], y: item.y })
    }
  })
  return pares.sort((a, b) => b.y - a.y)
}

async function respostasPorRadiosTextuais(pdf) {
  const respostas = {}
  let rowIndex = 0
  let encontradas = 0

  for (let p = 1; p <= pdf.numPages && rowIndex < CHECKBOX_CONFLITO_ROWS.length; p += 1) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const pares = paresRadioTexto(content.items)
    if (!pares.length) continue
    const img = await renderizarPaginaComoImagem(page, 2)
    if (!img) continue
    for (const par of pares) {
      const row = CHECKBOX_CONFLITO_ROWS[rowIndex]
      if (!row) break
      const value = respostaRadioTextualRenderizado(img, par.sim, par.nao)
      respostas[row.key] = value
      if (value !== null) encontradas += 1
      rowIndex += 1
    }
  }

  return { respostas, confianca: CHECKBOX_CONFLITO_ROWS.length ? encontradas / CHECKBOX_CONFLITO_ROWS.length : 0 }
}

async function extrairImagemPrincipalPdf(pdf, pdfjsLib) {
  const page = await pdf.getPage(1)
  const op = await page.getOperatorList()
  const paint = pdfjsLib.OPS?.paintImageXObject
  const imageArg = op.argsArray.find((args, i) => op.fnArray[i] === paint && args?.[0])?.[0]
  if (!imageArg) return null
  return normalizarImagemPdf(await getObjetoPdf(page, imageArg))
}

async function extrairConflitoPdf(file) {
  const pdfjsLib = await import('pdfjs-dist/legacy/webpack.mjs')
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)), isEvalSupported: false }).promise
  let texto = ''
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    texto += '\n' + content.items.map(i => i.str).join('\n')
  }
  let metodo = texto.trim() ? 'texto_pdf' : 'imagem_checkbox'
  let parsed = texto.trim() ? respostasPorTextoConflito(texto) : { respostas: {}, confianca: 0 }
  if (texto.trim()) {
    const byTextRadios = await respostasPorRadiosTextuais(pdf)
    if (byTextRadios.confianca >= 0.8) {
      parsed = {
        respostas: { ...parsed.respostas, ...byTextRadios.respostas },
        confianca: Math.max(parsed.confianca, byTextRadios.confianca),
      }
      metodo = 'texto_pdf_radio'
    }
  }
  if (parsed.confianca < 1) {
    const img = await extrairImagemPrincipalPdf(pdf, pdfjsLib)
    if (img) {
      const byImage = respostasPorImagemPrincipal(img)
      if (byImage.confianca >= parsed.confianca) {
        parsed = byImage
        metodo = 'imagem_checkbox'
      }
    }
  }
  const respostas = Object.fromEntries(CHECKBOX_CONFLITO_ROWS.map(row => [row.key, parsed.respostas[row.key] === true]))
  const extracaoIncompleta = parsed.confianca < 0.8
  const risco = extracaoIncompleta ? 'MEDIO' : avaliarRiscoConflito(respostas)
  const meta = RISCO_CONFLITO_META[risco]
  return {
    texto_extraido: texto.trim(),
    respostas,
    nivel_risco: risco,
    flag: meta.flag,
    status: meta.status,
    recomendacao: extracaoIncompleta ? 'Extracao automatica incompleta. Encaminhar para revisao manual do formulario.' : resumoRiscoConflito(risco, respostas),
    metodo_extracao: metodo,
    confianca_extracao: parsed.confianca,
  }
}

function StatusBadge({ status, small }) {
  const s = STATUS_LABELS[status] || { label: status, color: C.gray, bg: C.grayBg }
  return (
    <span style={{
      display: 'inline-block', padding: small ? '2px 8px' : '3px 10px',
      borderRadius: 999, fontSize: small ? 11 : 12, fontWeight: 700,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>{s.label}</span>
  )
}

function Avatar({ nome, size = 32 }) {
  const initials = (nome || 'CO').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: C.navy, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38,
      fontWeight: 800, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ── Componente de input de formulário ─────────────────────────────────────────

const INP = { width: '100%', padding: '8px 10px', border: '1px solid ' + C.border, borderRadius: 7, fontSize: 13, background: C.white, color: C.text, boxSizing: 'border-box' }
const SEL = { ...INP, cursor: 'pointer' }
const LBL = { display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4 }

// ── Help pop-up genérico ──────────────────────────────────────────────────────

function HelpPopup({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer',
          color: '#6b7280', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
        <HelpCircle size={13} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f1f5f9',
          borderRadius: 10, padding: '12px 14px',
          fontSize: 12, lineHeight: 1.65,
          width: 300, zIndex: 999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          pointerEvents: 'none',
        }}>
          {/* seta */}
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #1e293b',
          }} />
          {children}
        </div>
      )}
    </span>
  )
}

// ── Dashboard cards ───────────────────────────────────────────────────────────

function DashboardCards({ denuncias }) {
  const counts = useMemo(() => {
    const c = {}
    STATUS_ORDER.forEach(s => { c[s] = 0 })
    denuncias.forEach(d => { if (c[d.status] !== undefined) c[d.status]++ })
    return c
  }, [denuncias])

  const cards = [
    { key: 'recebido',        label: 'Recebidas',       icon: Inbox },
    { key: 'em_investigacao', label: 'Investigando',    icon: Activity },
    { key: 'em_diligencia',   label: 'Em diligência',  icon: FileText },
    { key: 'concluido',       label: 'Concluídas',      icon: CheckCircle },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
      {cards.map(({ key, label, icon: Icon }) => {
        const s = STATUS_LABELS[key]
        return (
          <div key={key} style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color={s.color} />
              </div>
              <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{counts[key]}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Stepper de status ─────────────────────────────────────────────────────────

function StatusStepper({ current, onChange, disabled }) {
  const currentIdx = STATUS_FLOW.findIndex(s => s.key === current)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', rowGap: 8 }}>
      {STATUS_FLOW.map((step, i) => {
        const done    = i < currentIdx
        const active  = i === currentIdx
        const future  = i > currentIdx
        const color   = active ? STATUS_LABELS[step.key]?.color ?? C.blue
                       : done  ? C.green
                       : C.muted
        return (
          <div key={step.key} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => !disabled && onChange(step.key)}
              disabled={disabled || active}
              title={disabled ? undefined : `Mover para: ${step.label}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 20,
                border: active ? `2px solid ${color}` : '1px solid ' + C.border,
                background: active ? STATUS_LABELS[step.key]?.bg ?? C.blueBg : future ? C.bg : C.greenBg,
                color, fontWeight: active ? 800 : 600, fontSize: 12,
                cursor: disabled || active ? 'default' : 'pointer',
                opacity: future ? 0.5 : 1, transition: 'all 0.15s',
              }}>
              {done ? <CheckCircle size={13} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />}
              {step.label}
            </button>
            {i < STATUS_FLOW.length - 1 && (
              <ArrowRight size={13} color={C.border} style={{ margin: '0 2px' }} />
            )}
          </div>
        )
      })}
      {/* Arquivar como botão separado */}
      {current !== 'arquivado' && (
        <>
          <div style={{ margin: '0 6px', color: C.border, fontSize: 14 }}>|</div>
          <button
            onClick={() => !disabled && onChange('arquivado')}
            disabled={disabled}
            style={{
              padding: '5px 10px', borderRadius: 20, border: '1px solid ' + C.border,
              background: C.bg, color: C.muted, fontSize: 12, fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
            }}>
            Arquivar
          </button>
        </>
      )}
    </div>
  )
}

// ── Aba de documentos ─────────────────────────────────────────────────────────

function DocumentosTab({ denuncia, mensagens }) {
  const [anexos, setAnexos]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    supabase
      .from('compliance_anexos')
      .select('*')
      .eq('denuncia_id', denuncia.id)
      .order('criado_em', { ascending: true })
      .then(({ data }) => { setAnexos(data || []); setLoading(false) })
  }, [denuncia.id])

  // Agrupa por mensagem_id
  const grupos = useMemo(() => {
    const map = new Map()
    anexos.forEach(a => {
      const key = a.mensagem_id ?? '__sem_msg__'
      if (!map.has(key)) {
        map.set(key, { msg: mensagens.find(m => m.id === a.mensagem_id) ?? null, files: [] })
      }
      map.get(key).files.push(a)
    })
    return [...map.values()]
  }, [anexos, mensagens])

  async function handleDownload(anexo) {
    setDownloading(anexo.id)
    try {
      const { data } = await supabase.storage
        .from('compliance-anexos')
        .createSignedUrl(anexo.storage_path, 120)
      if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    } finally { setDownloading(null) }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
        <Loader size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} />
        Carregando documentos…
      </div>
    )
  }

  if (!grupos.length) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <Paperclip size={36} color={C.border} style={{ display: 'block', margin: '0 auto 12px' }} />
        <p style={{ color: C.muted, fontSize: 14, margin: '0 0 6px', fontWeight: 700 }}>Nenhum documento anexado</p>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>
          Arquivos enviados ou recebidos nas mensagens desta denúncia aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {grupos.map(({ msg, files }, gi) => {
        const meta = msg ? (TIPO_MSG_LABELS[msg.tipo] || { label: msg.tipo, icon: FileText, color: C.gray }) : null
        const Icon = meta?.icon ?? Paperclip
        return (
          <div key={gi} style={{ border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden' }}>
            {/* Cabeçalho da mensagem relacionada */}
            <div style={{ padding: '9px 14px', background: C.soft, borderBottom: '1px solid ' + C.border,
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {meta ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
                    color: meta.color, background: C.white, border: '1px solid ' + C.border,
                    padding: '2px 8px', borderRadius: 10 }}>
                    <Icon size={11} />{meta.label}
                  </div>
                  <span style={{ fontSize: 11, color: C.muted }}>{fmt(msg.criado_em)}</span>
                  {msg.enviado_por_nome && (
                    <span style={{ fontSize: 11, color: C.muted }}>· {msg.enviado_por_nome}</span>
                  )}
                  {msg.assunto && (
                    <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>· {msg.assunto}</span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>Origem não vinculada</span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, fontWeight: 600 }}>
                {files.length} arquivo{files.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Lista de arquivos */}
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {files.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 8, background: C.bg, border: '1px solid ' + C.border }}>
                  <FileText size={15} color={a.direcao === 'recebido' ? C.blue : C.green} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.nome_arquivo}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {formatBytes(a.tamanho_bytes)}
                      {' · '}
                      <span style={{ color: a.direcao === 'recebido' ? C.blue : C.green, fontWeight: 700 }}>
                        {a.direcao === 'recebido' ? '↓ Recebido' : '↑ Enviado'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(a)}
                    disabled={downloading === a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 7, border: '1px solid ' + C.border,
                      background: C.white, color: C.navy, fontSize: 12, fontWeight: 600,
                      cursor: downloading === a.id ? 'not-allowed' : 'pointer',
                      opacity: downloading === a.id ? 0.6 : 1 }}>
                    {downloading === a.id
                      ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                      : <Download size={12} />}
                    {downloading === a.id ? 'Aguarde…' : 'Baixar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Composer de mensagens ─────────────────────────────────────────────────────

function MessageComposer({ denuncia, profile, onSent, preset }) {
  const [tipo, setTipo] = useState('officer_reply')
  const [corpo, setCorpo] = useState('')
  const [setor, setSetor] = useState('')
  const [paraEmail, setParaEmail] = useState('')  // para diligencia: e-mail do setor
  const [assunto, setAssunto] = useState(`Atualização da denúncia ${denuncia.numero}`)
  const [arquivos, setArquivos] = useState([])    // File[] para upload
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState(null)
  const fileInputRef = useRef(null)

  const isEmailTipo = tipo === 'officer_reply' || tipo === 'diligencia'
  const isDiligencia = tipo === 'diligencia'

  // Preenche o assunto automaticamente quando o tipo muda.
  // Diligências têm assunto FIXO — o filtro do Gmail depende desse padrão exato.
  useEffect(() => {
    if (tipo === 'diligencia') {
      setAssunto(`Solicitação de Diligência — ${denuncia.numero}`)
    } else if (tipo === 'officer_reply') {
      setAssunto(`Atualização da denúncia ${denuncia.numero}`)
    } else {
      setAssunto('')
    }
  }, [tipo, denuncia.numero])

  // Aplica preset externo (ex: "Responder ao setor" clicado no histórico)
  useEffect(() => {
    if (!preset) return
    if (preset.tipo)                   setTipo(preset.tipo)
    if (preset.paraEmail !== undefined) setParaEmail(preset.paraEmail)
    if (preset.setor     !== undefined) setSetor(preset.setor)
    if (preset.corpo     !== undefined) setCorpo(preset.corpo)
  }, [preset])

  async function handleSend() {
    if (!corpo.trim()) return
    setSending(true); setErr(null)
    try {
      const msgData = {
        denuncia_id:      denuncia.id,
        escritorio_id:    denuncia.escritorio_id,
        tipo,
        corpo:            corpo.trim(),
        assunto:          isDiligencia ? `Solicitação de Diligência — ${denuncia.numero}` : (assunto.trim() || null),
        setor_acionado:   isDiligencia ? setor.trim() || null : null,
        para_email:       isDiligencia ? paraEmail.trim() || null : null,
        para_exibicao:    tipo === 'interna'
                            ? 'Nota interna'
                            : tipo === 'diligencia'
                              ? `Setor: ${setor || 'não especificado'}`
                              : 'Denunciante [identidade protegida]',
        enviado_por_nome: profile.nome,
        enviado_por_id:   profile.id,
        status_envio:     isEmailTipo ? 'pendente' : 'nao_aplicavel',
      }

      // Insere a mensagem e obtém o ID para vincular os anexos
      const { data: msgRow, error } = await supabase
        .from('compliance_mensagens')
        .insert(msgData)
        .select('id')
        .single()
      if (error) throw error

      // Faz upload de cada arquivo selecionado
      for (const file of arquivos) {
        try {
          const ext  = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
          const safe = sanitizeFileName(file.name)
          const path = `${denuncia.escritorio_id}/${denuncia.id}/${msgRow.id}/${crypto.randomUUID()}.${ext}`

          const { error: upErr } = await supabase.storage
            .from('compliance-anexos')
            .upload(path, file, { contentType: file.type || 'application/octet-stream' })

          if (!upErr) {
            await supabase.from('compliance_anexos').insert({
              denuncia_id:   denuncia.id,
              mensagem_id:   msgRow.id,
              escritorio_id: denuncia.escritorio_id,
              nome_arquivo:  safe,
              storage_path:  path,
              tamanho_bytes: file.size,
              content_type:  file.type || 'application/octet-stream',
              direcao:       'enviado',
            })
          } else {
            console.warn('[compliance-upload] Falha ao enviar', file.name, upErr.message)
          }
        } catch (uploadErr) {
          console.warn('[compliance-upload] Erro no arquivo', file.name, uploadErr)
        }
      }

      setCorpo(''); setArquivos([]); setSetor(''); setParaEmail('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      // Restaura o assunto para o padrão do tipo atual (useEffect só dispara quando tipo muda)
      if (tipo === 'diligencia') setAssunto(`Solicitação de Diligência — ${denuncia.numero}`)
      else if (tipo === 'officer_reply') setAssunto(`Atualização da denúncia ${denuncia.numero}`)
      else setAssunto('')
      onSent()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ border: '1px solid ' + C.border, borderRadius: 10, padding: 16, background: C.soft }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <MessageSquare size={14} />Nova mensagem
      </div>

      {/* Tipo */}
      <div style={{ marginBottom: 10 }}>
        <label style={LBL}>Tipo de mensagem</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'officer_reply', label: 'Resposta ao denunciante' },
            { key: 'diligencia',    label: 'Diligência' },
            { key: 'interna',       label: 'Nota interna' },
          ].map(t => (
            <button key={t.key} onClick={() => setTipo(t.key)}
              style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: tipo === t.key ? `2px solid ${C.navy}` : '1px solid ' + C.border,
                background: tipo === t.key ? C.navy : C.white,
                color: tipo === t.key ? 'white' : C.text, cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campos específicos por tipo */}
      {isDiligencia && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={LBL}>Setor acionado</label>
            <input style={INP} value={setor} onChange={e => setSetor(e.target.value)} placeholder="Ex: RH, Jurídico, Financeiro…" />
          </div>
          <div>
            <label style={LBL}>E-mail do setor (destinatário)</label>
            <input style={INP} type="email" value={paraEmail} onChange={e => setParaEmail(e.target.value)} placeholder="setor@empresa.com" />
          </div>
        </div>
      )}

      {isEmailTipo && (
        <div style={{ marginBottom: 10 }}>
          <label style={LBL}>
            Assunto do e-mail
            {isDiligencia
              ? <span style={{ color: C.amber, fontWeight: 600, marginLeft: 4 }}>— fixo (necessário para rastreamento)</span>
              : <span style={{ color: C.muted, fontWeight: 400, marginLeft: 4 }}>(opcional)</span>}
          </label>
          <input
            style={{ ...INP, ...(isDiligencia ? { background: '#f8fafc', color: C.muted, cursor: 'default' } : {}) }}
            value={assunto}
            onChange={isDiligencia ? undefined : e => setAssunto(e.target.value)}
            readOnly={isDiligencia}
            placeholder={isDiligencia ? '' : `Atualização da denúncia ${denuncia.numero}`}
          />
        </div>
      )}

      {/* Corpo */}
      <div style={{ marginBottom: 10 }}>
        <label style={LBL}>Mensagem</label>
        <textarea style={{ ...INP, height: 110, resize: 'vertical', fontFamily: 'inherit' }}
          value={corpo} onChange={e => setCorpo(e.target.value)}
          placeholder={tipo === 'interna' ? 'Escreva uma nota interna (não será enviada por e-mail)…' : 'Escreva a mensagem…'} />
      </div>

      {/* Anexar arquivos (disponível para todos os tipos de e-mail + nota interna) */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: arquivos.length ? 8 : 0 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 7, border: '1px solid ' + C.border,
            background: C.white, color: C.navy, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Paperclip size={12} />Anexar arquivo
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const novos = Array.from(e.target.files || [])
                setArquivos(prev => {
                  const existentes = new Set(prev.map(f => f.name + f.size))
                  return [...prev, ...novos.filter(f => !existentes.has(f.name + f.size))]
                })
                e.target.value = ''
              }}
            />
          </label>
          {arquivos.length > 0 && (
            <span style={{ fontSize: 11, color: C.muted }}>
              {arquivos.length} arquivo{arquivos.length !== 1 ? 's' : ''} selecionado{arquivos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {arquivos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {arquivos.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px', background: C.soft, borderRadius: 6,
                border: '1px solid ' + C.border, fontSize: 12 }}>
                <FileText size={12} color={C.navy} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ color: C.muted, flexShrink: 0 }}>{formatBytes(f.size)}</span>
                <button
                  onClick={() => setArquivos(prev => prev.filter((_, j) => j !== i))}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 2, flexShrink: 0 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEmailTipo && (
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Lock size={11} />
          {tipo === 'officer_reply'
            ? 'A mensagem será enviada ao endereço registrado do denunciante. O endereço não é exibido nesta tela.'
            : 'A mensagem será enviada ao e-mail do setor informado acima.'}
        </div>
      )}

      {err && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{err}</div>}

      <button onClick={handleSend} disabled={sending || !corpo.trim()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
          background: C.navy, color: 'white', border: 'none', fontWeight: 700, fontSize: 13,
          cursor: sending || !corpo.trim() ? 'not-allowed' : 'pointer', opacity: !corpo.trim() ? 0.5 : 1 }}>
        {sending ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={13} />}
        {sending ? 'Enviando…' : tipo === 'interna' ? 'Salvar nota' : 'Enviar'}
      </button>
    </div>
  )
}

// ── Thread de mensagens ───────────────────────────────────────────────────────

function MessageThread({ mensagens, profile, denuncia, onRefresh, onReplyToSector }) {
  if (!mensagens.length) {
    return <div style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Nenhuma mensagem ainda.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {mensagens.map(msg => {
        const meta  = TIPO_MSG_LABELS[msg.tipo] || { label: msg.tipo, icon: MessageSquare, color: C.gray }
        const Icon  = meta.icon
        const isOut = ['officer_reply','diligencia','auto_resposta'].includes(msg.tipo)
        return (
          <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isOut ? 'row-reverse' : 'row' }}>
            <Avatar nome={isOut ? (msg.enviado_por_nome || 'CO') : 'D'} size={30} />
            <div style={{ maxWidth: '80%', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                flexDirection: isOut ? 'row-reverse' : 'row' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                  background: C.soft, border: '1px solid ' + C.border,
                  padding: '2px 8px', borderRadius: 10, color: meta.color }}>
                  <Icon size={11} />{meta.label}
                </div>
                {msg.status_envio === 'falha' && (
                  <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>⚠ Falha no envio</span>
                )}
                {msg.status_envio === 'pendente' && (
                  <span style={{ fontSize: 11, color: C.amber }}>⏳ Aguardando envio</span>
                )}
                {msg.setor_acionado && (
                  <span style={{ fontSize: 11, color: C.purple, background: C.purpleBg, padding: '2px 7px', borderRadius: 10 }}>
                    Setor: {msg.setor_acionado}
                  </span>
                )}
              </div>
              {msg.assunto && (
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontStyle: 'italic' }}>
                  Assunto: {msg.assunto}
                </div>
              )}
              <div style={{
                background: isOut ? C.navy : C.white,
                color: isOut ? 'white' : C.text,
                border: '1px solid ' + (isOut ? 'transparent' : C.border),
                borderRadius: isOut ? '10px 4px 10px 10px' : '4px 10px 10px 10px',
                padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.corpo}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textAlign: isOut ? 'right' : 'left' }}>
                {msg.enviado_por_nome && <span>{msg.enviado_por_nome} · </span>}
                {fmt(msg.criado_em)}
                {msg.tipo === 'recebida' && (
                  <span style={{ marginLeft: 6, fontSize: 10, background: C.blueBg, color: C.blue,
                    padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>
                    <Lock size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                    Endereço protegido
                  </span>
                )}
              </div>
              {msg.tipo === 'resposta_diligencia' && onReplyToSector && (
                <div style={{ marginTop: 6 }}>
                  <button
                    onClick={() => {
                      const emailMatch = (msg.para_exibicao || '').match(/<([^>]+)>/)
                      const lastDilig  = [...mensagens].reverse().find(m => m.tipo === 'diligencia' && m.setor_acionado)
                      onReplyToSector({ paraEmail: emailMatch?.[1] ?? '', setor: lastDilig?.setor_acionado ?? '' })
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 11px', borderRadius: 8,
                      border: '1px solid ' + C.border,
                      background: C.white, color: C.navy,
                      fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    <Reply size={11} />Responder ao setor
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modal de denúncia ─────────────────────────────────────────────────────────

function DenunciaModal({ denuncia: initialDenuncia, profile, onClose, onUpdated }) {
  const [denuncia, setDenuncia]     = useState(initialDenuncia)
  const [tab, setTab]               = useState('dados')
  const [mensagens, setMensagens]   = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const [saving, setSaving]         = useState(false)
  const [sancaoEmail, setSancaoEmail] = useState('')   // e-mail do destinatário da notificação de sanção
  const [composerPreset, setComposerPreset] = useState(null)
  const composerRef = useRef(null)
  const [editData, setEditData]     = useState({
    categoria:      denuncia.categoria,
    competencia:    denuncia.competencia,
    setor_destino:  denuncia.setor_destino  || '',
    prazo_resposta: denuncia.prazo_resposta || '',
    parecer:        denuncia.parecer        || '',
    responsavel_id: denuncia.responsavel_id || '',
    sancao_tipo:    denuncia.sancao_tipo    || null,
    sancao_mensagem: denuncia.sancao_mensagem || '',
  })

  const fetchMensagens = useCallback(async () => {
    setLoadingMsgs(true)
    const { data } = await supabase
      .from('compliance_mensagens')
      .select('*')
      .eq('denuncia_id', denuncia.id)
      .order('criado_em', { ascending: true })
    setMensagens(data || [])
    setLoadingMsgs(false)
  }, [denuncia.id])

  useEffect(() => { fetchMensagens() }, [fetchMensagens])

  async function handleStatusChange(newStatus) {
    setSaving(true)
    const { data, error } = await supabase
      .from('compliance_denuncias')
      .update({ status: newStatus })
      .eq('id', denuncia.id)
      .select('*')
      .single()
    setSaving(false)
    if (!error && data) { setDenuncia(data); onUpdated(data) }
  }

  async function handleSaveData() {
    setSaving(true)
    const updates = {
      categoria:       editData.categoria,
      competencia:     editData.competencia,
      setor_destino:   editData.setor_destino   || null,
      prazo_resposta:  editData.prazo_resposta  || null,
      parecer:         editData.parecer         || null,
      sancao_tipo:     editData.sancao_tipo     || null,
      sancao_mensagem: editData.sancao_mensagem || null,
    }
    const { data, error } = await supabase
      .from('compliance_denuncias')
      .update(updates)
      .eq('id', denuncia.id)
      .select('*')
      .single()

    // Se há sanção + e-mail + mensagem, envia notificação como diligência e registra no histórico
    if (!error && editData.sancao_tipo && sancaoEmail.trim() && editData.sancao_mensagem.trim()) {
      const SANCAO_SETOR = {
        feedback:                 'Setor competente (Feedback)',
        advertencia:              'Setor competente (Advertência)',
        suspensao:                'Setor competente (Suspensão)',
        desligamento_justa_causa: 'Departamento de Pessoal (Desligamento JC)',
      }
      const setorLabel = SANCAO_SETOR[editData.sancao_tipo] || editData.sancao_tipo
      await supabase.from('compliance_mensagens').insert({
        denuncia_id:      denuncia.id,
        escritorio_id:    denuncia.escritorio_id,
        tipo:             'diligencia',
        para_email:       sancaoEmail.trim(),
        para_exibicao:    `Setor: ${setorLabel}`,
        assunto:          `Aplicação de Sanção — ${denuncia.numero}`,
        corpo:            editData.sancao_mensagem.trim(),
        setor_acionado:   setorLabel,
        enviado_por_nome: profile.nome,
        enviado_por_id:   profile.id,
        status_envio:     'pendente',
      })
      setSancaoEmail('')
      fetchMensagens()   // atualiza o badge e a aba Mensagens
    }

    setSaving(false)
    if (!error && data) { setDenuncia(data); onUpdated(data) }
  }

  function handleReplyToSector({ paraEmail, setor }) {
    setTab('mensagens')
    setComposerPreset({ tipo: 'diligencia', paraEmail, setor, _ts: Date.now() })
    setTimeout(() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
  }

  const tabStyle = (active) => ({
    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: 'transparent', borderBottom: active ? `3px solid ${C.green}` : '3px solid transparent',
    color: active ? C.green : C.muted,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: C.white, borderRadius: 14, width: '100%', maxWidth: 820, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', animation: 'fadeInUp 0.2s ease' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid ' + C.border }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: C.navy }}>{denuncia.numero}</span>
                <StatusBadge status={denuncia.status} />
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                Recebida em {fmt(denuncia.data_protocolo)}
                {denuncia.prazo_resposta && ` · Prazo: ${fmtDate(denuncia.prazo_resposta)}`}
              </div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
              <X size={20} />
            </button>
          </div>

          {/* Stepper */}
          <div style={{ marginBottom: 14 }}>
            <StatusStepper current={denuncia.status} onChange={handleStatusChange} disabled={saving} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            <button style={tabStyle(tab === 'dados')} onClick={() => setTab('dados')}>Dados</button>
            <button style={tabStyle(tab === 'mensagens')} onClick={() => setTab('mensagens')}>
              Mensagens
              {mensagens.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, background: C.blueBg, color: C.blue, padding: '1px 7px', borderRadius: 10 }}>
                  {mensagens.length}
                </span>
              )}
            </button>
            <button style={tabStyle(tab === 'documentos')} onClick={() => setTab('documentos')}>
              <Paperclip size={12} style={{ marginRight: 4 }} />Documentos
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', maxHeight: 'calc(90vh - 200px)', overflowY: 'auto' }}>

          {/* ── TAB: DADOS ─────────────────────────────────────── */}
          {tab === 'dados' && (
            <div>
              {/* Aviso de anonimização */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.amberBg, border: '1px solid ' + C.amber, borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                <Lock size={14} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#92400e' }}>
                  <strong>Endereço do denunciante anonimizado para preservar o sigilo.</strong>{' '}
                  Os e-mails de resposta são enviados automaticamente pelo sistema sem expor o endereço aqui.
                </div>
              </div>

              {/* Resumo do corpo */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ ...LBL, marginBottom: 6 }}>Conteúdo da denúncia</label>
                <div style={{ background: C.soft, border: '1px solid ' + C.border, borderRadius: 8, padding: '12px 14px',
                  fontSize: 13, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                  {denuncia.corpo_resumo || denuncia.corpo_original || '(sem conteúdo)'}
                  {denuncia.corpo_original && denuncia.corpo_original.length > 800 && (
                    <span style={{ color: C.muted, fontStyle: 'italic' }}> … [texto completo disponível no registro interno]</span>
                  )}
                </div>
              </div>

              {/* Grid de edição */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={LBL}>Categoria</label>
                  <select style={SEL} value={editData.categoria} onChange={e => setEditData(p => ({ ...p, categoria: e.target.value }))}>
                    {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={LBL}>Competência</label>
                  <select style={SEL} value={editData.competencia} onChange={e => setEditData(p => ({ ...p, competencia: e.target.value }))}>
                    <option value="compliance">Compliance</option>
                    <option value="reencaminhar">Reencaminhar para setor</option>
                  </select>
                </div>
                {editData.competencia === 'reencaminhar' && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={LBL}>Setor de destino</label>
                    <input style={INP} value={editData.setor_destino} onChange={e => setEditData(p => ({ ...p, setor_destino: e.target.value }))} placeholder="Ex: RH, Jurídico, Financeiro…" />
                  </div>
                )}
                <div>
                  <label style={LBL}>Prazo de resposta</label>
                  <input type="date" style={INP} value={editData.prazo_resposta} onChange={e => setEditData(p => ({ ...p, prazo_resposta: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Parecer / conclusão final</label>
                <textarea style={{ ...INP, height: 90, resize: 'vertical', fontFamily: 'inherit' }}
                  value={editData.parecer} onChange={e => setEditData(p => ({ ...p, parecer: e.target.value }))}
                  placeholder="Registre o parecer ou conclusão da apuração…" />
              </div>

              {/* ── Aplicação de sanção ── */}
              <div style={{ marginBottom: 16, border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: C.soft, borderBottom: '1px solid ' + C.border,
                  display: 'flex', alignItems: 'center', gap: 7 }}>
                  <AlertTriangle size={14} color={C.amber} />
                  <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>Aplicação de Sanção</span>
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>(opcional — preencher apenas se houver encaminhamento)</span>
                </div>
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {SANCAO_OPCOES.map(op => (
                    <label key={op.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      padding: '8px 12px', borderRadius: 8, border: '1px solid',
                      borderColor: editData.sancao_tipo === op.value ? op.color : C.border,
                      background: editData.sancao_tipo === op.value ? (op.color + '12') : C.white,
                      transition: 'all 0.12s' }}>
                      <input
                        type="checkbox"
                        checked={editData.sancao_tipo === op.value}
                        onChange={() => setEditData(p => ({
                          ...p,
                          sancao_tipo: p.sancao_tipo === op.value ? null : op.value,
                          sancao_mensagem: p.sancao_tipo === op.value ? '' : p.sancao_mensagem,
                        }))}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: op.color, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 13, fontWeight: editData.sancao_tipo === op.value ? 700 : 500,
                        color: editData.sancao_tipo === op.value ? op.color : C.text }}>
                        {op.label}
                      </span>
                    </label>
                  ))}

                  {/* Campos de mensagem e e-mail — aparecem ao selecionar qualquer sanção */}
                  {editData.sancao_tipo && (
                    <div style={{ marginTop: 4, padding: '10px 12px', background: C.soft, borderRadius: 8,
                      border: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', gap: 10 }}>

                      {/* Mensagem livre */}
                      <div>
                        <label style={{ ...LBL, marginBottom: 6 }}>
                          Mensagem ao setor / departamento competente
                          <span style={{ color: C.muted, fontWeight: 400, marginLeft: 4 }}>(preenchimento livre)</span>
                        </label>
                        <textarea
                          style={{ ...INP, height: 90, resize: 'vertical', fontFamily: 'inherit' }}
                          value={editData.sancao_mensagem}
                          onChange={e => setEditData(p => ({ ...p, sancao_mensagem: e.target.value }))}
                          placeholder={`Descreva as orientações para o ${
                            editData.sancao_tipo === 'desligamento_justa_causa' ? 'Departamento de Pessoal' : 'setor competente'
                          } quanto à aplicação da sanção…`}
                        />
                      </div>

                      {/* E-mail do destinatário */}
                      <div>
                        <label style={{ ...LBL, marginBottom: 4 }}>
                          E-mail do responsável pela aplicação
                          <span style={{ color: C.muted, fontWeight: 400, marginLeft: 4 }}>(opcional — preencha para enviar por e-mail ao salvar)</span>
                        </label>
                        <input
                          type="email"
                          style={INP}
                          value={sancaoEmail}
                          onChange={e => setSancaoEmail(e.target.value)}
                          placeholder={
                            editData.sancao_tipo === 'desligamento_justa_causa'
                              ? 'dp@empresa.com'
                              : 'rh@empresa.com, juridico@empresa.com…'
                          }
                        />
                        {sancaoEmail.trim() && editData.sancao_mensagem.trim() && (
                          <div style={{ fontSize: 11, color: C.navy, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Send size={11} />
                            Ao salvar, a mensagem será enviada por e-mail e registrada no histórico de mensagens da denúncia.
                          </div>
                        )}
                        {sancaoEmail.trim() && !editData.sancao_mensagem.trim() && (
                          <div style={{ fontSize: 11, color: C.amber, marginTop: 3 }}>
                            Preencha a mensagem acima para que o envio seja realizado.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button onClick={handleSaveData} disabled={saving}
                style={{ padding: '8px 20px', background: C.navy, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {saving ? 'Salvando…' : 'Salvar dados'}
              </button>
            </div>
          )}

          {/* ── TAB: DOCUMENTOS ────────────────────────────────── */}
          {tab === 'documentos' && (
            <DocumentosTab denuncia={denuncia} mensagens={mensagens} />
          )}

          {/* ── TAB: MENSAGENS ─────────────────────────────────── */}
          {tab === 'mensagens' && (
            <div>
              {loadingMsgs
                ? <div style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Carregando mensagens…</div>
                : <MessageThread mensagens={mensagens} profile={profile} denuncia={denuncia} onRefresh={fetchMensagens} onReplyToSector={handleReplyToSector} />
              }

              <div ref={composerRef} style={{ marginTop: 20 }}>
                <MessageComposer denuncia={denuncia} profile={profile} onSent={fetchMensagens} preset={composerPreset} />
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Card de denúncia na lista ─────────────────────────────────────────────────

function DenunciaCard({ denuncia, onClick, onArchive, onRestore }) {
  const s = STATUS_LABELS[denuncia.status] || { label: denuncia.status, color: C.gray, bg: C.grayBg }
  const cat = CATEGORIA_LABELS[denuncia.categoria] || denuncia.categoria
  const isArchived = denuncia.status === 'arquivado'
  return (
    <div onClick={onClick}
      style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10,
        padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s',
        opacity: isArchived ? 0.75 : 1 }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 900, fontSize: 14, color: C.navy }}>{denuncia.numero}</span>
            <StatusBadge status={denuncia.status} small />
          </div>
          {denuncia.assunto && (
            <div style={{ fontSize: 13, color: C.text, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {denuncia.assunto}
            </div>
          )}
          <div style={{ fontSize: 12, color: C.muted }}>
            {cat !== 'Não classificado' && <span style={{ marginRight: 8 }}><Tag size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />{cat}</span>}
            <span><Calendar size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />{fmt(denuncia.data_protocolo)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!isArchived && onArchive && (
            <button
              onClick={e => { e.stopPropagation(); onArchive(denuncia) }}
              title="Mover para o arquivo"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px',
                borderRadius: 7, border: '1px solid ' + C.border, background: C.bg,
                color: C.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <Archive size={12} />Arquivar
            </button>
          )}
          {isArchived && onRestore && (
            <button
              onClick={e => { e.stopPropagation(); onRestore(denuncia) }}
              title="Restaurar para a caixa de entrada"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px',
                borderRadius: 7, border: '1px solid ' + C.blue, background: C.blueBg,
                color: C.blue, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              <RotateCcw size={12} />Reativar
            </button>
          )}
          <ChevronRight size={16} color={C.muted} />
        </div>
      </div>
      {denuncia.corpo_resumo && (
        <div style={{ marginTop: 8, fontSize: 12, color: C.muted, lineHeight: 1.5,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {denuncia.corpo_resumo}
        </div>
      )}
    </div>
  )
}

// ── Relatórios de compliance ──────────────────────────────────────────────────

function ComplianceRelatorios({ profile, onClose }) {
  const [filtros, setFiltros] = useState({
    periodo_inicio: '',
    periodo_fim:    '',
    categoria:      '',
    reencaminhadas: false,
    concluidas:     false,
    desligamentos:  false,
  })
  const [resultado, setResultado] = useState([])
  const [loading, setLoading]     = useState(false)
  const [rodou, setRodou]         = useState(false)

  const setF = (k, v) => setFiltros(p => ({ ...p, [k]: v }))

  function handlePrint() {
    document.body.classList.add('printing-compliance-report')
    const cleanup = () => {
      document.body.classList.remove('printing-compliance-report')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  async function gerarRelatorio() {
    setLoading(true)
    let q = supabase
      .from('compliance_denuncias')
      .select('numero,status,categoria,competencia,setor_destino,data_protocolo,prazo_resposta,sancao_tipo,parecer,corpo_resumo')
      .eq('escritorio_id', profile.escritorio_id)

    if (filtros.periodo_inicio) q = q.gte('data_protocolo', filtros.periodo_inicio)
    if (filtros.periodo_fim)    q = q.lte('data_protocolo', filtros.periodo_fim + 'T23:59:59.999Z')
    if (filtros.categoria)      q = q.eq('categoria', filtros.categoria)
    if (filtros.reencaminhadas) q = q.eq('competencia', 'reencaminhar')
    if (filtros.concluidas)     q = q.eq('status', 'concluido')
    if (filtros.desligamentos)  q = q.eq('sancao_tipo', 'desligamento_justa_causa')

    const { data } = await q.order('data_protocolo', { ascending: false })
    setResultado(data || [])
    setRodou(true)
    setLoading(false)
  }

  const stats = useMemo(() => {
    const porCat = {}
    resultado.forEach(d => { porCat[d.categoria] = (porCat[d.categoria] || 0) + 1 })
    return {
      total:         resultado.length,
      reencaminhadas: resultado.filter(d => d.competencia === 'reencaminhar').length,
      concluidas:    resultado.filter(d => d.status === 'concluido').length,
      desligamentos: resultado.filter(d => d.sancao_tipo === 'desligamento_justa_causa').length,
      comSancao:     resultado.filter(d => d.sancao_tipo).length,
      porCategoria:  Object.entries(porCat).sort((a, b) => b[1] - a[1]),
    }
  }, [resultado])

  const periodoTexto = [
    filtros.periodo_inicio ? `de ${fmtDate(filtros.periodo_inicio + 'T12:00:00')}` : '',
    filtros.periodo_fim    ? `até ${fmtDate(filtros.periodo_fim + 'T12:00:00')}` : '',
  ].filter(Boolean).join(' ') || 'Todo o período'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', overflowY: 'auto' }} className="no-print">
      <div style={{ background: C.white, borderRadius: 14, width: '100%', maxWidth: 1020,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + C.border,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.navy,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart2 size={16} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: C.text }}>Relatório de Compliance</div>
              <div style={{ fontSize: 12, color: C.muted }}>Filtre e exporte denúncias registradas</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {rodou && resultado.length > 0 && (
              <button onClick={handlePrint}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px',
                  border: '1px solid ' + C.border, borderRadius: 8, background: C.white,
                  color: C.navy, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <Printer size={14} />Imprimir / PDF
              </button>
            )}
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ padding: '16px 24px', background: C.soft, borderBottom: '1px solid ' + C.border }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: C.muted, textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Filter size={12} />Filtros
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={LBL}>Período — de</label>
              <input type="date" style={INP} value={filtros.periodo_inicio}
                onChange={e => setF('periodo_inicio', e.target.value)} />
            </div>
            <div>
              <label style={LBL}>Período — até</label>
              <input type="date" style={INP} value={filtros.periodo_fim}
                onChange={e => setF('periodo_fim', e.target.value)} />
            </div>
            <div>
              <label style={LBL}>Categoria</label>
              <select style={SEL} value={filtros.categoria} onChange={e => setF('categoria', e.target.value)}>
                <option value="">Todas as categorias</option>
                {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { key: 'reencaminhadas', label: 'Apenas reencaminhadas' },
              { key: 'concluidas',     label: 'Apenas concluídas' },
              { key: 'desligamentos',  label: 'Apenas desligamentos por justa causa' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: C.text }}>
                <input type="checkbox" checked={filtros[key]} onChange={e => setF(key, e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: C.navy }} />
                {label}
              </label>
            ))}
          </div>
          <button onClick={gerarRelatorio} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              background: C.navy, color: 'white', border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <BarChart2 size={14} />}
            {loading ? 'Gerando…' : 'Gerar relatório'}
          </button>
        </div>

        {/* Resultado */}
        {rodou && (
          <div className="compliance-print-area" style={{ padding: '20px 24px' }} id="compliance-relatorio-print">

            {/* Cabeçalho de impressão */}
            <div className="print-only" style={{ display: 'none', marginBottom: 20 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.navy }}>Canal de Compliance — Relatório</div>
              <div style={{ fontSize: 13, color: C.muted }}>{periodoTexto}</div>
              {filtros.categoria && <div style={{ fontSize: 13 }}>Categoria: {CATEGORIA_LABELS[filtros.categoria]}</div>}
            </div>

            {/* Cards de resumo */}
            <div className="rel-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Total filtrado',     value: stats.total,          color: C.navy },
                { label: 'Reencaminhadas',     value: stats.reencaminhadas, color: C.amber },
                { label: 'Concluídas',         value: stats.concluidas,     color: C.green },
                { label: 'Com sanção',         value: stats.comSancao,      color: C.purple },
                { label: 'Desligamentos JC',   value: stats.desligamentos,  color: '#dc2626' },
              ].map(c => (
                <div key={c.label} style={{ background: C.soft, border: '1px solid ' + C.border,
                  borderRadius: 9, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 2 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Distribuição por categoria */}
            {stats.porCategoria.length > 0 && (
              <div style={{ background: C.soft, border: '1px solid ' + C.border, borderRadius: 9,
                padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: C.muted, textTransform: 'uppercase', marginBottom: 10 }}>
                  Distribuição por categoria
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {stats.porCategoria.map(([cat, count]) => (
                    <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6,
                      background: C.white, border: '1px solid ' + C.border, borderRadius: 7, padding: '4px 10px', fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: C.navy }}>{count}</span>
                      <span style={{ color: C.muted }}>{CATEGORIA_LABELS[cat] || cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabela */}
            {resultado.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center', background: C.soft, borderRadius: 10 }}>
                <Filter size={32} color={C.border} style={{ display: 'block', margin: '0 auto 10px' }} />
                <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Nenhuma denúncia corresponde aos filtros aplicados.</p>
              </div>
            ) : (
              <div className="rel-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="rel-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <colgroup>
                    <col /><col /><col /><col /><col /><col /><col />
                  </colgroup>
                  <thead>
                    <tr style={{ background: C.navy, color: 'white' }}>
                      {['Nº', 'Data', 'Categoria', 'Status', 'Competência', 'Sanção aplicada', 'Prazo'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.map((d, i) => {
                      const sancao = d.sancao_tipo ? SANCAO_LABELS[d.sancao_tipo] : null
                      const statusS = STATUS_LABELS[d.status] || { label: d.status, color: C.muted }
                      return (
                        <tr key={d.numero} style={{ background: i % 2 === 0 ? C.white : C.soft, borderBottom: '1px solid ' + C.border }}>
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: C.navy, whiteSpace: 'nowrap' }}>{d.numero}</td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{fmtDate(d.data_protocolo)}</td>
                          <td style={{ padding: '8px 12px' }}>{CATEGORIA_LABELS[d.categoria] || d.categoria}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ color: statusS.color, fontWeight: 700 }}>{statusS.label}</span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {d.competencia === 'reencaminhar'
                              ? <span style={{ color: C.amber, fontWeight: 700 }}>Reencaminhada{d.setor_destino ? ` → ${d.setor_destino}` : ''}</span>
                              : <span style={{ color: C.muted }}>Compliance</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {sancao
                              ? <span style={{ color: sancao.color, fontWeight: 700 }}>
                                  {sancao.value === 'desligamento_justa_causa' ? 'Desligamento JC'
                                    : sancao.value === 'suspensao' ? 'Suspensão'
                                    : sancao.value === 'advertencia' ? 'Advertência'
                                    : 'Feedback'}
                                </span>
                              : <span style={{ color: C.muted }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{d.prazo_resposta ? fmtDate(d.prazo_resposta) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted, textAlign: 'right' }}>
                  {resultado.length} registro{resultado.length !== 1 ? 's' : ''} · Gerado em {fmt(new Date().toISOString())}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Estilos de impressão */}
      <style>{`
        @page { size: A4 landscape; margin: 1.2cm 1.5cm; }

        @media print {
          /*
           * Estratégia: ocultar TUDO via visibility:hidden e revelar
           * apenas .compliance-print-area e seus filhos.
           * Isso evita imprimir a sidebar, o cabeçalho do app e o
           * restante da página de compliance junto com o relatório.
           */
          body.printing-compliance-report * {
            visibility: hidden !important;
          }
          body.printing-compliance-report .compliance-print-area,
          body.printing-compliance-report .compliance-print-area * {
            visibility: visible !important;
          }
          body.printing-compliance-report .compliance-print-area {
            position: fixed !important;
            inset: 0 !important;
            padding: 1.2cm 1.5cm !important;
            background: white !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }

          /* ── Cabeçalho exclusivo de impressão ── */
          .print-only { display: block !important; }

          /* ── Cards: 5 colunas em linha ── */
          .rel-cards {
            display: grid !important;
            grid-template-columns: repeat(5, 1fr) !important;
            gap: 6px !important;
            margin-bottom: 14px !important;
          }
          .rel-cards > div { padding: 8px 10px !important; border-radius: 6px !important; }
          .rel-cards > div > div:first-child { font-size: 20px !important; }
          .rel-cards > div > div:last-child  { font-size: 10px !important; }

          /* ── Tabela: sem scroll, ajustada à largura da página ── */
          .rel-table-wrap { overflow: visible !important; width: 100% !important; }
          .rel-table {
            width: 100% !important;
            table-layout: fixed !important;
            font-size: 9.5pt !important;
            border-collapse: collapse !important;
          }
          .rel-table th, .rel-table td {
            padding: 5px 7px !important;
            white-space: normal !important;
            word-break: break-word !important;
          }
          .rel-table thead tr {
            background: #1e3a5f !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .rel-table tbody tr:nth-child(even) {
            background: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          @keyframes spin {}
        }
      `}</style>
    </div>
  )
}

// ── Painel de denúncias ───────────────────────────────────────────────────────

function RiskBadge({ risco }) {
  const meta = RISCO_CONFLITO_META[risco] || RISCO_CONFLITO_META.BAIXO
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
      borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 800 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
      {meta.flag}
    </span>
  )
}

const CONFLITO_GESTAO_KEY = '_gestao'

function conflitoGestao(row) {
  return row?.respostas?.[CONFLITO_GESTAO_KEY] || {}
}

function conflitoArquivado(row) {
  return conflitoGestao(row).arquivado === true
}

function respostasComGestao(row, patch) {
  const respostas = { ...(row?.respostas || {}) }
  respostas[CONFLITO_GESTAO_KEY] = {
    ...(respostas[CONFLITO_GESTAO_KEY] || {}),
    ...patch,
  }
  return respostas
}

function ConflitosInteresseTab({ profile }) {
  const [rows, setRows] = useState([])
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [archiveView, setArchiveView] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [savingDecision, setSavingDecision] = useState(false)
  const [decisionForm, setDecisionForm] = useState({ observacoes_resultado: '', parecer_decisao: '' })
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('compliance_conflito_interesse_analises')
      .select('*')
      .eq('escritorio_id', profile.escritorio_id)
      .order('criado_em', { ascending: false })
    if (!err) setRows(data || [])
    else setError(err.message)
    setLoading(false)
  }, [profile.escritorio_id])

  useEffect(() => { load() }, [load])

  function addFiles(fileList) {
    const pdfs = Array.from(fileList || []).filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    const grandes = pdfs.filter(f => f.size > CONFLITO_PDF_MAX_BYTES)
    const novos = pdfs.filter(f => f.size <= CONFLITO_PDF_MAX_BYTES)
    if (grandes.length) {
      setError(`O limite por PDF e ${formatBytes(CONFLITO_PDF_MAX_BYTES)}. Arquivo recusado: ${grandes.map(f => `${f.name} (${formatBytes(f.size)})`).join(', ')}`)
    } else if (pdfs.length) {
      setError('')
    }
    if (!novos.length) return
    setFiles(prev => {
      const vistos = new Set(prev.map(f => `${f.name}:${f.size}:${f.lastModified}`))
      return [...prev, ...novos.filter(f => !vistos.has(`${f.name}:${f.size}:${f.lastModified}`))]
    })
  }

  async function criarAtividadeRevisao(analise) {
    if (analise.nivel_risco === 'BAIXO') return null
    const high = analise.nivel_risco === 'ALTO'
    const prazo = new Date(Date.now() + (high ? 2 : 5) * 86400000).toISOString().slice(0, 10)
    const { data, error: err } = await supabase.from('atividades').insert({
      escritorio_id: profile.escritorio_id,
      tipo: 'tarefa',
      titulo: `${high ? 'Alerta critico' : 'Revisar'} conflito de interesse - ${analise.arquivo_nome}`,
      descricao: `${RISCO_CONFLITO_META[analise.nivel_risco]?.statusLabel || analise.status}\n\n${analise.recomendacao}`,
      status: 'a_fazer',
      prioridade: high ? 'urgente' : 'alta',
      responsavel_id: profile.id,
      criado_por: profile.id,
      prazo,
    }).select('id').single()
    if (err) return null
    return data?.id || null
  }

  async function processarArquivos() {
    if (!files.length || processing) return
    setProcessing(true)
    setError('')
    const novos = []
    try {
      for (const file of files) {
        const analise = await extrairConflitoPdf(file)
        const path = `${profile.escritorio_id}/conflitos_interesse/${Date.now()}_${Math.random().toString(16).slice(2)}_${sanitizeFileName(file.name)}`
        const { error: upErr } = await supabase.storage
          .from(COMPLIANCE_ANEXOS_BUCKET)
          .upload(path, file, { contentType: file.type || 'application/pdf', upsert: false })
        if (upErr) {
          const msg = upErr.message || String(upErr)
          if (/maximum allowed size|exceeded.*size|object.*size/i.test(msg)) {
            throw new Error(`Erro ao enviar ${file.name}: o PDF tem ${formatBytes(file.size)} e ultrapassou o limite configurado no Storage. O bucket ${COMPLIANCE_ANEXOS_BUCKET} deve aceitar ate ${formatBytes(CONFLITO_PDF_MAX_BYTES)}.`)
          }
          throw new Error(`Erro ao enviar ${file.name}: ${msg}`)
        }
        const payload = {
          escritorio_id: profile.escritorio_id,
          arquivo_nome: file.name,
          arquivo_tipo: file.type || 'application/pdf',
          arquivo_tamanho_bytes: file.size,
          storage_bucket: COMPLIANCE_ANEXOS_BUCKET,
          storage_path: path,
          respostas: analise.respostas,
          nivel_risco: analise.nivel_risco,
          flag: analise.flag,
          status: analise.status,
          recomendacao: analise.recomendacao,
          metodo_extracao: analise.metodo_extracao,
          confianca_extracao: analise.confianca_extracao,
          texto_extraido: analise.texto_extraido || null,
          criado_por: profile.id,
          criado_por_nome: profile.nome || profile.email,
        }
        const { data, error: dbErr } = await supabase
          .from('compliance_conflito_interesse_analises')
          .insert(payload)
          .select('*')
          .single()
        if (dbErr) {
          await supabase.storage.from(COMPLIANCE_ANEXOS_BUCKET).remove([path])
          throw new Error(`Erro ao salvar ${file.name}: ${dbErr.message}`)
        }
        const atividadeId = await criarAtividadeRevisao(data)
        const finalRow = atividadeId ? { ...data, atividade_id: atividadeId } : data
        if (atividadeId) {
          await supabase.from('compliance_conflito_interesse_analises')
            .update({ atividade_id: atividadeId })
            .eq('id', data.id)
        }
        novos.push(finalRow)
      }
      setRows(prev => [...novos, ...prev])
      setFiles([])
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setProcessing(false)
    }
  }

  async function abrirArquivo(row) {
    if (!row?.storage_path) return
    const { data } = await supabase.storage
      .from(row.storage_bucket || COMPLIANCE_ANEXOS_BUCKET)
      .createSignedUrl(row.storage_path, 120)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function atualizarGestaoAnalises(targetRows, patch) {
    const targets = (targetRows || []).filter(Boolean)
    if (!targets.length) return []
    setError('')
    const atualizadas = []
    for (const row of targets) {
      const payload = {
        respostas: respostasComGestao(row, patch),
        atualizado_em: new Date().toISOString(),
      }
      const { data, error: err } = await supabase
        .from('compliance_conflito_interesse_analises')
        .update(payload)
        .eq('id', row.id)
        .eq('escritorio_id', profile.escritorio_id)
        .select('*')
        .single()
      if (err) throw err
      atualizadas.push(data)
    }
    const map = new Map(atualizadas.map(row => [row.id, row]))
    setRows(prev => prev.map(row => map.get(row.id) || row))
    setSelected(prev => (prev && map.get(prev.id)) || prev)
    return atualizadas
  }

  async function arquivarAnalises(targetRows) {
    const targets = (targetRows || []).filter(row => row && !conflitoArquivado(row))
    if (!targets.length) return
    try {
      const agora = new Date().toISOString()
      await atualizarGestaoAnalises(targets, {
        arquivado: true,
        arquivado_em: agora,
        arquivado_por: profile.id,
        arquivado_por_nome: profile.nome || profile.email,
      })
      setSelectedIds([])
      if (targets.some(row => row.id === selected?.id)) setSelected(null)
    } catch (e) {
      setError(e?.message || String(e))
    }
  }

  async function reativarAnalises(targetRows) {
    const targets = (targetRows || []).filter(row => row && conflitoArquivado(row))
    if (!targets.length) return
    try {
      const agora = new Date().toISOString()
      await atualizarGestaoAnalises(targets, {
        arquivado: false,
        reativado_em: agora,
        reativado_por: profile.id,
        reativado_por_nome: profile.nome || profile.email,
      })
      setSelectedIds([])
      if (targets.some(row => row.id === selected?.id)) setSelected(null)
    } catch (e) {
      setError(e?.message || String(e))
    }
  }

  async function excluirAnalises(targetRows) {
    const targets = (targetRows || []).filter(Boolean)
    if (!targets.length) return
    const ok = window.confirm(`Excluir definitivamente ${targets.length} analise${targets.length > 1 ? 's' : ''}? Esta acao remove tambem os PDFs anexados.`)
    if (!ok) return
    try {
      setError('')
      const pathsByBucket = targets.reduce((acc, row) => {
        if (!row.storage_path) return acc
        const bucket = row.storage_bucket || COMPLIANCE_ANEXOS_BUCKET
        acc[bucket] = acc[bucket] || []
        acc[bucket].push(row.storage_path)
        return acc
      }, {})
      for (const [bucket, paths] of Object.entries(pathsByBucket)) {
        const { error: stErr } = await supabase.storage.from(bucket).remove(paths)
        if (stErr) throw stErr
      }
      const ids = targets.map(row => row.id)
      const { error: dbErr } = await supabase
        .from('compliance_conflito_interesse_analises')
        .delete()
        .eq('escritorio_id', profile.escritorio_id)
        .in('id', ids)
      if (dbErr) throw dbErr
      setRows(prev => prev.filter(row => !ids.includes(row.id)))
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)))
      if (selected && ids.includes(selected.id)) setSelected(null)
    } catch (e) {
      setError(e?.message || String(e))
    }
  }

  async function salvarParecer() {
    if (!detalhe || savingDecision) return
    setSavingDecision(true)
    try {
      const agora = new Date().toISOString()
      const [updated] = await atualizarGestaoAnalises([detalhe], {
        observacoes_resultado: decisionForm.observacoes_resultado || '',
        parecer_decisao: decisionForm.parecer_decisao || '',
        parecer_atualizado_em: agora,
        parecer_atualizado_por: profile.id,
        parecer_atualizado_por_nome: profile.nome || profile.email,
      })
      if (updated) setSelected(updated)
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setSavingDecision(false)
    }
  }

  function toggleSelecionado(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const activeRows = useMemo(() => rows.filter(row => !conflitoArquivado(row)), [rows])
  const archivedRows = useMemo(() => rows.filter(row => conflitoArquivado(row)), [rows])
  const visibleRows = useMemo(() => archiveView ? archivedRows : activeRows, [archiveView, activeRows, archivedRows])
  const stats = useMemo(() => ({
    total: visibleRows.length,
    baixo: visibleRows.filter(r => r.nivel_risco === 'BAIXO').length,
    medio: visibleRows.filter(r => r.nivel_risco === 'MEDIO').length,
    alto: visibleRows.filter(r => r.nivel_risco === 'ALTO').length,
  }), [visibleRows])
  const selectedRows = useMemo(() => visibleRows.filter(row => selectedIds.includes(row.id)), [visibleRows, selectedIds])
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(row => selectedIds.includes(row.id))
  const detalhe = selected && visibleRows.some(row => row.id === selected.id) ? selected : visibleRows[0] || null

  useEffect(() => {
    setSelectedIds([])
    setSelected(null)
  }, [archiveView])

  useEffect(() => {
    const gestao = conflitoGestao(detalhe)
    setDecisionForm({
      observacoes_resultado: gestao.observacoes_resultado || '',
      parecer_decisao: gestao.parecer_decisao || '',
    })
  }, [detalhe?.id])

  function toggleSelecionarTodos() {
    setSelectedIds(allVisibleSelected ? [] : visibleRows.map(row => row.id))
  }

  const detalheGestao = conflitoGestao(detalhe)
  const detalheArquivado = conflitoArquivado(detalhe)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18, alignItems: 'start' }}>
      <div>
        <div
          onClick={() => fileRef.current?.click()}
          onDragEnter={e => { e.preventDefault(); setDragging(true) }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={e => { e.preventDefault(); if (e.currentTarget === e.target) setDragging(false) }}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
          style={{ border: '2px dashed ' + (dragging ? C.green : C.border), borderRadius: 12, padding: 18,
            background: dragging ? C.greenBg : C.white, cursor: 'pointer', textAlign: 'center', marginBottom: 12 }}>
          <Upload size={22} color={dragging ? C.green : C.muted} style={{ display: 'block', margin: '0 auto 7px' }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: dragging ? C.green : C.text }}>Anexar formulario em PDF</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Arraste arquivos ou clique para selecionar</div>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple style={{ display: 'none' }}
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        {files.length > 0 && (
          <div style={{ border: '1px solid ' + C.border, borderRadius: 10, padding: 10, background: C.white, marginBottom: 12 }}>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: i < files.length - 1 ? '1px solid ' + C.border : 0 }}>
                <FileText size={14} color={C.red} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700 }}>{f.name}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{formatBytes(f.size)}</span>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ border: 0, background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={processarArquivos} disabled={processing}
                style={{ display: 'flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 8,
                  background: processing ? C.muted : C.navy, color: 'white', padding: '9px 15px',
                  fontWeight: 800, cursor: processing ? 'not-allowed' : 'pointer' }}>
                {processing ? <Loader size={14} style={{ animation: 'spin .8s linear infinite' }} /> : <ShieldAlert size={14} />}
                {processing ? 'Analisando...' : `Analisar ${files.length} PDF${files.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        )}

        {error && <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: C.redBg, color: C.red, border: '1px solid ' + C.red, borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}><AlertCircle size={14} />{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', border: '1px solid ' + C.border, borderRadius: 9, overflow: 'hidden', background: C.white }}>
            <button type="button" onClick={() => setArchiveView(false)}
              style={{ border: 0, borderRight: '1px solid ' + C.border, background: !archiveView ? C.greenBg : C.white, color: !archiveView ? C.green : C.text, padding: '8px 11px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
              Em analise ({activeRows.length})
            </button>
            <button type="button" onClick={() => setArchiveView(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: 0, background: archiveView ? C.grayBg : C.white, color: archiveView ? C.gray : C.text, padding: '8px 11px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
              <Archive size={13} /> Arquivo ({archivedRows.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, fontWeight: 800, cursor: visibleRows.length ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={allVisibleSelected} disabled={!visibleRows.length} onChange={toggleSelecionarTodos} />
              Selecionar todos
            </label>
            {selectedRows.length > 0 && (
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 800 }}>{selectedRows.length} selecionada{selectedRows.length > 1 ? 's' : ''}</span>
            )}
            <button type="button" disabled={!selectedRows.length} onClick={() => archiveView ? reativarAnalises(selectedRows) : arquivarAnalises(selectedRows)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + C.border, background: selectedRows.length ? C.white : C.grayBg, color: selectedRows.length ? C.text : C.muted, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 900, cursor: selectedRows.length ? 'pointer' : 'not-allowed' }}>
              {archiveView ? <RotateCcw size={13} /> : <Archive size={13} />}
              {archiveView ? 'Reativar' : 'Arquivar'}
            </button>
            <button type="button" disabled={!selectedRows.length} onClick={() => excluirAnalises(selectedRows)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + (selectedRows.length ? C.red : C.border), background: C.white, color: selectedRows.length ? C.red : C.muted, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 900, cursor: selectedRows.length ? 'pointer' : 'not-allowed' }}>
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
          {[
            ['Total', stats.total, C.navy],
            ['Verde', stats.baixo, C.green],
            ['Amarela', stats.medio, C.amber],
            ['Vermelha', stats.alto, C.red],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 9, padding: '10px 12px' }}>
              <div style={{ fontSize: 21, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 24, color: C.muted, textAlign: 'center' }}>Carregando analises...</div>
            : visibleRows.length === 0 ? <div style={{ padding: 30, color: C.muted, textAlign: 'center' }}>{archiveView ? 'Nenhuma analise arquivada.' : 'Nenhuma analise registrada.'}</div>
            : visibleRows.map(row => {
              const meta = RISCO_CONFLITO_META[row.nivel_risco] || RISCO_CONFLITO_META.BAIXO
              const gestao = conflitoGestao(row)
              const isChecked = selectedIds.includes(row.id)
              return (
                <div key={row.id} role="button" tabIndex={0} onClick={() => setSelected(row)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(row) }}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto auto auto', gap: 10, alignItems: 'center',
                    padding: '11px 13px', border: 0, borderBottom: '1px solid ' + C.border,
                    background: detalhe?.id === row.id ? meta.bg : C.white, textAlign: 'left', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleSelecionado(row.id)}
                    onClick={e => e.stopPropagation()} title="Selecionar analise" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.arquivo_nome}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {fmt(row.criado_em)} - {meta.statusLabel}
                      {gestao.arquivado_em ? ` - Arquivada em ${fmt(gestao.arquivado_em)}` : ''}
                    </div>
                  </div>
                  <RiskBadge risco={row.nivel_risco} />
                  <button type="button" onClick={e => { e.stopPropagation(); abrirArquivo(row) }} title="Visualizar PDF"
                    style={{ display: 'flex', border: '1px solid ' + C.border, background: C.white, borderRadius: 7, padding: 6, color: C.muted, cursor: 'pointer' }}>
                    <Eye size={14} />
                  </button>
                  <button type="button" onClick={e => { e.stopPropagation(); archiveView ? reativarAnalises([row]) : arquivarAnalises([row]) }} title={archiveView ? 'Reativar analise' : 'Arquivar analise'}
                    style={{ display: 'flex', border: '1px solid ' + C.border, background: C.white, borderRadius: 7, padding: 6, color: C.muted, cursor: 'pointer' }}>
                    {archiveView ? <RotateCcw size={14} /> : <Archive size={14} />}
                  </button>
                  <button type="button" onClick={e => { e.stopPropagation(); excluirAnalises([row]) }} title="Excluir analise"
                    style={{ display: 'flex', border: '1px solid ' + C.red, background: C.white, borderRadius: 7, padding: 6, color: C.red, cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
        </div>
      </div>

      <aside style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, padding: 14, position: 'sticky', top: 18 }}>
        {!detalhe ? (
          <div style={{ color: C.muted, textAlign: 'center', padding: 20 }}>Selecione uma analise.</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Analise de conflito</div>
                <div style={{ fontWeight: 900, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis' }}>{detalhe.arquivo_nome}</div>
              </div>
              <RiskBadge risco={detalhe.nivel_risco} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button type="button" onClick={() => abrirArquivo(detalhe)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + C.border, background: C.white, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 900, color: C.text, cursor: 'pointer' }}>
                <Eye size={13} /> Visualizar
              </button>
              <button type="button" onClick={() => detalheArquivado ? reativarAnalises([detalhe]) : arquivarAnalises([detalhe])}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + C.border, background: C.white, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 900, color: C.text, cursor: 'pointer' }}>
                {detalheArquivado ? <RotateCcw size={13} /> : <Archive size={13} />}
                {detalheArquivado ? 'Reativar' : 'Arquivar'}
              </button>
              <button type="button" onClick={() => excluirAnalises([detalhe])}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + C.red, background: C.white, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 900, color: C.red, cursor: 'pointer' }}>
                <Trash2 size={13} /> Excluir
              </button>
            </div>
            <div style={{ border: '1px solid ' + (RISCO_CONFLITO_META[detalhe.nivel_risco]?.color || C.border), borderRadius: 9, padding: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
              <div style={{ color: RISCO_CONFLITO_META[detalhe.nivel_risco]?.color || C.text, fontWeight: 900 }}>{RISCO_CONFLITO_META[detalhe.nivel_risco]?.statusLabel || detalhe.status}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>{detalhe.recomendacao}</div>
              {detalheArquivado && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid ' + C.border, fontSize: 11, color: C.muted, lineHeight: 1.45 }}>
                  Arquivada em {fmt(detalheGestao.arquivado_em)}{detalheGestao.arquivado_por_nome ? ` por ${detalheGestao.arquivado_por_nome}` : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'grid', gap: 7 }}>
              {CHECKBOX_CONFLITO_ROWS.map(row => {
                const value = detalhe.respostas?.[row.key]
                return (
                  <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', borderBottom: '1px solid ' + C.border, paddingBottom: 7 }}>
                    <span style={{ fontSize: 12, color: C.text }}>{row.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: value ? C.red : C.green }}>{value ? 'SIM' : 'NAO'}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, fontSize: 11, color: C.muted }}>
              <span>Metodo: {detalhe.metodo_extracao || 'n/d'}</span>
              <span>Confianca: {Math.round(Number(detalhe.confianca_extracao || 0) * 100)}%</span>
            </div>
            <div style={{ borderTop: '1px solid ' + C.border, marginTop: 14, paddingTop: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>Observacoes sobre o resultado</label>
              <textarea value={decisionForm.observacoes_resultado}
                onChange={e => setDecisionForm(prev => ({ ...prev, observacoes_resultado: e.target.value }))}
                placeholder="Registre observacoes sobre a leitura automatica, conferencias realizadas ou contexto do caso."
                style={{ width: '100%', minHeight: 74, resize: 'vertical', border: '1px solid ' + C.border, borderRadius: 8, padding: 10, fontSize: 12, color: C.text, outline: 'none', marginBottom: 10 }} />

              <label style={{ display: 'block', fontSize: 11, color: C.muted, fontWeight: 900, textTransform: 'uppercase', marginBottom: 6 }}>Parecer / decisao e medida adotada</label>
              <textarea value={decisionForm.parecer_decisao}
                onChange={e => setDecisionForm(prev => ({ ...prev, parecer_decisao: e.target.value }))}
                placeholder="Registre o parecer, a decisao tomada e a medida adotada para dirimir ou mitigar o conflito."
                style={{ width: '100%', minHeight: 92, resize: 'vertical', border: '1px solid ' + C.border, borderRadius: 8, padding: 10, fontSize: 12, color: C.text, outline: 'none' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 11, color: C.muted }}>
                  {detalheGestao.parecer_atualizado_em ? `Atualizado em ${fmt(detalheGestao.parecer_atualizado_em)}` : 'Sem parecer salvo.'}
                </div>
                <button type="button" onClick={salvarParecer} disabled={savingDecision}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, border: 0, background: savingDecision ? C.muted : C.navy, color: 'white', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 900, cursor: savingDecision ? 'not-allowed' : 'pointer' }}>
                  {savingDecision ? <Loader size={13} style={{ animation: 'spin .8s linear infinite' }} /> : <CheckCircle2 size={13} />}
                  {savingDecision ? 'Salvando...' : 'Salvar parecer'}
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function DenunciasList({ profile }) {
  const [denuncias, setDenuncias]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [catFiltro, setCatFiltro]       = useState('todos')
  const [q, setQ]                       = useState('')
  const [refreshing, setRefreshing]     = useState(false)
  const [archiveView, setArchiveView]   = useState(false)  // false = caixa ativa; true = arquivo

  const fetchDenuncias = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const { data, error } = await supabase
      .from('compliance_denuncias')
      .select('id,numero,status,categoria,competencia,setor_destino,assunto,corpo_resumo,data_protocolo,prazo_resposta,parecer,responsavel_id,escritorio_id,corpo_original,sancao_tipo,sancao_mensagem')
      .eq('escritorio_id', profile.escritorio_id)
      .order('data_protocolo', { ascending: false })
    if (!error) setDenuncias(data || [])
    setLoading(false)
    setRefreshing(false)
  }, [profile.escritorio_id])

  useEffect(() => { fetchDenuncias() }, [fetchDenuncias])

  // Ativas = tudo exceto arquivado; Arquivo = apenas arquivado
  const ativas   = useMemo(() => denuncias.filter(d => d.status !== 'arquivado'), [denuncias])
  const arquivo  = useMemo(() => denuncias.filter(d => d.status === 'arquivado'),  [denuncias])

  const filtered = useMemo(() => {
    let rows = archiveView ? arquivo : ativas
    if (!archiveView) {
      if (statusFiltro !== 'todos') rows = rows.filter(d => d.status === statusFiltro)
    }
    if (catFiltro !== 'todos') rows = rows.filter(d => d.categoria === catFiltro)
    if (q.trim()) {
      const ql = q.trim().toLowerCase()
      rows = rows.filter(d =>
        (d.numero || '').toLowerCase().includes(ql) ||
        (d.assunto || '').toLowerCase().includes(ql) ||
        (d.corpo_resumo || '').toLowerCase().includes(ql)
      )
    }
    return rows
  }, [denuncias, archiveView, ativas, arquivo, statusFiltro, catFiltro, q])

  function handleUpdated(updated) {
    setDenuncias(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
    if (selected?.id === updated.id) setSelected(s => ({ ...s, ...updated }))
  }

  async function handleArchive(denuncia) {
    const { data } = await supabase
      .from('compliance_denuncias')
      .update({ status: 'arquivado' })
      .eq('id', denuncia.id)
      .select('*').single()
    if (data) handleUpdated(data)
  }

  async function handleRestore(denuncia) {
    const { data } = await supabase
      .from('compliance_denuncias')
      .update({ status: 'recebido' })
      .eq('id', denuncia.id)
      .select('*').single()
    if (data) handleUpdated(data)
  }

  if (loading) {
    return (
      <div style={{ height: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(0,0,0,0.1)', borderTopColor: C.navy, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>Carregando denúncias…</p>
        </div>
      </div>
    )
  }

  const viewTabStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700,
    background: active ? C.navy : C.white,
    color: active ? 'white' : C.muted,
    boxShadow: active ? 'none' : '0 0 0 1px ' + C.border,
  })

  return (
    <>
      <DashboardCards denuncias={ativas} />

      {/* Seletor de vista: Ativas / Arquivo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={viewTabStyle(!archiveView)} onClick={() => setArchiveView(false)}>
          <Inbox size={13} />Caixa de entrada
          {ativas.length > 0 && (
            <span style={{ background: C.blueBg, color: C.blue, borderRadius: 99, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>
              {ativas.length}
            </span>
          )}
        </button>
        <button style={viewTabStyle(archiveView)} onClick={() => setArchiveView(true)}>
          <Archive size={13} />Arquivo
          {arquivo.length > 0 && (
            <span style={{ background: archiveView ? 'rgba(255,255,255,0.25)' : C.grayBg, color: archiveView ? 'white' : C.muted, borderRadius: 99, fontSize: 11, padding: '1px 7px', fontWeight: 700 }}>
              {arquivo.length}
            </span>
          )}
        </button>
      </div>

      {/* Filtros (apenas na vista ativa) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input style={{ ...INP, paddingLeft: 28 }} value={q} onChange={e => setQ(e.target.value)}
            placeholder={archiveView ? 'Buscar no arquivo…' : 'Buscar por número, assunto ou conteúdo…'} />
        </div>
        {!archiveView && (
          <select style={{ ...SEL, flex: '0 0 160px' }} value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
            <option value="todos">Todos os status</option>
            {STATUS_ORDER.filter(s => s !== 'arquivado').map(s => <option key={s} value={s}>{STATUS_LABELS[s]?.label}</option>)}
          </select>
        )}
        <select style={{ ...SEL, flex: '0 0 180px' }} value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
          <option value="todos">Todas as categorias</option>
          {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => fetchDenuncias(true)} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', border: '1px solid ' + C.border,
            borderRadius: 8, background: C.white, color: C.muted, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
        </button>
      </div>

      {/* Banner informativo no arquivo */}
      {archiveView && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
          background: C.soft, border: '1px solid ' + C.border, borderRadius: 8, marginBottom: 14,
          fontSize: 12, color: C.muted }}>
          <Archive size={13} />
          Denúncias arquivadas ficam aqui e não aparecem na caixa de entrada. Use "Reativar" para movê-las de volta.
        </div>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: C.white, border: '1px solid ' + C.border, borderRadius: 12 }}>
          <Archive size={36} color={C.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            {archiveView
              ? 'Nenhuma denúncia arquivada.'
              : denuncias.length === 0 ? 'Nenhuma denúncia recebida ainda.' : 'Nenhuma denúncia corresponde aos filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
            {filtered.length} denúncia{filtered.length !== 1 ? 's' : ''}
          </div>
          {filtered.map(d => (
            <DenunciaCard
              key={d.id}
              denuncia={d}
              onClick={() => setSelected(d)}
              onArchive={!archiveView ? handleArchive : undefined}
              onRestore={archiveView  ? handleRestore  : undefined}
            />
          ))}
        </div>
      )}

      {selected && (
        <DenunciaModal
          denuncia={selected}
          profile={profile}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </>
  )
}

// ── Módulo principal ──────────────────────────────────────────────────────────

export default function Compliance({ profile }) {
  const [mainTab, setMainTab]           = useState('denuncias')
  const [showRelatorios, setShowRelatorios] = useState(false)

  const tabStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: 'transparent',
    borderBottom: active ? `3px solid ${C.green}` : '3px solid transparent',
    color: active ? C.green : C.muted,
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px' }}>
      {/* Título + botão Relatórios */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={17} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>Canal de Compliance</h1>
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Acesso restrito a gerentes</p>
          </div>
        </div>
        <button
          onClick={() => setShowRelatorios(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            border: '1px solid ' + C.border, borderRadius: 8, background: C.white,
            color: C.navy, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <BarChart2 size={14} />Relatórios
        </button>
      </div>

      {/* Tabs principais */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid ' + C.border, marginBottom: 22, marginTop: 18 }}>
        <button style={tabStyle(mainTab === 'denuncias')} onClick={() => setMainTab('denuncias')}>
          <ShieldAlert size={14} />Denúncias
        </button>
        <button style={tabStyle(mainTab === 'conflitos')} onClick={() => setMainTab('conflitos')}>
          <AlertTriangle size={14} />Conflitos de interesse
        </button>
      </div>

      {mainTab === 'denuncias'  && <DenunciasList profile={profile} />}
      {mainTab === 'conflitos'  && <ConflitosInteresseTab profile={profile} />}

      {showRelatorios && (
        <ComplianceRelatorios profile={profile} onClose={() => setShowRelatorios(false)} />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
