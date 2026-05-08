import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, can } from '../lib/supabase'
import {
  FileText, Send, Plus, Search, Edit2, Trash2, Download,
  ChevronRight, X, Paperclip, Eye, Building2, BookOpen,
  Check, ChevronDown, Upload, AlertCircle,
} from 'lucide-react'

// ── Cores (mesmas do App.jsx) ─────────────────────────────────────────────
const C = {
  bg:           '#f8fafc',
  white:        '#ffffff',
  text:         '#0f172a',
  muted:        '#64748b',
  border:       '#e5e7eb',
  primary:      '#10b981',
  primaryLight: '#d1fae5',
  primaryMid:   '#059669',
  danger:       '#dc2626',
  dangerLight:  '#fee2e2',
  warning:      '#f59e0b',
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
const inp = { width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#0f172a', outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }

// ── Modal: Novo / Editar Ofício ───────────────────────────────────────────
function OficioModal({ oficio, empresa, destinatarios, opcoes, numeroSugerido, onSave, onClose, profile }) {
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
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function addDestinatario(nome) {
    await supabase.from('oficios_destinatarios').insert({ empresa_id: empresa.id, nome })
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
      const payload = { ...form, empresa_id: empresa.id, ano: new Date(form.data).getFullYear(), updated_at: new Date().toISOString(), updated_by: profile?.id, updated_by_nome: profile?.nome || profile?.email }
      let ofId = oficio?.id, action = 'editado'
      if (isEdit) {
        await supabase.from('oficios').update(payload).eq('id', oficio.id)
      } else {
        payload.created_by = profile?.id; payload.created_by_nome = profile?.nome || profile?.email
        const { data } = await supabase.from('oficios').insert(payload).select().single()
        ofId = data.id; action = 'criado'
      }
      await supabase.from('oficios_auditoria').insert({ oficio_id: ofId, empresa_id: empresa.id, numero_oficio: form.numero, acao: action, usuario_id: profile?.id, usuario_nome: profile?.nome || profile?.email, dados_json: payload })
      for (const file of files) {
        const path = `oficios/${ofId}/${Date.now()}_${file.name}`
        const { data: up } = await supabase.storage.from('documentos').upload(path, file)
        if (up) {
          const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
          await supabase.from('oficios_anexos').insert({ oficio_id: ofId, nome_arquivo: file.name, url: publicUrl, created_by: profile?.id, created_by_nome: profile?.nome || profile?.email })
        }
      }
      onSave()
    } catch (e2) { setErr('Erro ao salvar: ' + e2.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? `Editar — ${oficio.numero}` : `Novo Ofício — ${empresa.nome}`} onClose={onClose}>
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
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed ' + C.border, borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
            <Upload size={18} color={C.muted} style={{ display: 'block', margin: '0 auto 4px' }} />
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Clique para selecionar arquivos</p>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files))} />
          </div>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, background: C.bg, borderRadius: 6, padding: '6px 10px', marginTop: 4 }}>
              <Paperclip size={12} color={C.muted} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <button type="button" onClick={() => setFiles(ff => ff.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 0 }}><X size={13} /></button>
            </div>
          ))}
        </Field>
        {err && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.dangerLight, border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13 }}><AlertCircle size={14} />{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: C.primary, color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>{saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar ofício'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Modal: Consultar Todos ────────────────────────────────────────────────
function ConsultarModal({ empresa, onClose, profile, onEdit, canEdit, canDelete }) {
  const [oficios, setOficios] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [anexos, setAnexos] = useState([])
  const [auditoria, setAuditoria] = useState([])
  const [deleting, setDeleting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('oficios').select('*').eq('empresa_id', empresa.id).order('created_at', { ascending: false })
    setOficios(data || []); setLoading(false)
  }, [empresa.id])
  useEffect(() => { fetchAll() }, [fetchAll])

  async function selectOficio(of) {
    setSelected(of)
    const [{ data: a }, { data: au }] = await Promise.all([
      supabase.from('oficios_anexos').select('*').eq('oficio_id', of.id),
      supabase.from('oficios_auditoria').select('*').eq('oficio_id', of.id).order('timestamp', { ascending: false }),
    ])
    setAnexos(a || []); setAuditoria(au || [])
  }

  async function handleDelete(of) {
    if (!canDelete) { alert('Visitante possui acesso somente leitura.'); return }
    if (!confirm(`Excluir ofício ${of.numero}?`)) return
    setDeleting(true)
    await supabase.from('oficios_auditoria').insert({ oficio_id: of.id, empresa_id: empresa.id, numero_oficio: of.numero, acao: 'excluído', usuario_id: profile?.id, usuario_nome: profile?.nome || profile?.email, dados_json: of })
    await supabase.from('oficios').delete().eq('id', of.id)
    setSelected(null); fetchAll(); setDeleting(false)
  }

  const filtered = oficios.filter(o => (o.numero + o.destinatario + o.referencia + o.responsavel + o.departamento).toLowerCase().includes(search.toLowerCase()))

  return (
    <Modal title={`Todos os Ofícios — ${empresa.nome}`} onClose={onClose} wide>
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
              <div style={{ display: 'flex', gap: 8 }}>
                {canEdit && <button onClick={() => { onEdit(selected); onClose() }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}><Edit2 size={13} />Editar</button>}
                {canDelete && <button onClick={() => handleDelete(selected)} disabled={deleting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px solid #fca5a5', borderRadius: 8, background: C.dangerLight, color: C.danger, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}><Trash2 size={13} />Excluir</button>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Data', fmtDate(selected.data)], ['Departamento', selected.departamento], ['Responsável', selected.responsavel], ['Remetente', selected.remetente], ['Forma de Envio', selected.forma_envio], ['Arquivado', selected.arquivado]].map(([k, v]) => (
                <div key={k}><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{k}</div><div style={{ fontSize: 14, color: C.text }}>{v || '—'}</div></div>
              ))}
            </div>
            {selected.referencia && <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Referência / Assunto</div><div style={{ fontSize: 14, color: C.text, background: C.bg, borderRadius: 8, padding: '10px 14px', lineHeight: 1.5 }}>{selected.referencia}</div></div>}
            {selected.observacoes && <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Observações</div><div style={{ fontSize: 13, color: C.muted, fontStyle: 'italic' }}>{selected.observacoes}</div></div>}
            {anexos.length > 0 && <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Anexos ({anexos.length})</div>{anexos.map(a => <a key={a.id} href={a.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.primary, background: C.primaryLight, borderRadius: 6, padding: '6px 10px', textDecoration: 'none', fontWeight: 600, marginBottom: 4 }}><Paperclip size={12} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome_arquivo}</span><Download size={12} /></a>)}</div>}
            {auditoria.length > 0 && <div><div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Histórico</div><div style={{ maxHeight: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>{auditoria.map(a => <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, background: C.bg, borderRadius: 6, padding: '5px 10px' }}><span style={{ fontWeight: 700, color: a.acao === 'excluído' ? C.danger : a.acao === 'criado' ? C.primaryMid : C.warning }}>{a.acao}</span><span style={{ color: C.muted }}>por</span><span style={{ color: C.text, fontWeight: 600 }}>{a.usuario_nome || '—'}</span><span style={{ marginLeft: 'auto', color: C.muted }}>{fmtTs(a.timestamp)}</span></div>)}</div></div>}
          </>)}
        </div>
      </div>
    </Modal>
  )
}

