import cron from 'node-cron'
import { config } from './config.js'
import { ingestUnreadEmails } from './services/emailIngestor.js'
import { ingestComplianceEmails } from './services/complianceIngestor.js'
import { processComplianceOutbox } from './services/complianceOutbox.js'

// ── Andamentos processuais ────────────────────────────────────────────────────
async function runAndamentos() {
  const result = await ingestUnreadEmails()
  console.log(`[push-email] Processados: ${result.processed}; salvos: ${result.saved}`)
}

// ── Compliance — ingestão de denúncias ───────────────────────────────────────
async function runCompliance() {
  if (!config.COMPLIANCE_IMAP_ENABLED) return
  const result = await ingestComplianceEmails()
  if (result.processed > 0) {
    console.log(`[compliance] Processados: ${result.processed}; salvos: ${result.saved}; falhas: ${result.failed}`)
  }
}

// ── Compliance — outbox de e-mails (auto-resposta + replies do officer) ───────
async function runComplianceOutbox() {
  if (!config.COMPLIANCE_IMAP_ENABLED) return
  await processComplianceOutbox()
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
const once = process.argv.includes('--once')

if (once) {
  Promise.all([runAndamentos(), runCompliance(), runComplianceOutbox()]).catch((err) => {
    console.error('[push-email] Erro:', err)
    process.exit(1)
  })
} else {
  const andamentosExpr = `*/${config.POLL_INTERVAL_MINUTES} * * * *`
  console.log(`[push-email] Andamentos: monitorando ${config.IMAP_USER} a cada ${config.POLL_INTERVAL_MINUTES} minuto(s).`)
  cron.schedule(andamentosExpr, () => {
    runAndamentos().catch((err) => console.error('[push-email] Erro andamentos:', err))
  })
  runAndamentos().catch((err) => console.error('[push-email] Erro inicial andamentos:', err))

  if (config.COMPLIANCE_IMAP_ENABLED) {
    console.log(`[compliance] Canal de compliance ativo: monitorando ${config.COMPLIANCE_IMAP_USER} a cada ${config.POLL_INTERVAL_MINUTES} minuto(s).`)

    // Ingestão: mesma cadência dos andamentos
    cron.schedule(andamentosExpr, () => {
      runCompliance().catch((err) => console.error('[compliance] Erro ingestão:', err))
    })
    runCompliance().catch((err) => console.error('[compliance] Erro inicial ingestão:', err))

    // Outbox: a cada 1 minuto (para envio rápido da auto-resposta)
    cron.schedule('* * * * *', () => {
      runComplianceOutbox().catch((err) => console.error('[compliance] Erro outbox:', err))
    })
    runComplianceOutbox().catch((err) => console.error('[compliance] Erro inicial outbox:', err))
  }
}
