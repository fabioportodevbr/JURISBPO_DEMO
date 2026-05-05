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

export type PushEmailResult = {
  processed: number
  saved: number
  ignored: number
  failed: number
}
