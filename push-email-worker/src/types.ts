// Andamento processual (tribunal → andamentos_processuais_push)
export type ParsedAndamento = {
  numeroProcesso?: string
  tribunal?: string
  assunto?: string
  movimento: string
  dataMovimento?: string
  urlOrigem?: string
  fonte: 'email'
  remetente?: string
  assuntoEmail?: string
  corpoResumo?: string
  corpoEmail?: string
  rawTextHash: string
}

export type ProcessoMatch = {
  id: string
  cliente_id?: string | null
  escritorio_id?: string | null
  numero?: string | null
  responsavel_id?: string | null
}

// Denúncia de compliance (canal exclusivo → compliance_denuncias)
export type ParsedDenuncia = {
  remetenteEmail: string      // endereço real — nunca expor no frontend
  remetenteNome?: string
  assuntoEmail?: string
  corpoOriginal: string       // corpo completo limpo
  corpoResumo: string         // primeiros ~800 chars
  rawTextHash: string         // SHA-256 para deduplicação
  escritorioId: string        // UUID do escritório compliance
}

// Configuração IMAP+SMTP lida do banco (compliance_config) pelo worker
export type ComplianceDbConfig = {
  id: string
  escritorioId: string
  // IMAP
  imapHost: string
  imapPort: number
  imapSecure: boolean
  imapUser: string
  imapPassword: string
  // SMTP
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  smtpUser: string
  smtpPassword: string
  smtpFromName: string
  smtpFromEmail: string
}
