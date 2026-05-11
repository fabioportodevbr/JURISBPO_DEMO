import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, can } from '../lib/supabase'
import { normalizeEmpresaNome, pickDefaultEmpresaGrupoId } from '../lib/empresaGrupoFilter.js'
import {
  FileText, Send, Plus, Search, Edit2, Trash2, Download,
  ChevronRight, X, Paperclip, Eye, Building2, BookOpen,
  Check, ChevronDown, ChevronUp, Upload, AlertCircle, HelpCircle, Archive,
} from 'lucide-react'

// ── Cores (mesmas do App.jsx) ─────────────────────────────────────────────
import { C as GlobalC } from '../lib/theme'
const C = {
  ...GlobalC,
  primary: GlobalC.green,
  primaryLight: GlobalC.greenBg,
  primaryMid: GlobalC.green,
  danger: GlobalC.red,
  dangerLight: GlobalC.redBg,
  warning: GlobalC.amber,
}

// ── Utilitários ───────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtTs(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('pt-BR')
}
function numSeq(numero) {
  const n = parseInt(String(numero || '').split('/')[0], 10)
  return Number.isFinite(n) ? n : 0
}
function ultimoOficio(oficios = []) {
  return [...oficios].sort((a, b) => {
    const byAno = Number(a.ano || 0) - Number(b.ano || 0)
    if (byAno) return byAno
    const bySeq = numSeq(a.numero) - numSeq(b.numero)
    if (bySeq) return bySeq
    return new Date(a.created_at || a.data || 0) - new Date(b.created_at || b.data || 0)
  }).at(-1) || null
}
function uniq(values = []) {
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function nomeEmpresaAcervo(e) {
  if (!e) return 'Empresa'
  const f = e.nome_fantasia?.trim()
  return f || e.nome || 'Empresa'
}

/** Cruza CRM (empresa do grupo) com linhas antigas de oficios_empresas pelo nome. */
function nomeLegadoCombinaCrm(crmEmpresa, nomeLegado) {
  const leg = normalizeEmpresaNome(nomeLegado)
  if (!leg) return false
  const nomes = [crmEmpresa?.nome, crmEmpresa?.nome_fantasia].map(normalizeEmpresaNome).filter(Boolean)
  for (const en of nomes) {
    if (leg === en) return true
    const lc = leg.replace(/[^a-z0-9]/g, '')
    const ec = en.replace(/[^a-z0-9]/g, '')
    if (lc && ec && lc === ec) return true
    if (lc.length >= 8 && ec.length >= 8 && (lc.includes(ec) || ec.includes(lc))) return true
  }
  return false
}

async function resolverLegacyOficiosEmpresaId(supabase, crmEmpresa) {
  if (!crmEmpresa?.id) return null
  const { data, error } = await supabase.from('oficios_empresas').select('id,nome').order('nome')
  if (error || !data?.length) return null
  const hit = data.find((row) => nomeLegadoCombinaCrm(crmEmpresa, row.nome))
  return hit?.id || null
}

/** Ofícios do ano: modelo novo (parte_grupo_id + escritório) + legado (empresa_id em oficios_empresas). */
async function carregarOficiosAnoMesclados(supabase, crmEmpresa, ano, escritorioId, legacyEmpresaId) {
  const byId = {}
  const { data: novos } = await supabase.from('oficios').select('*')
    .eq('parte_grupo_id', crmEmpresa.id)
    .eq('escritorio_id', escritorioId)
    .eq('ano', ano)
    .eq('controle_arquivado', false)
  ;(novos || []).forEach((o) => { byId[o.id] = o })

  if (legacyEmpresaId) {
    const { data: leg } = await supabase.from('oficios').select('*')
      .eq('empresa_id', legacyEmpresaId)
      .eq('ano', ano)
      .eq('controle_arquivado', false)
    ;(leg || []).forEach((o) => {
      if (!byId[o.id]) byId[o.id] = o
    })
  }
  return Object.values(byId)
}

/** Mescla CRM + legado para consultas com filtros opcionais de ano e arquivado. */
async function carregarOficiosConsultaMesclados(supabase, { crmEmpresa, escritorioId, legacyEmpresaId, anoFiltro, apenasArquivados }) {
  const mergeRows = (rows, into) => {
    ;(rows || []).forEach((o) => { if (!into[o.id]) into[o.id] = o })
  }
  const byId = {}
  let q1 = supabase.from('oficios').select('*').eq('parte_grupo_id', crmEmpresa.id).eq('escritorio_id', escritorioId)
  if (anoFiltro != null && anoFiltro !== undefined) q1 = q1.eq('ano', anoFiltro)
  if (apenasArquivados) q1 = q1.eq('controle_arquivado', true)
  else q1 = q1.eq('controle_arquivado', false)
  const { data: d1 } = await q1.order('created_at', { ascending: false })
  mergeRows(d1, byId)

  if (legacyEmpresaId) {
    let q2 = supabase.from('oficios').select('*').eq('empresa_id', legacyEmpresaId)
    if (anoFiltro != null && anoFiltro !== undefined) q2 = q2.eq('ano', anoFiltro)
    if (apenasArquivados) q2 = q2.eq('controle_arquivado', true)
    else q2 = q2.eq('controle_arquivado', false)
    const { data: d2 } = await q2.order('created_at', { ascending: false })
    mergeRows(d2, byId)
  }
  return Object.values(byId).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

// ── Audit: log de controle anual ─────────────────────────────────────────
async function logControleAcao({ escritorioId, parteGrupoId, ano, acao, profile, detalhes }) {
  try {
    await supabase.from('oficios_controle_log').insert({
      escritorio_id: escritorioId,
      parte_grupo_id: parteGrupoId,
      ano,
      acao,
      usuario_id: profile?.id,
      usuario_nome: profile?.nome || profile?.email,
      detalhes: detalhes ?? null,
    })
  } catch (e) {
    console.error('[controle-log]', e)
  }
}

// ── Modal base ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: '100%', maxWidth: wide ? 860 : 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid ' + C.border, flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, padding: 4, borderRadius: 6, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

// ── Dropdown com criação ──────────────────────────────────────────────────
function CreatableSelect({ options, value, onChange, placeholder, onCreateNew }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const canCreate = search.trim() && !options.some(o => o.toLowerCase() === search.trim().toLowerCase())

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, cursor: 'pointer', fontSize: 14, color: value ? C.text : C.muted, fontFamily: 'inherit' }}>
        <span>{value || placeholder}</span>
        <ChevronDown size={14} color={C.muted} />
      </button>
      {open && (
        <div style={{ position: 'absolute', zIndex: 200, top: '100%', marginTop: 4, width: '100%', background: C.white, border: '1px solid ' + C.border, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <div style={{ padding: 8 }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ou digitar novo..."
              style={{ width: '100%', padding: '6px 10px', border: '1px solid ' + C.border, borderRadius: 6, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map(opt => (
              <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); setSearch('') }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', background: value === opt ? C.primaryLight : 'none', color: value === opt ? C.primary : C.text, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>
                {opt}
              </button>
            ))}
            {canCreate && (
              <button type="button" onClick={() => { onCreateNew(search.trim()); onChange(search.trim()); setOpen(false); setSearch('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '8px 14px', border: 'none', borderTop: '1px solid ' + C.border, background: 'none', color: C.primaryMid, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                <Plus size={13} /> Adicionar "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Campo label ───────────────────────────────────────────────────────────
function Field({ label, children, required }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}{required && <span style={{ color: C.danger, marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}
const inp = { width: '100%', padding: '8px 12px', border: '1px solid '+C.border, borderRadius: 8, fontSize: 14, color: C.text, outline: 'none', background: C.white, boxSizing: 'border-box', fontFamily: 'inherit' }

// ── Modal: Novo / Editar Ofício ───────────────────────────────────────────
function OficioModal({ oficio, empresa, destinatarios, opcoes, numeroSugerido, onSave, onClose, profile, anoControle }) {
  const isEdit = !!oficio
  const [form, setForm] = useState({
    numero:       oficio?.numero       || numeroSugerido || '',
    departamento: oficio?.departamento || '',
    responsavel:  oficio?.responsavel  || '',
    data:         oficio?.data         || new Date().toISOString().split('T')[0],
    destinatario: oficio?.destinatario || '',
    referencia:   oficio?.referencia   || '',
    remetente:    oficio?.remetente    || '',
    forma_envio:  oficio?.forma_envio  || '',
    arquivado:    oficio?.arquivado    || '',
    observacoes:  oficio?.observacoes  || '',
  })
  const [destOpts, setDestOpts] = useState(destinatarios.map(d => d.nome))
  const [localOpts, setLocalOpts] = useState({
    departamentos: opcoes?.departamentos || [],
    responsaveis: opcoes?.responsaveis || [],
    remetentes: opcoes?.remetentes || [],
    formasEnvio: opcoes?.formasEnvio || [],
  })
  const [files, setFiles] = useState([])
  const [existingAnexos, setExistingAnexos] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!isEdit || !oficio?.id) return
    supabase.from('oficios_anexos').select('*').eq('oficio_id', oficio.id).order('created_at', { ascending: true })
      .then(({ data }) => setExistingAnexos(data || []))
  }, [isEdit, oficio?.id])

  async function deleteAnexo(anexo) {
    if (!confirm(`Excluir o arquivo "${anexo.nome_arquivo}"?`)) return
    const { error } = await supabase.from('oficios_anexos').delete().eq('id', anexo.id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    setExistingAnexos(prev => prev.filter(a => a.id !== anexo.id))
  }

  async function addDestinatario(nome) {
    await supabase.from('oficios_destinatarios').insert({
      parte_grupo_id: empresa.id,
      escritorio_id: profile?.escritorio_id,
      nome,
    })
    setDestOpts(prev => [...prev, nome].sort())
  }
  function addLocalOption(key, nome) {
    setLocalOpts(prev => ({ ...prev, [key]: uniq([...(prev[key] || []), nome]) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.numero || !form.destinatario || !form.data) { setErr('Preencha Número, Destinatário e Data.'); return }
    setSaving(true)
    try {
      const anoDoc = isEdit ? (oficio.ano ?? new Date(oficio.data).getFullYear()) : anoControle
      const payload = {
        ...form,
        empresa_id: null,
        parte_grupo_id: empresa.id,
        escritorio_id: profile?.escritorio_id,
        ano: anoDoc,
        controle_arquivado: false,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
        updated_by_nome: profile?.nome || profile?.email,
      }
      let ofId = oficio?.id, action = 'editado'
      if (isEdit) {
        await supabase.from('oficios').update(payload).eq('id', oficio.id)
      } else {
        payload.created_by = profile?.id; payload.created_by_nome = profile?.nome || profile?.email
        const { data } = await supabase.from('oficios').insert(payload).select().single()
        ofId = data.id; action = 'criado'
      }
      await supabase.from('oficios_auditoria').insert({
        oficio_id: ofId,
        empresa_id: empresa.id,
        parte_grupo_id: empresa.id,
        escritorio_id: profile?.escritorio_id,
        numero_oficio: form.numero,
        acao: action,
        usuario_id: profile?.id,
        usuario_nome: profile?.nome || profile?.email,
        dados_json: payload,
      })
      for (const file of files) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = ev => resolve(ev.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const { error: anexoErr } = await supabase.from('oficios_anexos').insert({
          oficio_id: ofId,
          nome_arquivo: file.name,
          arquivo_base64: base64,
          arquivo_tipo: file.type || 'application/octet-stream',
          created_by: profile?.id,
          created_by_nome: profile?.nome || profile?.email,
        })
        if (anexoErr) throw new Error('Erro ao salvar anexo "' + file.name + '": ' + anexoErr.message)
      }
      onSave()
    } catch (e2) { setErr('Erro ao salvar: ' + e2.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? `Editar — ${oficio.numero}` : `Novo Ofício — ${nomeEmpresaAcervo(empresa)}`} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Número" required><input style={inp} value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="ex: 124/2026" /></Field>
          <Field label="Data" required><input type="date" style={inp} value={form.data} onChange={e => set('data', e.target.value)} /></Field>
        </div>
        <Field label="Órgão de Destino" required>
          <CreatableSelect options={destOpts} value={form.destinatario} onChange={v => set('destinatario', v)} placeholder="Selecionar ou adicionar..." onCreateNew={addDestinatario} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Departamento"><CreatableSelect options={localOpts.departamentos} value={form.departamento} onChange={v => set('departamento', v)} placeholder="Selecionar ou adicionar..." onCreateNew={v => addLocalOption('departamentos', v)} /></Field>
          <Field label="Responsável pelo Ofício"><CreatableSelect options={localOpts.responsaveis} value={form.responsavel} onChange={v => set('responsavel', v)} placeholder="Selecionar ou adicionar..." onCreateNew={v => addLocalOption('responsaveis', v)} /></Field>
        </div>
        <Field label="Referência / Assunto">
          <textarea style={{ ...inp, resize: 'none', height: 68 }} value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="Assunto do ofício..." />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Remetente Responsável pelo Envio"><CreatableSelect options={localOpts.remetentes} value={form.remetente} onChange={v => set('remetente', v)} placeholder="Selecionar ou adicionar..." onCreateNew={v => addLocalOption('remetentes', v)} /></Field>
          <Field label="Forma de Envio"><CreatableSelect options={localOpts.formasEnvio} value={form.forma_envio} onChange={v => set('forma_envio', v)} placeholder="Selecionar ou adicionar..." onCreateNew={v => addLocalOption('formasEnvio', v)} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Arquivado na Pasta?">
            <CreatableSelect options={['SIM', 'NÃO']} value={form.arquivado} onChange={v => set('arquivado', v)} placeholder="SIM / NÃO" onCreateNew={() => {}} />
          </Field>
          <Field label="Observações"><input style={inp} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} /></Field>
        </div>
        <Field label="Documentos Anexos">
          {isEdit && existingAnexos.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Arquivos já anexados ({existingAnexos.length})
              </div>
              {existingAnexos.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: C.bg, border: '1px solid ' + C.border, borderRadius: 6, padding: '7px 10px', marginBottom: 4 }}>
                  <Paperclip size={12} color={C.primary} />
                  {a.arquivo_base64
                    ? <a href={`data:${a.arquivo_tipo || 'application/octet-stream'};base64,${a.arquivo_base64}`} download={a.nome_arquivo}
                        style={{ flex: 1, color: C.primary, fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.nome_arquivo}
                      </a>
                    : <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome_arquivo}</span>
                  }
                  {a.arquivo_base64 && (
                    <a href={`data:${a.arquivo_tipo || 'application/octet-stream'};base64,${a.arquivo_base64}`} download={a.nome_arquivo}
                      title="Baixar" style={{ color: C.muted, display: 'flex', padding: 2 }}>
                      <Download size={13} />
                    </a>
                  )}
                  <button type="button" onClick={() => deleteAnexo(a)} title="Excluir este arquivo"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.danger, display: 'flex', padding: 2 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {isEdit && existingAnexos.length === 0 && (
            <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px' }}>Nenhum arquivo anexado ainda.</p>
          )}
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed ' + C.border, borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
            <Upload size={18} color={C.muted} style={{ display: 'block', margin: '0 auto 4px' }} />
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{isEdit ? 'Clique para adicionar novos arquivos' : 'Clique para selecionar arquivos'}</p>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files))} />
          </div>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, background: C.greenBg, border: '1px solid ' + C.primaryLight, borderRadius: 6, padding: '6px 10px', marginTop: 4 }}>
              <Paperclip size={12} color={C.primary} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>novo</span>
              <button type="button" onClick={() => setFiles(ff => ff.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 0 }}><X size={13} /></button>
            </div>
          ))}
        </Field>
        {err && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.dangerLight, border: '1px solid '+C.border, borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13 }}><AlertCircle size={14} />{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: C.primary, color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar ofício'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal: Ver Anexos de um Ofício ────────────────────────────────────────
function AnexosOficioModal({ oficio, onClose }) {
  const [anexos, setAnexos] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('oficios_anexos').select('*').eq('oficio_id', oficio.id).order('created_at', { ascending: true })
      .then(({ data }) => { setAnexos(data || []); setLoading(false) })
  }, [oficio.id])
  return (
    <Modal title={`Anexos — Ofício ${oficio.numero}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <p style={{ color: C.muted, fontSize: 14 }}>Carregando...</p>}
        {!loading && anexos.length === 0 && <p style={{ color: C.muted, fontSize: 14, textAlign: 'center', padding: 24 }}>Nenhum anexo para este ofício.</p>}
        {anexos.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.bg, borderRadius: 8, padding: '10px 14px', border: '1px solid ' + C.border }}>
            <Paperclip size={14} color={C.muted} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome_arquivo}</span>
            {a.arquivo_base64
              ? <a href={`data:${a.arquivo_tipo || 'application/octet-stream'};base64,${a.arquivo_base64}`} download={a.nome_arquivo}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: 'none', borderRadius: 6, background: C.primary, color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  <Download size={12} />Baixar
                </a>
              : <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>indisponível</span>}
            {a.created_by_nome && <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{a.created_by_nome}</span>}
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Modal: Consultar Todos ────────────────────────────────────────────────
function ConsultarModal({ empresa, escritorioId, legacyEmpresaId, onClose, profile, onEdit, canEdit, readOnly, anoFiltro, apenasArquivados }) {
  const [oficios, setOficios] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [anexos, setAnexos] = useState([])
  const [auditoria, setAuditoria] = useState([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const merged = await carregarOficiosConsultaMesclados(supabase, {
      crmEmpresa: empresa,
      escritorioId,
      legacyEmpresaId,
      anoFiltro,
      apenasArquivados,
    })
    setOficios(merged); setLoading(false)
  }, [empresa, escritorioId, legacyEmpresaId, anoFiltro, apenasArquivados])
  useEffect(() => { fetchAll() }, [fetchAll])

  async function selectOficio(of) {
    setSelected(of)
    const [{ data: a }, { data: au }] = await Promise.all([
      supabase.from('oficios_anexos').select('*').eq('oficio_id', of.id),
      supabase.from('oficios_auditoria').select('*').eq('oficio_id', of.id).order('timestamp', { ascending: false }),
    ])
    setAnexos(a || []); setAuditoria(au || [])
  }

  const filtered = oficios.filter(o => (o.numero + o.destinatario + o.referencia + o.responsavel + o.departamento).toLowerCase().includes(search.toLowerCase()))

  const tituloBase = readOnly && anoFiltro != null ? `Arquivo ${anoFiltro} — ${nomeEmpresaAcervo(empresa)}` : `Todos os Ofícios — ${nomeEmpresaAcervo(empresa)}`
  return (
    <Modal title={tituloBase} onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 20, minHeight: 440 }}>
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} color={C.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inp, paddingLeft: 30 }} />
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{filtered.length} registro(s)</div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, maxHeight: 380 }}>
            {loading ? <p style={{ color: C.muted, fontSize: 13 }}>Carregando...</p>
              : filtered.map(of => (
              <button key={of.id} onClick={() => selectOficio(of)}
                style={{ textAlign: 'left', border: '1px solid ' + (selected?.id === of.id ? C.primary : C.border), borderRadius: 8, padding: '10px 12px', background: selected?.id === of.id ? C.primaryLight : C.white, cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: C.primary }}>{of.numero}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(of.data)}</span>
                </div>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{of.destinatario}</div>
                <div style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{of.referencia}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: '1px solid ' + C.border, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: 440 }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 14 }}>← Selecione um ofício</div>
          ) : (<>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: C.primary }}>{selected.numero}</span>
              {canEdit && !readOnly && <button onClick={() => { onEdit(selected); onClose() }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}><Edit2 size={13} />Editar</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Data', fmtDate(selected.data)], ['Departamento', selected.departamento], ['Responsável', selected.responsavel], ['Remetente', selected.remetente], ['Forma de Envio', selected.forma_envio], ['Arquivado', selected.arquivado]].map(([k, v]) => (
                <div key={k}><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k}</div><div style={{ fontSize: 14, color: C.text }}>{v || '—'}</div></div>
              ))}
            </div>
            {selected.referencia && <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Referência / Assunto</div><div style={{ fontSize: 14, color: C.text, background: C.bg, borderRadius: 8, padding: '10px 14px', lineHeight: 1.5 }}>{selected.referencia}</div></div>}
            {selected.observacoes && <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Observações</div><div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{selected.observacoes}</div></div>}
            {anexos.length > 0 && <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Anexos ({anexos.length})</div>
              {anexos.map(a => (
                a.arquivo_base64
                  ? <a key={a.id} href={`data:${a.arquivo_tipo || 'application/octet-stream'};base64,${a.arquivo_base64}`} download={a.nome_arquivo}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.primary, background: C.primaryLight, borderRadius: 6, padding: '6px 10px', textDecoration: 'none', fontWeight: 600, marginBottom: 4 }}>
                      <Paperclip size={12} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome_arquivo}</span><Download size={12} />
                    </a>
                  : <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted, background: C.bg, borderRadius: 6, padding: '6px 10px', marginBottom: 4 }}>
                      <Paperclip size={12} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome_arquivo}</span>
                    </div>
              ))}
            </div>}
            {auditoria.length > 0 && <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Histórico</div><div style={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>{auditoria.map(a => <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: C.bg, borderRadius: 6, padding: '5px 10px' }}><span style={{ fontWeight: 700, color: a.acao === 'excluído' ? C.danger : a.acao === 'criado' ? C.primaryMid : C.warning }}>{a.acao}</span><span style={{ color: C.muted }}>por</span><span style={{ color: C.text, fontWeight: 600 }}>{a.usuario_nome || '—'}</span><span style={{ marginLeft: 'auto', color: C.muted }}>{fmtTs(a.timestamp)}</span></div>)}</div></div>}
          </>)}
        </div>
      </div>
    </Modal>
  )
}

// ── Modal: Controles arquivados com histórico e reabertura ───────────────
const CONTROLE_ACAO_LABEL = {
  controle_arquivado:    'Arquivado',
  controle_desarquivado: 'Reaberto para edição',
}
const CONTROLE_ACAO_COLOR = {
  controle_arquivado:    '#92400e',
  controle_desarquivado: '#1e40af',
}
const CONTROLE_ACAO_BG = {
  controle_arquivado:    '#fef3c7',
  controle_desarquivado: '#dbeafe',
}

function AnosArquivadosModal({ empresa, escritorioId, legacyEmpresaId, profile, canEdit, onClose, onPickAno, onDesarquivar, onReArquivar }) {
  const [anosData, setAnosData] = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null) // ano cujo log está aberto

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: logData }, { data: d1 }] = await Promise.all([
        supabase.from('oficios_controle_log')
          .select('ano, acao, usuario_nome, criado_em')
          .eq('escritorio_id', escritorioId)
          .eq('parte_grupo_id', empresa.id)
          .order('criado_em', { ascending: false }),
        supabase.from('oficios')
          .select('ano')
          .eq('parte_grupo_id', empresa.id)
          .eq('escritorio_id', escritorioId)
          .eq('controle_arquivado', true),
      ])
      let d2 = []
      if (legacyEmpresaId) {
        const { data } = await supabase.from('oficios').select('ano').eq('empresa_id', legacyEmpresaId).eq('controle_arquivado', true)
        d2 = data || []
      }
      const arquivSet = new Set([...(d1 || []), ...d2].map(r => r.ano).filter(v => v != null))
      const logByAno = {}
      for (const e of (logData || [])) {
        if (e.ano == null) continue
        if (!logByAno[e.ano]) logByAno[e.ano] = []
        logByAno[e.ano].push(e)
      }
      const allAnos = new Set([...arquivSet, ...Object.keys(logByAno).map(Number)])
      const result = [...allAnos].map(ano => {
        const entries = logByAno[ano] || []
        const latest  = entries[0]?.acao ?? null
        let status
        if (arquivSet.has(ano)) status = 'arquivado'
        else if (latest === 'controle_desarquivado') status = 'reaberto'
        else return null
        return { ano, status, entries }
      }).filter(Boolean).sort((a, b) => b.ano - a.ano)
      setAnosData(result)
    } finally { setLoading(false) }
  }, [empresa.id, escritorioId, legacyEmpresaId])

  useEffect(() => { loadData() }, [loadData])

  return (
    <Modal title={`Controles de anos anteriores — ${nomeEmpresaAcervo(empresa)}`} onClose={onClose} wide>
      <p style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
        Histórico de controles arquivados. Você pode reabrir um ano para retificações e re-arquivá-lo quando concluir.
      </p>
      {loading ? <p style={{ color: C.muted }}>Carregando...</p>
       : anosData.length === 0 ? <p style={{ color: C.muted }}>Nenhum controle arquivado para esta empresa.</p>
       : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {anosData.map(({ ano, status, entries }) => {
            const isExp = expanded === ano
            const latestEntry = entries[0]
            return (
              <div key={ano} style={{ border: '1px solid ' + C.border, borderRadius: 10, overflow: 'hidden' }}>
                {/* ── cabeçalho do ano ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: C.bg, gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Ano {ano}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: status === 'arquivado' ? '#fef3c7' : '#dbeafe',
                      color:      status === 'arquivado' ? '#92400e' : '#1e40af' }}>
                      {status === 'arquivado' ? 'Arquivado' : 'Reaberto'}
                    </span>
                    {latestEntry && (
                      <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {CONTROLE_ACAO_LABEL[latestEntry.acao] ?? latestEntry.acao}
                        {' — '}{fmtTs(latestEntry.criado_em)}
                        {' — '}{latestEntry.usuario_nome || '—'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button type="button" onClick={() => onPickAno(ano, status)}
                      style={{ padding: '5px 12px', border: '1px solid ' + C.border, borderRadius: 7, background: C.white, color: C.text, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      {status === 'reaberto' ? 'Editar ofícios' : 'Ver ofícios'}
                    </button>
                    {canEdit && status === 'arquivado' && (
                      <button type="button" onClick={() => onDesarquivar(ano, loadData)}
                        style={{ padding: '5px 12px', border: '1px solid #bfdbfe', borderRadius: 7, background: '#eff6ff', color: '#1e40af', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                        Reabrir
                      </button>
                    )}
                    {canEdit && status === 'reaberto' && (
                      <button type="button" onClick={() => onReArquivar(ano, loadData)}
                        style={{ padding: '5px 12px', border: '1px solid #a7f3d0', borderRadius: 7, background: '#ecfdf5', color: '#065f46', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                        Re-arquivar
                      </button>
                    )}
                    {entries.length > 0 && (
                      <button type="button" onClick={() => setExpanded(isExp ? null : ano)}
                        title={isExp ? 'Fechar histórico' : 'Ver histórico completo'}
                        style={{ padding: '5px 8px', border: '1px solid ' + C.border, borderRadius: 7, background: C.white, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    )}
                  </div>
                </div>
                {/* ── log expandido ── */}
                {isExp && (
                  <div style={{ padding: '10px 16px', borderTop: '1px solid ' + C.border, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Histórico do controle</div>
                    {entries.map((e, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 10px', background: C.bg, borderRadius: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: CONTROLE_ACAO_COLOR[e.acao] ?? C.muted }} />
                        <span style={{ fontWeight: 700, color: CONTROLE_ACAO_COLOR[e.acao] ?? C.muted }}>
                          {CONTROLE_ACAO_LABEL[e.acao] ?? e.acao}
                        </span>
                        <span style={{ color: C.muted }}>por</span>
                        <span style={{ color: C.text, fontWeight: 600 }}>{e.usuario_nome || '—'}</span>
                        <span style={{ marginLeft: 'auto', color: C.muted, whiteSpace: 'nowrap' }}>{fmtTs(e.criado_em)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>}
    </Modal>
  )
}

// ── Modal: Todos os Modelos ───────────────────────────────────────────────
function TodosModelosModal({ modelos, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = modelos.filter(m => (m.nome + (m.tipo || '') + (m.area || '')).toLowerCase().includes(search.toLowerCase()))
  return (
    <Modal title="Todos os Modelos" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} color={C.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modelos..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>{filtered.length} modelo(s)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: 480 }}>
          {filtered.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: C.bg, borderRadius: 8, border: '1px solid ' + C.border }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.nome}</span>
                  {m.tipo && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: C.border, color: C.muted }}>{m.tipo}</span>}
                  {m.area && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, background: C.primaryLight, color: C.primary, fontWeight: 600 }}>{m.area}</span>}
                </div>
                {m.descricao && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{m.descricao}</div>}
                {m.arquivo_nome && (m.arquivo_base64
                  ? <a href={`data:${m.arquivo_tipo||'application/octet-stream'};base64,${m.arquivo_base64}`} download={m.arquivo_nome} style={{ fontSize: 11, color: C.primary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 700 }}><Paperclip size={10} />{m.arquivo_nome}</a>
                  : <div style={{ fontSize: 11, color: C.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={10} />{m.arquivo_nome}</div>)}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginLeft: 16, whiteSpace: 'nowrap' }}>{m.updated_at ? fmtDate(m.updated_at.split('T')[0]) : '—'}</div>
            </div>
          ))}
          {filtered.length === 0 && <p style={{ color: C.muted, fontSize: 14, textAlign: 'center', padding: 24 }}>Nenhum modelo encontrado.</p>}
        </div>
      </div>
    </Modal>
  )
}

// ── Componente Principal ──────────────────────────────────────────────────
function ModeloUploadModal({ profile, onSave, onClose }) {
  const [form, setForm] = useState({ nome: '', tipo: '', area: '', descricao: '' })
  const [files, setFiles] = useState([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) { setErr('Informe o nome do modelo.'); return }
    if (!files.length) { setErr('Anexe ao menos um arquivo.'); return }
    setSaving(true); setErr('')
    try {
      for (const file of files) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = ev => resolve(ev.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const { error } = await supabase.from('acervo_modelos').insert({
          escritorio_id: profile?.escritorio_id,
          nome: files.length > 1 ? `${form.nome.trim()} — ${file.name}` : form.nome.trim(),
          tipo: form.tipo || null,
          area: form.area || null,
          descricao: form.descricao || null,
          arquivo_nome: file.name,
          arquivo_tipo: file.type,
          arquivo_tamanho: file.size,
          arquivo_base64: base64,
          created_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        if (error) throw error
      }
      onSave()
    } catch (e2) { setErr('Erro ao anexar modelo: ' + (e2?.message || e2)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Anexar modelo" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Nome do modelo" required><input autoFocus style={inp} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="ex: Ofício de resposta ao órgão" /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Tipo"><input style={inp} value={form.tipo} onChange={e => set('tipo', e.target.value)} placeholder="ex: Ofício" /></Field>
          <Field label="Área"><input style={inp} value={form.area} onChange={e => set('area', e.target.value)} placeholder="ex: Jurídico" /></Field>
        </div>
        <Field label="Descrição"><textarea style={{ ...inp, resize: 'none', height: 70 }} value={form.descricao} onChange={e => set('descricao', e.target.value)} placeholder="Observações sobre uso do modelo..." /></Field>
        <Field label="Arquivo do modelo" required>
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed ' + C.border, borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
            <Upload size={18} color={C.muted} style={{ display: 'block', margin: '0 auto 4px' }} />
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Clique para selecionar arquivos</p>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files || []))} />
          </div>
          {files.map((f, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, background: C.bg, borderRadius: 6, padding: '6px 10px', marginTop: 4 }}><Paperclip size={12} color={C.muted} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span><button type="button" onClick={() => setFiles(ff => ff.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 0 }}><X size={13} /></button></div>)}
        </Field>
        {err && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.dangerLight, border: '1px solid '+C.border, borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13 }}><AlertCircle size={14} />{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: C.primary, color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>{saving ? 'Anexando...' : 'Anexar modelo'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Acervo({ profile }) {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('oficios')
  const [modelos, setModelos] = useState([])
  const [loadingModelos, setLoadingModelos] = useState(true)
  const [showTodosModelos, setShowTodosModelos] = useState(false)
  const [showUploadModelo, setShowUploadModelo] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [selectedEmpresa, setSelectedEmpresa] = useState(null)
  const [anoVigente, setAnoVigente] = useState(() => new Date().getFullYear())
  const [oficiosList, setOficiosList] = useState([])
  const [destinatarios, setDestinatarios] = useState([])
  const [opcoesOficios, setOpcoesOficios] = useState({ departamentos: [], responsaveis: [], remetentes: [], formasEnvio: [] })
  const [loadingOficios, setLoadingOficios] = useState(false)
  const [showNovoOficio, setShowNovoOficio] = useState(false)
  const [showConsultar, setShowConsultar] = useState(false)
  const [showHelpNovaEmpresa, setShowHelpNovaEmpresa] = useState(false)
  const [showEncerrarModal, setShowEncerrarModal] = useState(false)
  const [showAnosArquivados, setShowAnosArquivados] = useState(false)
  const [consultarArquivadoAno, setConsultarArquivadoAno] = useState(null)
  const [consultarReabertoAno, setConsultarReabertoAno] = useState(null)
  const [editingOficio, setEditingOficio] = useState(null)
  const [anexosOficio, setAnexosOficio] = useState(null)
  const [sortCol, setSortCol] = useState('numero')
  const [sortDir, setSortDir] = useState('asc')
  const canEdit = can(profile, 'docs.upload')
  const canDelete = can(profile, 'docs.excluir')

  const fetchModelos = useCallback(() => {
    setLoadingModelos(true)
    supabase.from('acervo_modelos').select('*').eq('escritorio_id', profile.escritorio_id).order('updated_at', { ascending: false })
      .then(({ data }) => { setModelos(data || []); setLoadingModelos(false) })
  }, [profile.escritorio_id])

  useEffect(() => { fetchModelos() }, [fetchModelos])

  useEffect(() => {
    if (!profile?.escritorio_id) return
    supabase.from('partes_crm').select('id,nome,nome_fantasia').eq('escritorio_id', profile.escritorio_id).eq('tipo', 'empresa_grupo').eq('status', 'ativo').order('nome')
      .then(({ data }) => {
        const list = data || []
        setEmpresas(list)
        setSelectedEmpresa(prev => {
          if (prev && list.some(x => x.id === prev.id)) return prev
          if (!list.length) return null
          const preferId = pickDefaultEmpresaGrupoId(list)
          return list.find(x => String(x.id) === String(preferId)) || list[0]
        })
      })
  }, [profile?.escritorio_id])

  useEffect(() => {
    if (!selectedEmpresa?.id || !profile?.escritorio_id) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('oficios_controle_ano').select('ano_vigente').eq('escritorio_id', profile.escritorio_id).eq('parte_grupo_id', selectedEmpresa.id).maybeSingle()
      if (cancelled) return
      const cy = new Date().getFullYear()
      setAnoVigente(typeof data?.ano_vigente === 'number' ? data.ano_vigente : cy)
    })()
    return () => { cancelled = true }
  }, [selectedEmpresa?.id, profile?.escritorio_id])

  useEffect(() => {
    setConsultarArquivadoAno(null)
    setShowAnosArquivados(false)
    setShowHelpNovaEmpresa(false)
  }, [selectedEmpresa?.id])

  const [legacyOficiosEmpresaId, setLegacyOficiosEmpresaId] = useState(null)

  useEffect(() => {
    if (!selectedEmpresa) {
      setLegacyOficiosEmpresaId(null)
      return
    }
    let cancelled = false
    resolverLegacyOficiosEmpresaId(supabase, selectedEmpresa).then((id) => {
      if (!cancelled) setLegacyOficiosEmpresaId(id)
    })
    return () => { cancelled = true }
  }, [selectedEmpresa])

  const refreshOficiosPainel = useCallback(async () => {
    if (!selectedEmpresa || !profile?.escritorio_id || !anoVigente) return
    setLoadingOficios(true)
    try {
      const rows = await carregarOficiosAnoMesclados(supabase, selectedEmpresa, anoVigente, profile.escritorio_id, legacyOficiosEmpresaId)
      setOficiosList(rows)
      setOpcoesOficios({
        departamentos: uniq(rows.map(x => x.departamento)),
        responsaveis: uniq(rows.map(x => x.responsavel)),
        remetentes: uniq(rows.map(x => x.remetente)),
        formasEnvio: uniq(rows.map(x => x.forma_envio)),
      })
    } finally {
      setLoadingOficios(false)
    }
  }, [selectedEmpresa, anoVigente, profile?.escritorio_id, legacyOficiosEmpresaId])

  useEffect(() => {
    refreshOficiosPainel()
  }, [refreshOficiosPainel])

  useEffect(() => {
    if (!selectedEmpresa || !profile?.escritorio_id) return
    ;(async () => {
      const { data: d1 } = await supabase.from('oficios_destinatarios').select('*').eq('parte_grupo_id', selectedEmpresa.id).eq('escritorio_id', profile.escritorio_id).order('nome')
      let list = d1 || []
      if (legacyOficiosEmpresaId) {
        const { data: d2 } = await supabase.from('oficios_destinatarios').select('*').eq('empresa_id', legacyOficiosEmpresaId).order('nome')
        const seen = new Set(list.map(x => String(x.nome || '').toLowerCase()))
        ;(d2 || []).forEach((x) => {
          const k = String(x.nome || '').toLowerCase()
          if (k && !seen.has(k)) { seen.add(k); list.push(x) }
        })
      }
      list.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      setDestinatarios(list)
    })()
  }, [selectedEmpresa, profile?.escritorio_id, legacyOficiosEmpresaId])

  function nextNumero() {
    const nums = oficiosList.map(o => numSeq(o.numero)).filter(n => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${String(next).padStart(3, '0')}/${anoVigente}`
  }

  async function confirmEncerrarControleAnual() {
    if (!canEdit) {
      alert('Apenas usuários com permissão para incluir ou editar documentos podem arquivar o controle anual.')
      setShowEncerrarModal(false)
      return
    }
    if (!selectedEmpresa || !profile?.escritorio_id || !anoVigente) return

    // Regra de segurança: só é possível arquivar após 1º de janeiro do ano seguinte
    const hoje = new Date()
    const limiteArquivamento = new Date(anoVigente + 1, 0, 1) // Jan 1 do próximo ano
    if (hoje < limiteArquivamento) {
      alert(
        `O controle de ${anoVigente} só pode ser arquivado a partir de 1º de janeiro de ${anoVigente + 1}.\n\n` +
        `Aguarde o encerramento do ano corrente para realizar esta operação.`
      )
      setShowEncerrarModal(false)
      return
    }

    const y = anoVigente
    const { error: upErr } = await supabase.from('oficios').update({ controle_arquivado: true })
      .eq('parte_grupo_id', selectedEmpresa.id)
      .eq('escritorio_id', profile.escritorio_id)
      .eq('ano', y)
      .eq('controle_arquivado', false)
    if (upErr) {
      alert('Erro ao arquivar: ' + upErr.message)
      setShowEncerrarModal(false)
      return
    }
    if (legacyOficiosEmpresaId) {
      const { error: legErr } = await supabase.from('oficios').update({ controle_arquivado: true })
        .eq('empresa_id', legacyOficiosEmpresaId)
        .eq('ano', y)
        .eq('controle_arquivado', false)
      if (legErr) console.warn('Arquivo legado:', legErr.message)
    }
    const prox = y + 1
    const { error: cfgErr } = await supabase.from('oficios_controle_ano').upsert({
      escritorio_id: profile.escritorio_id,
      parte_grupo_id: selectedEmpresa.id,
      ano_vigente: prox,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'escritorio_id,parte_grupo_id' })
    if (cfgErr) {
      alert('Ofícios arquivados, mas falhou ao registrar o novo ano vigente: ' + cfgErr.message)
    }
    // Registra no histórico de controle
    await logControleAcao({
      escritorioId: profile.escritorio_id,
      parteGrupoId: selectedEmpresa.id,
      ano: y,
      acao: 'controle_arquivado',
      profile,
      detalhes: { proximo_ano: prox, total_oficios: oficiosList.length },
    })

    setAnoVigente(prox)
    setShowEncerrarModal(false)
    const rows = await carregarOficiosAnoMesclados(supabase, selectedEmpresa, prox, profile.escritorio_id, legacyOficiosEmpresaId)
    setOficiosList(rows)
    setOpcoesOficios({
      departamentos: uniq(rows.map(x => x.departamento)),
      responsaveis: uniq(rows.map(x => x.responsavel)),
      remetentes: uniq(rows.map(x => x.remetente)),
      formasEnvio: uniq(rows.map(x => x.forma_envio)),
    })
  }

  // ── Reabrir controle de ano arquivado ───────────────────────────────────
  async function confirmarDesarquivar(ano, onRefresh) {
    if (!canEdit) { alert('Sem permissão para esta operação.'); return }
    if (!confirm(
      `Reabrir o controle de ofícios de ${ano} para edição?\n\n` +
      `Os ofícios de ${ano} poderão ser consultados e editados na seção "Controles de anos anteriores".\n` +
      `O ano vigente (${anoVigente}) não será alterado.`
    )) return

    const { error } = await supabase.from('oficios').update({ controle_arquivado: false })
      .eq('parte_grupo_id', selectedEmpresa.id)
      .eq('escritorio_id', profile.escritorio_id)
      .eq('ano', ano)
      .eq('controle_arquivado', true)
    if (error) { alert('Erro ao reabrir controle: ' + error.message); return }

    if (legacyOficiosEmpresaId) {
      await supabase.from('oficios').update({ controle_arquivado: false })
        .eq('empresa_id', legacyOficiosEmpresaId)
        .eq('ano', ano)
        .eq('controle_arquivado', true)
    }

    await logControleAcao({
      escritorioId: profile.escritorio_id,
      parteGrupoId: selectedEmpresa.id,
      ano,
      acao: 'controle_desarquivado',
      profile,
      detalhes: { ano_ativo: anoVigente },
    })
    onRefresh?.()
  }

  // ── Re-arquivar controle reaberto ────────────────────────────────────────
  async function confirmarReArquivar(ano, onRefresh) {
    if (!canEdit) { alert('Sem permissão para esta operação.'); return }

    const hoje = new Date()
    if (hoje < new Date(ano + 1, 0, 1)) {
      alert(`O controle de ${ano} só pode ser arquivado a partir de 1º de janeiro de ${ano + 1}.`)
      return
    }
    if (!confirm(
      `Re-arquivar o controle de ofícios de ${ano}?\n\n` +
      `Os ofícios de ${ano} voltarão para somente leitura no histórico.`
    )) return

    const { error } = await supabase.from('oficios').update({ controle_arquivado: true })
      .eq('parte_grupo_id', selectedEmpresa.id)
      .eq('escritorio_id', profile.escritorio_id)
      .eq('ano', ano)
      .eq('controle_arquivado', false)
    if (error) { alert('Erro ao re-arquivar: ' + error.message); return }

    if (legacyOficiosEmpresaId) {
      await supabase.from('oficios').update({ controle_arquivado: true })
        .eq('empresa_id', legacyOficiosEmpresaId)
        .eq('ano', ano)
        .eq('controle_arquivado', false)
    }

    await logControleAcao({
      escritorioId: profile.escritorio_id,
      parteGrupoId: selectedEmpresa.id,
      ano,
      acao: 'controle_arquivado',
      profile,
      detalhes: { re_arquivamento: true },
    })
    onRefresh?.()
  }

  async function excluirModelo(id) {
    if (!canDelete) return
    if (!confirm('Excluir este modelo?')) return
    await supabase.from('acervo_modelos').delete().eq('id', id)
    fetchModelos()
  }

  const recentModelos = modelos.slice(0, 5)

  const sortedOficios = [...oficiosList].sort((a, b) => {
    let va, vb
    if (sortCol === 'destinatario') {
      va = String(a.destinatario || '').toLowerCase()
      vb = String(b.destinatario || '').toLowerCase()
      return sortDir === 'asc' ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR')
    }
    // default: numero sequencial
    va = numSeq(a.numero); vb = numSeq(b.numero)
    return sortDir === 'asc' ? va - vb : vb - va
  })

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function exportarCSV() {
    const headers = ['Número','Data','Departamento','Responsável','Destinatário','Referência / Assunto','Forma de Envio','Arquivado na Pasta','Observações']
    const rows = sortedOficios.map(o => [
      o.numero || '',
      fmtDate(o.data),
      o.departamento || '',
      o.responsavel || '',
      o.destinatario || '',
      o.referencia || '',
      o.forma_envio || '',
      o.arquivado || '',
      o.observacoes || '',
    ])
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `oficios_${String(nomeEmpresaAcervo(selectedEmpresa)).replace(/\s+/g,'_')}_${anoVigente}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <ChevronDown size={10} style={{ opacity: 0.3, marginLeft: 2 }} />
    return sortDir === 'asc'
      ? <ChevronUp size={10} style={{ color: C.primary, marginLeft: 2 }} />
      : <ChevronDown size={10} style={{ color: C.primary, marginLeft: 2 }} />
  }

  return (
    <div style={{ padding: 32, background: C.bg, minHeight: '100%' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>Acervo</h1>
        <p style={{ fontSize: 14, color: C.muted, margin: '4px 0 0' }}>Modelos editáveis e controle de expedição de ofícios</p>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ id: 'oficios', label: 'Expedição de Ofícios e Cartas', Icon: Send }, { id: 'modelos', label: 'Modelos', Icon: BookOpen }].map(({ id, label, Icon }) => {
          const active = activeSection === id
          return (
            <button key={id} onClick={() => setActiveSection(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', border: '1px solid ' + (active ? C.navy : C.border), borderRadius: 8, background: active ? C.navy : C.white, color: active ? 'white' : C.text, cursor: 'pointer', fontSize: 14, fontWeight: active ? 700 : 400, fontFamily: 'inherit' }}>
              <Icon size={15} />{label}
            </button>
          )
        })}
      </div>

      {/* ── MODELOS ── */}
      {activeSection === 'modelos' && (
        <div style={{ maxWidth: 620 }}>
          <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={16} color={C.primary} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Modelos de Documentos</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{modelos.length} modelo(s) no acervo</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {canEdit && <button onClick={() => setShowUploadModelo(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid ' + C.border, background: C.white, cursor: 'pointer', color: C.primary, borderRadius: 8, padding: '7px 10px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                  <Upload size={14} />Anexar modelo
                </button>}
                <button onClick={() => setShowTodosModelos(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', color: C.primary, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                  Ver mais <ChevronRight size={14} />
                </button>
              </div>
            </div>
            {loadingModelos ? <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>Carregando...</div>
              : recentModelos.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: C.muted }}>Nenhum modelo encontrado.</div>
              : recentModelos.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: i === 0 ? 'none' : '1px solid ' + C.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: C.bg, border: '1px solid ' + C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={13} color={C.muted} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      {m.tipo && <span style={{ fontSize: 11, color: C.muted }}>{m.tipo}</span>}
                      {m.area && <span style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>{m.area}</span>}
                      {m.arquivo_nome && (m.arquivo_base64
                        ? <a href={`data:${m.arquivo_tipo||'application/octet-stream'};base64,${m.arquivo_base64}`} download={m.arquivo_nome} style={{ fontSize: 11, color: C.primary, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none', fontWeight: 700 }}><Paperclip size={9} />{m.arquivo_nome}</a>
                        : <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}><Paperclip size={9} />{m.arquivo_nome}</span>)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{m.updated_at ? fmtDate(m.updated_at.split('T')[0]) : '—'}</div>
                  {canDelete && <button onClick={() => excluirModelo(m.id)} title="Excluir modelo"
                    style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', border: '1px solid '+C.danger, borderRadius: 6, background: C.dangerLight, color: C.danger, cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>}
                </div>
              </div>
            ))}
            {modelos.length > 5 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid ' + C.border, textAlign: 'center' }}>
                <button onClick={() => setShowTodosModelos(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.primary, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Ver todos os {modelos.length} modelos →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OFÍCIOS ── */}
      {activeSection === 'oficios' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Seletor empresa (Partes / CRM — empresas do grupo) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: C.bg, border: '1px solid ' + C.border, borderRadius: 10, padding: 4 }}>
              {empresas.map(emp => {
                const sel = selectedEmpresa?.id === emp.id
                return (
                  <button key={emp.id} onClick={() => setSelectedEmpresa(emp)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: sel ? 700 : 400, background: sel ? C.white : 'transparent', color: sel ? C.primary : C.muted, boxShadow: sel ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', fontFamily: 'inherit' }}>
                    <Building2 size={13} />{nomeEmpresaAcervo(emp)}
                  </button>
                )
              })}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={() => navigate('/partes')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px dashed ' + C.border, borderRadius: 8, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                <Plus size={13} />Nova empresa
              </button>
              <button type="button" aria-label="Ajuda sobre cadastro de empresas"
                onMouseEnter={() => setShowHelpNovaEmpresa(true)}
                onMouseLeave={() => setShowHelpNovaEmpresa(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: '1px solid ' + C.border, borderRadius: '50%', background: C.bg, color: C.muted, cursor: 'default', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' }}
                onFocus={() => setShowHelpNovaEmpresa(true)}
                onBlur={() => setShowHelpNovaEmpresa(false)}>
                ?
              </button>
              {showHelpNovaEmpresa && (
                <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 8, zIndex: 50, maxWidth: 360, padding: '12px 14px', background: C.white, border: '1px solid ' + C.border, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.12)', fontSize: 13, color: C.text, lineHeight: 1.55 }}>
                  Para incluir o controle de ofícios de <strong>outra empresa</strong>, cadastre-a antes em <strong>Partes / CRM</strong>, escolhendo o tipo <strong>Empresa do grupo</strong>. Depois ela aparecerá automaticamente nestes botões.
                  <button type="button" onClick={() => setShowHelpNovaEmpresa(false)} style={{ marginTop: 10, border: 'none', background: 'none', color: C.primary, cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', padding: 0 }}>Fechar</button>
                </div>
              )}
            </div>
          </div>

          {!empresas.length && (
            <div style={{ padding: '20px 18px', background: C.white, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 14, color: C.muted }}>
              Nenhuma <strong>empresa do grupo</strong> cadastrada. Acesse <strong>Partes / CRM</strong> e inclua pelo menos uma empresa com esse tipo para usar o controle de ofícios.
            </div>
          )}

          {selectedEmpresa && (<>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>Controle de Ofícios — {nomeEmpresaAcervo(selectedEmpresa)}</h2>
                <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
                  Ano <strong style={{ color: C.text }}>{anoVigente}</strong> · {oficiosList.length} ofício(s) · Próximo: <strong style={{ color: C.primary }}>{nextNumero()}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setShowAnosArquivados(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                  <Archive size={14} />Controles arquivados
                </button>
                <button onClick={() => setShowConsultar(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                  <Eye size={14} />Consultar todos
                </button>
                <button onClick={exportarCSV} disabled={sortedOficios.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: sortedOficios.length === 0 ? C.muted : C.text, cursor: sortedOficios.length === 0 ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', opacity: sortedOficios.length === 0 ? 0.5 : 1 }}>
                  <Download size={14} />Exportar CSV
                </button>
                {canEdit && <button onClick={() => { setEditingOficio(null); setShowNovoOficio(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
                  <Plus size={14} />Novo Ofício
                </button>}
              </div>
            </div>

            <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowY: 'auto', maxHeight: 390 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 88 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 100 }} />
                    <col style={{ width: 108 }} />
                    <col style={{ width: 118 }} />
                    <col />
                    <col style={{ width: 96 }} />
                    <col style={{ width: 48 }} />
                    <col style={{ width: 36 }} />
                    <col style={{ width: 36 }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: C.bg, boxShadow: '0 1px 0 ' + C.border }}>
                      {[
                        { key: 'numero', label: 'Número', sortable: true },
                        { key: 'data', label: 'Data', sortable: false },
                        { key: 'departamento', label: 'Depto.', sortable: false },
                        { key: 'responsavel', label: 'Responsável', sortable: false },
                        { key: 'destinatario', label: 'Destinatário', sortable: true },
                        { key: 'referencia', label: 'Referência / Assunto', sortable: false },
                        { key: 'envio', label: 'Envio', sortable: false },
                        { key: 'pasta', label: 'Pasta', sortable: false },
                        { key: 'a1', label: '', sortable: false },
                        { key: 'a2', label: '', sortable: false },
                      ].map(col => (
                        <th key={col.key} onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                          style={{ padding: '9px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: sortCol === col.key ? C.primary : C.muted, textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', position: 'sticky', top: 0, background: C.bg, zIndex: 1, cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                          {col.label}{col.sortable && <SortIcon col={col.key} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOficios ? <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: C.muted }}>Carregando...</td></tr>
                      : sortedOficios.length === 0 ? <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: C.muted }}>Nenhum ofício registrado em {anoVigente}.</td></tr>
                      : sortedOficios.map((of, i) => (
                      <tr key={of.id} style={{ borderTop: i === 0 ? 'none' : '1px solid ' + C.border }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '8px 10px', overflow: 'hidden' }}><span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 11, color: C.primary }}>{of.numero}</span></td>
                        <td style={{ padding: '8px 10px', color: C.muted, fontSize: 12 }}>{fmtDate(of.data)}</td>
                        <td style={{ padding: '8px 10px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={of.departamento}>{of.departamento || '—'}</td>
                        <td style={{ padding: '8px 10px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={of.responsavel}>{of.responsavel || '—'}</td>
                        <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                          <span style={{ display: 'block', background: C.primaryLight, color: C.primary, padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={of.destinatario}>{of.destinatario || '—'}</span>
                        </td>
                        <td style={{ padding: '8px 10px', color: C.muted, overflow: 'hidden' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={of.referencia}>{of.referencia || '—'}</div>
                        </td>
                        <td style={{ padding: '8px 10px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={of.forma_envio}>{of.forma_envio || '—'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          {of.arquivado === 'SIM'
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#16a34a', fontSize: 11, fontWeight: 700 }}><Check size={11} />SIM</span>
                            : <span style={{ color: C.muted, fontSize: 11 }}>{of.arquivado || '—'}</span>}
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <button onClick={() => setAnexosOficio(of)} title="Ver anexos"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: '1px solid ' + C.border, borderRadius: 6, background: C.white, color: C.muted, cursor: 'pointer' }}>
                            <Paperclip size={11} />
                          </button>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          {canEdit && <button onClick={() => { setEditingOficio(of); setShowNovoOficio(true) }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: '1px solid ' + C.border, borderRadius: 6, background: C.white, color: C.muted, cursor: 'pointer' }}>
                            <Edit2 size={11} />
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '8px 14px', borderTop: '1px solid ' + C.border, background: C.bg, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowEncerrarModal(true)}
                  title={`Clique aqui para encerrar o controle de ofícios de ${anoVigente} e iniciar o do próximo ano`}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: '1px solid ' + C.border, borderRadius: 6, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', opacity: 0.7 }}>
                  <Archive size={12} />
                  Encerrar {anoVigente}
                </button>
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* Modais */}
      {showTodosModelos && <TodosModelosModal modelos={modelos} onClose={() => setShowTodosModelos(false)} />}
      {showUploadModelo && <ModeloUploadModal profile={profile} onSave={() => { setShowUploadModelo(false); fetchModelos() }} onClose={() => setShowUploadModelo(false)} />}
      {showNovoOficio && selectedEmpresa && profile?.escritorio_id && (
        <OficioModal oficio={editingOficio} empresa={selectedEmpresa} destinatarios={destinatarios} opcoes={opcoesOficios} numeroSugerido={nextNumero()} profile={profile} anoControle={anoVigente}
          onSave={() => {
            setShowNovoOficio(false); setEditingOficio(null)
            refreshOficiosPainel()
            supabase.from('oficios_destinatarios').select('*').eq('parte_grupo_id', selectedEmpresa.id).eq('escritorio_id', profile.escritorio_id).order('nome').then(({ data }) => setDestinatarios(data || []))
          }}
          onClose={() => { setShowNovoOficio(false); setEditingOficio(null) }} />
      )}
      {showConsultar && selectedEmpresa && profile?.escritorio_id && (
        <ConsultarModal empresa={selectedEmpresa} escritorioId={profile.escritorio_id} legacyEmpresaId={legacyOficiosEmpresaId} profile={profile} canEdit={canEdit} readOnly={false}
          onClose={() => setShowConsultar(false)}
          onEdit={of => { setEditingOficio(of); setShowNovoOficio(true) }} />
      )}
      {consultarArquivadoAno != null && selectedEmpresa && profile?.escritorio_id && (
        <ConsultarModal empresa={selectedEmpresa} escritorioId={profile.escritorio_id} legacyEmpresaId={legacyOficiosEmpresaId} profile={profile} canEdit={false} readOnly apenasArquivados anoFiltro={consultarArquivadoAno}
          onClose={() => setConsultarArquivadoAno(null)}
          onEdit={() => {}} />
      )}
      {consultarReabertoAno != null && selectedEmpresa && profile?.escritorio_id && (
        <ConsultarModal
          empresa={selectedEmpresa}
          escritorioId={profile.escritorio_id}
          legacyEmpresaId={legacyOficiosEmpresaId}
          profile={profile}
          canEdit={canEdit}
          readOnly={false}
          apenasArquivados={false}
          anoFiltro={consultarReabertoAno}
          onClose={() => setConsultarReabertoAno(null)}
          onEdit={of => { setEditingOficio(of); setShowNovoOficio(true) }}
        />
      )}
      {showAnosArquivados && selectedEmpresa && profile?.escritorio_id && (
        <AnosArquivadosModal
          empresa={selectedEmpresa}
          escritorioId={profile.escritorio_id}
          legacyEmpresaId={legacyOficiosEmpresaId}
          profile={profile}
          canEdit={canEdit}
          onClose={() => setShowAnosArquivados(false)}
          onPickAno={(ano, status) => {
            setShowAnosArquivados(false)
            if (status === 'reaberto') setConsultarReabertoAno(ano)
            else setConsultarArquivadoAno(ano)
          }}
          onDesarquivar={confirmarDesarquivar}
          onReArquivar={confirmarReArquivar}
        />
      )}
      {showEncerrarModal && selectedEmpresa && (
        <Modal title={`Encerrar controle de ofícios de ${anoVigente}`} onClose={() => setShowEncerrarModal(false)}>
          <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, margin: '0 0 12px' }}>
            O controle do ano <strong>{anoVigente}</strong> será <strong>arquivado</strong>. Os registros passarão para <strong>Controles arquivados</strong>, em modo somente leitura.
          </p>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
            Em seguida abriremos automaticamente o controle do ano <strong>{anoVigente + 1}</strong>, com numeração reiniciada para novos documentos.
          </p>
          {!canEdit && (
            <p style={{ fontSize: 13, color: C.danger, margin: '0 0 14px' }}>Seu perfil não tem permissão para arquivar; somente usuários autorizados conseguem confirmar.</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setShowEncerrarModal(false)} style={{ padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Cancelar</button>
            <button type="button" onClick={confirmEncerrarControleAnual} style={{ padding: '8px 18px', border: 'none', borderRadius: 8, background: C.navy, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>Confirmar arquivamento</button>
          </div>
        </Modal>
      )}
      {anexosOficio && <AnexosOficioModal oficio={anexosOficio} onClose={() => setAnexosOficio(null)} />}
    </div>
  )
}
