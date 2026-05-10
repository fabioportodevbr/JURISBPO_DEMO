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
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ShieldAlert, Search, RefreshCw, ChevronRight,
  MessageSquare, Send, FileText, CheckCircle,
  X, Lock, Inbox, Activity, Tag,
  Calendar, ArrowRight, Loader, Settings,
  Mail, Server, Eye, EyeOff, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle2, Wifi, HelpCircle,
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
  recebida:      { label: 'E-mail recebido',       icon: Inbox,       color: C.blue   },
  auto_resposta: { label: 'Protocolo automático',  icon: CheckCircle, color: C.green  },
  officer_reply: { label: 'Resposta ao denunciante', icon: Send,      color: C.navy   },
  diligencia:    { label: 'Diligência',             icon: FileText,   color: C.purple },
  interna:       { label: 'Nota interna',           icon: Lock,       color: C.gray   },
}

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

// ── Composer de mensagens ─────────────────────────────────────────────────────

function MessageComposer({ denuncia, profile, onSent }) {
  const [tipo, setTipo] = useState('officer_reply')
  const [corpo, setCorpo] = useState('')
  const [setor, setSetor] = useState('')
  const [paraEmail, setParaEmail] = useState('')  // para diligencia: e-mail do setor
  const [assunto, setAssunto] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState(null)

  const isEmailTipo = tipo === 'officer_reply' || tipo === 'diligencia'
  const isDiligencia = tipo === 'diligencia'

  async function handleSend() {
    if (!corpo.trim()) return
    setSending(true); setErr(null)
    try {
      const msgData = {
        denuncia_id:      denuncia.id,
        escritorio_id:    denuncia.escritorio_id,
        tipo,
        corpo:            corpo.trim(),
        assunto:          assunto.trim() || null,
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

      const { error } = await supabase.from('compliance_mensagens').insert(msgData)
      if (error) throw error

      setCorpo(''); setAssunto(''); setSetor(''); setParaEmail('')
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
          <label style={LBL}>Assunto do e-mail (opcional)</label>
          <input style={INP} value={assunto} onChange={e => setAssunto(e.target.value)}
            placeholder={tipo === 'diligencia' ? `Solicitação de Diligência — ${denuncia.numero}` : `Atualização da denúncia ${denuncia.numero}`} />
        </div>
      )}

      {/* Corpo */}
      <div style={{ marginBottom: 10 }}>
        <label style={LBL}>Mensagem</label>
        <textarea style={{ ...INP, height: 110, resize: 'vertical', fontFamily: 'inherit' }}
          value={corpo} onChange={e => setCorpo(e.target.value)}
          placeholder={tipo === 'interna' ? 'Escreva uma nota interna (não será enviada por e-mail)…' : 'Escreva a mensagem…'} />
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

function MessageThread({ mensagens, profile, denuncia, onRefresh }) {
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
  const [editData, setEditData]     = useState({
    categoria:    denuncia.categoria,
    competencia:  denuncia.competencia,
    setor_destino: denuncia.setor_destino || '',
    prazo_resposta: denuncia.prazo_resposta || '',
    parecer:      denuncia.parecer || '',
    responsavel_id: denuncia.responsavel_id || '',
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
      categoria:     editData.categoria,
      competencia:   editData.competencia,
      setor_destino: editData.setor_destino || null,
      prazo_resposta: editData.prazo_resposta || null,
      parecer:       editData.parecer || null,
    }
    const { data, error } = await supabase
      .from('compliance_denuncias')
      .update(updates)
      .eq('id', denuncia.id)
      .select('*')
      .single()
    setSaving(false)
    if (!error && data) { setDenuncia(data); onUpdated(data) }
  }

  const tabStyle = (active) => ({
    padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: 'transparent', borderBottom: active ? `3px solid ${C.navy}` : '3px solid transparent',
    color: active ? C.navy : C.muted,
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

              <button onClick={handleSaveData} disabled={saving}
                style={{ padding: '8px 20px', background: C.navy, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {saving ? 'Salvando…' : 'Salvar dados'}
              </button>
            </div>
          )}

          {/* ── TAB: MENSAGENS ─────────────────────────────────── */}
          {tab === 'mensagens' && (
            <div>
              {loadingMsgs
                ? <div style={{ padding: '24px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>Carregando mensagens…</div>
                : <MessageThread mensagens={mensagens} profile={profile} denuncia={denuncia} onRefresh={fetchMensagens} />
              }

              <div style={{ marginTop: 20 }}>
                <MessageComposer denuncia={denuncia} profile={profile} onSent={fetchMensagens} />
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

function DenunciaCard({ denuncia, onClick }) {
  const s = STATUS_LABELS[denuncia.status] || { label: denuncia.status, color: C.gray, bg: C.grayBg }
  const cat = CATEGORIA_LABELS[denuncia.categoria] || denuncia.categoria
  return (
    <div onClick={onClick}
      style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10,
        padding: '14px 16px', cursor: 'pointer', transition: 'box-shadow 0.15s',
        ':hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
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
        <ChevronRight size={16} color={C.muted} style={{ flexShrink: 0 }} />
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

// ── Configurações de e-mail ───────────────────────────────────────────────────

const EMPTY_CFG = {
  enabled:           false,
  imap_host:         '', imap_port: 993, imap_secure: true,
  imap_user:         '', imap_password: '',
  imap_mailbox:      'INBOX',
  smtp_host:         '', smtp_port: 587, smtp_secure: false,
  smtp_user:         '', smtp_password: '',
  smtp_from_name:    'Canal de Compliance', smtp_from_email: '',
  filtro_remetentes: '',
  aceitar_todos:     false,
}

function FieldRow({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={LBL}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        style={{ ...INP, paddingRight: 34 }}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
      />
      <button type="button" onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 2 }}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}

function SectionTitle({ icon: Icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '22px 0 14px',
      paddingBottom: 8, borderBottom: '1px solid ' + C.border }}>
      <Icon size={14} color={C.navy} />
      <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>{label}</span>
    </div>
  )
}

function ComplianceSettings({ profile }) {
  const [form, setForm]           = useState(EMPTY_CFG)
  const [pwChanged, setPwChanged] = useState({ imap: false, smtp: false })
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [err, setErr]             = useState(null)
  const [exists, setExists]       = useState(false)

  // Senhas — nunca carregadas na UI
  const [hasPwImap, setHasPwImap] = useState(false)
  const [hasPwSmtp, setHasPwSmtp] = useState(false)

  // Teste de conexão IMAP
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState(null)   // { ok, erro?, mensagens?, naolidas? }
  // Status persistido no banco (da última conexão — worker ou teste manual)
  const [connStatus, setConnStatus]     = useState('desconhecido')
  const [connErro, setConnErro]         = useState('')
  const [connUltimaVez, setConnUltimaVez] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('compliance_config')
        .select('*')
        .eq('escritorio_id', profile.escritorio_id)
        .maybeSingle()
      if (data) {
        setExists(true)
        setHasPwImap(!!data.imap_password)
        setHasPwSmtp(!!data.smtp_password)
        setConnStatus(data.conn_status    || 'desconhecido')
        setConnErro(data.conn_erro        || '')
        setConnUltimaVez(data.conn_ultima_vez || null)
        setForm({
          enabled:           data.enabled,
          imap_host:         data.imap_host         || '',
          imap_port:         data.imap_port         || 993,
          imap_secure:       data.imap_secure       ?? true,
          imap_user:         data.imap_user         || '',
          imap_password:     '',   // nunca carrega senha na UI
          imap_mailbox:      data.imap_mailbox      || 'INBOX',
          smtp_host:         data.smtp_host         || '',
          smtp_port:         data.smtp_port         || 587,
          smtp_secure:       data.smtp_secure       ?? false,
          smtp_user:         data.smtp_user         || '',
          smtp_password:     '',   // nunca carrega senha na UI
          smtp_from_name:    data.smtp_from_name    || 'Canal de Compliance',
          smtp_from_email:   data.smtp_from_email   || '',
          filtro_remetentes: data.filtro_remetentes || '',
          aceitar_todos:     data.aceitar_todos     ?? false,
        })
      }
      setLoading(false)
    }
    load()
  }, [profile.escritorio_id])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSave() {
    setSaving(true); setErr(null); setSaved(false)
    try {
      const payload = {
        escritorio_id:     profile.escritorio_id,
        enabled:           form.enabled,
        imap_host:         form.imap_host.trim(),
        imap_port:         Number(form.imap_port) || 993,
        imap_secure:       form.imap_secure,
        imap_user:         form.imap_user.trim(),
        imap_mailbox:      form.imap_mailbox.trim() || 'INBOX',
        smtp_host:         form.smtp_host.trim(),
        smtp_port:         Number(form.smtp_port) || 587,
        smtp_secure:       form.smtp_secure,
        smtp_user:         form.smtp_user.trim(),
        smtp_from_name:    form.smtp_from_name.trim() || 'Canal de Compliance',
        smtp_from_email:   form.smtp_from_email.trim(),
        filtro_remetentes: form.filtro_remetentes.trim(),
        aceitar_todos:     form.aceitar_todos,
      }
      // Só inclui senhas se o usuário digitou algo novo
      if (pwChanged.imap && form.imap_password) {
        payload.imap_password = form.imap_password
      }
      if (pwChanged.smtp && form.smtp_password) {
        payload.smtp_password = form.smtp_password
      }

      const { error } = exists
        ? await supabase.from('compliance_config').update(payload).eq('escritorio_id', profile.escritorio_id)
        : await supabase.from('compliance_config').insert({ ...payload,
            imap_password: form.imap_password || '',
            smtp_password: form.smtp_password || '',
          })

      if (error) throw error

      setExists(true)
      if (pwChanged.imap && form.imap_password) setHasPwImap(true)
      if (pwChanged.smtp && form.smtp_password) setHasPwSmtp(true)
      setPwChanged({ imap: false, smtp: false })
      setForm(f => ({ ...f, imap_password: '', smtp_password: '' }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await supabase.functions.invoke('compliance-test-imap', {
        body: { escritorio_id: profile.escritorio_id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const result = res.data ?? { ok: false, erro: res.error?.message ?? 'Erro desconhecido.' }
      setTestResult(result)
      // Atualiza status local para refletir o que o banco recebeu
      setConnStatus(result.ok ? 'ok' : 'erro')
      setConnErro(result.ok ? '' : result.erro)
      setConnUltimaVez(new Date().toISOString())
    } catch (e) {
      setTestResult({ ok: false, erro: e.message })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
        <Loader size={20} style={{ animation: 'spin 0.8s linear infinite', margin: '0 auto 8px', display: 'block' }} />
        Carregando configurações…
      </div>
    )
  }

  return (
    <div>
      {/* Aviso de segurança */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.amberBg,
        border: '1px solid ' + C.amber, borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
        <Lock size={14} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: '#92400e' }}>
          <strong>Credenciais protegidas por RLS.</strong> As senhas são acessíveis apenas pelo worker
          (service role) e pelo gerente logado. Nunca são enviadas ao frontend após o salvamento —
          somente substituídas quando um novo valor for fornecido.
        </div>
      </div>

      {/* Toggle de ativação */}
      <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10,
        padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Canal de Compliance</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {form.enabled ? 'Ativo — o worker monitora a caixa de e-mail configurada abaixo.' : 'Inativo — o worker ignora esta caixa.'}
          </div>
        </div>
        <button onClick={() => set('enabled', !form.enabled)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: form.enabled ? C.green : C.muted }}>
          {form.enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
        </button>
      </div>

      {/* ── IMAP ──────────────────────────────────────────────── */}
      <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
        <SectionTitle icon={Inbox} label="Caixa de recebimento (IMAP)" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'end' }}>
          <FieldRow label="Servidor IMAP (host)">
            <input style={INP} value={form.imap_host} onChange={e => set('imap_host', e.target.value)}
              placeholder="mail.empresa.com ou imap.gmail.com" />
          </FieldRow>

          {/* Porta + help */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...LBL, display: 'flex', alignItems: 'center' }}>
              Porta
              <HelpPopup>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Porta e criptografia IMAP</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                      <th style={{ textAlign: 'left', paddingBottom: 4, color: '#94a3b8', fontWeight: 600 }}>Porta</th>
                      <th style={{ textAlign: 'left', paddingBottom: 4, color: '#94a3b8', fontWeight: 600 }}>SSL/TLS</th>
                      <th style={{ textAlign: 'left', paddingBottom: 4, color: '#94a3b8', fontWeight: 600 }}>Quando usar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #1e3a5f' }}>
                      <td style={{ padding: '5px 0', fontWeight: 700, color: '#7dd3fc' }}>993</td>
                      <td style={{ padding: '5px 8px', color: '#86efac' }}>✔ Marcado</td>
                      <td style={{ padding: '5px 0', color: '#e2e8f0' }}>Padrão para IMAP sobre TLS — Gmail, Outlook.com, Zoho, Exchange moderno.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #1e3a5f' }}>
                      <td style={{ padding: '5px 0', fontWeight: 700, color: '#7dd3fc' }}>143</td>
                      <td style={{ padding: '5px 8px', color: '#fca5a5' }}>✘ Desmarcado</td>
                      <td style={{ padding: '5px 0', color: '#e2e8f0' }}>IMAP sem TLS ou com STARTTLS — servidores legados ou redes internas.</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '5px 0', fontWeight: 700, color: '#7dd3fc' }}>443</td>
                      <td style={{ padding: '5px 8px', color: '#86efac' }}>✔ Marcado</td>
                      <td style={{ padding: '5px 0', color: '#e2e8f0' }}>Exchange / Microsoft 365 em redes que bloqueiam a porta 993 — usa HTTPS como túnel.</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 8, padding: '6px 8px', background: '#0f172a', borderRadius: 6, color: '#94a3b8', fontSize: 11 }}>
                  💡 Em caso de dúvida, consulte o administrador de TI ou o provedor de e-mail.
                </div>
              </HelpPopup>
            </label>
            <input style={{ ...INP, width: 80 }} type="number" value={form.imap_port}
              onChange={e => set('imap_port', e.target.value)} />
          </div>

          {/* SSL/TLS + help */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ ...LBL, display: 'flex', alignItems: 'center' }}>
              SSL/TLS
              <HelpPopup>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Criptografia da conexão</div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ color: '#86efac', fontWeight: 700 }}>✔ SSL/TLS marcado</span><br />
                  A conexão usa TLS desde o início. Use com as portas <strong>993</strong> ou <strong>443</strong>.
                  É o modo mais seguro e recomendado.
                </div>
                <div>
                  <span style={{ color: '#fca5a5', fontWeight: 700 }}>✘ Desmarcado (STARTTLS)</span><br />
                  Conecta sem criptografia e depois negocia TLS. Use com a porta <strong>143</strong>.
                  Adequado apenas em redes internas ou servidores legados.
                </div>
                <div style={{ marginTop: 8, padding: '6px 8px', background: '#0f172a', borderRadius: 6, color: '#94a3b8', fontSize: 11 }}>
                  💡 Se estiver usando porta 993 ou 443, mantenha este campo marcado.
                </div>
              </HelpPopup>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36 }}>
              <input type="checkbox" id="imap_secure" checked={form.imap_secure}
                onChange={e => set('imap_secure', e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="imap_secure" style={{ fontSize: 13, color: C.text, cursor: 'pointer' }}>
                {form.imap_secure ? 'SSL/TLS' : 'STARTTLS'}
              </label>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FieldRow label="Usuário (e-mail da caixa)">
            <input style={INP} type="email" value={form.imap_user}
              onChange={e => set('imap_user', e.target.value)} placeholder="compliance@empresa.com" />
          </FieldRow>
          <FieldRow
            label="Senha"
            hint={hasPwImap && !pwChanged.imap ? 'Senha já configurada — preencha somente para alterar.' : undefined}>
            <PasswordInput
              value={form.imap_password}
              onChange={e => { set('imap_password', e.target.value); setPwChanged(p => ({ ...p, imap: true })) }}
              placeholder={hasPwImap && !pwChanged.imap ? '••••••••  (configurada)' : 'Senha da caixa de e-mail'}
            />
          </FieldRow>
        </div>

        {/* Pasta / Label IMAP */}
        <div style={{ marginBottom: 4 }}>
          <label style={{ ...LBL, display: 'flex', alignItems: 'center' }}>
            Pasta / Label IMAP
            <HelpPopup>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Qual pasta monitorar?</div>
              <div style={{ marginBottom: 8 }}>
                Por padrão o sistema lê a <strong style={{ color: '#7dd3fc' }}>INBOX</strong> (caixa de entrada).
                Se quiser usar um label do Gmail para separar as denúncias das demais mensagens, siga os passos:
              </div>
              <ol style={{ margin: '0 0 8px', paddingLeft: 16, lineHeight: 1.8 }}>
                <li>No Gmail, crie um label chamado <strong style={{ color: '#7dd3fc' }}>Compliance</strong> (Configurações → Labels → Criar).</li>
                <li>Crie um filtro (Configurações → Filtros) que envie as mensagens de denúncia para esse label.</li>
                <li>Digite aqui o nome exato do label: <strong style={{ color: '#7dd3fc' }}>Compliance</strong></li>
              </ol>
              <div style={{ padding: '6px 8px', background: '#0f172a', borderRadius: 6, color: '#94a3b8', fontSize: 11 }}>
                💡 O nome do label é sensível a maiúsculas. Use exatamente o mesmo nome criado no Gmail.
                Para INBOX (comportamento padrão), deixe em branco ou escreva <em>INBOX</em>.
              </div>
            </HelpPopup>
          </label>
          <input
            style={INP}
            value={form.imap_mailbox}
            onChange={e => set('imap_mailbox', e.target.value)}
            placeholder="INBOX  (ou nome do label Gmail, ex: Compliance)"
          />
          {/gmail/i.test(form.imap_host) && form.imap_mailbox.trim() && form.imap_mailbox.trim() !== 'INBOX' && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
              O worker vai monitorar apenas o label <strong>"{form.imap_mailbox.trim()}"</strong> — e-mails fora desse label não serão processados.
            </div>
          )}
        </div>

        {/* Aviso Microsoft 365 / Outlook */}
        {/outlook\.|office365/i.test(form.imap_host) && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#eff6ff',
            border: '1px solid #93c5fd', borderRadius: 8, padding: '10px 13px', marginTop: 4 }}>
            <AlertCircle size={14} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.6 }}>
              <strong>Microsoft 365 / Outlook.com detectado.</strong> A Microsoft desabilitou a autenticação básica para IMAP.
              Use uma <strong>Senha de App</strong> no campo acima (não a senha normal da conta):{' '}
              <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer"
                style={{ color: '#1d4ed8', fontWeight: 700 }}>
                conta.microsoft.com → Segurança → Senhas de App
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Status da conexão + botão de teste ────────────────── */}
      <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>

          {/* Status persistido */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {connStatus === 'ok' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.green }}>
                <CheckCircle2 size={16} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Conexão OK</span>
              </div>
            )}
            {connStatus === 'erro' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.red }}>
                <AlertCircle size={16} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Falha na conexão</span>
              </div>
            )}
            {connStatus === 'desconhecido' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted }}>
                <Wifi size={16} />
                <span style={{ fontSize: 13 }}>Conexão não testada</span>
              </div>
            )}
            {connUltimaVez && (
              <span style={{ fontSize: 11, color: C.muted }}>
                · último teste {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(connUltimaVez))}
              </span>
            )}
          </div>

          {/* Botão de teste */}
          <button onClick={handleTest} disabled={testing || !exists}
            title={!exists ? 'Salve as configurações antes de testar' : 'Testar conexão com a caixa IMAP'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
              border: '1px solid ' + C.border, borderRadius: 8, background: C.white,
              color: testing ? C.muted : C.navy, fontWeight: 700, fontSize: 13,
              cursor: testing || !exists ? 'not-allowed' : 'pointer',
              opacity: !exists ? 0.5 : 1, transition: 'all 0.15s' }}>
            {testing
              ? <><Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} />Conectando…</>
              : <><Wifi size={13} />Testar conexão</>}
          </button>
        </div>

        {/* Detalhes do erro de conexão */}
        {connStatus === 'erro' && connErro && !testResult && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2',
            border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, color: C.red, wordBreak: 'break-word' }}>
            <strong>Erro registrado:</strong> {connErro}
          </div>
        )}

        {/* Resultado do teste imediato */}
        {testResult && (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, wordBreak: 'break-word',
            background: testResult.ok ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${testResult.ok ? '#86efac' : '#fecaca'}` }}>
            {testResult.ok ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} color={C.green} />
                <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
                  Conexão estabelecida com sucesso!
                </span>
                <span style={{ fontSize: 12, color: '#15803d', marginLeft: 4 }}>
                  {testResult.mensagens} mensagen{testResult.mensagens !== 1 ? 's' : ''} na caixa
                  · {testResult.naolidas} não lida{testResult.naolidas !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <AlertCircle size={14} color={C.red} />
                  <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 700 }}>Falha na conexão</span>
                </div>
                <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.5 }}>
                  {testResult.erro}
                </div>
                <div style={{ fontSize: 11, color: '#9f1239', marginTop: 6 }}>
                  Verifique: host, porta, SSL/TLS, usuário, senha e se o servidor aceita conexões externas.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SMTP ──────────────────────────────────────────────── */}
      <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
        <SectionTitle icon={Mail} label="Envio de e-mails (SMTP)" />
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px' }}>
          Usado para enviar a auto-resposta ao denunciante e as mensagens do Compliance Officer.
          Em geral é o mesmo servidor Exchange da caixa acima.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'end' }}>
          <FieldRow label="Servidor SMTP (host)">
            <input style={INP} value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)}
              placeholder="mail.empresa.com ou smtp.gmail.com" />
          </FieldRow>
          <FieldRow label="Porta">
            <input style={{ ...INP, width: 80 }} type="number" value={form.smtp_port}
              onChange={e => set('smtp_port', e.target.value)} />
          </FieldRow>
          <FieldRow label="SSL/TLS" hint="Porta 465 = SSL; 587 = STARTTLS">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36 }}>
              <input type="checkbox" id="smtp_secure" checked={form.smtp_secure}
                onChange={e => set('smtp_secure', e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="smtp_secure" style={{ fontSize: 13, color: C.text, cursor: 'pointer' }}>
                {form.smtp_secure ? 'SSL/TLS (465)' : 'STARTTLS (587)'}
              </label>
            </div>
          </FieldRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FieldRow label="Usuário SMTP">
            <input style={INP} type="email" value={form.smtp_user}
              onChange={e => set('smtp_user', e.target.value)} placeholder="compliance@empresa.com" />
          </FieldRow>
          <FieldRow
            label="Senha SMTP"
            hint={hasPwSmtp && !pwChanged.smtp ? 'Senha já configurada — preencha somente para alterar.' : undefined}>
            <PasswordInput
              value={form.smtp_password}
              onChange={e => { set('smtp_password', e.target.value); setPwChanged(p => ({ ...p, smtp: true })) }}
              placeholder={hasPwSmtp && !pwChanged.smtp ? '••••••••  (configurada)' : 'Senha do servidor SMTP'}
            />
          </FieldRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <FieldRow label="Nome do remetente (exibido no e-mail)">
            <input style={INP} value={form.smtp_from_name}
              onChange={e => set('smtp_from_name', e.target.value)} placeholder="Canal de Compliance" />
          </FieldRow>
          <FieldRow label="E-mail de envio (endereço 'De:')">
            <input style={INP} type="email" value={form.smtp_from_email}
              onChange={e => set('smtp_from_email', e.target.value)} placeholder="compliance@empresa.com" />
          </FieldRow>
        </div>
      </div>

      {/* ── FILTRO DE MENSAGENS ───────────────────────────────── */}
      <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
        <SectionTitle icon={Search} label="Filtro de mensagens" />
        <p style={{ fontSize: 12, color: C.muted, margin: '0 0 14px' }}>
          Define quais e-mails recebidos na caixa serão registrados como denúncias.
          O sistema usa três regras em sequência — a primeira que for satisfeita aceita a mensagem.
        </p>

        {/* Toggle aceitar todos */}
        <div style={{ background: C.soft, border: '1px solid ' + C.border, borderRadius: 8,
          padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Aceitar todos os e-mails</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {form.aceitar_todos
                ? 'Qualquer mensagem recebida nesta caixa será registrada como denúncia, sem filtro.'
                : 'Apenas e-mails que passarem pelo filtro de remetentes ou terminologia serão registrados.'}
            </div>
          </div>
          <button onClick={() => set('aceitar_todos', !form.aceitar_todos)}
            style={{ border: 'none', background: 'none', cursor: 'pointer',
              color: form.aceitar_todos ? C.amber : C.muted, flexShrink: 0 }}>
            {form.aceitar_todos ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>

        {!form.aceitar_todos && (
          <>
            {/* Remetentes autorizados */}
            <FieldRow
              label="Remetentes autorizados (endereços ou padrões)"
              hint='Separe por vírgula. Exemplo: naorespondabrbpo@gmail.com, compliance@empresa.com — o sistema aceita o e-mail se o campo "De:" contiver qualquer um desses padrões (busca parcial, sem distinção de maiúsculas).'>
              <input style={INP}
                value={form.filtro_remetentes}
                onChange={e => set('filtro_remetentes', e.target.value)}
                placeholder="naorespondabrbpo@gmail.com, compliance@empresa.com, brbpo compliance"
              />
            </FieldRow>

            {/* Terminologia automática */}
            <div style={{ background: C.greenBg, border: '1px solid ' + C.green, borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: '#065f46' }}>
              <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={13} />Terminologia de compliance (automática, sempre ativa)
              </div>
              <div style={{ lineHeight: 1.6 }}>
                Se nenhum remetente autorizado for encontrado, o sistema ainda aceita o e-mail se o assunto
                ou remetente contiver termos como:{' '}
                <em>compliance, denúncia, assédio, discriminação, corrupção, fraude, desvio de conduta,
                irregularidade, ética, integridade, retaliação, suborno, conflito de interesses, LGPD, violação…</em>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Ações */}
      {err && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: C.red, fontSize: 13, marginBottom: 10 }}>
          <AlertCircle size={14} />{err}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
            background: C.navy, color: 'white', border: 'none', borderRadius: 8,
            fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving
            ? <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} />Salvando…</>
            : <><Server size={14} />Salvar configurações</>}
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: C.green, fontSize: 13, fontWeight: 600 }}>
            <CheckCircle2 size={15} />Configurações salvas com sucesso!
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, padding: '12px 14px', background: C.soft, border: '1px solid ' + C.border,
        borderRadius: 8, fontSize: 12, color: C.muted }}>
        <strong style={{ color: C.text }}>Ordem de prioridade do filtro:</strong>
        <ol style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.8 }}>
          <li><strong>Aceitar todos</strong> ativado → registra tudo sem análise.</li>
          <li><strong>Remetente autorizado</strong> → aceita se o campo "De:" contiver qualquer padrão da lista.</li>
          <li><strong>Terminologia</strong> → aceita se assunto ou remetente contiver vocabulário de compliance.</li>
          <li>Nenhuma regra satisfeita → e-mail é ignorado (marcado como lido, não registrado).</li>
        </ol>
      </div>
    </div>
  )
}

// ── Painel de denúncias ───────────────────────────────────────────────────────

function DenunciasList({ profile }) {
  const [denuncias, setDenuncias]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [catFiltro, setCatFiltro]       = useState('todos')
  const [q, setQ]                       = useState('')
  const [refreshing, setRefreshing]     = useState(false)

  const fetchDenuncias = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const { data, error } = await supabase
      .from('compliance_denuncias')
      .select('id,numero,status,categoria,competencia,setor_destino,assunto,corpo_resumo,data_protocolo,prazo_resposta,parecer,responsavel_id,escritorio_id,corpo_original')
      .eq('escritorio_id', profile.escritorio_id)
      .order('data_protocolo', { ascending: false })
    if (!error) setDenuncias(data || [])
    setLoading(false)
    setRefreshing(false)
  }, [profile.escritorio_id])

  useEffect(() => { fetchDenuncias() }, [fetchDenuncias])

  const filtered = useMemo(() => {
    let rows = denuncias
    if (statusFiltro !== 'todos') rows = rows.filter(d => d.status === statusFiltro)
    if (catFiltro !== 'todos')    rows = rows.filter(d => d.categoria === catFiltro)
    if (q.trim()) {
      const ql = q.trim().toLowerCase()
      rows = rows.filter(d =>
        (d.numero || '').toLowerCase().includes(ql) ||
        (d.assunto || '').toLowerCase().includes(ql) ||
        (d.corpo_resumo || '').toLowerCase().includes(ql)
      )
    }
    return rows
  }, [denuncias, statusFiltro, catFiltro, q])

  function handleUpdated(updated) {
    setDenuncias(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
    if (selected?.id === updated.id) setSelected(s => ({ ...s, ...updated }))
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

  return (
    <>
      <DashboardCards denuncias={denuncias} />

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input style={{ ...INP, paddingLeft: 28 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por número, assunto ou conteúdo…" />
        </div>
        <select style={{ ...SEL, flex: '0 0 160px' }} value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
          <option value="todos">Todos os status</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]?.label}</option>)}
        </select>
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

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: C.white, border: '1px solid ' + C.border, borderRadius: 12 }}>
          <ShieldAlert size={36} color={C.border} style={{ display: 'block', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
            {denuncias.length === 0 ? 'Nenhuma denúncia recebida ainda.' : 'Nenhuma denúncia corresponde aos filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
            {filtered.length} denúncia{filtered.length !== 1 ? 's' : ''}
          </div>
          {filtered.map(d => (
            <DenunciaCard key={d.id} denuncia={d} onClick={() => setSelected(d)} />
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
  const [mainTab, setMainTab] = useState('denuncias')

  const tabStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: 'transparent',
    borderBottom: active ? `3px solid ${C.navy}` : '3px solid transparent',
    color: active ? C.navy : C.muted,
  })

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px' }}>
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={17} color="white" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>Canal de Compliance</h1>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Acesso restrito a gerentes</p>
        </div>
      </div>

      {/* Tabs principais */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid ' + C.border, marginBottom: 22, marginTop: 18 }}>
        <button style={tabStyle(mainTab === 'denuncias')} onClick={() => setMainTab('denuncias')}>
          <ShieldAlert size={14} />Denúncias
        </button>
        <button style={tabStyle(mainTab === 'configuracoes')} onClick={() => setMainTab('configuracoes')}>
          <Settings size={14} />Configurações de e-mail
        </button>
      </div>

      {mainTab === 'denuncias'     && <DenunciasList profile={profile} />}
      {mainTab === 'configuracoes' && <ComplianceSettings profile={profile} />}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
