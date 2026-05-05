import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Scale, FileText, CheckSquare, Calendar,
  Brain, Users, Bell, LogOut, Menu, ChevronRight, Settings,
  AlertTriangle, Loader, BarChart3, Building2, Archive,
} from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { supabase, signOut, can, ROLES } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import { APP_CONFIG } from './config/appConfig.js'
import AvatarUsuario from './components/common/AvatarUsuario.jsx'

// ── Importa as páginas ────────────────────────────────────────────────────
// (cada uma em seu próprio arquivo para facilitar manutenção)
import Dashboard   from './components/Dashboard.jsx'
import Processos   from './components/Processos.jsx'
import Contratos   from './components/Contratos.jsx'
import Atividades  from './components/Atividades.jsx'
import Calendario  from './components/Calendario.jsx'
import IaJuridica  from './components/IaJuridica.jsx'
import Equipe      from './components/Equipe.jsx'
import Notificacoes from './components/Notificacoes.jsx'
import MeuPerfil   from './components/MeuPerfil.jsx'
import Relatorios   from './components/Relatorios.jsx'
import PartesCRM   from './components/PartesCRM.jsx'
import Acervo      from './components/Acervo.jsx'

// ── Tema ─────────────────────────────────────────────────────────────────
const C = {
  navy: '#050505', navyL: '#111827', gold: '#064e3b',
  bg: '#f8fafc', white: '#ffffff', text: '#0f172a',
  muted: '#64748b', border: '#e5e7eb', red: '#dc2626',
}

// ── Sidebar ───────────────────────────────────────────────────────────────
function buildNav(profile) {
  const all = [
    { path: '/dashboard',  label: 'Painel',        Icon: LayoutDashboard },
    { path: '/processos',  label: 'Processos',      Icon: Scale,     perm: 'processos.ver' },
    { path: '/contratos',  label: 'Contratos',      Icon: FileText,  perm: 'contratos.ver' },
    { path: '/partes',     label: 'Partes / CRM',   Icon: Building2, perm: 'processos.ver' },
    { path: '/acervo',     label: 'Acervo',        Icon: Archive,   perm: 'processos.ver' },
    { path: '/atividades', label: 'Atividades',    Icon: CheckSquare },
    { path: '/calendario', label: 'Calendário',     Icon: Calendar   },
    { path: '/ia',         label: 'IA Jurídica',    Icon: Brain,     perm: 'ia.usar', accent: true },
    { path: '/notificacoes', label: 'Notificações', Icon: Bell },
    { path: '/relatorios', label: 'Relatórios', Icon: BarChart3, perm: 'processos.ver' },
    { path: '/equipe',     label: 'Equipe',         Icon: Users,     perm: 'equipe.ver' },
  ]
  return all.filter(item => !item.perm || can(profile, item.perm))
}

