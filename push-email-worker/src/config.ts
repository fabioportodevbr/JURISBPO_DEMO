import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  // ── Andamentos processuais (Gmail IMAP) ─────────────────────────────────
  IMAP_HOST:               z.string().default('imap.gmail.com'),
  IMAP_PORT:               z.coerce.number().default(993),
  IMAP_SECURE:             z.coerce.boolean().default(true),
  IMAP_USER:               z.string().email().default('juridicocallbrbpo@gmail.com'),
  IMAP_PASSWORD:           z.string().min(1),
  SUPABASE_URL:            z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  POLL_INTERVAL_MINUTES:   z.coerce.number().default(5),
  DEFAULT_ESCRITORIO_ID:   z.string().uuid().optional(),
  ALERT_EMAIL_ENABLED:     z.coerce.boolean().default(false),
  ALERT_WEBHOOK_URL:       z.string().url().optional().or(z.literal('')),

  // ── Canal de Compliance ──────────────────────────────────────────────────
  // As configurações IMAP/SMTP de compliance são gerenciadas pelo gerente
  // diretamente na UI (tabela compliance_config no Supabase).
  // Nenhuma variável de ambiente adicional é necessária para compliance.
})

let config: z.infer<typeof envSchema>
try {
  config = envSchema.parse(process.env)
} catch (err) {
  console.error('[push-email] ERRO DE CONFIGURAÇÃO — variáveis de ambiente ausentes ou inválidas:')
  if (err instanceof z.ZodError) {
    for (const issue of err.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
  } else {
    console.error(err)
  }
  process.exit(1)
}
export { config }
