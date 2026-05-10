// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ImapFlow } from "npm:imapflow@1"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!
  const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin            = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  let escritorio_id: string | null = null

  try {
    // ── Autenticação ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ ok: false, erro: "Não autorizado." }, 401)

    const body = await req.json()
    escritorio_id = body?.escritorio_id ?? null
    if (!escritorio_id) return json({ ok: false, erro: "escritorio_id é obrigatório." })

    // Verifica se o caller é gerente do escritório
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ ok: false, erro: "Sessão inválida." }, 401)

    const { data: link } = await userClient
      .from("usuarios_escritorios")
      .select("papel")
      .eq("usuario_id", user.id)
      .eq("escritorio_id", escritorio_id)
      .eq("ativo", true)
      .maybeSingle()

    if (!link || link.papel !== "gerente") {
      return json({ ok: false, erro: "Acesso restrito a gerentes." }, 403)
    }

    // ── Lê configuração (com senha) via SERVICE_ROLE ──────────────────────
    const { data: cfg } = await admin
      .from("compliance_config")
      .select("imap_host, imap_port, imap_secure, imap_user, imap_password")
      .eq("escritorio_id", escritorio_id)
      .maybeSingle()

    if (!cfg?.imap_host || !cfg?.imap_user || !cfg?.imap_password) {
      return json({ ok: false, erro: "Preencha e salve o servidor IMAP, usuário e senha antes de testar." })
    }

    // ── Teste de conexão IMAP ─────────────────────────────────────────────
    const client = new ImapFlow({
      host:   cfg.imap_host,
      port:   cfg.imap_port,
      secure: cfg.imap_secure,
      auth:   { user: cfg.imap_user, pass: cfg.imap_password },
      tls:    { rejectUnauthorized: false },
      logger: false,
    })

    await Promise.race([
      client.connect(),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("Tempo limite de conexão excedido (12s). Verifique host, porta e firewall.")), 12_000)
      ),
    ])

    const lock          = await client.getMailboxLock("INBOX")
    const mailboxStatus = await client.status("INBOX", { messages: true, unseen: true })
    lock.release()

    await Promise.race([client.logout(), new Promise((r) => setTimeout(r, 3_000))])
    try { client.close() } catch { /* ignore */ }

    const mensagens = mailboxStatus?.messages ?? 0
    const naolidas  = mailboxStatus?.unseen   ?? 0

    // Persiste resultado OK
    await admin
      .from("compliance_config")
      .update({ conn_status: "ok", conn_erro: "", conn_ultima_vez: new Date().toISOString() })
      .eq("escritorio_id", escritorio_id)

    return json({ ok: true, mensagens, naolidas })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

    // Persiste erro (best-effort)
    if (escritorio_id) {
      try {
        await admin
          .from("compliance_config")
          .update({ conn_status: "erro", conn_erro: msg, conn_ultima_vez: new Date().toISOString() })
          .eq("escritorio_id", escritorio_id)
      } catch { /* ignore */ }
    }

    return json({ ok: false, erro: msg })
  }
})