// ── Modal: Nova Empresa ───────────────────────────────────────────────────
function NovaEmpresaModal({ onSave, onClose }) {
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)
  async function handleSubmit(e) {
    e.preventDefault()
    if (!nome.trim()) return
    setSaving(true)
    await supabase.from('oficios_empresas').insert({ nome: nome.trim() })
    onSave(); setSaving(false)
  }
  return (
    <Modal title="Novo Controle de Ofícios" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Nome da empresa / contrato" required><input autoFocus style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="ex: NOVA EMPRESA LTDA" /></Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: C.primary, color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>{saving ? 'Criando...' : 'Criar'}</button>
        </div>
      </form>
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
                {m.arquivo_nome && (m.arquivo_url || m.url)
                  ? <a href={m.arquivo_url || m.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.primary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 700 }}><Paperclip size={10} />{m.arquivo_nome}</a>
                  : m.arquivo_nome && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Paperclip size={10} />{m.arquivo_nome}</div>}
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

  async function insertModelo(payload) {
    const attempts = [
      payload,
      { nome: payload.nome, tipo: payload.tipo, area: payload.area, descricao: payload.descricao, arquivo_nome: payload.arquivo_nome, arquivo_url: payload.arquivo_url, storage_path: payload.storage_path, storage_bucket: payload.storage_bucket },
      { nome: payload.nome, tipo: payload.tipo, area: payload.area, descricao: payload.descricao, arquivo_nome: payload.arquivo_nome, arquivo_url: payload.arquivo_url },
      { nome: payload.nome, tipo: payload.tipo, area: payload.area, descricao: payload.descricao, arquivo_nome: payload.arquivo_nome },
    ]
    let lastError = null
    for (const body of attempts) {
      const { error } = await supabase.from('modelos').insert(body)
      if (!error) return
      lastError = error
      if (!/column|schema|cache|not found/i.test(error.message || '')) break
    }
    throw lastError
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) { setErr('Informe o nome do modelo.'); return }
    if (!files.length) { setErr('Anexe ao menos um arquivo.'); return }
    setSaving(true); setErr('')
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, '_')
        const path = `${profile?.escritorio_id || 'modelos'}/modelos/${Date.now()}_${safeName}`
        const { error: upErr } = await supabase.storage.from('modelos').upload(path, file, { upsert: false })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('modelos').getPublicUrl(path)
        await insertModelo({
          escritorio_id: profile?.escritorio_id,
          nome: files.length > 1 ? `${form.nome.trim()} - ${file.name}` : form.nome.trim(),
          tipo: form.tipo || null,
          area: form.area || null,
          descricao: form.descricao || null,
          arquivo_nome: file.name,
          arquivo_url: publicUrl,
          storage_bucket: 'modelos',
          storage_path: path,
          created_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
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
        {err && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.dangerLight, border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13 }}><AlertCircle size={14} />{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: C.primary, color: 'white', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>{saving ? 'Anexando...' : 'Anexar modelo'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Acervo({ profile }) {
  const [activeSection, setActiveSection] = useState('modelos')
  const [modelos, setModelos] = useState([])
  const [loadingModelos, setLoadingModelos] = useState(true)
  const [showTodosModelos, setShowTodosModelos] = useState(false)
  const [showUploadModelo, setShowUploadModelo] = useState(false)
  const [empresas, setEmpresas] = useState([])
  const [selectedEmpresa, setSelectedEmpresa] = useState(null)
  const [oficiosList, setOficiosList] = useState([])
  const [destinatarios, setDestinatarios] = useState([])
  const [opcoesOficios, setOpcoesOficios] = useState({ departamentos: [], responsaveis: [], remetentes: [], formasEnvio: [] })
  const [loadingOficios, setLoadingOficios] = useState(false)
  const [showNovoOficio, setShowNovoOficio] = useState(false)
  const [showConsultar, setShowConsultar] = useState(false)
  const [showNovaEmpresa, setShowNovaEmpresa] = useState(false)
  const [editingOficio, setEditingOficio] = useState(null)
  const canEdit = can(profile, 'docs.upload')
  const canDelete = can(profile, 'docs.excluir')

  const fetchModelos = useCallback(() => {
    setLoadingModelos(true)
    supabase.from('modelos').select('*').order('updated_at', { ascending: false })
      .then(({ data }) => { setModelos(data || []); setLoadingModelos(false) })
  }, [])

  useEffect(() => { fetchModelos() }, [fetchModelos])

  useEffect(() => {
    supabase.from('oficios_empresas').select('*').order('nome').then(({ data }) => {
      setEmpresas(data || [])
      if (data?.length && !selectedEmpresa) setSelectedEmpresa(data[0])
    })
  }, [])

  const fetchOficios = useCallback(async (empresa) => {
    if (!empresa) return
    setLoadingOficios(true)
    const { data } = await supabase.from('oficios').select('*').eq('empresa_id', empresa.id).eq('ano', new Date().getFullYear()).order('created_at', { ascending: true })
    setOficiosList(data || []); setLoadingOficios(false)
  }, [])

  const fetchOpcoesOficios = useCallback(async (empresa) => {
    if (!empresa) return
    const { data } = await supabase.from('oficios').select('departamento,responsavel,remetente,forma_envio').eq('empresa_id', empresa.id)
    setOpcoesOficios({
      departamentos: uniq((data || []).map(x => x.departamento)),
      responsaveis: uniq((data || []).map(x => x.responsavel)),
      remetentes: uniq((data || []).map(x => x.remetente)),
      formasEnvio: uniq((data || []).map(x => x.forma_envio)),
    })
  }, [])

  useEffect(() => {
    if (!selectedEmpresa) return
    fetchOficios(selectedEmpresa)
    fetchOpcoesOficios(selectedEmpresa)
    supabase.from('oficios_destinatarios').select('*').eq('empresa_id', selectedEmpresa.id).order('nome').then(({ data }) => setDestinatarios(data || []))
  }, [selectedEmpresa, fetchOficios, fetchOpcoesOficios])

  function nextNumero() {
    const year = new Date().getFullYear()
    const nums = oficiosList.map(o => numSeq(o.numero)).filter(n => !isNaN(n))
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${String(next).padStart(3, '0')}/${year}`
  }

  async function excluirUltimoOficio() {
    if (!canDelete) { alert('Visitante possui acesso somente leitura.'); return }
    const alvo = ultimoOficio(oficiosList)
    if (!alvo) return
    if (!confirm(`Excluir o último ofício registrado (${alvo.numero})?`)) return
    await supabase.from('oficios_auditoria').insert({ oficio_id: alvo.id, empresa_id: selectedEmpresa.id, numero_oficio: alvo.numero, acao: 'excluído', usuario_id: profile?.id, usuario_nome: profile?.nome || profile?.email, dados_json: alvo })
    await supabase.from('oficios').delete().eq('id', alvo.id)
    fetchOficios(selectedEmpresa)
    fetchOpcoesOficios(selectedEmpresa)
  }

  const recentModelos = modelos.slice(0, 5)
  const ultimoRegistro = ultimoOficio(oficiosList)

  return (
    <div style={{ padding: 32, background: C.bg, minHeight: '100%' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: 0, letterSpacing: '-0.02em' }}>Acervo</h1>
        <p style={{ fontSize: 14, color: C.muted, margin: '4px 0 0' }}>Modelos editáveis e controle de expedição de ofícios</p>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ id: 'modelos', label: 'Modelos', Icon: BookOpen }, { id: 'oficios', label: 'Expedição de Ofícios e Cartas', Icon: Send }].map(({ id, label, Icon }) => {
          const active = activeSection === id
          return (
            <button key={id} onClick={() => setActiveSection(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', border: '1px solid ' + (active ? C.primary : C.border), borderRadius: 8, background: active ? C.primary : C.white, color: active ? 'white' : C.text, cursor: 'pointer', fontSize: 14, fontWeight: active ? 700 : 400, fontFamily: 'inherit' }}>
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
                      {m.arquivo_nome && (m.arquivo_url || m.url)
                        ? <a href={m.arquivo_url || m.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.primary, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none', fontWeight: 700 }}><Paperclip size={9} />{m.arquivo_nome}</a>
                        : m.arquivo_nome && <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}><Paperclip size={9} />{m.arquivo_nome}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginLeft: 12, whiteSpace: 'nowrap' }}>{m.updated_at ? fmtDate(m.updated_at.split('T')[0]) : '—'}</div>
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
          {/* Seletor empresa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, background: C.bg, border: '1px solid ' + C.border, borderRadius: 10, padding: 4 }}>
              {empresas.map(emp => {
                const sel = selectedEmpresa?.id === emp.id
                return (
                  <button key={emp.id} onClick={() => setSelectedEmpresa(emp)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: sel ? 700 : 400, background: sel ? C.white : 'transparent', color: sel ? C.primary : C.muted, boxShadow: sel ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', fontFamily: 'inherit' }}>
                    <Building2 size={13} />{emp.nome}
                  </button>
                )
              })}
            </div>
            {canEdit && <button onClick={() => setShowNovaEmpresa(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', border: '1px dashed ' + C.border, borderRadius: 8, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              <Plus size={13} />Nova empresa
            </button>}
          </div>

          {selectedEmpresa && (<>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: C.text, margin: 0 }}>Controle de Ofícios — {selectedEmpresa.nome}</h2>
                <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>
                  Ano {new Date().getFullYear()} · {oficiosList.length} ofício(s) · Próximo: <strong style={{ color: C.primary }}>{nextNumero()}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowConsultar(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid ' + C.border, borderRadius: 8, background: C.white, color: C.text, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>
                  <Eye size={14} />Consultar todos
                </button>
                {canDelete && <button onClick={excluirUltimoOficio} disabled={!ultimoRegistro}
                  title={ultimoRegistro ? `Excluir ${ultimoRegistro.numero}` : 'Nenhum ofício para excluir'}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #fca5a5', borderRadius: 8, background: C.dangerLight, color: C.danger, cursor: ultimoRegistro ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', opacity: ultimoRegistro ? 1 : 0.55 }}>
                  <Trash2 size={14} />Excluir último
                </button>}
                {canEdit && <button onClick={() => { setEditingOficio(null); setShowNovoOficio(true) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', border: 'none', borderRadius: 8, background: C.primary, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
                  <Plus size={14} />Novo Ofício
                </button>}
              </div>
            </div>

            <div style={{ background: C.white, border: '1px solid ' + C.border, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.bg, borderBottom: '1px solid ' + C.border }}>
                      {['Número', 'Data', 'Departamento', 'Responsável', 'Destinatário', 'Referência / Assunto', 'Forma Envio', 'Pasta', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingOficios ? <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: C.muted }}>Carregando...</td></tr>
                      : oficiosList.length === 0 ? <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: C.muted }}>Nenhum ofício registrado em {new Date().getFullYear()}.</td></tr>
                      : oficiosList.map((of, i) => (
                      <tr key={of.id} style={{ borderTop: i === 0 ? 'none' : '1px solid ' + C.border }}
                        onMouseEnter={e => e.currentTarget.style.background = C.bg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, color: C.primary }}>{of.numero}</span></td>
                        <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap' }}>{fmtDate(of.data)}</td>
                        <td style={{ padding: '10px 14px', color: C.text }}>{of.departamento || '—'}</td>
                        <td style={{ padding: '10px 14px', color: C.text, whiteSpace: 'nowrap' }}>{of.responsavel || '—'}</td>
                        <td style={{ padding: '10px 14px' }}><span style={{ background: C.primaryLight, color: C.primary, padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{of.destinatario || '—'}</span></td>
                        <td style={{ padding: '10px 14px', color: C.muted, maxWidth: 260 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={of.referencia}>{of.referencia || '—'}</div></td>
                        <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap' }}>{of.forma_envio || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {of.arquivado === 'SIM'
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: 12, fontWeight: 700 }}><Check size={12} />SIM</span>
                            : <span style={{ color: C.muted, fontSize: 12 }}>{of.arquivado || '—'}</span>}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {canEdit && <button onClick={() => { setEditingOficio(of); setShowNovoOficio(true) }}
                            style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', border: '1px solid ' + C.border, borderRadius: 6, background: C.white, color: C.muted, cursor: 'pointer' }}>
                            <Edit2 size={12} />
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* Modais */}
      {showTodosModelos && <TodosModelosModal modelos={modelos} onClose={() => setShowTodosModelos(false)} />}
      {showUploadModelo && <ModeloUploadModal profile={profile} onSave={() => { setShowUploadModelo(false); fetchModelos() }} onClose={() => setShowUploadModelo(false)} />}
      {showNovoOficio && selectedEmpresa && (
        <OficioModal oficio={editingOficio} empresa={selectedEmpresa} destinatarios={destinatarios} opcoes={opcoesOficios} numeroSugerido={nextNumero()} profile={profile}
          onSave={() => { setShowNovoOficio(false); setEditingOficio(null); fetchOficios(selectedEmpresa); fetchOpcoesOficios(selectedEmpresa); supabase.from('oficios_destinatarios').select('*').eq('empresa_id', selectedEmpresa.id).order('nome').then(({ data }) => setDestinatarios(data || [])) }}
          onClose={() => { setShowNovoOficio(false); setEditingOficio(null) }} />
      )}
      {showConsultar && selectedEmpresa && (
        <ConsultarModal empresa={selectedEmpresa} profile={profile} canEdit={canEdit} canDelete={canDelete}
          onClose={() => setShowConsultar(false)}
          onEdit={of => { setEditingOficio(of); setShowNovoOficio(true) }} />
      )}
      {showNovaEmpresa && (
        <NovaEmpresaModal
          onSave={() => { setShowNovaEmpresa(false); supabase.from('oficios_empresas').select('*').order('nome').then(({ data }) => setEmpresas(data || [])) }}
          onClose={() => setShowNovaEmpresa(false)} />
      )}
    </div>
  )
}
