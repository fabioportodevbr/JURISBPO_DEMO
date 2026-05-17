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
 * Extrai o índice DataJud diretamente do número CNJ.
 * Formato: NNNNNNN-DD.AAAA.J.TT.OOOO (20 dígitos após limpar)
 *
 * Posições (0-based nos 20 dígitos):
 *   0-6   = NNNNNNN (7 dígitos do número)
 *   7-8   = DD (dígito verificador)
 *   9-12  = AAAA (ano)
 *   13    = J (segmento de justiça)
 *   14-15 = TT (código do tribunal)
 *   16-19 = OOOO (origem / vara)
 *
 * Segmentos J:
 *   1 = STF  |  3 = STJ  |  4 = Justiça Federal (TRFs)
 *   5 = Trabalho (TRTs)  |  6 = Eleitoral (TREs)
 *   7 = Militar União    |  8 = Estadual (TJs)
 *   9 = Militar Estadual
 */
function parseIndexFromNumber(numero: string): string | null {
  // Precisa de exatamente 20 dígitos para o número CNJ completo
  if (numero.length !== 20) return null;

  const j  = numero[13];          // segmento de justiça
  const tt = numero.slice(14, 16); // código do tribunal (zero-padded)
  const ttNum = parseInt(tt, 10);

  switch (j) {
    case "1": return "api_publica_stf";
    case "3": return "api_publica_stj";
    case "7": return "api_publica_stm";

    case "4": { // Justiça Federal → TRFs (01-06)
      if (ttNum === 0) return "api_publica_stj"; // improvável, mas seguro
      if (ttNum >= 1 && ttNum <= 6) return `api_publica_trf${ttNum}`;
      return null;
    }

    case "5": { // Justiça do Trabalho → TRTs (01-24) ou TST (00)
      if (ttNum === 0) return "api_publica_tst";
      if (ttNum >= 1 && ttNum <= 24) return `api_publica_trt${ttNum}`;
      return null;
    }

    case "6": { // Eleitoral → TREs
      // TT nos processos eleitorais é o código do estado (01-27)
      const TRE_BY_CODE: Record<number, string> = {
        1:"api_publica_tre_ac",  2:"api_publica_tre_al",  3:"api_publica_tre_ap",
        4:"api_publica_tre_am",  5:"api_publica_tre_ba",  6:"api_publica_tre_ce",
        7:"api_publica_tre_df",  8:"api_publica_tre_es",  9:"api_publica_tre_go",
        10:"api_publica_tre_ma",11:"api_publica_tre_mt", 12:"api_publica_tre_ms",
        13:"api_publica_tre_mg",14:"api_publica_tre_pa", 15:"api_publica_tre_pb",
        16:"api_publica_tre_pr",17:"api_publica_tre_pe", 18:"api_publica_tre_pi",
        19:"api_publica_tre_rj",20:"api_publica_tre_rn", 21:"api_publica_tre_rs",
        22:"api_publica_tre_ro",23:"api_publica_tre_rr", 24:"api_publica_tre_sc",
        25:"api_publica_tre_se",26:"api_publica_tre_sp", 27:"api_publica_tre_to",
      };
      return TRE_BY_CODE[ttNum] ?? null;
    }

    case "8": { // Estadual → TJs
      const TJ_BY_CODE: Record<number, string> = {
        1:"api_publica_tjac",  2:"api_publica_tjal",  3:"api_publica_tjap",
        4:"api_publica_tjam",  5:"api_publica_tjba",  6:"api_publica_tjce",
        7:"api_publica_tjdft", 8:"api_publica_tjes",  9:"api_publica_tjgo",
        10:"api_publica_tjma",11:"api_publica_tjmt", 12:"api_publica_tjms",
        13:"api_publica_tjmg",14:"api_publica_tjpa", 15:"api_publica_tjpb",
        16:"api_publica_tjpr",17:"api_publica_tjpe", 18:"api_publica_tjpi",
        19:"api_publica_tjrj",20:"api_publica_tjrn", 21:"api_publica_tjrs",
        22:"api_publica_tjro",23:"api_publica_tjrr", 24:"api_publica_tjsc",
        25:"api_publica_tjse",26:"api_publica_tjsp", 27:"api_publica_tjto",
      };
      return TJ_BY_CODE[ttNum] ?? null;
    }

    case "9": { // Militar estadual
      // 13=TJMMG, 21=TJMRS, 26=TJMSP
      const TJM_BY_CODE: Record<number, string> = {
        13:"api_publica_tjmmg",21:"api_publica_tjmrs",26:"api_publica_tjmsp",
      };
      return TJM_BY_CODE[ttNum] ?? null;
    }
  }

  return null;
}

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

  // Sempre retorna HTTP 200 — erros ficam no body para o cliente tratar
  const json = (body: unknown, _status = 200) =>
    new Response(JSON.stringify(body), {
      status: 200,
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
      return json({ error: "Número de processo inválido ou muito curto.", processos: [] });
    }

    // 1ª tentativa: extrair tribunal diretamente do número CNJ (mais confiável)
    const indexFromNumber = parseIndexFromNumber(numero);

    // 2ª tentativa: campo tribunal livre (fallback)
    const indexFromTribunal = resolveIndex(tribunal);

    const index = indexFromNumber ?? indexFromTribunal;

    if (!index) {
      return json({
        error: `Não foi possível identificar o tribunal. Verifique o número do processo (${numeroProcesso}) e o campo Tribunal ("${tribunal}").`,
        processos: [],
        tribunalRaw: tribunal,
        dica: "O número do processo deve estar no formato CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO",
      });
    }

    const url = `${DATAJUD_BASE}/${index}/_search`;
    console.log("DataJud query:", url, "numero:", numero, "index:", index,
      indexFromNumber ? "(via CNJ number)" : "(via tribunal text)");

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
      return json({ error: `DataJud retornou ${res.status}: ${txt}`, processos: [] });
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

    return json({ processos, total, index, tribunalRaw: tribunal,
      indexSource: indexFromNumber ? "cnj_number" : "tribunal_text" });
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: String(err), processos: [] });
  }
});
