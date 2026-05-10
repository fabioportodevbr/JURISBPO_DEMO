/** @typedef {{ id: string, nome?: string | null, nome_fantasia?: string | null }} ParteEmpresaGrupo */

export function normalizeEmpresaNome(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function compactAlnum(s) {
  return normalizeEmpresaNome(s).replace(/[^a-z0-9]/g, '')
}

/**
 * Processo vinculado à empresa do grupo (CRM): por ID ou por nome / nome fantasia (tolerante a grafias).
 * @param { { parte_contraria_id?: string | null, parte_contraria?: string | null } | null | undefined } processo
 * @param { ParteEmpresaGrupo } empresa
 */
export function processoPertenceEmpresaGrupo(processo, empresa) {
  if (!processo || !empresa?.id) return false
  const pid = processo.parte_contraria_id
  if (pid && String(pid) === String(empresa.id)) return true
  const pn = normalizeEmpresaNome(processo.parte_contraria)
  if (!pn) return false
  const nomes = [empresa.nome, empresa.nome_fantasia].map(normalizeEmpresaNome).filter(Boolean)
  for (const en of nomes) {
    if (pn === en) return true
    const pc = compactAlnum(processo.parte_contraria)
    const ec = compactAlnum(en)
    if (pc && ec && pc === ec) return true
    if (pc.length >= 12 && ec.length >= 12 && (pc.includes(ec) || ec.includes(pc))) return true
  }
  return false
}

/** @param { ParteEmpresaGrupo[] } empresas */
export function processoPertenceAlgumaEmpresaGrupo(processo, empresas) {
  if (!empresas?.length) return true
  return empresas.some((e) => processoPertenceEmpresaGrupo(processo, e))
}

/** Prioriza BRBPO / BR BPO quando existir; senão a primeira da lista (já ordenada). */
export function pickDefaultEmpresaGrupoId(empresas) {
  if (!empresas?.length) return ''
  const prefer = empresas.find((e) => {
    const blob = `${e.nome || ''} ${e.nome_fantasia || ''}`
    return /br\s*bpo|brbpo/i.test(blob)
  })
  return String((prefer || empresas[0]).id)
}

export const CONSOLIDADO_KEY = '__consolidado__'

/**
 * Restringe processos, lançamentos financeiros e atividades à empresa do grupo ou ao consolidado (união das empresas do grupo).
 * Atividades sem processo só entram no consolidado.
 * @param {{ processos: any[], financeiros: any[], atividades: any[], contratos?: any[], equipe?: any[] }} data
 * @param { ParteEmpresaGrupo[] } empresasGrupo
 * @param { string } empresaVista id ou CONSOLIDADO_KEY
 */
export function scopeDataByEmpresaGrupo(data, empresasGrupo, empresaVista) {
  if (!empresasGrupo?.length || !empresaVista) return data
  const processosFiltrados = data.processos.filter((p) => {
    if (empresaVista === CONSOLIDADO_KEY) return processoPertenceAlgumaEmpresaGrupo(p, empresasGrupo)
    const emp = empresasGrupo.find((e) => String(e.id) === String(empresaVista))
    return !!(emp && processoPertenceEmpresaGrupo(p, emp))
  })
  const ids = new Set(processosFiltrados.map((p) => p.id))
  return {
    ...data,
    processos: processosFiltrados,
    financeiros: data.financeiros.filter((f) => f.processo_id && ids.has(f.processo_id)),
    atividades: data.atividades.filter((a) => {
      if (!a.processo_id) return empresaVista === CONSOLIDADO_KEY
      return ids.has(a.processo_id)
    }),
  }
}
