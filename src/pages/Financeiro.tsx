import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Wallet, TrendingUp, TrendingDown, AlertCircle, Scale, FileText } from "lucide-react";

type FinanceiroTipo = "receita" | "despesa" | "honorario" | "acordo" | "custas" | "reembolso" | "outro";
type FinanceiroStatus = "pendente" | "pago" | "atrasado" | "cancelado" | "parcial";
type FormaPagamento = "pix" | "boleto" | "transferencia" | "cartao" | "dinheiro" | "outro";

type Lancamento = {
  id: string;
  escritorio_id: string;
  cliente_id: string | null;
  processo_id: string | null;
  contrato_id: string | null;
  criado_por: string | null;
  tipo: FinanceiroTipo;
  categoria: string | null;
  descricao: string;
  valor_bruto: number;
  valor_liquido: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  forma_pagamento: FormaPagamento | null;
  status: FinanceiroStatus;
  observacoes: string | null;
  created_at: string;
  clientes?: { nome: string | null } | null;
  processos?: { numero_processo: string | null; titulo: string | null } | null;
};

type Option = { id: string; label: string };

type FormState = {
  tipo: FinanceiroTipo;
  descricao: string;
  cliente_id: string;
  processo_id: string;
  contrato_id: string;
  categoria: string;
  valor_bruto: string;
  valor_liquido: string;
  data_vencimento: string;
  data_pagamento: string;
  forma_pagamento: "" | FormaPagamento;
  status: FinanceiroStatus;
  observacoes: string;
};

const initialForm: FormState = {
  tipo: "receita",
  descricao: "",
  cliente_id: "",
  processo_id: "",
  contrato_id: "",
  categoria: "",
  valor_bruto: "",
  valor_liquido: "",
  data_vencimento: "",
  data_pagamento: "",
  forma_pagamento: "",
  status: "pendente",
  observacoes: "",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number | null | undefined) {
  return currency.format(Number(value || 0));
}

function normalizeMoney(value: string) {
  if (!value) return 0;
  return Number(value.replace(/\./g, "").replace(",", ".")) || 0;
}

