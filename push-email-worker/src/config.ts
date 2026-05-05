import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  IMAP_HOST: z.string().default('imap.gmail.com'),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: z.coerce.boolean().default(true),
  IMAP_USER: z.string().email().default('juridicocallbrbpo@gmail.com'),
  IMAP_PASSWORD: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  POLL_INTERVAL_MINUTES: z.coerce.number().default(5),
  DEFAULT_ESCRITORIO_ID: z.string().uuid().optional(),
  ALERT_EMAIL_ENABLED: z.coerce.boolean().default(false),
  ALERT_WEBHOOK_URL: z.string().url().optional().or(z.literal(''))
})

export const config = envSchema.parse(process.env)
