import cron from 'node-cron'
import { config } from './config.js'
import { ingestUnreadEmails } from './services/emailIngestor.js'

async function runOnce() {
  const result = await ingestUnreadEmails()
  console.log(`[push-email] Processados: ${result.processed}; salvos: ${result.saved}`)
}

const once = process.argv.includes('--once')

if (once) {
  runOnce().catch((err) => {
    console.error('[push-email] Erro:', err)
    process.exit(1)
  })
} else {
  const expression = `*/${config.POLL_INTERVAL_MINUTES} * * * *`
  console.log(`[push-email] Monitorando ${config.IMAP_USER} a cada ${config.POLL_INTERVAL_MINUTES} minuto(s).`)
  cron.schedule(expression, () => {
    runOnce().catch((err) => console.error('[push-email] Erro:', err))
  })
  runOnce().catch((err) => console.error('[push-email] Erro inicial:', err))
}
