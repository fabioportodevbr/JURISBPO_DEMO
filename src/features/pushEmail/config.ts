import { z } from 'zod'

const configSchema = z.object({
  IMAP_HOST: z.string().min(1),
  IMAP_PORT: z.number().int().positive(),
  IMAP_SECURE: z.boolean(),
  IMAP_USER: z.string().email(),
  IMAP_PASSWORD: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DEFAULT_ESCRITORIO_ID: z.string().uuid().optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  PUSH_EMAIL_CRON_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
})

export type PushEmailConfig = z.infer<typeof configSchema>

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'sim'].includes(value.toLowerCase())
}

function readNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getPushEmailConfig(): PushEmailConfig {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL

  const parsed = configSchema.safeParse({
    IMAP_HOST: process.env.IMAP_HOST || 'imap.gmail.com',
    IMAP_PORT: readNumber(process.env.IMAP_PORT, 993),
    IMAP_SECURE: readBoolean(process.env.IMAP_SECURE, true),
    IMAP_USER: process.env.IMAP_USER || 'juridicocallbrbpo@gmail.com',
    IMAP_PASSWORD: process.env.IMAP_PASSWORD,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DEFAULT_ESCRITORIO_ID: process.env.DEFAULT_ESCRITORIO_ID || undefined,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL || undefined,
    PUSH_EMAIL_CRON_SECRET: process.env.PUSH_EMAIL_CRON_SECRET || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
  })

  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]
    throw new Error(
      `Configuracao do push-email invalida. Confira no arquivo .env da raiz e reinicie o servidor. Campos faltando ou invalidos: ${fields.join(', ')}`,
    )
  }

  return parsed.data
}
