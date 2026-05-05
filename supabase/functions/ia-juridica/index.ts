import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  try {
    const { mensagem } = await req.json();

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ resposta: "OPENAI_API_KEY não encontrada nos Secrets do Supabase." }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input:
          "Você é um assistente jurídico brasileiro integrado ao JurisBPO. " +
          "Responda com clareza, objetividade e linguagem técnica acessível. " +
          "Avise que a resposta deve ser revisada por profissional habilitado.\n\n" +
          mensagem,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          resposta: `Erro OpenAI: ${data?.error?.message || "erro desconhecido"}`,
          detalhe: data,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        resposta:
          data.output_text ||
          data.output?.[0]?.content?.[0]?.text ||
          "Sem resposta retornada.",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ resposta: `Erro interno: ${err.message}` }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
});
