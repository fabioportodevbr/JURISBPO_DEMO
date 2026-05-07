import { useState } from 'react'
import { Scale, Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react'
import { signIn, resetPassword } from '../lib/supabase'
import { APP_CONFIG } from '../config/appConfig'

const C = {
  navy: '#050505', gold: '#064e3b', bg: '#f8fafc',
  white: '#ffffff', text: '#0f172a', muted: '#64748b',
  border: '#e5e7eb', red: '#dc2626', redBg: '#fee2e2',
  green: '#16a34a', greenBg: '#dcfce7',
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
    background: C.white, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Scale size={26} color={C.gold} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, letterSpacing: '-0.03em' }}>{APP_CONFIG.nome}</h1>
          <p style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>{APP_CONFIG.descricao}</p>
        </div>

        <div style={{ background: C.white, borderRadius: 16, padding: '32px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid ' + C.border }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 22 }}>
            {mode === 'login' ? 'Entrar na sua conta' : 'Redefinir senha'}
          </h2>

          {error && (
            <div style={{ background: C.redBg, border: '1px solid ' + C.red + '40', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.red }}>
              <AlertCircle size={15} />{error}
            </div>
          )}
          {success && (
            <div style={{ background: C.greenBg, border: '1px solid ' + C.green + '40', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.green }}>
              ✓ {success}
            </div>
          )}

          <form onSubmit={mode === 'login' ? handleLogin : handleForgot}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com.br" style={INP} />
              </div>
            </div>

            {mode === 'login' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: C.muted, pointerEvents: 'none' }} />
                  <input type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ ...INP, paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? C.muted : C.navy, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar link de redefinição'}
            </button>
          </form>

          <div style={{ marginTop: 18, textAlign: 'center' }}>
            {mode === 'login' ? (
              <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }} style={{ fontSize: 13, color: C.muted, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Esqueci minha senha
              </button>
            ) : (
              <button onClick={() => { setMode('login'); setError(''); setSuccess('') }} style={{ fontSize: 13, color: C.muted, border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                ← Voltar ao login
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 20 }}>
          Acesso apenas por convite do administrador
        </p>
      </div>
    </div>
  )
}
