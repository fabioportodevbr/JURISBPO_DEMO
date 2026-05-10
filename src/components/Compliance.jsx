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
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ShieldAlert, Search, Filter, RefreshCw, ChevronDown, ChevronRight,
  MessageSquare, Send, FileText, AlertTriangle, CheckCircle, Clock,
  Eye, Plus, X, User, Lock, Inbox, Activity, Tag, Info,
  Building, Calendar, UserCheck, ArrowRight, Loader,
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

// ── Módulo principal ──────────────────────────────────────────────────────────

export default function Compliance({ profile }) {
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
      <div style={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(0,0,0,0.1)', borderTopColor: C.navy, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: C.muted, fontSize: 13 }}>Carregando denúncias…</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 20px' }}>
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={17} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>Canal de Compliance</h1>
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Gestão de denúncias — acesso restrito a gerentes</p>
          </div>
        </div>
        <button onClick={() => fetchDenuncias(true)} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid ' + C.border,
            borderRadius: 8, background: C.white, color: C.muted, fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : {}} />
          Atualizar
        </button>
      </div>

      {/* Cards de dashboard */}
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

      {/* Modal */}
      {selected && (
        <DenunciaModal
          denuncia={selected}
          profile={profile}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
