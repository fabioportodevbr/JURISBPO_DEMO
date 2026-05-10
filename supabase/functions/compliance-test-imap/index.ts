// @ts-nocheck
import { serve }        from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { connect as tlsConnect } from "node:tls"
import { connect as netConnect } from "node:net"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })

// ---------------------------------------------------------------------------
// Traduz erros comuns de conexão para português
// ---------------------------------------------------------------------------
function translateError(e: Error, host: string, port: number): Error {
  const m = e.message ?? String(e)
  if (/ECONNREFUSED|connection refused/i.test(m))
    return new Error(`Conexão recusada em ${host}:${port}. Verifique se a porta está correta e se o servidor IMAP está ativo.`)
  if (/ENOTFOUND|getaddrinfo/i.test(m))
    return new Error(`Servidor "${host}" não encontrado. Verifique o endereço digitado.`)
  if (/ETIMEDOUT|timed out/i.test(m))
    return new Error(`Tempo limite excedido ao conectar em ${host}:${port}. Verifique host, porta e firewall.`)
  return e
}

// ---------------------------------------------------------------------------
// Teste IMAP puro via node:tls / node:net  (sem npm:imapflow)
// Usa rejectUnauthorized: false para suportar certificados corporativos/
// autoassinados — equivalente ao que o ImapFlow fazia.
// ---------------------------------------------------------------------------
async function testImap(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string,
  mailbox = "INBOX",
): Promise<{ messages: number; unseen: number }> {
  const TIMEOUT_MS = 18_000

  // ── 1. Conecta ────────────────────────────────────────────────────────────
  const socket = await new Promise<any>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Tempo limite excedido (${TIMEOUT_MS / 1000}s) ao conectar em ${host}:${port}. Verifique host, porta e firewall.`)),
      TIMEOUT_MS,
    )

    const onConnect = () => { clearTimeout(timer); resolve(s) }
    const onError   = (e: Error) => { clearTimeout(timer); reject(translateError(e, host, port)) }

    const s = secure
      ? tlsConnect({ host, port, rejectUnauthorized: false }, onConnect)
      : netConnect({ host, port }, onConnect)

    s.once("error", onError)
  })

  // ── 2. Leitor de linhas baseado em fila ───────────────────────────────────
  const lineQueue: string[] = []
  let lineBuffer = ""
  const waiters: Array<(line: string | null, err?: Error) => void> = []

  socket.on("data", (chunk: Buffer | string) => {
    lineBuffer += typeof chunk === "string" ? chunk : chunk.toString("utf8")
    while (true) {
      const nl = lineBuffer.indexOf("\n")
      if (nl === -1) break
      const line = lineBuffer.slice(0, nl + 1).trimEnd()
      lineBuffer  = lineBuffer.slice(nl + 1)
      if (waiters.length > 0) waiters.shift()!(line, undefined)
      else lineQueue.push(line)
    }
  })

  const flushError = (err: Error) => {
    for (const w of waiters) w(null, err)
    waiters.length = 0
  }
  socket.once("error", flushError)
  socket.once("end",   () => flushError(new Error("Servidor IMAP fechou a conexão inesperadamente.")))

  const readLine = (): Promise<string> =>
    new Promise((resolve, reject) => {
      if (lineQueue.length > 0) { resolve(lineQueue.shift()!); return }

      const timer = setTimeout(() => {
        const i = waiters.indexOf(handler)
        if (i !== -1) waiters.splice(i, 1)
        reject(new Error("Tempo limite de resposta do servidor IMAP excedido."))
      }, TIMEOUT_MS)

      const handler = (line: string | null, err?: Error) => {
        clearTimeout(timer)
        err ? reject(err) : resolve(line!)
      }
      waiters.push(handler)
    })

  const send = (cmd: string): Promise<void> =>
    new Promise((resolve, reject) =>
      socket.write(cmd + "\r\n", "utf8", (err: Error | null) => err ? reject(err) : resolve())
    )

  // ── 3. Protocolo IMAP ─────────────────────────────────────────────────────
  try {
    // Greeting
    const greeting = await readLine()
    if (!greeting.startsWith("* OK") && !greeting.startsWith("* PREAUTH")) {
      throw new Error(`Resposta inesperada do servidor: ${greeting}`)
    }

    // LOGIN
    const eu = user.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const ep = pass.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    await send(`A001 LOGIN "${eu}" "${ep}"`)

    let loginResp = ""
    while (true) {
      const line = await readLine()
      if (line.startsWith("A001 ")) { loginResp = line; break }
    }
    if (!loginResp.startsWith("A001 OK")) {
      let hint: string
      if (/NO LOGIN failed|LOGIN failed/i.test(loginResp)) {
        hint = "O servidor rejeitou a autenticação básica (LOGIN). " +
          "Se for uma conta Microsoft 365 ou Outlook.com, a autenticação básica está desabilitada — " +
          "gere uma Senha de App em: conta.microsoft.com → Segurança → Senhas de App."
      } else if (/AUTHENTICATIONFAILED|invalid credentials|Bad credentials/i.test(loginResp)) {
        hint = "Usuário ou senha incorretos."
      } else {
        hint = loginResp
      }
      throw new Error(`Falha de autenticação IMAP: ${hint}`)
    }

    // STATUS INBOX
    // Usa o mailbox configurado (ex: COMPLIANCE) em vez de INBOX fixo
    const mbEncoded = mailbox.includes(" ") ? `"${mailbox}"` : mailbox
    await send(`A002 STATUS ${mbEncoded} (MESSAGES UNSEEN)`)
    let statusLine = "", statusResp = ""
    while (true) {
      const line = await readLine()
      if (line.startsWith("* STATUS")) statusLine = line
      if (line.startsWith("A002 "))    { statusResp = line; break }
    }
    if (!statusResp.startsWith("A002 OK")) {
      throw new Error(`Falha ao consultar a pasta "${mailbox}": ${statusResp}. Verifique se o label existe no Gmail com o nome exato.`)
    }

    const messages = parseInt(statusLine.match(/MESSAGES\s+(\d+)/i)?.[1] ?? "0", 10)
    const unseen   = parseInt(statusLine.match(/UNSEEN\s+(\d+)/i)?.[1]   ?? "0", 10)

    // LOGOUT
    await send("A003 LOGOUT")
    try { await readLine() } catch { /* ignore */ }

    return { messages, unseen }
  } finally {
    try { socket.destroy() } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
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

    if (!link || link.papel !== "gerente")
      return json({ ok: false, erro: "Acesso restrito a gerentes." }, 403)

    // ── Lê configuração via SERVICE_ROLE ──────────────────────────────────
    const { data: cfg } = await admin
      .from("compliance_config")
      .select("imap_host, imap_port, imap_secure, imap_user, imap_password, imap_mailbox")
      .eq("escritorio_id", escritorio_id)
      .maybeSingle()

    if (!cfg?.imap_host || !cfg?.imap_user || !cfg?.imap_password)
      return json({ ok: false, erro: "Preencha e salve o servidor IMAP, usuário e senha antes de testar." })

    const mailbox = cfg.imap_mailbox?.trim() || "INBOX"

    // ── Teste IMAP ────────────────────────────────────────────────────────
    const { messages, unseen } = await testImap(
      cfg.imap_host,
      cfg.imap_port    ?? (cfg.imap_secure ? 993 : 143),
      cfg.imap_secure  ?? true,
      cfg.imap_user,
      cfg.imap_password,
      mailbox,
    )

    await admin
      .from("compliance_config")
      .update({ conn_status: "ok", conn_erro: "", conn_ultima_vez: new Date().toISOString() })
      .eq("escritorio_id", escritorio_id)

    return json({ ok: true, mensagens: messages, naolidas: unseen })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)

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