function Sidebar({ nav, currentPath, onNav, open, onClose, profile, onLogout, mobile, unreadCount }) {
  const initials = profile?.nome?.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
  return (
    <>
      {mobile && open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 98 }} />}
      <aside style={{ position: 'fixed', top: 0, bottom: 0, width: 224, left: open ? 0 : -240, background: C.navy, display: 'flex', flexDirection: 'column', zIndex: 99, transition: 'left 0.22s ease' }}>
        {/* Logo */}
        <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid ' + C.navyL }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={19} color={C.navy} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{APP_CONFIG.nome}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{APP_CONFIG.subtitulo}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {nav.map(({ path, label, Icon, accent }) => {
            const active = currentPath === path
            return (
              <button key={path} onClick={() => { onNav(path); onClose() }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 2, textAlign: 'left', background: active ? C.navyL : (accent && !active ? 'rgba(6,78,59,0.16)' : 'transparent'), color: active ? C.gold : (accent ? '#86efac' : 'rgba(255,255,255,0.6)'), fontSize: 14, fontWeight: active ? 700 : 400, transition: 'all 0.12s' }}>
                <Icon size={16} />{label}
                {path === '/notificacoes' && unreadCount > 0 && <span title={`${unreadCount} item(ns) não lido(s)`} style={{ marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 999, background: '#dc2626', color: 'white', fontSize: 11, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
                {active && path !== '/notificacoes' && <ChevronRight size={12} style={{ marginLeft: 'auto' }} />}
                {active && path === '/notificacoes' && unreadCount === 0 && <ChevronRight size={12} style={{ marginLeft: 'auto' }} />}
                {accent && !active && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, background: 'rgba(6,78,59,0.55)', color: '#bbf7d0', padding: '2px 6px', borderRadius: 10 }}>IA</span>}
              </button>
            )
          })}
        </nav>

        {/* Usuário */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid ' + C.navyL }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <AvatarUsuario profile={profile} size={34} fontSize={13} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.nome}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{ROLES[profile?.role]?.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onNav('/perfil'); onClose() }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              <Settings size={13} />Perfil
            </button>
            <button onClick={onLogout}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              <LogOut size={13} />Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ── Layout autenticado ─────────────────────────────────────────────────────
function AppLayout() {
  const { profile, loading, profileError } = useAuth()
  const navigate = useNavigate()
  const [mobile, setMobile]   = useState(false)
  const [sbOpen, setSbOpen]   = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const check = () => { const m = window.innerWidth < 768; setMobile(m); setSbOpen(!m) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    async function carregarNaoLidas() {
      const [{ count: notificacoesCount }, { count: mensagensCount }] = await Promise.all([
        supabase.from('notificacoes').select('id', { count: 'exact', head: true }).eq('usuario_id', profile.id).eq('lida', false).eq('arquivada', false),
        supabase.from('mensagens').select('id', { count: 'exact', head: true }).eq('destinatario_id', profile.id).eq('lida', false).not('arquivada_por','cs',`{${profile.id}}`),
      ])
      if (alive) setUnreadCount((notificacoesCount || 0) + (mensagensCount || 0))
    }
    carregarNaoLidas()
    const timer = window.setInterval(carregarNaoLidas, 30000)
    window.addEventListener('jurisbpo:notificacoes-atualizadas', carregarNaoLidas)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener('jurisbpo:notificacoes-atualizadas', carregarNaoLidas)
    }
  }, [profile?.id])

  const nav = profile ? buildNav(profile) : []
  const currentPath = window.location.pathname

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #050505', borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: C.muted, fontSize: 14 }}>Carregando...</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <Loader size={34} color={C.gold} style={{ display: 'block', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Carregando perfil...</h2>
          {profileError && <p style={{ color: C.red, fontSize: 12, marginTop: 10 }}>{profileError.message}</p>}
          <button onClick={handleLogout} style={{ marginTop: 20, padding: '10px 24px', background: C.navy, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Sair</button>
        </div>
      </div>
    )
  }

  if (profile.ativo === false) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <AlertTriangle size={40} color={C.red} style={{ display: 'block', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Conta desativada</h2>
          <p style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>Sua conta foi desativada. Entre em contato com o gerente jurídico.</p>
          <button onClick={handleLogout} style={{ padding: '10px 24px', background: C.navy, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Sair</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,sans-serif', overflow: 'hidden' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <Sidebar nav={nav} currentPath={currentPath} onNav={navigate} open={sbOpen} onClose={() => mobile && setSbOpen(false)} profile={profile} onLogout={handleLogout} mobile={mobile} unreadCount={unreadCount} />
      <div style={{ flex: 1, marginLeft: mobile ? 0 : 224, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'margin-left 0.22s' }}>
        {/* Topbar mobile */}
        {mobile && (
          <div className="mobile-topbar" style={{ padding: '12px 16px', background: C.white, borderBottom: '1px solid ' + C.border, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
            <button aria-label="Abrir menu" onClick={() => setSbOpen(true)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.text, display: 'flex', padding: 8, marginLeft: -8 }}><Menu size={22} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><Scale size={18} color={C.gold} /><span style={{ fontSize: 15, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{APP_CONFIG.nome}</span></div>
          </div>
        )}
        <main className="app-main" style={{ flex: 1, overflowY: 'auto', paddingBottom: mobile ? 'calc(78px + env(safe-area-inset-bottom))' : 0 }}>
          <Routes>
            <Route path="/dashboard"  element={<Dashboard  profile={profile} />} />
            <Route path="/processos"  element={can(profile,'processos.ver') ? <Processos  profile={profile} /> : <Bloqueado />} />
            <Route path="/contratos"  element={can(profile,'contratos.ver') ? <Contratos  profile={profile} /> : <Bloqueado />} />
            <Route path="/partes"     element={can(profile,'processos.ver') ? <PartesCRM profile={profile} /> : <Bloqueado />} />
            <Route path="/acervo"     element={can(profile,'processos.ver') ? <Acervo profile={profile} /> : <Bloqueado />} />
            <Route path="/atividades" element={<Atividades profile={profile} />} />
            <Route path="/tarefas" element={<Navigate to="/atividades" replace />} />
            <Route path="/calendario" element={<Calendario profile={profile} />} />
            <Route path="/ia"         element={can(profile,'ia.usar')        ? <IaJuridica profile={profile} /> : <Bloqueado />} />
            <Route path="/notificacoes" element={<Notificacoes profile={profile} />} />
            <Route path="/relatorios" element={<Relatorios profile={profile} />} />
            <Route path="/equipe"     element={can(profile,'equipe.ver')     ? <Equipe     profile={profile} /> : <Bloqueado />} />
            <Route path="/perfil"     element={<MeuPerfil  profile={profile} />} />
            <Route path="*"           element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        {mobile && <MobileNav nav={nav} currentPath={currentPath} onNav={navigate} unreadCount={unreadCount} />}
      </div>
    </div>
  )
}

function MobileNav({ nav, currentPath, onNav, unreadCount }) {
  const primary = nav.filter(item => ['/dashboard','/processos','/atividades','/calendario','/notificacoes'].includes(item.path)).slice(0, 5)
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {primary.map(({ path, label, Icon }) => {
        const active = currentPath === path
        return (
          <button key={path} onClick={() => onNav(path)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={20} />
              {path === '/notificacoes' && unreadCount > 0 && <span style={{ position: 'absolute', top: -6, right: -8, width: 10, height: 10, borderRadius: 999, background: '#dc2626', border: '2px solid white' }} />}
            </span>
            <span>{label === 'Atividades' ? 'Ativ.' : label === 'Notificações' ? 'Notif.' : label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Bloqueado() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <AlertTriangle size={36} color="#b45309" style={{ display: 'block', margin: '0 auto 12px' }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Acesso restrito</h2>
      <p style={{ color: '#64748b', fontSize: 14 }}>Você não tem permissão para acessar esta seção.</p>
    </div>
  )
}

// ── Roteador principal ────────────────────────────────────────────────────
function AppRouter() {
  const { session, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={!session ? <Auth /> : <Navigate to="/dashboard" replace />} />
      <Route path="/*"     element={session  ? <AppLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
