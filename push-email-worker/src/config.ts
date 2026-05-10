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

  // ── Canal de Compliance (Exchange IMAP) ─────────────────────────────────
  // Defina COMPLIANCE_IMAP_ENABLED=true para ativar o monitoramento.
  COMPLIANCE_IMAP_ENABLED:  z.coerce.boolean().default(false),
  COMPLIANCE_IMAP_HOST:     z.string().default(''),          // ex: mail.empresa.com
  COMPLIANCE_IMAP_PORT:     z.coerce.number().default(993),
  COMPLIANCE_IMAP_SECURE:   z.coerce.boolean().default(true),
  COMPLIANCE_IMAP_USER:     z.string().default(''),          // ex: compliance@empresa.com
  COMPLIANCE_IMAP_PASSWORD: z.string().default(''),
  // UUID do escritório ao qual as denúncias serão vinculadas
  COMPLIANCE_ESCRITORIO_ID: z.string().uuid().optional(),

  // ── SMTP para envio de e-mails (auto-resposta + replies do officer) ──────
  // Pode ser o mesmo servidor Exchange da caixa de compliance.
  SMTP_HOST:       z.string().default(''),
  SMTP_PORT:       z.coerce.number().default(587),
  SMTP_SECURE:     z.coerce.boolean().default(false),  // false = STARTTLS na porta 587
  SMTP_USER:       z.string().default(''),
  SMTP_PASSWORD:   z.string().default(''),
  SMTP_FROM_NAME:  z.string().default('Canal de Compliance'),
  SMTP_FROM_EMAIL: z.string().default(''),
})

export const config = envSchema.parse(process.env)
