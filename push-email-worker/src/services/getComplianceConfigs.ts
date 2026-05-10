/**
 * getComplianceConfigs.ts
 * Lê todas as configurações de compliance ativas (enabled=true) da tabela
 * compliance_config via SERVICE_ROLE (bypassa RLS para acessar as senhas).
 */
import { supabase } from '../db/supabase.js'
import { ComplianceDbConfig } from '../types.js'

export async function getComplianceConfigs(): Promise<ComplianceDbConfig[]> {
  const { data, error } = await supabase
    .from('compliance_config')
    .select(`
      id, escritorio_id, enabled,
      imap_host, imap_port, imap_secure, imap_user, imap_password, imap_mailbox,
      smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password,
      smtp_from_name, smtp_from_email,
      filtro_remetentes, aceitar_todos
    `)
    .eq('enabled', true)
    .neq('imap_host', '')
    .neq('imap_user', '')
    .neq('imap_password', '')

  if (error) {
    console.error('[compliance] Erro ao buscar configurações no banco:', error.message)
    return []
  }

  return (data ?? []).map(row => ({
    id:               row.id,
    escritorioId:     row.escritorio_id,
    imapHost:         row.imap_host,
    imapPort:         row.imap_port,
    imapSecure:       row.imap_secure,
    imapUser:         row.imap_user,
    imapPassword:     row.imap_password,
    smtpHost:         row.smtp_host,
    smtpPort:         row.smtp_port,
    smtpSecure:       row.smtp_secure,
    smtpUser:         row.smtp_user,
    smtpPassword:     row.smtp_password,
    smtpFromName:     row.smtp_from_name,
    smtpFromEmail:    row.smtp_from_email,
    filtroRemetentes: row.filtro_remetentes ?? '',
    aceitarTodos:     row.aceitar_todos ?? false,
    imapMailbox:      row.imap_mailbox  || 'INBOX',
  }))
}
