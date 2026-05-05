import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, AlertCircle, FileText, TrendingUp } from "lucide-react";

type Lancamento = {
  tipo: string;
  status: string;
  valor_bruto: number;
  valor_liquido: number | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function FinanceiroResumoDashboard() {
  const [items, setItems] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("escritorio_id")
        .eq("id", userId)
        .single();

      if (!profile?.escritorio_id) {
        setLoading(false);
        return;
      }

      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("financeiro_lancamentos")
        .select("tipo, status, valor_bruto, valor_liquido, data_pagamento, data_vencimento")
        .eq("escritorio_id", profile.escritorio_id)
        .or(`data_pagamento.gte.${firstDay},data_vencimento.gte.${firstDay}`)
        .or(`data_pagamento.lte.${lastDay},data_vencimento.lte.${lastDay}`);

      if (!error) setItems((data || []) as Lancamento[]);
      setLoading(false);
    }

    load();
  }, []);

  const resumo = useMemo(() => {
    const receitas = items.filter((item) => ["receita", "honorario", "acordo", "reembolso"].includes(item.tipo));
    const receitaMes = receitas
      .filter((item) => item.status === "pago")
      .reduce((sum, item) => sum + Number(item.valor_liquido || item.valor_bruto || 0), 0);
    const pendencias = items
      .filter((item) => ["pendente", "parcial", "atrasado"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.valor_bruto || 0), 0);
    const acordosPendentes = items
      .filter((item) => item.tipo === "acordo" && ["pendente", "parcial", "atrasado"].includes(item.status))
      .reduce((sum, item) => sum + Number(item.valor_bruto || 0), 0);
    const totalRecebido = receitas
      .filter((item) => item.status === "pago")
      .reduce((sum, item) => sum + Number(item.valor_liquido || item.valor_bruto || 0), 0);

    return { receitaMes, pendencias, acordosPendentes, totalRecebido };
  }, [items]);

  const cards = [
    { label: "Receita do mês", value: resumo.receitaMes, icon: TrendingUp },
    { label: "Pendências financeiras", value: resumo.pendencias, icon: AlertCircle },
    { label: "Acordos pendentes", value: resumo.acordosPendentes, icon: FileText },
    { label: "Total recebido", value: resumo.totalRecebido, icon: Wallet },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Resumo financeiro</h2>
          <p className="text-sm text-slate-500">Visão rápida do mês atual.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-900">{loading ? "..." : currency.format(card.value)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
