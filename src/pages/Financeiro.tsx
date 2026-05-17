import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { can, fetchAllRows, supabase } from "@/lib/supabase.js";
import {
  CONSOLIDADO_KEY,
  pickDefaultEmpresaGrupoId,
  processoPertenceAlgumaEmpresaGrupo,
  processoPertenceEmpresaGrupo,
} from "@/lib/empresaGrupoFilter.js";
import { C } from "@/lib/theme";
import EmpresaGrupoToggleBar from "@/components/EmpresaGrupoToggleBar.jsx";

type Processo = {
  id: string;
  numero?: string | null;
  titulo?: string | null;
  parte_contraria?: string | null;
  parte_contraria_id?: string | null;
  partes_contrarias?: Array<{ id?: string | null; nome?: string | null; parte_contraria_id?: string | null; parte_contraria?: string | null }> | null;
  categoria?: string | null;
  status?: string | null;
  valor_acao?: number | null;
  transito_julgado?: boolean | null;
};

type EmpresaGrupoRow = { id: string; nome?: string | null; nome_fantasia?: string | null };

type RegistroFinanceiro = {
  id: string;
  escritorio_id: string;
  processo_id: string | null;
  criado_por?: string | null;
  natureza?: string | null;
  data_referencia?: string | null;
  valor_bruto?: number | string | null;
  deposito_ro?: number | string | null;
  deposito_rr?: number | string | null;
  deposito_embargos?: number | string | null;
  agravo_instrumento?: number | string | null;
  custas?: number | string | null;
  fgts?: number | string | null;
  honorarios_sucumbenciais?: number | string | null;
  honorarios_periciais?: number | string | null;
  honorarios_e_custos?: number | string | null;
  inss_reclamante?: number | string | null;
  inss_reclamada?: number | string | null;
  multa_inadimplemento?: number | string | null;
  forma_pagamento?: string | null;
  numero_parcelas?: number | string | null;
  primeiro_vencimento?: string | null;
  status_pagamento?: string | null;
  seguro_garantia?: boolean | null;
  apolice_numero?: string | null;
  apolice_inicio?: string | null;
  apolice_fim?: string | null;
  valor_assegurado?: number | string | null;
  seguro_premio?: number | string | null;
  valor_restituido?: number | string | null;
  observacoes?: string | null;
  created_at?: string | null;
};

type FormState = {
  id: string;
  processo_id: string;
  natureza: string;
  data_referencia: string;
  valor_bruto: string;
  deposito_ro: string;
  deposito_rr: string;
  deposito_embargos: string;
  agravo_instrumento: string;
  custas: string;
  fgts: string;
  honorarios_sucumbenciais: string;
  honorarios_periciais: string;
  honorarios_e_custos: string;
  inss_reclamante: string;
  inss_reclamada: string;
  multa_inadimplemento: string;
  forma_pagamento: string;
  numero_parcelas: string;
  primeiro_vencimento: string;
  status_pagamento: string;
  seguro_garantia: boolean;
  apolice_numero: string;
  apolice_inicio: string;
  apolice_fim: string;
  valor_assegurado: string;
  seguro_premio: string;
  valor_restituido: string;
  observacoes: string;
};

const INP = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid " + C.border,
  borderRadius: 8,
  boxSizing: "border-box" as const,
  fontSize: 14,
  background: C.white,
  color: C.text,
};

const NATUREZAS = [
  ["acordo", "Acordo"],
  ["execucao", "Execução"],
];

const FORMAS = [
  ["avista", "À vista"],
  ["parcelado", "Parcelado"],
];

const STATUS = [
  ["pendente", "Pendente"],
  ["em_dia", "Em dia"],
  ["atrasado", "Atrasado"],
  ["pago", "Pago"],
  ["quitado", "Quitado"],
  ["inadimplido", "Inadimplido"],
];

const CATEGORIAS = [
  ["todas", "Todas"],
  ["trabalhista", "Trabalhista"],
  ["civel", "Cível"],
  ["administrativo", "Administrativo"],
  ["tributario", "Tributário"],
  ["criminal", "Criminal"],
];

const CAMPOS_VALOR = [
  "valor_bruto",
  "deposito_ro",
  "deposito_rr",
  "deposito_embargos",
  "agravo_instrumento",
  "custas",
  "fgts",
  "honorarios_sucumbenciais",
  "honorarios_periciais",
  "honorarios_e_custos",
  "inss_reclamante",
  "inss_reclamada",
  "multa_inadimplemento",
  "valor_assegurado",
  "seguro_premio",
];

const CAMPOS_ENCARGOS = [
  "deposito_ro",
  "deposito_rr",
  "deposito_embargos",
  "agravo_instrumento",
  "custas",
  "fgts",
  "honorarios_sucumbenciais",
  "honorarios_periciais",
  "honorarios_e_custos",
  "inss_reclamante",
  "inss_reclamada",
  "multa_inadimplemento",
  "seguro_premio",
];

