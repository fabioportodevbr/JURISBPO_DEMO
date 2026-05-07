import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  FileText, Send, Plus, Search, Edit2, Trash2, Download,
  ChevronRight, X, Paperclip, Eye, Building2, BookOpen,
  Clock, User, AlertCircle, Check, ChevronDown, Upload
} from 'lucide-react';

// ─────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}
function fmtTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pt-BR');
}

// ─────────────────────────────────────────────
// Modal genérico
// ─────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
      <div className={`bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${wide ? 'w-full max-w-5xl' : 'w-full max-w-xl'}`}
        style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dropdown com criação de novo item
// ─────────────────────────────────────────────
function CreatableSelect({ options, value, onChange, placeholder, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const canCreate = search.trim() && !options.some(o => o.toLowerCase() === search.toLowerCase().trim());

  return (
    <div ref={ref} className="relative">
      <button type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors">
        <span className={value ? 'text-white' : 'text-white/40'}>{value || placeholder}</span>
        <ChevronDown size={14} className="text-white/40" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-[#1a1f2e] border border-white/20 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ou digitar novo..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(opt => (
              <button key={opt} type="button"
                onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${value === opt ? 'text-emerald-400' : 'text-white/80'}`}>
                {opt}
              </button>
            ))}
            {canCreate && (
              <button type="button"
                onClick={() => { onCreateNew(search.trim()); onChange(search.trim()); setOpen(false); setSearch(''); }}
                className="w-full text-left px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-400/10 flex items-center gap-2 border-t border-white/5">
                <Plus size={13} />
                Adicionar "{search.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Campo de formulário
// ─────────────────────────────────────────────
function Field({ label, children, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
function Input({ ...props }) {
  return (
    <input {...props}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500/50 transition-colors" />
  );
}
function Textarea({ ...props }) {
  return (
    <textarea {...props} rows={3}
      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-500/50 transition-colors resize-none" />
  );
}

// ─────────────────────────────────────────────
// Modal: Novo/Editar Ofício
// ─────────────────────────────────────────────
function OficioModal({ oficio, empresa, destinatarios, onSave, onClose, currentUser }) {
  const isEdit = !!oficio;
  const [form, setForm] = useState({
    numero: oficio?.numero || '',
    departamento: oficio?.departamento || '',
    responsavel: oficio?.responsavel || '',
    data: oficio?.data || new Date().toISOString().split('T')[0],
    destinatario: oficio?.destinatario || '',
    referencia: oficio?.referencia || '',
    remetente: oficio?.remetente || '',
    forma_envio: oficio?.forma_envio || '',
    arquivado: oficio?.arquivado || '',
    observacoes: oficio?.observacoes || '',
  });
  const [destOpts, setDestOpts] = useState(destinatarios.map(d => d.nome));
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function addDestinatario(nome) {
    await supabase.from('oficios_destinatarios').insert({ empresa_id: empresa.id, nome });
    setDestOpts(prev => [...prev, nome].sort());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.numero || !form.destinatario || !form.data) {
      setErr('Preencha Número, Destinatário e Data.'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        empresa_id: empresa.id,
        ano: new Date(form.data).getFullYear(),
        updated_at: new Date().toISOString(),
        updated_by: currentUser?.id,
        updated_by_nome: currentUser?.nome || currentUser?.email,
      };

      let ofId = oficio?.id;
      let action = 'editado';

      if (isEdit) {
        await supabase.from('oficios').update(payload).eq('id', oficio.id);
      } else {
        payload.created_by = currentUser?.id;
        payload.created_by_nome = currentUser?.nome || currentUser?.email;
        const { data } = await supabase.from('oficios').insert(payload).select().single();
        ofId = data.id;
        action = 'criado';
      }

      // Auditoria
      await supabase.from('oficios_auditoria').insert({
        oficio_id: ofId,
        empresa_id: empresa.id,
        numero_oficio: form.numero,
        acao: action,
        usuario_id: currentUser?.id,
        usuario_nome: currentUser?.nome || currentUser?.email,
        dados_json: payload,
      });

      // Upload de anexos
      for (const file of files) {
        const path = `oficios/${ofId}/${Date.now()}_${file.name}`;
        const { data: up } = await supabase.storage.from('documentos').upload(path, file);
        if (up) {
          const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path);
          await supabase.from('oficios_anexos').insert({
            oficio_id: ofId,
            nome_arquivo: file.name,
            url: publicUrl,
            created_by: currentUser?.id,
            created_by_nome: currentUser?.nome || currentUser?.email,
          });
        }
      }

      onSave();
    } catch (e) {
      setErr('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? `Editar Ofício ${oficio.numero}` : 'Novo Ofício'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número" required>
            <Input value={form.numero} onChange={e => set('numero', e.target.value)}
              placeholder="ex: 124/2026" />
          </Field>
          <Field label="Data" required>
            <Input type="date" value={form.data} onChange={e => set('data', e.target.value)} />
          </Field>
        </div>

        <Field label="Órgão de Destino" required>
          <CreatableSelect options={destOpts} value={form.destinatario}
            onChange={v => set('destinatario', v)} placeholder="Selecionar ou adicionar..."
            onCreateNew={addDestinatario} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Departamento Responsável">
            <Input value={form.departamento} onChange={e => set('departamento', e.target.value)}
              placeholder="ex: Jurídico" />
          </Field>
          <Field label="Responsável pelo Ofício/Carta">
            <Input value={form.responsavel} onChange={e => set('responsavel', e.target.value)}
              placeholder="Nome do responsável" />
          </Field>
        </div>

        <Field label="Referência / Assunto">
          <Textarea value={form.referencia} onChange={e => set('referencia', e.target.value)}
            placeholder="Assunto do ofício..." />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Remetente Responsável pelo Envio">
            <Input value={form.remetente} onChange={e => set('remetente', e.target.value)} />
          </Field>
          <Field label="Forma de Envio">
            <Input value={form.forma_envio} onChange={e => set('forma_envio', e.target.value)}
              placeholder="ex: SEI, E-mail..." />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Arquivado na Pasta?">
            <CreatableSelect options={['SIM', 'NÃO']} value={form.arquivado}
              onChange={v => set('arquivado', v)} placeholder="SIM / NÃO"
              onCreateNew={() => {}} />
          </Field>
          <Field label="Observações">
            <Input value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </Field>
        </div>

        {/* Anexos */}
        <div>
          <label className="block text-xs font-medium text-white/50 mb-2">Documentos Anexos</label>
          <div className="border border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500/40 transition-colors"
            onClick={() => fileRef.current?.click()}>
            <Upload size={20} className="mx-auto text-white/30 mb-2" />
            <p className="text-sm text-white/40">Clique para selecionar arquivos</p>
            <input ref={fileRef} type="file" multiple className="hidden"
              onChange={e => setFiles(Array.from(e.target.files))} />
          </div>
          {files.length > 0 && (
            <div className="mt-2 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-white/60 bg-white/5 rounded-lg px-3 py-1.5">
                  <Paperclip size={12} />
                  <span>{f.name}</span>
                  <button type="button" onClick={() => setFiles(ff => ff.filter((_, ii) => ii !== i))}
                    className="ml-auto text-white/30 hover:text-red-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {err && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-sm">
            <AlertCircle size={14} /> {err}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 transition-colors flex items-center gap-2">
            {saving ? <><span className="animate-spin">⟳</span> Salvando...</> : <><Check size={14} /> Salvar</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Modal: Consultar Todos os Ofícios
// ─────────────────────────────────────────────
function ConsultarModal({ empresa, onClose, currentUser, onEdit }) {
  const [oficios, setOficios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [anexos, setAnexos] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('oficios')
      .select('*').eq('empresa_id', empresa.id)
      .order('created_at', { ascending: false });
    setOficios(data || []);
    setLoading(false);
  }, [empresa.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function selectOficio(of) {
    setSelected(of);
    const [{ data: a }, { data: au }] = await Promise.all([
      supabase.from('oficios_anexos').select('*').eq('oficio_id', of.id),
      supabase.from('oficios_auditoria').select('*').eq('oficio_id', of.id).order('timestamp', { ascending: false }),
    ]);
    setAnexos(a || []);
    setAuditoria(au || []);
  }

  async function handleDelete(of) {
    if (!confirm(`Excluir ofício ${of.numero}? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    await supabase.from('oficios').delete().eq('id', of.id);
    await supabase.from('oficios_auditoria').insert({
      oficio_id: of.id,
      empresa_id: empresa.id,
      numero_oficio: of.numero,
      acao: 'excluído',
      usuario_id: currentUser?.id,
      usuario_nome: currentUser?.nome || currentUser?.email,
      dados_json: of,
    });
    setSelected(null);
    fetchAll();
    setDeleting(false);
  }

  const filtered = oficios.filter(o =>
    (o.numero + o.destinatario + o.referencia + o.responsavel + o.departamento)
      .toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal title={`Todos os Ofícios — ${empresa.nome}`} onClose={onClose} wide>
      <div className="flex gap-4 h-full" style={{ minHeight: 400 }}>
        {/* Lista */}
        <div className="w-1/2 flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ofícios..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 outline-none" />
          </div>
          <div className="text-xs text-white/30 font-medium">{filtered.length} registro(s)</div>
          <div className="overflow-y-auto space-y-1.5 flex-1" style={{ maxHeight: 440 }}>
            {loading ? (
              <div className="text-white/30 text-sm text-center py-8">Carregando...</div>
            ) : filtered.map(of => (
              <button key={of.id} onClick={() => selectOficio(of)}
                className={`w-full text-left rounded-xl px-3 py-3 transition-all ${selected?.id === of.id ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-white/5 border border-white/5 hover:border-white/15'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400">{of.numero}</span>
                  <span className="text-xs text-white/30">{fmtDate(of.data)}</span>
                </div>
                <div className="text-sm text-white/80 mt-0.5 truncate">{of.destinatario}</div>
                <div className="text-xs text-white/40 truncate mt-0.5">{of.referencia}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Detalhe */}
        <div className="w-1/2 border-l border-white/10 pl-4 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
              ← Selecione um ofício
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-mono font-bold text-emerald-400">{selected.numero}</span>
                <div className="flex gap-2">
                  <button onClick={() => { onEdit(selected); onClose(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors">
                    <Edit2 size={12} /> Editar
                  </button>
                  <button onClick={() => handleDelete(selected)} disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors">
                    <Trash2 size={12} /> Excluir
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Data', fmtDate(selected.data)],
                  ['Departamento', selected.departamento],
                  ['Responsável', selected.responsavel],
                  ['Remetente', selected.remetente],
                  ['Forma de Envio', selected.forma_envio],
                  ['Arquivado', selected.arquivado],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs text-white/30 mb-0.5">{k}</div>
                    <div className="text-white/80">{v || '—'}</div>
                  </div>
                ))}
              </div>

              {selected.referencia && (
                <div>
                  <div className="text-xs text-white/30 mb-1">Referência / Assunto</div>
                  <div className="text-sm text-white/80 bg-white/5 rounded-lg p-3">{selected.referencia}</div>
                </div>
              )}
              {selected.observacoes && (
                <div>
                  <div className="text-xs text-white/30 mb-1">Observações</div>
                  <div className="text-sm text-white/60 italic">{selected.observacoes}</div>
                </div>
              )}

              {/* Anexos */}
              {anexos.length > 0 && (
                <div>
                  <div className="text-xs text-white/30 mb-2">Anexos ({anexos.length})</div>
                  <div className="space-y-1">
                    {anexos.map(a => (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 rounded-lg px-3 py-2 transition-colors">
                        <Paperclip size={11} />
                        <span className="truncate">{a.nome_arquivo}</span>
                        <Download size={11} className="ml-auto" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Auditoria */}
              {auditoria.length > 0 && (
                <div>
                  <div className="text-xs text-white/30 mb-2">Histórico de alterações</div>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {auditoria.map(a => (
                      <div key={a.id}
                        className="flex items-center gap-2 text-xs bg-white/5 rounded-lg px-3 py-1.5">
                        <span className={`font-medium ${a.acao === 'excluído' ? 'text-red-400' : a.acao === 'criado' ? 'text-emerald-400' : 'text-blue-400'}`}>
                          {a.acao}
                        </span>
                        <span className="text-white/40">por</span>
                        <span className="text-white/60">{a.usuario_nome || '—'}</span>
                        <span className="ml-auto text-white/30">{fmtTs(a.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Modal: Nova Empresa
// ─────────────────────────────────────────────
function NovaEmpresaModal({ onSave, onClose }) {
  const [nome, setNome] = useState('');
  const [saving, setSaving] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSaving(true);
    await supabase.from('oficios_empresas').insert({ nome: nome.trim() });
    onSave();
    setSaving(false);
  }
  return (
    <Modal title="Nova Empresa / Controle" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome da Empresa" required>
          <Input value={nome} onChange={e => setNome(e.target.value)}
            placeholder="ex: NOVA EMPRESA LTDA" autoFocus />
        </Field>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 transition-colors">
            {saving ? 'Salvando...' : 'Criar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Modal: Ver Mais Modelos
// ─────────────────────────────────────────────
function TodosModelosModal({ modelos, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = modelos.filter(m =>
    (m.nome + (m.tipo || '') + (m.area || '')).toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Modal title="Todos os Modelos" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar modelos..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 outline-none" />
        </div>
        <div className="text-xs text-white/30">{filtered.length} modelo(s)</div>
        <div className="overflow-y-auto space-y-2" style={{ maxHeight: 480 }}>
          {filtered.map(m => (
            <div key={m.id}
              className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 hover:bg-white/8 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{m.nome}</span>
                  {m.tipo && <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/50">{m.tipo}</span>}
                  {m.area && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">{m.area}</span>}
                </div>
                {m.descricao && <div className="text-xs text-white/40 mt-0.5">{m.descricao}</div>}
                {m.arquivo_nome && <div className="text-xs text-white/30 mt-0.5 flex items-center gap-1"><Paperclip size={10} />{m.arquivo_nome}</div>}
              </div>
              <div className="text-xs text-white/30 ml-4 whitespace-nowrap">
                {m.updated_at ? fmtDate(m.updated_at.split('T')[0]) : '—'}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-white/30 text-sm text-center py-8">Nenhum modelo encontrado.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────
export default function Acervo() {
  const [activeSection, setActiveSection] = useState('modelos'); // 'modelos' | 'oficios'
  const [currentUser, setCurrentUser] = useState(null);

  // Modelos
  const [modelos, setModelos] = useState([]);
  const [loadingModelos, setLoadingModelos] = useState(true);
  const [showTodosModelos, setShowTodosModelos] = useState(false);

  // Ofícios
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [oficiosList, setOficiosList] = useState([]);
  const [destinatarios, setDestinatarios] = useState([]);
  const [loadingOficios, setLoadingOficios] = useState(false);
  const [showNovoOficio, setShowNovoOficio] = useState(false);
  const [showConsultar, setShowConsultar] = useState(false);
  const [showNovaEmpresa, setShowNovaEmpresa] = useState(false);
  const [editingOficio, setEditingOficio] = useState(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setCurrentUser({ ...user, ...profile });
      }
    });
  }, []);

  // Modelos
  useEffect(() => {
    supabase.from('modelos')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => { setModelos(data || []); setLoadingModelos(false); });
  }, []);

  // Empresas
  useEffect(() => {
    supabase.from('oficios_empresas').select('*').order('nome').then(({ data }) => {
      setEmpresas(data || []);
      if (data && data.length > 0 && !selectedEmpresa) setSelectedEmpresa(data[0]);
    });
  }, []);

  // Ofícios da empresa selecionada (ano corrente)
  const fetchOficios = useCallback(async (empresa) => {
    if (!empresa) return;
    setLoadingOficios(true);
    const currentYear = new Date().getFullYear();
    const { data } = await supabase.from('oficios')
      .select('*')
      .eq('empresa_id', empresa.id)
      .eq('ano', currentYear)
      .order('created_at', { ascending: true });
    setOficiosList(data || []);
    setLoadingOficios(false);
  }, []);

  useEffect(() => {
    if (selectedEmpresa) {
      fetchOficios(selectedEmpresa);
      supabase.from('oficios_destinatarios')
        .select('*').eq('empresa_id', selectedEmpresa.id).order('nome')
        .then(({ data }) => setDestinatarios(data || []));
    }
  }, [selectedEmpresa, fetchOficios]);

  // Próximo número sequencial
  function nextNumero() {
    const year = new Date().getFullYear();
    const nums = oficiosList
      .map(o => parseInt(o.numero?.split('/')[0]))
      .filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${String(next).padStart(3, '0')}/${year}`;
  }

  const recentModelos = modelos.slice(0, 5);

  return (
    <div className="p-8 min-h-screen" style={{ background: '#0d1117' }}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Acervo</h1>
        <p className="text-white/40 mt-1 text-sm">Modelos editáveis e controle de expedição de ofícios</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        {[
          { id: 'modelos', label: 'Modelos', icon: BookOpen },
          { id: 'oficios', label: 'Expedição de Ofícios e Cartas', icon: Send },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeSection === tab.id
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
            }`}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SEÇÃO MODELOS ── */}
      {activeSection === 'modelos' && (
        <div className="max-w-2xl">
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <BookOpen size={16} className="text-emerald-400" />
                </div>
                <div>
                  <div className="text-white font-semibold">Modelos de Documentos</div>
                  <div className="text-xs text-white/40">{modelos.length} modelo(s) no acervo</div>
                </div>
              </div>
              <button onClick={() => setShowTodosModelos(true)}
                className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                Ver mais <ChevronRight size={14} />
              </button>
            </div>
            <div className="divide-y divide-white/5">
              {loadingModelos ? (
                <div className="px-6 py-8 text-center text-white/30 text-sm">Carregando...</div>
              ) : recentModelos.length === 0 ? (
                <div className="px-6 py-8 text-center text-white/30 text-sm">Nenhum modelo encontrado.</div>
              ) : recentModelos.map(m => (
                <div key={m.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-white/3 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0">
                      <FileText size={13} className="text-white/50" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">{m.nome}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.tipo && <span className="text-xs text-white/30">{m.tipo}</span>}
                        {m.area && <span className="text-xs text-emerald-400/60">{m.area}</span>}
                        {m.arquivo_nome && (
                          <span className="text-xs text-white/25 flex items-center gap-1">
                            <Paperclip size={9} />{m.arquivo_nome}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-white/25 ml-4 whitespace-nowrap">
                    {m.updated_at ? fmtDate(m.updated_at.split('T')[0]) : '—'}
                  </div>
                </div>
              ))}
            </div>
            {modelos.length > 5 && (
              <div className="px-6 py-3 border-t border-white/5 flex justify-center">
                <button onClick={() => setShowTodosModelos(true)}
                  className="text-sm text-white/40 hover:text-emerald-400 transition-colors">
                  Ver todos os {modelos.length} modelos →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SEÇÃO OFÍCIOS ── */}
      {activeSection === 'oficios' && (
        <div className="space-y-6">
          {/* Empresas */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
              {empresas.map(emp => (
                <button key={emp.id} onClick={() => setSelectedEmpresa(emp)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedEmpresa?.id === emp.id
                      ? 'bg-white text-[#0d1117]'
                      : 'text-white/50 hover:text-white hover:bg-white/8'
                  }`}>
                  <Building2 size={13} className="inline mr-1.5 opacity-60" />
                  {emp.nome}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNovaEmpresa(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm transition-colors border border-dashed border-white/15">
              <Plus size={13} /> Nova empresa
            </button>
          </div>

          {selectedEmpresa && (
            <>
              {/* Header do controle */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Controle de Ofícios — {selectedEmpresa.nome}
                  </h2>
                  <p className="text-sm text-white/40 mt-0.5">
                    Ano {new Date().getFullYear()} · {oficiosList.length} ofício(s) registrado(s)
                    {oficiosList.length > 0 && ` · Próximo: ${nextNumero()}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowConsultar(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white/70 hover:text-white text-sm transition-colors border border-white/10">
                    <Eye size={14} /> Consultar todos
                  </button>
                  <button onClick={() => { setEditingOficio(null); setShowNovoOficio(true); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20">
                    <Plus size={14} /> Novo Ofício
                  </button>
                </div>
              </div>

              {/* Tabela */}
              <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Número', 'Data', 'Departamento', 'Responsável', 'Destinatário', 'Referência/Assunto', 'Forma Envio', 'Pasta', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loadingOficios ? (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-white/30">Carregando...</td></tr>
                      ) : oficiosList.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-white/30">
                          Nenhum ofício registrado em {new Date().getFullYear()}.
                        </td></tr>
                      ) : oficiosList.map(of => (
                        <tr key={of.id} className="hover:bg-white/3 transition-colors group">
                          <td className="px-4 py-3">
                            <span className="font-mono font-bold text-emerald-400 text-xs">{of.numero}</span>
                          </td>
                          <td className="px-4 py-3 text-white/60 whitespace-nowrap text-xs">{fmtDate(of.data)}</td>
                          <td className="px-4 py-3 text-white/70 text-xs">{of.departamento || '—'}</td>
                          <td className="px-4 py-3 text-white/70 text-xs whitespace-nowrap">{of.responsavel || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium text-white/80 bg-white/8 px-2 py-1 rounded-lg">{of.destinatario || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-white/60 text-xs max-w-xs">
                            <div className="truncate max-w-[260px]" title={of.referencia}>{of.referencia || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{of.forma_envio || '—'}</td>
                          <td className="px-4 py-3">
                            {of.arquivado === 'SIM'
                              ? <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={11} />SIM</span>
                              : <span className="text-xs text-white/30">{of.arquivado || '—'}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setEditingOficio(of); setShowNovoOficio(true); }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
                              <Edit2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAIS ── */}
      {showTodosModelos && (
        <TodosModelosModal modelos={modelos} onClose={() => setShowTodosModelos(false)} />
      )}

      {showNovoOficio && selectedEmpresa && (
        <OficioModal
          oficio={editingOficio}
          empresa={selectedEmpresa}
          destinatarios={destinatarios}
          currentUser={currentUser}
          onSave={() => {
            setShowNovoOficio(false);
            setEditingOficio(null);
            fetchOficios(selectedEmpresa);
            // Atualizar destinatários
            supabase.from('oficios_destinatarios')
              .select('*').eq('empresa_id', selectedEmpresa.id).order('nome')
              .then(({ data }) => setDestinatarios(data || []));
          }}
          onClose={() => { setShowNovoOficio(false); setEditingOficio(null); }}
        />
      )}

      {showConsultar && selectedEmpresa && (
        <ConsultarModal
          empresa={selectedEmpresa}
          currentUser={currentUser}
          onClose={() => setShowConsultar(false)}
          onEdit={(of) => { setEditingOficio(of); setShowNovoOficio(true); }}
        />
      )}

      {showNovaEmpresa && (
        <NovaEmpresaModal
          onSave={() => {
            setShowNovaEmpresa(false);
            supabase.from('oficios_empresas').select('*').order('nome').then(({ data }) => {
              setEmpresas(data || []);
            });
          }}
          onClose={() => setShowNovaEmpresa(false)}
        />
      )}
    </div>
  );
}
