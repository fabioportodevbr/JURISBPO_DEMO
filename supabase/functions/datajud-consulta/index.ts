/**
 * Edge Function — DataJud / CNJ
 * Proxy para a API pública do DataJud (api-publica.datajud.cnj.jus.br).
 * A chave é pública e está na documentação oficial do CNJ.
 * Necessário como proxy pois a API Elasticsearch não tem CORS habilitado.
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
// Chave pública conforme documentação oficial: datajud-wiki.cnj.jus.br
const DATAJUD_KEY  = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/* ── Mapeamento tribunal → índice DataJud ── */
const TRIBUNAL_MAP: Record<string, string> = {
  // Superiores
  TST: "api_publica_tst", STJ: "api_publica_stj",
  STF: "api_publica_stf", TSE: "api_publica_tse", STM: "api_publica_stm",
  // TRFs
  TRF1: "api_publica_trf1", TRF2: "api_publica_trf2", TRF3: "api_publica_trf3",
  TRF4: "api_publica_trf4", TRF5: "api_publica_trf5", TRF6: "api_publica_trf6",
  // TRTs
  TRT1:  "api_publica_trt1",  TRT2:  "api_publica_trt2",  TRT3:  "api_publica_trt3",
  TRT4:  "api_publica_trt4",  TRT5:  "api_publica_trt5",  TRT6:  "api_publica_trt6",
  TRT7:  "api_publica_trt7",  TRT8:  "api_publica_trt8",  TRT9:  "api_publica_trt9",
  TRT10: "api_publica_trt10", TRT11: "api_publica_trt11", TRT12: "api_publica_trt12",
  TRT13: "api_publica_trt13", TRT14: "api_publica_trt14", TRT15: "api_publica_trt15",
  TRT16: "api_publica_trt16", TRT17: "api_publica_trt17", TRT18: "api_publica_trt18",
  TRT19: "api_publica_trt19", TRT20: "api_publica_trt20", TRT21: "api_publica_trt21",
  TRT22: "api_publica_trt22", TRT23: "api_publica_trt23", TRT24: "api_publica_trt24",
  // TJs estaduais
  TJAC: "api_publica_tjac", TJAL: "api_publica_tjal", TJAM: "api_publica_tjam",
  TJAP: "api_publica_tjap", TJBA: "api_publica_tjba", TJCE: "api_publica_tjce",
  TJDFT:"api_publica_tjdft",TJDF: "api_publica_tjdft",
  TJES: "api_publica_tjes", TJGO: "api_publica_tjgo", TJMA: "api_publica_tjma",
  TJMG: "api_publica_tjmg", TJMS: "api_publica_tjms", TJMT: "api_publica_tjmt",
  TJPA: "api_publica_tjpa", TJPB: "api_publica_tjpb", TJPE: "api_publica_tjpe",
  TJPI: "api_publica_tjpi", TJPR: "api_publica_tjpr", TJRJ: "api_publica_tjrj",
  TJRN: "api_publica_tjrn", TJRO: "api_publica_tjro", TJRR: "api_publica_tjrr",
  TJRS: "api_publica_tjrs", TJSC: "api_publica_tjsc", TJSE: "api_publica_tjse",
  TJSP: "api_publica_tjsp", TJTO: "api_publica_tjto",
  // TREs
  TREAC:"api_publica_tre_ac",TREAL:"api_publica_tre_al",TREAM:"api_publica_tre_am",
  TREAP:"api_publica_tre_ap",TREBA:"api_publica_tre_ba",TRECE:"api_publica_tre_ce",
  TREDF:"api_publica_tre_df",TREES:"api_publica_tre_es",TREGO:"api_publica_tre_go",
  TREMA:"api_publica_tre_ma",TREMG:"api_publica_tre_mg",TREMS:"api_publica_tre_ms",
  TREMT:"api_publica_tre_mt",TREPA:"api_publica_tre_pa",TREPB:"api_publica_tre_pb",
  TREPE:"api_publica_tre_pe",TREPI:"api_publica_tre_pi",TREPR:"api_publica_tre_pr",
  TRERJ:"api_publica_tre_rj",TRERN:"api_publica_tre_rn",TRERO:"api_publica_tre_ro",
  TRERR:"api_publica_tre_rr",TRERS:"api_publica_tre_rs",TRESC:"api_publica_tre_sc",
  TRESE:"api_publica_tre_se",TRESP:"api_publica_tre_sp",TRETO:"api_publica_tre_to",
  // Militares estaduais
  TJMMG:"api_publica_tjmmg",TJMRS:"api_publica_tjmrs",TJMSP:"api_publica_tjmsp",
};