function labelize(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

function statusClass(status: FinanceiroStatus) {
  const classes = {
    pago: "bg-emerald-100 text-emerald-800 border-emerald-200",
    pendente: "bg-amber-100 text-amber-800 border-amber-200",
    atrasado: "bg-red-100 text-red-800 border-red-200",
    cancelado: "bg-slate-100 text-slate-700 border-slate-200",
    parcial: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return classes[status] || classes.pendente;
}

function tipoClass(tipo: FinanceiroTipo) {
  if (["receita", "honorario", "acordo", "reembolso"].includes(tipo)) return "text-emerald-700";
  if (["despesa", "custas"].includes(tipo)) return "text-red-700";
  return "text-slate-700";
}

export default function Financeiro() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [clientes, setClientes] = useState<Option[]>([]);
  const [processos, setProcessos] = useState<Option[]>([]);
  const [contratos, setContratos] = useState<Option[]>([]);
  const [profile, setProfile] = useState<{ id: string; escritorio_id: string } | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [filters, setFilters] = useState({
    search: "",
    cliente_id: "",
    processo_id: "",
    status: "",
    tipo: "",
    forma_pagamento: "",
    data_inicio: "",
    data_fim: "",
  });

  async function loadBaseData() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, escritorio_id")
      .eq("id", userId)
      .single();

    if (profileError || !profileData?.escritorio_id) {
      console.error("Perfil sem escritorio_id", profileError);
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const [clientesRes, processosRes, contratosRes] = await Promise.all([
      supabase.from("clientes").select("id, nome").eq("escritorio_id", profileData.escritorio_id).order("nome"),
      supabase.from("processos").select("id, numero_processo, titulo").eq("escritorio_id", profileData.escritorio_id).order("created_at", { ascending: false }),
      supabase.from("contratos").select("id, titulo, numero").eq("escritorio_id", profileData.escritorio_id).order("created_at", { ascending: false }),
    ]);

    setClientes((clientesRes.data || []).map((c: any) => ({ id: c.id, label: c.nome || "Cliente sem nome" })));
    setProcessos((processosRes.data || []).map((p: any) => ({ id: p.id, label: p.numero_processo || p.titulo || "Processo sem identificação" })));
    setContratos((contratosRes.data || []).map((c: any) => ({ id: c.id, label: c.titulo || c.numero || "Contrato sem identificação" })));

    await loadLancamentos(profileData.escritorio_id);
    setLoading(false);
  }

  async function loadLancamentos(escritorioId = profile?.escritorio_id) {
    if (!escritorioId) return;

    let query = supabase
      .from("financeiro_lancamentos")
      .select("*, clientes(nome), processos(numero_processo, titulo)")
      .eq("escritorio_id", escritorioId)
      .order("data_vencimento", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (filters.cliente_id) query = query.eq("cliente_id", filters.cliente_id);
    if (filters.processo_id) query = query.eq("processo_id", filters.processo_id);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.tipo) query = query.eq("tipo", filters.tipo);
    if (filters.forma_pagamento) query = query.eq("forma_pagamento", filters.forma_pagamento);
    if (filters.data_inicio) query = query.gte("data_vencimento", filters.data_inicio);
    if (filters.data_fim) query = query.lte("data_vencimento", filters.data_fim);

    const { data, error } = await query;
    if (error) {
      console.error("Erro ao carregar financeiro", error);
      return;
    }

    const normalized = (data || []) as Lancamento[];
    const search = filters.search.trim().toLowerCase();
    setLancamentos(
      search
        ? normalized.filter((item) =>
            [item.descricao, item.categoria, item.clientes?.nome, item.processos?.numero_processo, item.processos?.titulo]
              .filter(Boolean)
              .some((field) => String(field).toLowerCase().includes(search))
          )
        : normalized
    );
  }

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (profile?.escritorio_id) loadLancamentos(profile.escritorio_id);
  }, [filters]);

  const resumo = useMemo(() => {
    const receitas = lancamentos.filter((l) => ["receita", "honorario", "acordo", "reembolso"].includes(l.tipo));
    const despesas = lancamentos.filter((l) => ["despesa", "custas"].includes(l.tipo));

    const receitaPrevista = receitas
      .filter((l) => ["pendente", "parcial", "atrasado"].includes(l.status))
      .reduce((sum, l) => sum + Number(l.valor_bruto || 0), 0);

    const receitaRecebida = receitas
      .filter((l) => l.status === "pago")
      .reduce((sum, l) => sum + Number(l.valor_liquido || l.valor_bruto || 0), 0);

    const valoresPendentes = lancamentos
      .filter((l) => ["pendente", "parcial", "atrasado"].includes(l.status))
      .reduce((sum, l) => sum + Number(l.valor_bruto || 0), 0);

    const despesasTotal = despesas.reduce((sum, l) => sum + Number(l.valor_liquido || l.valor_bruto || 0), 0);
    const acordosAbertos = lancamentos
      .filter((l) => l.tipo === "acordo" && ["pendente", "parcial", "atrasado"].includes(l.status))
      .reduce((sum, l) => sum + Number(l.valor_bruto || 0), 0);

    return {
      receitaPrevista,
      receitaRecebida,
      valoresPendentes,
      despesas: despesasTotal,
      saldoPeriodo: receitaRecebida - despesasTotal,
      acordosAbertos,
    };
  }, [lancamentos]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    const { error } = await supabase.from("financeiro_lancamentos").insert({
      escritorio_id: profile.escritorio_id,
      criado_por: profile.id,
      tipo: form.tipo,
      descricao: form.descricao,
      cliente_id: form.cliente_id || null,
      processo_id: form.processo_id || null,
      contrato_id: form.contrato_id || null,
      categoria: form.categoria || null,
      valor_bruto: normalizeMoney(form.valor_bruto),
      valor_liquido: form.valor_liquido ? normalizeMoney(form.valor_liquido) : null,
      data_vencimento: form.data_vencimento || null,
      data_pagamento: form.data_pagamento || null,
      forma_pagamento: form.forma_pagamento || null,
      status: form.status,
      observacoes: form.observacoes || null,
    });

    setSaving(false);
    if (error) {
      console.error("Erro ao salvar lançamento", error);
      alert("Não foi possível salvar o lançamento financeiro.");
      return;
    }

    setModalOpen(false);
    setForm(initialForm);
    await loadLancamentos();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Deseja excluir este lançamento financeiro?");
    if (!confirmed) return;

    const { error } = await supabase.from("financeiro_lancamentos").delete().eq("id", id);
    if (error) {
      console.error("Erro ao excluir lançamento", error);
      alert("Não foi possível excluir o lançamento.");
      return;
    }

    await loadLancamentos();
  }

  const cards = [
    { title: "Receita prevista", value: resumo.receitaPrevista, icon: TrendingUp },
    { title: "Receita recebida", value: resumo.receitaRecebida, icon: Wallet },
    { title: "Valores pendentes", value: resumo.valoresPendentes, icon: AlertCircle },
    { title: "Despesas", value: resumo.despesas, icon: TrendingDown },
    { title: "Saldo do período", value: resumo.saldoPeriodo, icon: Scale },
    { title: "Acordos em aberto", value: resumo.acordosAbertos, icon: FileText },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Financeiro</h1>
          <p className="text-sm text-slate-500">Controle de receitas, despesas, acordos e pagamentos do escritório.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Novo lançamento
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.title}</span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-900">{formatCurrency(card.value)}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <label className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((old) => ({ ...old, search: e.target.value }))}
              placeholder="Buscar descrição, cliente ou processo"
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <input type="date" value={filters.data_inicio} onChange={(e) => setFilters((old) => ({ ...old, data_inicio: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={filters.data_fim} onChange={(e) => setFilters((old) => ({ ...old, data_fim: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select value={filters.cliente_id} onChange={(e) => setFilters((old) => ({ ...old, cliente_id: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Cliente</option>
            {clientes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={filters.processo_id} onChange={(e) => setFilters((old) => ({ ...old, processo_id: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Processo</option>
            {processos.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((old) => ({ ...old, status: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
            <option value="cancelado">Cancelado</option>
            <option value="parcial">Parcial</option>
          </select>
          <select value={filters.tipo} onChange={(e) => setFilters((old) => ({ ...old, tipo: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Tipo</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
            <option value="honorario">Honorário</option>
            <option value="acordo">Acordo</option>
            <option value="custas">Custas</option>
            <option value="reembolso">Reembolso</option>
            <option value="outro">Outro</option>
          </select>
          <select value={filters.forma_pagamento} onChange={(e) => setFilters((old) => ({ ...old, forma_pagamento: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="">Forma de pagamento</option>
            <option value="pix">Pix</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
            <option value="cartao">Cartão</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Processo vinculado</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Forma</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">Carregando financeiro...</td></tr>
              ) : lancamentos.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">Nenhum lançamento financeiro encontrado.</td></tr>
              ) : (
                lancamentos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.data_pagamento || item.created_at?.slice(0, 10)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 font-medium ${tipoClass(item.tipo)}`}>{labelize(item.tipo)}</td>
                    <td className="min-w-[220px] px-4 py-3 text-slate-900">{item.descricao}</td>
                    <td className="px-4 py-3 text-slate-600">{item.clientes?.nome || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.processos?.numero_processo || item.processos?.titulo || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.categoria || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{formatCurrency(item.valor_liquido || item.valor_bruto)}</td>
                    <td className="px-4 py-3 text-slate-600">{labelize(item.forma_pagamento)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>{labelize(item.status)}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.data_vencimento || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => handleDelete(item.id)} className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Excluir</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Novo lançamento</h2>
                <p className="text-sm text-slate-500">Registre receitas, despesas, acordos, honorários ou custas.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100">Fechar</button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <select required value={form.tipo} onChange={(e) => setForm((old) => ({ ...old, tipo: e.target.value as FinanceiroTipo }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
                <option value="honorario">Honorário</option>
                <option value="acordo">Acordo</option>
                <option value="custas">Custas</option>
                <option value="reembolso">Reembolso</option>
                <option value="outro">Outro</option>
              </select>

              <input required value={form.descricao} onChange={(e) => setForm((old) => ({ ...old, descricao: e.target.value }))} placeholder="Descrição" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />

              <select value={form.cliente_id} onChange={(e) => setForm((old) => ({ ...old, cliente_id: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Cliente vinculado</option>
                {clientes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>

              <select value={form.processo_id} onChange={(e) => setForm((old) => ({ ...old, processo_id: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Processo vinculado opcional</option>
                {processos.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>

              <select value={form.contrato_id} onChange={(e) => setForm((old) => ({ ...old, contrato_id: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Contrato vinculado opcional</option>
                {contratos.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>

              <input value={form.categoria} onChange={(e) => setForm((old) => ({ ...old, categoria: e.target.value }))} placeholder="Categoria" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input required inputMode="decimal" value={form.valor_bruto} onChange={(e) => setForm((old) => ({ ...old, valor_bruto: e.target.value }))} placeholder="Valor bruto" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input inputMode="decimal" value={form.valor_liquido} onChange={(e) => setForm((old) => ({ ...old, valor_liquido: e.target.value }))} placeholder="Valor líquido" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />

              <label className="text-sm text-slate-600">Data de vencimento
                <input type="date" value={form.data_vencimento} onChange={(e) => setForm((old) => ({ ...old, data_vencimento: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>
              <label className="text-sm text-slate-600">Data de pagamento
                <input type="date" value={form.data_pagamento} onChange={(e) => setForm((old) => ({ ...old, data_pagamento: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </label>

              <select value={form.forma_pagamento} onChange={(e) => setForm((old) => ({ ...old, forma_pagamento: e.target.value as any }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Forma de pagamento</option>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="cartao">Cartão</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="outro">Outro</option>
              </select>

              <select value={form.status} onChange={(e) => setForm((old) => ({ ...old, status: e.target.value as FinanceiroStatus }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
                <option value="parcial">Parcial</option>
              </select>

              <textarea value={form.observacoes} onChange={(e) => setForm((old) => ({ ...old, observacoes: e.target.value }))} placeholder="Observações" className="md:col-span-2 min-h-24 rounded-xl border border-slate-200 px-3 py-2 text-sm" />

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button disabled={saving} type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
                  {saving ? "Salvando..." : "Salvar lançamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
