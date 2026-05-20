import dns from 'dns'
// Railway (e alguns provedores) não têm IPv6 — força resolução para IPv4
// para evitar "ENETUNREACH" ao conectar no smtp.gmail.com / outros SMTP.
dns.setDefaultResultOrder('ipv4first')

import cron from 'node-cron'
import { config } from './config.js'
import { ingestUnreadEmails } from './services/emailIngestor.js'
import { ingestComplianceEmails } from './services/complianceIngestor.js'
import { processComplianceOutbox } from './services/complianceOutbox.js'
import { getComplianceConfigs } from './services/getComplianceConfigs.js'
import { ingestPublicacoesLider } from './services/publicacoesLiderIngestor.js'

// ── Andamentos processuais ────────────────────────────────────────────────────
async function runAndamentos() {
  const result = await ingestUnreadEmails()
  console.log(`[push-email] Processados: ${result.processed}; salvos: ${result.saved}`)
}

// ── Compliance — lê configs do banco e processa cada escritório ───────────────
async function runCompliance() {
  const configs = await getComplianceConfigs()
  if (configs.length === 0) return

  for (const cfg of configs) {
    try {
      const result = await ingestComplianceEmails(cfg)
      if (result.processed > 0) {
        console.log(
          `[compliance][${cfg.escritorioId}] Processados: ${result.processed}; salvos: ${result.saved}; falhas: ${result.failed}`
        )
      }
    } catch (err) {
      console.error(`[compliance] Erro na ingestão do escritório ${cfg.escritorioId}:`, err)
    }
  }
}

async function runComplianceOutbox() {
  const configs = await getComplianceConfigs()
  for (const cfg of configs) {
    try {
      await processComplianceOutbox(cfg)
    } catch (err) {
      console.error(`[compliance-outbox] Erro no escritório ${cfg.escritorioId}:`, err)
    }
  }
}

// ── Publicacoes Lider ─────────────────────────────────────────────────────────
async function runPublicacoesLider() {
  if (!config.LIDER_WS_ENABLED) return
  try {
    const result = await ingestPublicacoesLider()
    console.log(`[lider] Processadas: ${result.processed}; salvas: ${result.saved}`)
  } catch (err) {
    console.error('[lider] Erro na ingestao de publicacoes:', err)
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
const once = process.argv.includes('--once')

if (once) {
  Promise.all([runAndamentos(), runCompliance(), runComplianceOutbox(), runPublicacoesLider()]).catch((err) => {
    console.error('[push-email] Erro:', err)
    process.exit(1)
  })
} else {
  const andamentosExpr = `*/${config.POLL_INTERVAL_MINUTES} * * * *`
  console.log(`[push-email] Andamentos: monitorando ${config.IMAP_USER} a cada ${config.POLL_INTERVAL_MINUTES} minuto(s).`)
  console.log(`[compliance] Configurações lidas do banco — canal ativo para escritórios com enabled=true.`)

  // Andamentos processuais
  cron.schedule(andamentosExpr, () => {
    runAndamentos().catch((err) => console.error('[push-email] Erro andamentos:', err))
  })
  runAndamentos().catch((err) => console.error('[push-email] Erro inicial andamentos:', err))

  // Compliance — ingestão: mesma cadência dos andamentos
  cron.schedule(andamentosExpr, () => {
    runCompliance().catch((err) => console.error('[compliance] Erro ingestão:', err))
  })
  runCompliance().catch((err) => console.error('[compliance] Erro inicial ingestão:', err))

  // Compliance — outbox: a cada 1 minuto
  cron.schedule('* * * * *', () => {
    runComplianceOutbox().catch((err) => console.error('[compliance] Erro outbox:', err))
  })
  runComplianceOutbox().catch((err) => console.error('[compliance] Erro inicial outbox:', err))

  // Publicacoes Lider: uma vez por hora (somente se LIDER_WS_ENABLED=true)
  if (config.LIDER_WS_ENABLED) {
    console.log(`[lider] WebService de publicacoes ativo — polling a cada hora.`)
    cron.schedule('0 * * * *', () => {
      runPublicacoesLider().catch((err) => console.error('[lider] Erro cron:', err))
    })
    runPublicacoesLider().catch((err) => console.error('[lider] Erro inicial:', err))
  }
}
