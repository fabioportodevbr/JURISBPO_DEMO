import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

type Props = {
  processoId: string;
  clienteId?: string | null;
  escritorioId: string;
  onNovoLancamento?: () => void;
};

type Lancamento = {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  valor_bruto: number;
  valor_liquido: number | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function statusClass(status: string) {
  if (status === "pago") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "atrasado") return "bg-red-100 text-red-800 border-red-200";
  if (status === "parcial") return "bg-blue-100 text-blue-800 border-blue-200";
  if (status === "cancelado") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export function FinanceiroProcessoCard({ processoId, onNovoLancamento }: Props) {
  const [items, setItems] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select("id, tipo, descricao, status, valor_bruto, valor_liquido, data_vencimento, data_pagamento")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: false });

      if (!error) setItems((data || []) as Lancamento[]);
      setLoading(false);
    }

    if (processoId) load();
  }, [processoId]);

  const resumo = useMemo(() => {
    const valorBruto = items.reduce((sum, item) => sum + Number(item.valor_bruto || 0), 0);
    const valorRecebido = items
      .filter((item) => item.status === "pago")
      .reduce((sum, item) => sum + Number(item.valor_liquido || item.valor_bruto || 0), 0);
    const valorPendente = items
      .filter((item) => ["pendente", "parcial", "atrasado"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.valor_bruto || 0), 0);

    const statusPagamento = valorPendente <= 0 && valorRecebido > 0 ? "Pago" : valorRecebido > 0 ? "Parcial" : "Pendente";
    return { valorBruto, valorRecebido, valorPendente, statusPagamento };
  }, [items]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Financeiro do processo</h2>
          <p className="text-sm text-slate-500">Acordos, honorários, custas e pagamentos vinculados.</p>
        </div>
        {onNovoLancamento && (
          <button onClick={onNovoLancamento} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
            <Plus className="h-4 w-4" />
            Criar lançamento financeiro
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Valor bruto</p><p className="font-semibold text-slate-900">{currency.format(resumo.valorBruto)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Valor recebido</p><p className="font-semibold text-slate-900">{currency.format(resumo.valorRecebido)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Valor pendente</p><p className="font-semibold text-slate-900">{currency.format(resumo.valorPendente)}</p></div>
        <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Status de pagamento</p><p className="font-semibold text-slate-900">{resumo.statusPagamento}</p></div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2 pr-4">Descrição</th>
              <th className="py-2 pr-4">Tipo</th>
              <th className="py-2 pr-4">Valor</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Vencimento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="py-4 text-slate-500" colSpan={5}>Carregando histórico financeiro...</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="py-4 text-slate-500" colSpan={5}>Nenhum lançamento vinculado a este processo.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 pr-4 text-slate-900">{item.descricao}</td>
                  <td className="py-3 pr-4 text-slate-600">{item.tipo}</td>
                  <td className="py-3 pr-4 font-medium text-slate-900">{currency.format(Number(item.valor_liquido || item.valor_bruto || 0))}</td>
                  <td className="py-3 pr-4"><span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(item.status)}`}>{item.status}</span></td>
                  <td className="py-3 pr-4 text-slate-600">{item.data_vencimento || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