const initialForm: FormState = {
  id: "",
  processo_id: "",
  natureza: "acordo",
  data_referencia: "",
  valor_bruto: "",
  deposito_ro: "",
  deposito_rr: "",
  deposito_embargos: "",
  agravo_instrumento: "",
  custas: "",
  fgts: "",
  honorarios_sucumbenciais: "",
  honorarios_periciais: "",
  honorarios_e_custos: "",
  inss_reclamante: "",
  inss_reclamada: "",
  multa_inadimplemento: "",
  forma_pagamento: "avista",
  numero_parcelas: "1",
  primeiro_vencimento: "",
  status_pagamento: "pendente",
  seguro_garantia: false,
  apolice_numero: "",
  apolice_inicio: "",
  apolice_fim: "",
  valor_assegurado: "",
  seguro_premio: "",
  valor_restituido: "",
  observacoes: "",
};

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, minWidth: 0 }}>
      <label style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", display: "block", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={(event) => event.target === event.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div style={{ width: "100%", maxWidth: 980, maxHeight: "92vh", background: C.white, borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 18, borderBottom: "1px solid " + C.border }}>
          <b>{title}</b>
          <button onClick={onClose} style={{ border: 0, background: "transparent", cursor: "pointer", color: C.muted, fontWeight: 800 }}>Fechar</button>
        </div>
        <div style={{ padding: 18, overflow: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function label(arr: string[][], value?: string | null) {
  return arr.find((item) => item[0] === value)?.[1] || value || "-";
}

function parseMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let text = String(value).replace(/[^\d,.-]/g, "");
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  return Number(text) || 0;
}

function money(value: unknown) {
  return parseMoney(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateBR(value?: string | null) {
  return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "-";
}

function normalizeInputValue(value: unknown) {
  const number = parseMoney(value);
  return number ? String(number) : "";
}

function limparMarcadorValorRestituido(observacoes = "") {
  return String(observacoes || "").replace(/\n?\[VALOR_RESTITUIDO:[^\]]*\]/g, "").trim();
}

function valorRestituido(registro: RegistroFinanceiro) {
  const direto = parseMoney(registro.valor_restituido);
  if (direto > 0) return direto;
  const match = String(registro.observacoes || "").match(/\[VALOR_RESTITUIDO:([^\]]*)\]/);
  return match ? parseMoney(match[1]) : 0;
}

function juntarMarcadorValorRestituido(observacoes = "", valor: unknown) {
  const limpas = limparMarcadorValorRestituido(observacoes);
  const restituido = parseMoney(valor);
  return [limpas, restituido > 0 ? `[VALOR_RESTITUIDO:${restituido.toFixed(2)}]` : ""].filter(Boolean).join("\n");
}

function totalEncargos(registro: RegistroFinanceiro) {
  return CAMPOS_ENCARGOS.reduce((sum, field) => sum + parseMoney((registro as any)[field]), 0);
}

function totalRegistro(registro: RegistroFinanceiro) {
  return Math.max(parseMoney(registro.valor_bruto) + totalEncargos(registro) - valorRestituido(registro), 0);
}

function isPago(registro: RegistroFinanceiro) {
  const status = String(registro.status_pagamento || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["pago", "quitado", "concluido"].includes(status);
}

function isAtrasado(registro: RegistroFinanceiro) {
  if (isPago(registro)) return false;
  const vencimento = registro.primeiro_vencimento || registro.data_referencia;
  if (!vencimento) return String(registro.status_pagamento || "").toLowerCase() === "atrasado";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return String(registro.status_pagamento || "").toLowerCase() === "atrasado" || new Date(vencimento + "T12:00:00") < hoje;
}

function financeiroExcluido(registro: RegistroFinanceiro) {
  return String(registro.observacoes || "").includes("[REGISTRO_FINANCEIRO_EXCLUIDO:");
}

function processoLabel(processo?: Processo) {
  if (!processo) return "Processo não localizado";
  return [processo.numero, processo.titulo].filter(Boolean).join(" - ") || "Processo sem identificação";
}

function processoCategoria(processo?: Processo) {
  return processo?.categoria || "trabalhista";
}

function economiaElegivel(processo: Processo | undefined, registros: RegistroFinanceiro[]) {
  return processo?.transito_julgado === true || registros.some((registro) => ["acordo", "execucao"].includes(String(registro.natureza || "").toLowerCase()) && isPago(registro));
}

function withDeletedMarker(observacoes = "", evento: Record<string, unknown>) {
  const limpas = String(observacoes || "").replace(/\n?\[REGISTRO_FINANCEIRO_EXCLUIDO:[^\]]*\]/g, "").trim();
  return [limpas, `[REGISTRO_FINANCEIRO_EXCLUIDO:${encodeURIComponent(JSON.stringify(evento))}]`].filter(Boolean).join("\n");
}

let _financeiro_cache: any = null
const FINANCEIRO_CACHE_TTL = 5 * 60 * 1000

export default function Financeiro({ profile }: { profile: any }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [registros, setRegistros] = useState<RegistroFinanceiro[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [hasValorRestituidoColumn, setHasValorRestituidoColumn] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [filters, setFilters] = useState({
    search: "",
    natureza: "todos",
    status: "todos",
    categoria: "todas",
    data_inicio: "",
    data_fim: "",
    apolice: "todos",
  });
  const [empresasGrupo, setEmpresasGrupo] = useState<EmpresaGrupoRow[]>([]);
  const [empresaVista, setEmpresaVista] = useState("");

  const canCreate = can(profile, "financeiro.criar");
  const canEdit = can(profile, "financeiro.editar");
  const canDelete = can(profile, "financeiro.excluir");
  const firstLoad = useRef(true);

  async function load() {
    if (!profile?.escritorio_id) return;
    const eid = profile.escritorio_id;
    const isFirst = firstLoad.current;
    if (isFirst) firstLoad.current = false;
    if (isFirst && _financeiro_cache?.eid === eid && Date.now() - _financeiro_cache.ts < FINANCEIRO_CACHE_TTL) {
      setRegistros(_financeiro_cache.registros);
      setProcessos(_financeiro_cache.processos);
      setHasValorRestituidoColumn(_financeiro_cache.hasValorRestituido);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const [financeiros, processosData] = await Promise.all([
        fetchAllRows(() => supabase
          .from("financeiro_processos")
          .select("*")
          .eq("escritorio_id", eid)
          .order("created_at", { ascending: false })),
        fetchAllRows(() => supabase
          .from("processos")
          .select("id, numero, titulo, parte_contraria, categoria, status, valor_acao, transito_julgado")
          .eq("escritorio_id", eid)
          .order("updated_at", { ascending: false })),
      ]);
      const registrosFinanceiros = (financeiros || []) as RegistroFinanceiro[];
      const hasValorRestituido = registrosFinanceiros.some((r) => Object.prototype.hasOwnProperty.call(r, "valor_restituido"));
      setHasValorRestituidoColumn(hasValorRestituido);
      setRegistros(registrosFinanceiros);
      setProcessos((processosData || []) as Processo[]);
      _financeiro_cache = { eid, ts: Date.now(), registros: registrosFinanceiros, processos: (processosData || []) as Processo[], hasValorRestituido };
    } catch (error: any) {
      console.error("[Financeiro] Erro ao carregar dados:", error);
      setLoadError(error?.message || "Nao foi possivel carregar os dados financeiros.");
      setRegistros([]);
      setProcessos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [profile?.escritorio_id]);

  useEffect(() => {
    if (!profile?.escritorio_id) return;
    supabase
      .from("partes_crm")
      .select("id,nome,nome_fantasia")
      .eq("escritorio_id", profile.escritorio_id)
      .eq("tipo", "empresa_grupo")
      .eq("status", "ativo")
      .order("nome")
      .then(({ data }) => setEmpresasGrupo((data || []) as EmpresaGrupoRow[]));
  }, [profile?.escritorio_id]);

  useEffect(() => {
    if (!empresasGrupo.length) return;
    setEmpresaVista((v) => v || pickDefaultEmpresaGrupoId(empresasGrupo));
  }, [empresasGrupo]);

  const processoById = useMemo(() => {
    const map = new Map<string, Processo>();
    processos.forEach((processo) => map.set(processo.id, processo));
    return map;
  }, [processos]);

  const ativos = useMemo(() => registros.filter((registro) => !financeiroExcluido(registro)), [registros]);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return ativos.filter((registro) => {
      const processo = registro.processo_id ? processoById.get(registro.processo_id) : undefined;
      if (empresasGrupo.length && empresaVista) {
        if (!registro.processo_id) return false;
        if (empresaVista === CONSOLIDADO_KEY) {
          if (!processoPertenceAlgumaEmpresaGrupo(processo, empresasGrupo)) return false;
        } else {
          const emp = empresasGrupo.find((e) => String(e.id) === String(empresaVista));
          if (!processo || !emp || !processoPertenceEmpresaGrupo(processo, emp)) return false;
        }
      }
      if (filters.natureza !== "todos" && registro.natureza !== filters.natureza) return false;
      if (filters.status !== "todos" && String(registro.status_pagamento || "pendente") !== filters.status) return false;
      if (filters.categoria !== "todas" && processoCategoria(processo) !== filters.categoria) return false;
      if (filters.apolice === "sim" && !(registro.seguro_garantia || registro.apolice_numero || parseMoney(registro.valor_assegurado) > 0)) return false;
      if (filters.apolice === "nao" && (registro.seguro_garantia || registro.apolice_numero || parseMoney(registro.valor_assegurado) > 0)) return false;

      const dataBase = registro.data_referencia || registro.primeiro_vencimento || registro.created_at?.slice(0, 10) || "";
      if (filters.data_inicio && dataBase < filters.data_inicio) return false;
      if (filters.data_fim && dataBase > filters.data_fim) return false;

      if (!term) return true;
      return [
        processo?.numero,
        processo?.titulo,
        processo?.parte_contraria,
        processo?.categoria,
        registro.natureza,
        registro.status_pagamento,
        registro.apolice_numero,
        registro.observacoes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [ativos, filters, processoById, empresasGrupo, empresaVista]);

  const processosParaSelect = useMemo(() => {
    if (!empresasGrupo.length || !empresaVista || empresaVista === CONSOLIDADO_KEY) return processos;
    const emp = empresasGrupo.find((e) => String(e.id) === String(empresaVista));
    if (!emp) return processos;
    return processos.filter((p) => processoPertenceEmpresaGrupo(p, emp));
  }, [processos, empresasGrupo, empresaVista]);

  const resumo = useMemo(() => {
    const total = filtered.reduce((sum, registro) => sum + totalRegistro(registro), 0);
    const principal = filtered.reduce((sum, registro) => sum + parseMoney(registro.valor_bruto), 0);
    const encargos = filtered.reduce((sum, registro) => sum + totalEncargos(registro), 0);
    const restituido = filtered.reduce((sum, registro) => sum + valorRestituido(registro), 0);
    const pago = filtered.filter(isPago).reduce((sum, registro) => sum + totalRegistro(registro), 0);
    const atrasado = filtered.filter(isAtrasado).reduce((sum, registro) => sum + totalRegistro(registro), 0);
    const apolices = filtered.filter((registro) => registro.seguro_garantia || registro.apolice_numero || parseMoney(registro.valor_assegurado) > 0).length;
    return { total, principal, encargos, restituido, pago, pendente: Math.max(total - pago, 0), atrasado, apolices };
  }, [filtered]);

  function openForm(registro?: RegistroFinanceiro) {
    if (!registro) {
      setForm(initialForm);
      setModal(true);
      return;
    }

    setForm({
      id: registro.id,
      processo_id: registro.processo_id || "",
      natureza: registro.natureza || "acordo",
      data_referencia: registro.data_referencia || "",
      valor_bruto: normalizeInputValue(registro.valor_bruto),
      deposito_ro: normalizeInputValue(registro.deposito_ro),
      deposito_rr: normalizeInputValue(registro.deposito_rr),
      deposito_embargos: normalizeInputValue(registro.deposito_embargos),
      agravo_instrumento: normalizeInputValue(registro.agravo_instrumento),
      custas: normalizeInputValue(registro.custas),
      fgts: normalizeInputValue(registro.fgts),
      honorarios_sucumbenciais: normalizeInputValue(registro.honorarios_sucumbenciais),
      honorarios_periciais: normalizeInputValue(registro.honorarios_periciais),
      honorarios_e_custos: normalizeInputValue(registro.honorarios_e_custos),
      inss_reclamante: normalizeInputValue(registro.inss_reclamante),
      inss_reclamada: normalizeInputValue(registro.inss_reclamada),
      multa_inadimplemento: normalizeInputValue(registro.multa_inadimplemento),
      forma_pagamento: registro.forma_pagamento || "avista",
      numero_parcelas: String(registro.numero_parcelas || 1),
      primeiro_vencimento: registro.primeiro_vencimento || "",
      status_pagamento: registro.status_pagamento || "pendente",
      seguro_garantia: !!registro.seguro_garantia,
      apolice_numero: registro.apolice_numero || "",
      apolice_inicio: registro.apolice_inicio || "",
      apolice_fim: registro.apolice_fim || "",
      valor_assegurado: normalizeInputValue(registro.valor_assegurado),
      seguro_premio: normalizeInputValue(registro.seguro_premio),
      valor_restituido: normalizeInputValue(valorRestituido(registro)),
      observacoes: limparMarcadorValorRestituido(registro.observacoes || ""),
    });
    setModal(true);
  }

  async function atualizarResumoProcesso(processoId: string) {
    if (!processoId) return;
    const { data } = await supabase
      .from("financeiro_processos")
      .select("*")
      .eq("escritorio_id", profile.escritorio_id)
      .eq("processo_id", processoId);

    const financeiros = ((data || []) as RegistroFinanceiro[]).filter((registro) => !financeiroExcluido(registro));
    const processo = processoById.get(processoId) || processos.find((item) => item.id === processoId);
    const totalGasto = financeiros.reduce((sum, registro) => sum + totalRegistro(registro), 0);
    const valorAcao = parseMoney(processo?.valor_acao);
    const valorEconomizado = economiaElegivel(processo, financeiros) ? Math.max(valorAcao - totalGasto, 0) : 0;

    await supabase.from("processos").update({ valor_gasto: totalGasto, valor_economizado: valorEconomizado }).eq("id", processoId);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (form.id && !canEdit) return alert("Visitante possui acesso somente leitura.");
    if (!form.id && !canCreate) return alert("Visitante possui acesso somente leitura.");
    if (!form.processo_id) return alert("Selecione o processo vinculado.");

    setSaving(true);
    const parcelas = form.forma_pagamento === "parcelado" ? Math.max(2, Number(form.numero_parcelas || 2)) : 1;
    const payload: Record<string, unknown> = {
      ...form,
      escritorio_id: profile.escritorio_id,
      processo_id: form.processo_id,
      numero_parcelas: parcelas,
      primeiro_vencimento: form.primeiro_vencimento || null,
      data_referencia: form.data_referencia || null,
      seguro_garantia: !!form.seguro_garantia,
      observacoes: hasValorRestituidoColumn
        ? limparMarcadorValorRestituido(form.observacoes) || null
        : juntarMarcadorValorRestituido(form.observacoes, form.valor_restituido) || null,
    };

    delete payload.id;
    if (!hasValorRestituidoColumn) delete payload.valor_restituido;
    if (!form.id) payload.criado_por = profile.id;
    CAMPOS_VALOR.forEach((field) => {
      payload[field] = parseMoney((form as any)[field]);
    });
    if (hasValorRestituidoColumn) payload.valor_restituido = parseMoney(form.valor_restituido);

    if (!form.seguro_garantia) {
      payload.apolice_numero = null;
      payload.apolice_inicio = null;
      payload.apolice_fim = null;
      payload.valor_assegurado = 0;
      payload.seguro_premio = 0;
    } else {
      payload.apolice_inicio = form.apolice_inicio || null;
      payload.apolice_fim = form.apolice_fim || null;
    }

    const result = form.id
      ? await supabase.from("financeiro_processos").update(payload).eq("id", form.id).eq("escritorio_id", profile.escritorio_id)
      : await supabase.from("financeiro_processos").insert(payload);

    setSaving(false);
    if (result.error) return alert(result.error.message);

    await atualizarResumoProcesso(form.processo_id);
    setModal(false);
    setForm(initialForm);
    await load();
  }

  async function del(registro: RegistroFinanceiro) {
    if (!canDelete) return alert("Sem permissão para excluir lançamentos financeiros.");
    if (!window.confirm("Excluir este lançamento financeiro?")) return;

    const observacoes = withDeletedMarker(registro.observacoes || "", {
      acao: "registro_financeiro_ocultado",
      registro_id: registro.id,
      usuario_id: profile.id,
      usuario_nome: profile.nome || profile.email || profile.id,
      data: new Date().toISOString(),
      valor_total: totalRegistro(registro),
    });

    const { error } = await supabase
      .from("financeiro_processos")
      .update({ observacoes })
      .eq("id", registro.id)
      .eq("escritorio_id", profile.escritorio_id);

    if (error) return alert(error.message);
    if (registro.processo_id) await atualizarResumoProcesso(registro.processo_id);
    await load();
  }

  const cards = [
    { title: "Total financeiro", value: resumo.total, icon: Wallet, color: C.text, sub: `${filtered.length} registro(s)` },
    { title: "Principal", value: resumo.principal, icon: FileText, color: C.blue, sub: "acordos e execuções" },
    { title: "Encargos", value: resumo.encargos, icon: AlertTriangle, color: C.amber, sub: "custas, depósitos e honorários" },
    { title: "Restituido", value: resumo.restituido, icon: CheckCircle, color: C.green, sub: "valores devolvidos" },
    { title: "Pago / quitado", value: resumo.pago, icon: CheckCircle, color: C.green, sub: "status finalizado" },
    { title: "Pendente", value: resumo.pendente, icon: AlertTriangle, color: resumo.pendente ? C.amber : C.green, sub: "em aberto" },
    { title: "Seguro-garantia", value: resumo.apolices, icon: ShieldCheck, color: C.blue, sub: "apólice(s)", count: true },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text }}>Financeiro</h1>
          <p style={{ color: C.muted, margin: "6px 0 0" }}>Acordos, execuções, encargos, pagamentos e seguro-garantia.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => navigate("/processos")} style={{ border: "1px solid " + C.border, background: C.white, color: C.text, borderRadius: 8, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>
            Processos
          </button>
          {canCreate && (
            <button onClick={() => openForm()} style={{ background: C.navy, color: "white", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 800, display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <Plus size={16} />Novo lançamento
            </button>
          )}
        </div>
      </div>

      <EmpresaGrupoToggleBar empresas={empresasGrupo} value={empresaVista} onChange={setEmpresaVista} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginTop: 22 }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>{card.title}</div>
                <Icon size={16} color={card.color} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: card.color, marginTop: 8 }}>{card.count ? card.value : money(card.value)}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{card.sub}</div>
            </div>
          );
        })}
      </div>

      <section style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 12, padding: 14, marginTop: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 13, color: C.muted }} />
            <input
              style={{ ...INP, paddingLeft: 34 }}
              placeholder="Buscar por processo, parte ou apólice"
              value={filters.search}
              onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value }))}
            />
          </div>
          <select style={INP} value={filters.natureza} onChange={(event) => setFilters((old) => ({ ...old, natureza: event.target.value }))}>
            <option value="todos">Natureza</option>
            {NATUREZAS.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
          </select>
          <select style={INP} value={filters.status} onChange={(event) => setFilters((old) => ({ ...old, status: event.target.value }))}>
            <option value="todos">Status</option>
            {STATUS.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
          </select>
          <select style={INP} value={filters.categoria} onChange={(event) => setFilters((old) => ({ ...old, categoria: event.target.value }))}>
            {CATEGORIAS.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
          </select>
          <select style={INP} value={filters.apolice} onChange={(event) => setFilters((old) => ({ ...old, apolice: event.target.value }))}>
            <option value="todos">Apólice</option>
            <option value="sim">Com apólice</option>
            <option value="nao">Sem apólice</option>
          </select>
          <input type="date" style={INP} value={filters.data_inicio} onChange={(event) => setFilters((old) => ({ ...old, data_inicio: event.target.value }))} />
          <input type="date" style={INP} value={filters.data_fim} onChange={(event) => setFilters((old) => ({ ...old, data_fim: event.target.value }))} />
        </div>
      </section>

      <section style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 12, marginTop: 22, overflow: "hidden" }}>
        {loadError && (
          <div style={{ padding: "12px 14px", borderBottom: "1px solid " + C.border, background: C.redBg, color: C.red, fontSize: 13, fontWeight: 700 }}>
            Nao foi possivel carregar o financeiro: {loadError}
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1260, fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.grayBg, color: C.muted, textTransform: "uppercase", fontSize: 11, letterSpacing: ".05em" }}>
                <th style={{ padding: 12, textAlign: "left" }}>Processo</th>
                <th style={{ padding: 12, textAlign: "left" }}>Parte</th>
                <th style={{ padding: 12, textAlign: "left" }}>Natureza</th>
                <th style={{ padding: 12, textAlign: "left" }}>Referência</th>
                <th style={{ padding: 12, textAlign: "left" }}>Vencimento</th>
                <th style={{ padding: 12, textAlign: "right" }}>Principal</th>
                <th style={{ padding: 12, textAlign: "right" }}>Encargos</th>
                <th style={{ padding: 12, textAlign: "right" }}>Restituido</th>
                <th style={{ padding: 12, textAlign: "right" }}>Total</th>
                <th style={{ padding: 12, textAlign: "left" }}>Status</th>
                <th style={{ padding: 12, textAlign: "left" }}>Seguro</th>
                <th style={{ padding: 12, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} style={{ padding: 30, textAlign: "center", color: C.muted }}>Carregando financeiro...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: 30, textAlign: "center", color: C.muted }}>Nenhum registro financeiro encontrado.</td></tr>
              ) : (
                filtered.map((registro) => {
                  const processo = registro.processo_id ? processoById.get(registro.processo_id) : undefined;
                  const atrasado = isAtrasado(registro);
                  const pago = isPago(registro);
                  return (
                    <tr key={registro.id} style={{ borderTop: "1px solid " + C.border }}>
                      <td style={{ padding: 12, verticalAlign: "top", color: C.text }}>
                        <div className="prv" style={{ fontFamily: "monospace", fontSize: 12, color: C.muted }}>{processo?.numero || "sem número"}</div>
                        <b className="prv">{processo?.titulo || "Processo não localizado"}</b>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{label(CATEGORIAS, processoCategoria(processo))}</div>
                      </td>
                      <td className="prv" style={{ padding: 12, verticalAlign: "top", color: C.muted }}>{processo?.parte_contraria || "-"}</td>
                      <td style={{ padding: 12, verticalAlign: "top", color: C.text }}>{label(NATUREZAS, registro.natureza)}</td>
                      <td style={{ padding: 12, verticalAlign: "top", color: C.muted }}>{dateBR(registro.data_referencia)}</td>
                      <td style={{ padding: 12, verticalAlign: "top", color: atrasado ? C.red : C.muted }}>{dateBR(registro.primeiro_vencimento)}</td>
                      <td className="prv" style={{ padding: 12, verticalAlign: "top", textAlign: "right", fontWeight: 800 }}>{money(registro.valor_bruto)}</td>
                      <td className="prv" style={{ padding: 12, verticalAlign: "top", textAlign: "right", color: totalEncargos(registro) ? C.amber : C.muted }}>{money(totalEncargos(registro))}</td>
                      <td className="prv" style={{ padding: 12, verticalAlign: "top", textAlign: "right", color: valorRestituido(registro) ? C.green : C.muted }}>{money(valorRestituido(registro))}</td>
                      <td className="prv" style={{ padding: 12, verticalAlign: "top", textAlign: "right", fontWeight: 900 }}>{money(totalRegistro(registro))}</td>
                      <td style={{ padding: 12, verticalAlign: "top" }}>
                        <span style={{ display: "inline-flex", border: "1px solid " + (pago ? "#86efac" : atrasado ? "#fecaca" : "#fde68a"), background: pago ? C.greenBg : atrasado ? C.redBg : C.amberBg, color: pago ? C.green : atrasado ? C.red : C.amber, borderRadius: 999, padding: "4px 9px", fontSize: 12, fontWeight: 900 }}>
                          {atrasado && !pago ? "Atrasado" : label(STATUS, registro.status_pagamento || "pendente")}
                        </span>
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", color: C.muted }}>
                        {registro.seguro_garantia || registro.apolice_numero ? (
                          <>
                            <b style={{ color: C.text }}>{registro.apolice_numero || "Sim"}</b>
                            <div style={{ fontSize: 12 }}>{money(registro.valor_assegurado)}</div>
                          </>
                        ) : "-"}
                      </td>
                      <td style={{ padding: 12, verticalAlign: "top", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {canEdit && (
                            <button title="Editar" onClick={() => openForm(registro)} style={{ border: "1px solid " + C.border, background: C.white, color: C.blue, borderRadius: 8, padding: 8, cursor: "pointer" }}>
                              <Edit2 size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button title="Excluir" onClick={() => del(registro)} style={{ border: "1px solid #fecaca", background: C.redBg, color: C.red, borderRadius: 8, padding: 8, cursor: "pointer" }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <Modal title={form.id ? "Editar lançamento financeiro" : "Novo lançamento financeiro"} onClose={() => setModal(false)}>
          <form onSubmit={save}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
              <F label="Processo vinculado">
                <select required style={INP} value={form.processo_id} onChange={(event) => setForm((old) => ({ ...old, processo_id: event.target.value }))}>
                  <option value="">Selecione</option>
                  {processosParaSelect.map((processo) => <option key={processo.id} value={processo.id}>{processoLabel(processo)}</option>)}
                </select>
              </F>
              <F label="Natureza">
                <select style={INP} value={form.natureza} onChange={(event) => setForm((old) => ({ ...old, natureza: event.target.value }))}>
                  {NATUREZAS.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
                </select>
              </F>
              <F label="Data de referência">
                <input type="date" style={INP} value={form.data_referencia} onChange={(event) => setForm((old) => ({ ...old, data_referencia: event.target.value }))} />
              </F>
              <F label="Status pagamento">
                <select style={INP} value={form.status_pagamento} onChange={(event) => setForm((old) => ({ ...old, status_pagamento: event.target.value }))}>
                  {STATUS.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
                </select>
              </F>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
              <F label="Valor bruto / acordo"><input type="number" step="0.01" min="0" style={INP} value={form.valor_bruto} onChange={(event) => setForm((old) => ({ ...old, valor_bruto: event.target.value }))} /></F>
              <F label="Depósito RO"><input type="number" step="0.01" min="0" style={INP} value={form.deposito_ro} onChange={(event) => setForm((old) => ({ ...old, deposito_ro: event.target.value }))} /></F>
              <F label="Depósito RR"><input type="number" step="0.01" min="0" style={INP} value={form.deposito_rr} onChange={(event) => setForm((old) => ({ ...old, deposito_rr: event.target.value }))} /></F>
              <F label="Depósito embargos"><input type="number" step="0.01" min="0" style={INP} value={form.deposito_embargos} onChange={(event) => setForm((old) => ({ ...old, deposito_embargos: event.target.value }))} /></F>
              <F label="AGRAVO DE INSTRUMENTO"><input type="number" step="0.01" min="0" style={INP} value={form.agravo_instrumento} onChange={(event) => setForm((old) => ({ ...old, agravo_instrumento: event.target.value }))} /></F>
              <F label="Custas"><input type="number" step="0.01" min="0" style={INP} value={form.custas} onChange={(event) => setForm((old) => ({ ...old, custas: event.target.value }))} /></F>
              <F label="FGTS"><input type="number" step="0.01" min="0" style={INP} value={form.fgts} onChange={(event) => setForm((old) => ({ ...old, fgts: event.target.value }))} /></F>
              <F label="Honorários sucumbenciais"><input type="number" step="0.01" min="0" style={INP} value={form.honorarios_sucumbenciais} onChange={(event) => setForm((old) => ({ ...old, honorarios_sucumbenciais: event.target.value }))} /></F>
              <F label="Honorários periciais"><input type="number" step="0.01" min="0" style={INP} value={form.honorarios_periciais} onChange={(event) => setForm((old) => ({ ...old, honorarios_periciais: event.target.value }))} /></F>
              <F label="Honorários e custos"><input type="number" step="0.01" min="0" style={INP} value={form.honorarios_e_custos} onChange={(event) => setForm((old) => ({ ...old, honorarios_e_custos: event.target.value }))} /></F>
              <F label="INSS reclamante"><input type="number" step="0.01" min="0" style={INP} value={form.inss_reclamante} onChange={(event) => setForm((old) => ({ ...old, inss_reclamante: event.target.value }))} /></F>
              <F label="INSS reclamada"><input type="number" step="0.01" min="0" style={INP} value={form.inss_reclamada} onChange={(event) => setForm((old) => ({ ...old, inss_reclamada: event.target.value }))} /></F>
              <F label="Multa"><input type="number" step="0.01" min="0" style={INP} value={form.multa_inadimplemento} onChange={(event) => setForm((old) => ({ ...old, multa_inadimplemento: event.target.value }))} /></F>
              <F label="Valor restituido"><input type="number" step="0.01" min="0" style={INP} value={form.valor_restituido} onChange={(event) => setForm((old) => ({ ...old, valor_restituido: event.target.value }))} /></F>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
              <F label="Forma de pagamento">
                <select style={INP} value={form.forma_pagamento} onChange={(event) => setForm((old) => ({ ...old, forma_pagamento: event.target.value, numero_parcelas: event.target.value === "avista" ? "1" : old.numero_parcelas }))}>
                  {FORMAS.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
                </select>
              </F>
              <F label="Número de parcelas"><input type="number" min={form.forma_pagamento === "parcelado" ? 2 : 1} style={INP} value={form.numero_parcelas} disabled={form.forma_pagamento === "avista"} onChange={(event) => setForm((old) => ({ ...old, numero_parcelas: event.target.value }))} /></F>
              <F label="Primeiro vencimento"><input type="date" style={INP} value={form.primeiro_vencimento} onChange={(event) => setForm((old) => ({ ...old, primeiro_vencimento: event.target.value }))} /></F>
              <F label="Seguro-garantia">
                <select style={INP} value={form.seguro_garantia ? "sim" : "nao"} onChange={(event) => setForm((old) => ({ ...old, seguro_garantia: event.target.value === "sim" }))}>
                  <option value="nao">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </F>
            </div>

            {form.seguro_garantia && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, background: C.grayBg, border: "1px solid " + C.border, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <F label="Número da apólice"><input style={INP} value={form.apolice_numero} onChange={(event) => setForm((old) => ({ ...old, apolice_numero: event.target.value }))} /></F>
                <F label="Início vigência"><input type="date" style={INP} value={form.apolice_inicio} onChange={(event) => setForm((old) => ({ ...old, apolice_inicio: event.target.value }))} /></F>
                <F label="Fim vigência"><input type="date" style={INP} value={form.apolice_fim} onChange={(event) => setForm((old) => ({ ...old, apolice_fim: event.target.value }))} /></F>
                <F label="Valor assegurado"><input type="number" step="0.01" min="0" style={INP} value={form.valor_assegurado} onChange={(event) => setForm((old) => ({ ...old, valor_assegurado: event.target.value }))} /></F>
                <F label="Prêmio pago"><input type="number" step="0.01" min="0" style={INP} value={form.seguro_premio} onChange={(event) => setForm((old) => ({ ...old, seguro_premio: event.target.value }))} /></F>
              </div>
            )}

            <F label="Observações">
              <textarea style={{ ...INP, minHeight: 90 }} value={form.observacoes} onChange={(event) => setForm((old) => ({ ...old, observacoes: event.target.value }))} />
            </F>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setModal(false)} style={{ border: "1px solid " + C.border, background: C.white, color: C.text, borderRadius: 8, padding: "10px 14px", fontWeight: 800, cursor: "pointer" }}>Cancelar</button>
              <button disabled={saving} type="submit" style={{ border: 0, background: C.navy, color: "white", borderRadius: 8, padding: "10px 16px", fontWeight: 800, cursor: "pointer", opacity: saving ? 0.65 : 1 }}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
