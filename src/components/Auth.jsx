import { useState } from 'react'
import { Scale, Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { signIn, resetPassword } from '../lib/supabase'
import { APP_CONFIG } from '../config/appConfig'

const C = {
  navy: '#050505', gold: '#064e3b', bg: '#000000',
  white: '#ffffff', text: '#ffffff', muted: '#9ca3af',
  border: 'rgba(255, 255, 255, 0.1)', red: '#ef4444', redBg: 'rgba(239, 68, 68, 0.1)',
  green: '#10b981', greenBg: 'rgba(16, 185, 129, 0.1)',
  primary: '#064e3b', // Dark green for primary actions
  primaryHover: '#043628'
}

export default function Auth() {
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message === 'Invalid login credentials'
      ? 'E-mail ou senha incorretos.'
      : error.message)
    setLoading(false)
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const { error } = await resetPassword(email)
    if (error) setError(error.message)
    else setSuccess('Enviamos um link de redefinição para ' + email)
    setLoading(false)
  }

  const INP = {
    width: '100%', padding: '11px 14px 11px 42px', borderRadius: 10,
    border: '1px solid ' + C.border, fontSize: 15, color: C.text,
    background: 'rgba(255, 255, 255, 0.05)', outline: 'none', fontFamily: 'inherit',
    transition: 'all 0.2s',
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundImage: 'url(/login-bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 16,
      position: 'relative'
    }}>
      {/* Dark overlay for better text readability */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        zIndex: 1
      }} />

      <div style={{ width: '100%', maxWidth: 420, zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ 
            width: 64, height: 64, borderRadius: 18, 
            background: 'rgba(6, 78, 59, 0.8)', // Dark Green
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <Scale size={32} color={C.white} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.white, letterSpacing: '-0.03em', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
            {APP_CONFIG.nome}
          </h1>
          <p style={{ fontSize: 15, color: C.muted, marginTop: 6, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
            {APP_CONFIG.descricao}
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div style={{ 
          background: 'rgba(20, 20, 20, 0.55)', 
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 20, 
          padding: '36px 32px', 
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)', 
          border: '1px solid rgba(255, 255, 255, 0.1)' 
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.white, marginBottom: 24, textAlign: 'center' }}>
            {mode === 'login' ? 'Acesse sua conta' : 'Redefinir senha'}
          </h2>

          {error && (
            <div style={{ background: C.redBg, border: '1px solid ' + C.red + '40', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: C.red }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />{error}
            </div>
          )}
          {success && (
            <div style={{ background: C.greenBg, border: '1px solid ' + C.green + '40', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: C.green }}>
              ✓ {success}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleForgot}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} />
                <input 
                  type="email" 
                  required 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="seu@email.com.br" 
                  style={INP} 
                  onFocus={(e) => e.target.style.borderColor = C.green}
                  onBlur={(e) => e.target.style.borderColor = C.border}
                />
              </div>
            </div>

            {mode === 'login' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} />
                  <input 
                    type={showPass ? 'text' : 'password'} 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    style={{ ...INP, paddingRight: 44 }} 
                    onFocus={(e) => e.target.style.borderColor = C.green}
                    onBlur={(e) => e.target.style.borderColor = C.border}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} style={{ 
              width: '100%', 
              padding: '14px', 
              background: loading ? C.muted : C.primary, 
              color: C.white, 
              border: 'none', 
              borderRadius: 10, 
              fontSize: 15, 
              fontWeight: 700, 
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(6, 78, 59, 0.3)',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => { if(!loading) e.target.style.background = C.primaryHover }}
            onMouseOut={(e) => { if(!loading) e.target.style.background = C.primary }}
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar link'}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            {mode === 'login' ? (
              <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} style={{ fontSize: 13, color: C.muted, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = C.white} onMouseOut={(e) => e.target.style.color = C.muted}>
                Esqueci minha senha
              </button>
            ) : (
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} style={{ fontSize: 13, color: C.muted, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = C.white} onMouseOut={(e) => e.target.style.color = C.muted}>
                ← Voltar ao login
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255, 255, 255, 0.5)', marginTop: 24 }}>
          Acesso restrito
        </p>
      </div>
    </div>
  )
}
