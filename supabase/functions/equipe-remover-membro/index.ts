import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { usuario_id, escritorio_id, deletar_auth = false } = await req.json();

    if (!token) return new Response(JSON.stringify({ error: "Token ausente." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!usuario_id || !escritorio_id) return new Response(JSON.stringify({ error: "Usuário e empresa são obrigatórios." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return new Response(JSON.stringify({ error: "Usuário não autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (authData.user.id === usuario_id) return new Response(JSON.stringify({ error: "Você não pode remover seu próprio usuário." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: gestor, error: gestorErr } = await userClient
      .from("usuarios_escritorios")
      .select("papel, ativo")
      .eq("usuario_id", authData.user.id)
      .eq("escritorio_id", escritorio_id)
      .eq("ativo", true)
      .maybeSingle();

    if (gestorErr) throw gestorErr;
    if (gestor?.papel !== "gerente") return new Response(JSON.stringify({ error: "Apenas gerente pode remover membros." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: vinculo, error: vinculoErr } = await admin
      .from("usuarios_escritorios")
      .select("usuario_id, ativo")
      .eq("usuario_id", usuario_id)
      .eq("escritorio_id", escritorio_id)
      .maybeSingle();
    if (vinculoErr) throw vinculoErr;

    if (!vinculo) {
      return new Response(JSON.stringify({ success: true, already_removed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: unlinkErr } = await admin
      .from("usuarios_escritorios")
      .update({ ativo: false })
      .eq("usuario_id", usuario_id)
      .eq("escritorio_id", escritorio_id);
    if (unlinkErr) throw unlinkErr;

    await admin.from("profiles").update({ ativo: false }).eq("id", usuario_id);

    if (!vinculo.ativo) {
      return new Response(JSON.stringify({ success: true, already_removed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (deletar_auth) {
      const { error: delErr } = await admin.auth.admin.deleteUser(usuario_id);
      if (delErr) throw delErr;
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
