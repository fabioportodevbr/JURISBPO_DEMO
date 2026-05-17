import { createContext, useContext, useEffect, useState } from 'react'

const PrivacyContext = createContext({ privacyMode: false, togglePrivacy: () => {} })

function getInitialPrivacy() {
  try {
    return localStorage.getItem('jurisbpo-privacy') === '1'
  } catch {
    return false
  }
}

export function PrivacyProvider({ children }) {
  const [privacyMode, setPrivacyMode] = useState(() => {
    const initial = getInitialPrivacy()
    // aplica imediatamente para evitar flash de dados antes do primeiro render
    if (initial) document.documentElement.classList.add('privacy-mode')
    return initial
  })

  useEffect(() => {
    if (privacyMode) {
      document.documentElement.classList.add('privacy-mode')
    } else {
      document.documentElement.classList.remove('privacy-mode')
    }
    try { localStorage.setItem('jurisbpo-privacy', privacyMode ? '1' : '0') } catch {}
  }, [privacyMode])

  const togglePrivacy = () => setPrivacyMode(v => !v)

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  return useContext(PrivacyContext)
}

/**
 * <Prv> — envolve qualquer dado sensível.
 * Quando o modo privacidade está ativo, o conteúdo fica borrado e
 * não pode ser selecionado ou copiado.
 *
 * Props:
 *   as       — tag HTML a renderizar (default: 'span')
 *   block    — atalho para as="div"
 *   style    — estilos adicionais
 *   className — classes adicionais
 */
export function Prv({ children, as: Tag = 'span', block = false, style, className = '' }) {
  const Elem = block ? 'div' : Tag
  return (
    <Elem className={`prv${className ? ' ' + className : ''}`} style={style}>
      {children}
    </Elem>
  )
}
