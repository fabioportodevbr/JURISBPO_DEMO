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
    return false
  }
  return true
}
