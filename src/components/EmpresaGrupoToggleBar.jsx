import { Building2 } from 'lucide-react'
import { C } from '../lib/theme'
import { CONSOLIDADO_KEY } from '../lib/empresaGrupoFilter.js'

function toggleLabel(empresa) {
  const f = empresa?.nome_fantasia?.trim()
  if (f) return f
  return empresa?.nome || 'Empresa'
}

/**
 * Toggles no estilo do módulo Acervo (pílulas + ícone).
 * @param {{ empresas: { id: string, nome?: string, nome_fantasia?: string }[], value: string, onChange: (id: string) => void }} props
 */
export default function EmpresaGrupoToggleBar({ empresas, value, onChange }) {
  if (!empresas?.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 4, background: C.bg, border: '1px solid ' + C.border, borderRadius: 10, padding: 4 }}>
        {empresas.map((emp) => {
          const sel = value === emp.id
          return (
            <button
              key={emp.id}
              type="button"
              onClick={() => onChange(emp.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                border: 'none',
                borderRadius: 7,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: sel ? 700 : 400,
                background: sel ? C.white : 'transparent',
                color: sel ? C.primary : C.muted,
                boxShadow: sel ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                fontFamily: 'inherit',
              }}
            >
              <Building2 size={13} />
              {toggleLabel(emp)}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChange(CONSOLIDADO_KEY)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: 'none',
            borderRadius: 7,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: value === CONSOLIDADO_KEY ? 700 : 400,
            background: value === CONSOLIDADO_KEY ? C.white : 'transparent',
            color: value === CONSOLIDADO_KEY ? C.primary : C.muted,
            boxShadow: value === CONSOLIDADO_KEY ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            fontFamily: 'inherit',
          }}
        >
          <Building2 size={13} />
          Consolidado
        </button>
      </div>
    </div>
  )
}