/**
 * Detecta o índice DataJud a partir de uma string livre de tribunal.
 * Ex: "TRT 15ª Região - Campinas" → "api_publica_trt15"
 */
function resolveIndex(tribunalRaw: string): string | null {
  const t = (tribunalRaw || "").toUpperCase().replace(/[°ºª]/g, "").trim();

  // Checa correspondência direta no mapa
  for (const [key, idx] of Object.entries(TRIBUNAL_MAP)) {
    if (t.startsWith(key) || t.includes(key)) return idx;
  }

  // Padrões numéricos: TRT 15, TRF 3, TRE-SP
  const trtM = t.match(/TRT\D*(\d{1,2})/);
  if (trtM) return `api_publica_trt${trtM[1]}`;

  const trfM = t.match(/TRF\D*(\d)/);
  if (trfM) return `api_publica_trf${trfM[1]}`;

  const treM = t.match(/TRE[^A-Z]*([A-Z]{2})/);
  if (treM) return `api_publica_tre_${treM[1].toLowerCase()}`;

  const tjM = t.match(/TJ([A-Z]{2,3})/);
  if (tjM) {
    const k = `TJ${tjM[1]}`;
    return TRIBUNAL_MAP[k] || null;
  }

  return null;
}

/** Remove tudo que não seja dígito do número do processo */
function cleanNumber(n: string): string {
  return (n || "").replace(/\D/g, "");
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
      numeroProcesso = "",
      tribunal       = "",
      size           = 50,
    } = body as { numeroProcesso?: string; tribunal?: string; size?: number };

    const numero = cleanNumber(numeroProcesso);
    if (numero.length < 7) {
      return json({ error: "Número de processo inválido ou muito curto.", processos: [] }, 400);
    }

    const index = resolveIndex(tribunal);
    if (!index) {
      return json({
        error: `Tribunal não reconhecido: "${tribunal}". Verifique o campo Tribunal do processo.`,
        processos: [],
        tribunalRaw: tribunal,
      }, 400);
    }

    const url = `${DATAJUD_BASE}/${index}/_search`;
    console.log("DataJud query:", url, "numero:", numero);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `ApiKey ${DATAJUD_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        size,
        query: {
          match: { numeroProcesso: numero },
        },
        sort: [{ "@timestamp": { order: "desc" } }],
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => res.statusText);
      console.error("DataJud error:", res.status, txt);
      return json({ error: `DataJud retornou ${res.status}: ${txt}`, processos: [] }, 502);
    }

    const data = await res.json();
    const hits  = (data?.hits?.hits || []) as Record<string, unknown>[];
    const total = data?.hits?.total?.value ?? hits.length;

    // Normaliza os resultados
    type Src = Record<string, unknown>;
    const processos = hits.map((h) => {
      const s = (h._source || {}) as Src;
      const movimentos = ((s.movimentos as Src[]) || [])
        .map((m) => ({
          dataHora:   m.dataHora,
          codigo:     m.codigo,
          nome:       m.nome,
          complemento: (m.complementosTabelados as Src[] || [])
            .map((c) => c.descricao || c.valor || "")
            .filter(Boolean)
            .join("; "),
        }))
        .sort((a, b) => {
          const da = a.dataHora ? new Date(String(a.dataHora)).getTime() : 0;
          const db = b.dataHora ? new Date(String(b.dataHora)).getTime() : 0;
          return db - da; // mais recente primeiro
        });

      return {
        numeroProcesso: s.numeroProcesso,
        tribunal:       s.tribunal,
        classe:         (s.classe as Src)?.nome,
        orgaoJulgador:  (s.orgaoJulgador as Src)?.nome,
        dataAjuizamento:s.dataAjuizamento,
        grau:           s.grau,
        assuntos:       ((s.assuntos as Src[]) || []).map((a) => a.nome),
        movimentos,
      };
    });

    return json({ processos, total, index, tribunalRaw: tribunal });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: String(err), processos: [] }, 500);
  }
});
