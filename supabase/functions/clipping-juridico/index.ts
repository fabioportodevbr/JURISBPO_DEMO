import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const noticiasFallback = [
  {
    titulo: "Consultar notícias jurídicas recentes",
    link: "https://news.google.com/search?q=not%C3%ADcias%20jur%C3%ADdicas%20Brasil&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias",
    resumo: "Clipping jurídico geral com notícias recentes do Brasil."
  },
  {
    titulo: "Notícias recentes do STF",
    link: "https://news.google.com/search?q=STF%20jur%C3%ADdico&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias",
    resumo: "Atualizações recentes sobre o Supremo Tribunal Federal."
  },
  {
    titulo: "Notícias recentes do STJ",
    link: "https://news.google.com/search?q=STJ%20jur%C3%ADdico&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias",
    resumo: "Atualizações recentes sobre o Superior Tribunal de Justiça."
  },
  {
    titulo: "Notícias recentes do TST",
    link: "https://news.google.com/search?q=TST%20direito%20do%20trabalho&hl=pt-BR&gl=BR&ceid=BR%3Apt-419",
    fonte: "Google Notícias",
    resumo: "Atualizações recentes sobre direito do trabalho."
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      noticias: noticiasFallback,
      total: noticiasFallback.length
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    }
  );
});
