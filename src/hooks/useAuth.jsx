import { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react'
import { supabase, getProfile } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)

  // Guarda o ultimo perfil valido. Assim, uma falha momentanea de rede/RLS
  // nao derruba o app para a tela "Carregando perfil...".
  const profileRef = useRef(null)
  const loadingProfileRef = useRef(false)

  const loadProfile = useCallback(async (user, options = {}) => {
    const { globalLoading = false, clearBeforeLoad = false } = options
    if (!user || loadingProfileRef.current) return profileRef.current

    loadingProfileRef.current = true
    if (globalLoading) setLoading(true)
    if (clearBeforeLoad) {
      profileRef.current = null
      setProfile(null)
    }

    try {
      const p = await getProfile(user.id, user.email)
      profileRef.current = p
      setProfile(p)
      setProfileError(null)
      return p
    } catch (e) {
      console.error('Erro ao carregar perfil:', e)
      setProfileError(e)
      // Mantem o perfil anterior se ja havia um. Isso evita "reset" do app.
      if (!profileRef.current) setProfile(null)
      return profileRef.current
    } finally {
      loadingProfileRef.current = false
      if (globalLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!alive) return
        setSession(session)
        if (session?.user) {
          await loadProfile(session.user, { clearBeforeLoad: true })
        } else {
          profileRef.current = null
          setProfile(null)
        }
      } finally {
        if (alive) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return

      setSession(nextSession)

      if (!nextSession?.user) {
        profileRef.current = null
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      // Eventos frequentes quando a aba volta ao foco. Nao recarregamos perfil
      // nem colocamos a aplicacao em loading para nao perder formularios abertos.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return

      // Em SIGNED_IN/INITIAL_SESSION, so busca de novo se ainda nao temos perfil.
      if (!profileRef.current) {
        loadProfile(nextSession.user, { globalLoading: false, clearBeforeLoad: false })
      }
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return null
    return loadProfile(session.user, { globalLoading: false, clearBeforeLoad: false })
  }, [session, loadProfile])

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileError, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
