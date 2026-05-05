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
    const { email, nome, cargo, papel = "advogado", senha_temporaria, escritorio_id } = await req.json();

    if (!token) return new Response(JSON.stringify({ error: "Token ausente." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!email || !nome || !escritorio_id) return new Response(JSON.stringify({ error: "Nome, e-mail e empresa são obrigatórios." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return new Response(JSON.stringify({ error: "Usuário não autenticado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: gestor, error: gestorErr } = await userClient
      .from("usuarios_escritorios")
      .select("papel, ativo")
      .eq("usuario_id", authData.user.id)
      .eq("escritorio_id", escritorio_id)
      .eq("ativo", true)
      .maybeSingle();

    if (gestorErr) throw gestorErr;
    if (gestor?.papel !== "gerente") return new Response(JSON.stringify({ error: "Apenas gerente pode incluir membros." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const password = senha_temporaria || crypto.randomUUID().replaceAll("-", "").slice(0, 14) + "A1!";

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { nome, cargo },
    });

    if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = created.user.id;

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      email: email.toLowerCase(),
      nome,
      cargo: cargo || papel,
      ativo: true,
    }, { onConflict: "id" });
    if (profileErr) throw profileErr;

    const { error: linkErr } = await admin.from("usuarios_escritorios").upsert({
      usuario_id: userId,
      escritorio_id,
      papel,
      ativo: true,
    }, { onConflict: "usuario_id,escritorio_id" });
    if (linkErr) throw linkErr;

    return new Response(JSON.stringify({ success: true, user_id: userId, senha_temporaria: senha_temporaria ? undefined : password }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
