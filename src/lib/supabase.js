import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
export const signOut = () => supabase.auth.signOut()
export const resetPassword = (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })

export async function fetchAllRows(queryFactory, pageSize = 1000) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await queryFactory().range(from, to)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
    from += pageSize
  }

  return rows
}

export const ROLES = {
  gerente: { label: 'Gerente Jurídico', nivel: 4 },
  advogado: { label: 'Advogado(a)', nivel: 3 },
  assistente: { label: 'Assistente', nivel: 2 },
  cliente: { label: 'Cliente', nivel: 1 },
  visitante: { label: 'Visitante', nivel: 1, readOnly: true },
}

export const can = (profile, acao) => {
  if (!profile) return false
  const role = ROLES[profile.role]
  const nivel = role?.nivel || 0
  const readOnly = !!role?.readOnly
  const perms = {
    'processos.ver': nivel >= 1,
    'processos.criar': !readOnly && nivel >= 2,
    'processos.editar': !readOnly && nivel >= 2,
    'processos.excluir': !readOnly && nivel >= 4,
    'contratos.ver': nivel >= 1,
    'contratos.criar': !readOnly && nivel >= 2,
    'contratos.editar': !readOnly && nivel >= 2,
    'contratos.excluir': !readOnly && nivel >= 4,
    'financeiro.ver': nivel >= 1,
    'financeiro.criar': !readOnly && nivel >= 2,
    'financeiro.editar': !readOnly && nivel >= 2,
    'financeiro.excluir': !readOnly && nivel >= 4,
    'atividades.ver': nivel >= 1,
    'atividades.criar': !readOnly && nivel >= 1,
    'atividades.editar': !readOnly && nivel >= 1,
    'atividades.excluir': !readOnly && nivel >= 3,
    'docs.upload': !readOnly && nivel >= 1,
    'docs.excluir': !readOnly && nivel >= 3,
    'equipe.ver': nivel >= 3,
    'equipe.gerenciar': nivel >= 4,
    'ia.usar': nivel >= 2,
    'perfil.editar': !readOnly,
    'mensagens.enviar': !readOnly && nivel >= 1,
    'compliance.ver': nivel >= 4,
    'compliance.gerenciar': nivel >= 4,
  }
  return perms[acao] ?? false
}

export async function getProfile(userId, email) {
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (pError) throw pError

  if (!profile && email) {
    throw new Error(`Usuário autenticado, mas sem profile em public.profiles para ${email}.`)
  }
  if (!profile) return null

  const { data: links, error: lError } = await supabase
    .from('usuarios_escritorios')
    .select('id, escritorio_id, papel, ativo, escritorios(id, nome, slug, plano, ativo)')
    .eq('usuario_id', userId)
    .eq('ativo', true)
    .limit(1)
  if (lError) throw lError

  const link = links?.[0]
  if (!link) throw new Error('Profile encontrado, mas o usuário não está vinculado a nenhuma empresa ativa.')

  return {
    ...profile,
    role: link.papel,
    papel: link.papel,
    escritorio_id: link.escritorio_id,
    escritorio: link.escritorios,
    escritorio_nome: link.escritorios?.nome || 'Empresa',
  }
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  if (error) throw error
  return data
}
