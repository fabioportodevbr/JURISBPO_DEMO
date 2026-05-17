/**
 * Proxy Edge Function — DOU Federal
 * Contorna o bloqueio CORS do portal in.gov.br chamando a API server-side.
 * Retorna resultados do Diário Oficial da União (Seções 1, 2 e 3).
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const DOU_URL = "https://www.in.gov.br/consulta/-/buscar/dou";

// Converte YYYY-MM-DD → DD-MM-YYYY (formato exigido pelo DOU)
function isoToDOU(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

// Nome legível da seção a partir do pubName retornado pelo DOU
function sectionLabel(pubName = ""): string {
  const n = pubName.toUpperCase();
  if (n.includes("DO1") && n.includes("EXTRA")) return "DOU Seção 1 — Extra";
  if (n.includes("DO1")) return "DOU Seção 1";
  if (n.includes("DO2")) return "DOU Seção 2";
  if (n.includes("DO3")) return "DOU Seção 3";
  if (n.includes("EXTRA"))  return "DOU Edição Extra";
  return pubName || "DOU";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      q           = "",
      publishFrom = "",          // YYYY-MM-DD
      publishTo   = "",          // YYYY-MM-DD
      sections    = ["do1", "do2", "do3"],
      size        = 20,
    } = body as Record<string, unknown> & {
      q?: string;
      publishFrom?: string;
      publishTo?: string;
      sections?: string[];
      size?: number;
    };

    const query = String(q).trim();
    if (!query) {
      return json({ results: [], total: 0, error: "Termo de busca obrigatório." }, 400);
    }

    // Monta a query string (sections aparecem como parâmetros repetidos)
    const params = new URLSearchParams({
      q:           query,
      exactDate:   "personalizado",
      publishFrom: isoToDOU(publishFrom),
      publishTo:   isoToDOU(publishTo),
      sortType:    "0",
    });
    for (const s of (sections as string[])) params.append("s", s);

    const url = `${DOU_URL}?${params.toString()}`;
    console.log("Fetching DOU:", url);

    const res = await fetch(url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (compatible; JurisBPO/1.0; +https://jurisbpo.com.br)",
        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control":   "no-cache",
        "Pragma":          "no-cache",
      },
    });

    if (!res.ok) {
      console.error("DOU API error:", res.status, res.statusText);
      return json({ results: [], total: 0, error: `DOU retornou ${res.status}` });
    }

    const html = await res.text();

    // Extrai o script com id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params"
    const scriptMatch = html.match(
      /<script[^>]+id="_br_com_seatecnologia_in_buscadou_BuscaDouPortlet_params"[^>]*>([\s\S]*?)<\/script>/
    );

    if (!scriptMatch || !scriptMatch[1]?.trim()) {
      console.warn("jsonArray script tag not found in DOU response");
      return json({ results: [], total: 0, note: "Nenhum resultado no DOU Federal para este período." });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(scriptMatch[1].trim());
    } catch (e) {
      console.error("Failed to parse DOU JSON:", e);
      return json({ results: [], total: 0, error: "Erro ao interpretar resposta do DOU." });
    }

    const items: Record<string, string>[] = Array.isArray(data.jsonArray) ? data.jsonArray : [];

    const results = items.slice(0, size).map((item) => ({
      id:          item.classPK   || "",
      title:       item.title     || "",
      excerpt:     item.content   || item.abstract || "",
      section:     sectionLabel(item.pubName || ""),
      publishDate: item.pubDate   || item.displayDate || "",
      url:         item.urlTitle  ? `https://www.in.gov.br${item.urlTitle}` : "",
      hierarchy:   item.hierarchyStr || "",
      artType:     item.artType   || "",
      source:      "DOU Federal",
    }));

    return json({ results, total: items.length, source: "dou_federal" });

  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ results: [], total: 0, error: String(err) }, 500);
  }
});
