import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, FileText, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase.js";

type RegistroFinanceiro = {
  natureza?: string | null;
  status_pagamento?: string | null;
  valor_bruto?: number | string | null;
  deposito_ro?: number | string | null;
  deposito_rr?: number | string | null;
  deposito_embargos?: number | string | null;
  custas?: number | string | null;
  fgts?: number | string | null;
  honorarios_sucumbenciais?: number | string | null;
  honorarios_periciais?: number | string | null;
  inss_reclamante?: number | string | null;
  inss_reclamada?: number | string | null;
  multa_inadimplemento?: number | string | null;
  seguro_garantia?: boolean | null;
  apolice_numero?: string | null;
  valor_assegurado?: number | string | null;
  seguro_premio?: number | string | null;
  observacoes?: string | null;
};

import { C as GlobalC } from "../lib/theme"
const C = {
  ...GlobalC
};

const CAMPOS_ENCARGOS = [
  "deposito_ro",
  "deposito_rr",
  "deposito_embargos",
  "custas",
  "fgts",
  "honorarios_sucumbenciais",
  "honorarios_periciais",
  "inss_reclamante",
  "inss_reclamada",
  "multa_inadimplemento",
  "seguro_premio",
];

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

function totalEncargos(registro: RegistroFinanceiro) {
  return CAMPOS_ENCARGOS.reduce((sum, field) => sum + parseMoney((registro as any)[field]), 0);
}

function totalRegistro(registro: RegistroFinanceiro) {
  return parseMoney(registro.valor_bruto) + totalEncargos(registro);
}

function isPago(registro: RegistroFinanceiro) {
  const status = String(registro.status_pagamento || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["pago", "quitado", "concluido"].includes(status);
}

function financeiroExcluido(registro: RegistroFinanceiro) {
  return String(registro.observacoes || "").includes("[REGISTRO_FINANCEIRO_EXCLUIDO:");
}

function MiniCard({ title, value, sub, icon, color, count = false }: any) {
  const Icon = icon;
  return (
    <div style={{ background: C.grayBg, borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em" }}>{title}</div>
        <Icon size={15} color={color} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color, marginTop: 8 }}>{count ? value : money(value)}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

export function FinanceiroResumoDashboard({ profile }: { profile: any }) {
  const [items, setItems] = useState<RegistroFinanceiro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.escritorio_id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("financeiro_processos")
        .select("*")
        .eq("escritorio_id", profile.escritorio_id)
        .order("created_at", { ascending: false });
      if (!error) setItems(((data || []) as RegistroFinanceiro[]).filter((item) => !financeiroExcluido(item)));
      setLoading(false);
    }
    load();
  }, [profile?.escritorio_id]);

  const resumo = useMemo(() => {
    const total = items.reduce((sum, item) => sum + totalRegistro(item), 0);
    const pago = items.filter(isPago).reduce((sum, item) => sum + totalRegistro(item), 0);
    const acordos = items.filter((item) => item.natureza === "acordo").reduce((sum, item) => sum + totalRegistro(item), 0);
    const apolices = items.filter((item) => item.seguro_garantia || item.apolice_numero || parseMoney(item.valor_assegurado) > 0).length;
    return { total, pago, pendente: Math.max(total - pago, 0), acordos, apolices };
  }, [items]);

  return (
    <section style={{ background: C.white, border: "1px solid " + C.border, borderRadius: 12, marginTop: 22, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 15, margin: 0, color: C.text }}>Resumo financeiro</h2>
        <span style={{ fontSize: 12, color: C.muted }}>{loading ? "Carregando..." : `${items.length} registro(s)`}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        <MiniCard title="Total" value={resumo.total} sub="valor consolidado" icon={FileText} color={C.text} />
        <MiniCard title="Pago" value={resumo.pago} sub="pago ou quitado" icon={CheckCircle} color={C.green} />
        <MiniCard title="Pendente" value={resumo.pendente} sub="em aberto" icon={AlertCircle} color={resumo.pendente ? C.amber : C.green} />
        <MiniCard title="Apólices" value={resumo.apolices} sub="seguro-garantia" icon={ShieldCheck} color={C.blue} count />
      </div>
    </section>
  );
}
