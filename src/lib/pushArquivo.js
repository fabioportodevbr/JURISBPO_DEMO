export function usuarioPushArquivo(profile = {}) {
  return {
    usuario_id: profile.id || null,
    usuario_nome: profile.nome || profile.email || profile.id || 'Usuario',
  }
}

export function motivoDesconsideracaoPush(profile = {}) {
  const usuario = usuarioPushArquivo(profile).usuario_nome
  return `Desconsiderado manualmente no JurisBPO por ${usuario} em ${new Date().toLocaleString('pt-BR')}.`
}

export function usuarioNomeDeMotivoPush(motivo = '') {
  const match = String(motivo || '').match(/\bpor\s+(.+?)\s+em\s+\d{1,2}\/\d{1,2}\/\d{4}/i)
  return match?.[1]?.trim() || ''
}

export function pushIgnoradoParaArquivo(push = {}) {
  const arquivadoEm = push.ignorado_em || push.atualizado_em || push.criado_em || new Date().toISOString()
  return {
    id: `push-ignorado-${push.id}`,
    andamento_id: push.id,
    escritorio_id: push.escritorio_id,
    usuario_id: null,
    usuario_nome: usuarioNomeDeMotivoPush(push.motivo_ignorado) || 'Registro do filtro Ignorados',
    arquivado_em: arquivadoEm,
    motivo: push.motivo_ignorado || 'Desconsiderado manualmente no JurisBPO.',
    snapshot: push,
    origem: 'andamentos_processuais_push',
  }
}

export function pushIgnoradoDentroDoPrazo(push = {}, agora = Date.now()) {
  if (push.status_associacao !== 'ignorado') return true
  const base = push.ignorado_em || push.atualizado_em || push.criado_em
  if (!base) return true
  return new Date(base).getTime() >= agora - 30 * 24 * 60 * 60 * 1000
}

export async function registrarPushDesconsiderado(supabase, push, profile, motivo) {
  const usuario = usuarioPushArquivo(profile)
  const payload = {
    andamento_id: push.id,
    escritorio_id: push.escritorio_id || profile.escritorio_id,
    ...usuario,
    arquivado_em: new Date().toISOString(),
    motivo,
    snapshot: push,
  }

  const { error } = await supabase.from('andamentos_processuais_push_arquivo').insert(payload)
  if (error) {
    console.warn('[push-email] Nao foi possivel registrar arquivo do push desconsiderado:', error)
    return { ok: false, error }
  }
  return { ok: true }
}
