import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Scale, FileText, CheckSquare, Calendar,
  Brain, Users, LogOut, Menu, ChevronRight, ChevronDown, Settings,
  AlertTriangle, Loader, BarChart3, Building2, Archive, Wallet,
  MessageSquare, ShieldAlert, Bell, Eye, EyeOff, Moon, Sun, Mail,
} from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import { supabase, signOut, can, ROLES } from './lib/supabase.js'
import Auth from './components/Auth.jsx'
import { APP_CONFIG } from './config/appConfig.js'
import AvatarUsuario from './components/common/AvatarUsuario.jsx'
import { ThemeProvider, useTheme } from './lib/ThemeContext.jsx'
import { PrivacyProvider, usePrivacy, Prv } from './lib/PrivacyContext.jsx'
import { NotificacoesModal } from './components/Notificacoes.jsx'
import AlertaAtividadePopup from './components/AlertaAtividadePopup.jsx'
import PushNotificacaoPopup from './components/PushNotificacaoPopup.jsx'

// ── Importa as páginas ────────────────────────────────────────────────────
import Dashboard   from './components/Dashboard.jsx'
import Processos   from './components/Processos.jsx'
import Contratos   from './components/Contratos.jsx'
import Atividades  from './components/Atividades.jsx'
import Calendario  from './components/Calendario.jsx'
import IaJuridica  from './components/IaJuridica.jsx'
import Equipe      from './components/Equipe.jsx'
import Forum       from './components/Forum.jsx'
import MeuPerfil   from './components/MeuPerfil.jsx'
import Relatorios  from './components/Relatorios.jsx'
import PartesCRM   from './components/PartesCRM.jsx'
import Acervo      from './components/Acervo.jsx'
import Financeiro  from './pages/Financeiro.tsx'
import ConfiguracaoCalendario from './pages/ConfiguracaoCalendario.jsx'
import Compliance  from './components/Compliance.jsx'

// ── Tema ─────────────────────────────────────────────────────────────────
import { C } from './lib/theme'

// ── TopBar: constantes ────────────────────────────────────────────────────
const TOP_H     = 52
const SB_W      = 256    // largura do menu lateral (aumentada)
const SB_MARGIN = 12     // margem flutuante das bordas do browser
const SB_GAP    = 8      // espaço entre sidebar e conteúdo/topbar

const dropItemStyle = {
  display: 'flex', alignItems: 'center', gap: 10,
  width: '100%', textAlign: 'left', padding: '9px 14px',
  border: 'none', background: 'transparent', cursor: 'pointer',
  fontSize: 13, color: '#374151', fontWeight: 500,
}

// ── Nav ───────────────────────────────────────────────────────────────────
function buildNav(profile) {
  const all = [
    { path: '/dashboard',  label: 'Painel',       Icon: LayoutDashboard },
    { path: '/processos',  label: 'Processos',     Icon: Scale,      perm: 'processos.ver' },
    { path: '/contratos',  label: 'Contratos',     Icon: FileText,   perm: 'contratos.ver' },
    { path: '/partes',     label: 'Partes / CRM',  Icon: Building2,  perm: 'processos.ver' },
    { path: '/acervo',     label: 'Acervo',        Icon: Archive,    perm: 'processos.ver' },
    { path: '/atividades', label: 'Atividades',    Icon: CheckSquare },
    { path: '/calendario', label: 'Calendário',    Icon: Calendar    },
    { path: '/financeiro', label: 'Financeiro',    Icon: Wallet,     perm: 'financeiro.ver' },
    { path: '/ia',         label: 'IA Jurídica',   Icon: Brain,      perm: 'ia.usar', accent: true },
    { path: '/relatorios', label: 'Relatórios',    Icon: BarChart3,  perm: 'processos.ver' },
    { path: '/compliance', label: 'Compliance',    Icon: ShieldAlert, perm: 'compliance.ver' },
  ]
  return all.filter(item => !item.perm || can(profile, item.perm))
}

// ── Sidebar (logo no topo, flutuante no desktop) ──────────────────────────
function Sidebar({ nav, currentPath, onNav, open, onClose, mobile, unreadCount }) {
  const [hovered, setHovered] = useState(null)
  return (
    <>
      {mobile && open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 98 }} />
      )}
      <aside style={{
        position: 'fixed',
        top: mobile ? TOP_H : SB_MARGIN,
        bottom: mobile ? 0 : SB_MARGIN,
        width: SB_W,
        left: open ? (mobile ? 0 : SB_MARGIN) : -(SB_W + SB_MARGIN * 2),
        background: C.navy, display: 'flex', flexDirection: 'column',
        zIndex: 99, transition: 'left 0.22s ease',
        borderRadius: mobile ? 0 : 16,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
        fontFamily: "'Nunito Sans',system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
      }}>
        {/* Logo — apenas no desktop */}
        {!mobile && (
          <div style={{
            padding: '16px 18px 14px', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Scale size={17} color={C.navy} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{APP_CONFIG.nome}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{APP_CONFIG.subtitulo}</div>
            </div>
          </div>
        )}
        <nav className="sidebar-nav" style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          {nav.map(({ path, label, Icon, accent }) => {
            const active = currentPath === path
            return (
              <button key={path}
                onClick={() => { onNav(path); onClose() }}
                onMouseEnter={() => setHovered(path)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '8px 12px', border: 'none',
                  borderRadius: 8, cursor: 'pointer', marginBottom: 1, textAlign: 'left',
                  background: active ? C.navyL
                    : hovered === path ? 'rgba(255,255,255,0.10)'
                    : accent ? 'rgba(6,78,59,0.16)' : 'transparent',
                  color: active ? C.gold : accent ? '#86efac' : 'rgba(255,255,255,0.6)',
                  fontSize: 14, fontWeight: active ? 700 : 400, transition: 'background 0.15s',
                }}>
                <Icon size={16} />{label}
                {path === '/dashboard' && unreadCount > 0 && (
                  <span title={`${unreadCount} item(ns) não lido(s)`} style={{
                    marginLeft: 'auto', minWidth: 18, height: 18, borderRadius: 999,
                    background: '#dc2626', color: 'white', fontSize: 11, fontWeight: 900,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
                  }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
                {active && (path !== '/dashboard' || unreadCount === 0) && (
                  <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
                )}
                {accent && !active && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, background: 'rgba(6,78,59,0.55)', color: '#bbf7d0', padding: '2px 6px', borderRadius: 10 }}>IA</span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

// ── TopBar ────────────────────────────────────────────────────────────────
function TopBar({ profile, currentPath, onNav, onLogout, unreadCount, onNotificacoes, mobile, onMenuOpen }) {
  const { theme, toggleTheme } = useTheme()
  const { privacyMode, togglePrivacy } = usePrivacy()
  const [forumOpen, setForumOpen] = useState(false)
  const [userOpen,  setUserOpen]  = useState(false)

  // ── Cores dinâmicas por tema ──────────────────────────────────────────
  const isDark  = theme === 'dark'
  const RBG     = isDark ? '#1e293b' : '#ffffff'   // fundo seção direita
  const RBORD   = isDark ? '#334155' : '#e5e7eb'   // borda inferior
  const RTEXT   = isDark ? '#e2e8f0' : '#111827'   // texto
  const RICON   = isDark ? '#94a3b8' : '#374151'   // ícones neutros
  const RHOVER  = isDark ? 'rgba(255,255,255,0.07)' : '#f3f4f6'  // hover btn
  const RDROP   = isDark ? '#1e293b' : '#ffffff'   // fundo dropdown
  const RDROPB  = isDark ? '#334155' : '#e5e7eb'   // borda dropdown
  const RDROPHI = isDark ? '#334155' : '#f3f4f6'   // item hover dropdown
  const RSEP    = isDark ? '#334155' : '#e5e7eb'   // separador vertical

  const btnBase = {
    position: 'relative', border: 'none', background: 'transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 7, borderRadius: 8,
    transition: 'background .12s', color: RICON,
  }

  useEffect(() => {
    if (!forumOpen && !userOpen) return
    const h = () => { setForumOpen(false); setUserOpen(false) }
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [forumOpen, userOpen])

  const forumLinks = [
    { label: 'Chat em tempo real', Icon: MessageSquare, tab: 'chat'      },
    { label: 'Mensagens',           Icon: Mail,          tab: 'mensagens' },
  ]

  return (
    <header style={{
      position: 'fixed',
      top: mobile ? 0 : SB_MARGIN,
      left: mobile ? 0 : SB_MARGIN + SB_W + SB_GAP,
      right: mobile ? 0 : SB_MARGIN,
      height: TOP_H,
      background: RBG,
      borderRadius: mobile ? 0 : 12,
      ...(mobile
        ? { borderBottom: `1px solid ${RBORD}` }
        : { border: `1px solid ${RBORD}` }
      ),
      display: 'flex', alignItems: 'center',
      padding: '0 14px', gap: 4,
      boxShadow: isDark
        ? '0 4px 20px rgba(0,0,0,0.30)'
        : '0 4px 20px rgba(0,0,0,.10)',
      zIndex: 100,
      fontFamily: "'Nunito Sans',system-ui,-apple-system,BlinkMacSystemFont,sans-serif",
    }}>

        {/* Mobile: hambúrguer + logo compacto */}
        {mobile && (
          <>
            <button onClick={onMenuOpen} style={{ ...btnBase, marginRight: 2 }} aria-label="Abrir menu">
              <Menu size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: '#064e3b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Scale size={13} color="#d97706" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: RTEXT }}>{APP_CONFIG.nome}</span>
            </div>
          </>
        )}

        {/* Espaçador */}
        <div style={{ flex: 1 }} />

        {/* Fórum dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            title="Fórum"
            onClick={e => { e.stopPropagation(); setForumOpen(v => !v); setUserOpen(false) }}
            style={{ ...btnBase, background: forumOpen || currentPath === '/forum' ? RHOVER : 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = RHOVER}
            onMouseLeave={e => { if (!forumOpen && currentPath !== '/forum') e.currentTarget.style.background = 'transparent' }}
          >
            <MessageSquare size={17} />
          </button>
          {forumOpen && (
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: RDROP, border: `1px solid ${RDROPB}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,.14)', width: 210, zIndex: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.06em' }}>Fórum</div>
              {forumLinks.map(({ label, Icon, tab }) => (
                <button key={tab}
                  onClick={() => { onNav(`/forum?tab=${tab}`); setForumOpen(false) }}
                  style={{ ...dropItemStyle, color: RTEXT }}
                  onMouseEnter={e => e.currentTarget.style.background = RDROPHI}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon size={14} style={{ color: RICON, flexShrink: 0 }} />{label}
                </button>
              ))}
              <div style={{ height: 6 }} />
            </div>
          )}
        </div>

        {/* Notificações */}
        <button
          title="Notificações"
          onClick={onNotificacoes}
          style={btnBase}
          onMouseEnter={e => e.currentTarget.style.background = RHOVER}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%', background: '#dc2626', border: `1.5px solid ${RBG}` }} />
          )}
        </button>

        {/* Modo privacidade */}
        <button
          title={privacyMode ? 'Desativar modo privacidade' : 'Ativar modo privacidade'}
          onClick={togglePrivacy}
          className={privacyMode ? 'privacy-toggle-icon' : ''}
          style={{ ...btnBase, background: privacyMode ? (isDark ? '#450a0a' : '#fee2e2') : 'transparent', color: privacyMode ? '#dc2626' : RICON }}
          onMouseEnter={e => { if (!privacyMode) e.currentTarget.style.background = RHOVER }}
          onMouseLeave={e => { if (!privacyMode) e.currentTarget.style.background = 'transparent' }}
        >
          {privacyMode ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>

        {/* Modo escuro/claro */}
        <button
          title="Alternar modo Claro / Escuro"
          onClick={toggleTheme}
          style={btnBase}
          onMouseEnter={e => e.currentTarget.style.background = RHOVER}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Separador */}
        <div style={{ width: 1, height: 22, background: RSEP, margin: '0 6px' }} />

        {/* Avatar / usuário dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            title="Menu do usuário"
            onClick={e => { e.stopPropagation(); setUserOpen(v => !v); setForumOpen(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 6px 4px 4px', borderRadius: 8, transition: 'background .12s' }}
            onMouseEnter={e => e.currentTarget.style.background = RHOVER}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="prv" style={{display:'inline-flex'}}><AvatarUsuario profile={profile} size={30} fontSize={11} /></span>
            {!mobile && (
              <span style={{ fontSize: 13, fontWeight: 700, color: RTEXT, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Prv>{profile?.nome?.split(' ')[0]}</Prv>
              </span>
            )}
            <ChevronDown size={13} color={RTEXT} style={{ flexShrink: 0 }} />
          </button>

          {userOpen && (
            <div onClick={e => e.stopPropagation()} style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: RDROP, border: `1px solid ${RDROPB}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,.16)', width: 210, zIndex: 200, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 14px', borderBottom: `1px solid ${RDROPB}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: RTEXT }}><Prv>{profile?.nome}</Prv></div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{ROLES[profile?.role]?.label}</div>
              </div>
              <div style={{ padding: '6px 0' }}>
                <button
                  onClick={() => { onNav('/perfil'); setUserOpen(false) }}
                  style={{ ...dropItemStyle, color: RTEXT }}
                  onMouseEnter={e => e.currentTarget.style.background = RDROPHI}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Settings size={14} style={{ color: RICON, flexShrink: 0 }} /> Meu Perfil
                </button>
                {can(profile, 'equipe.ver') && (
                  <button
                    onClick={() => { onNav('/equipe'); setUserOpen(false) }}
                    style={{ ...dropItemStyle, color: RTEXT }}
                    onMouseEnter={e => e.currentTarget.style.background = RDROPHI}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Users size={14} style={{ color: RICON, flexShrink: 0 }} /> Equipe
                  </button>
                )}
              </div>
              <div style={{ padding: '6px 0', borderTop: `1px solid ${RDROPB}` }}>
                <button
                  onClick={onLogout}
                  style={{ ...dropItemStyle, color: '#dc2626' }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? '#450a0a' : '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={14} style={{ color: '#dc2626', flexShrink: 0 }} /> Sair
                </button>
              </div>
            </div>
          )}
        </div>

    </header>
  )
}

// ── Layout autenticado ─────────────────────────────────────────────────────
function AppLayout() {
  const { profile, loading, profileError } = useAuth()
  const navigate = useNavigate()
  const [mobile, setMobile] = useState(false)
  const [sbOpen, setSbOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificacoesModal, setNotificacoesModal] = useState(false)

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
      const { count: notificacoesCount } = await supabase
        .from('notificacoes')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', profile.id)
        .eq('lida', false)
        .eq('arquivada', false)
      if (alive) setUnreadCount(notificacoesCount || 0)
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

  const ATIVIDADE_TIPOS = ['nova_atividade','atividade_redistribuida','atividade_aceita','atividade_devolvida','atividade_50_prazo','atividade_vencida']
  const handleNotificacaoNavigate = (n) => {
    setNotificacoesModal(false)
    if(!n.origem_id) return
    if(ATIVIDADE_TIPOS.includes(n.tipo)) navigate(`/atividades?open=${n.origem_id}`)
    else if(n.tipo === 'mensagem') navigate(`/forum?tab=mensagens&open=${n.origem_id}`)
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(6,78,59,0.1)', borderTopColor: C.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: C.muted, fontSize: 14 }}>Carregando...</p>
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.sidebar-nav::-webkit-scrollbar{display:none}.sidebar-nav{scrollbar-width:none;-ms-overflow-style:none}`}</style>
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
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: "'Nunito Sans',system-ui,-apple-system,BlinkMacSystemFont,sans-serif", overflow: 'hidden' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.sidebar-nav::-webkit-scrollbar{display:none}.sidebar-nav{scrollbar-width:none;-ms-overflow-style:none}`}</style>

      {/* ── Barra superior fixa ───────────────────────────────── */}
      <TopBar
        profile={profile}
        currentPath={currentPath}
        onNav={navigate}
        onLogout={handleLogout}
        unreadCount={unreadCount}
        onNotificacoes={() => setNotificacoesModal(true)}
        mobile={mobile}
        onMenuOpen={() => setSbOpen(true)}
      />

      {notificacoesModal && (
        <NotificacoesModal profile={profile} onClose={() => setNotificacoesModal(false)} onNavigate={handleNotificacaoNavigate} />
      )}

      <AlertaAtividadePopup profile={profile} />
      <PushNotificacaoPopup profile={profile} />

      {/* ── Menu lateral ─────────────────────────────────────── */}
      <Sidebar
        nav={nav}
        currentPath={currentPath}
        onNav={navigate}
        open={sbOpen}
        onClose={() => mobile && setSbOpen(false)}
        mobile={mobile}
        unreadCount={unreadCount}
      />

      {/* ── Conteúdo principal ───────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: mobile ? 0 : SB_MARGIN + SB_W + SB_GAP, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'margin-left 0.22s', paddingTop: mobile ? TOP_H : SB_MARGIN + TOP_H + SB_GAP }}>
        <main className="app-main" style={{ flex: 1, overflowY: 'auto', paddingBottom: mobile ? 'calc(78px + env(safe-area-inset-bottom))' : 0 }}>
          <Routes>
            <Route path="/dashboard"  element={<Dashboard  profile={profile} unreadCount={unreadCount} />} />
            <Route path="/processos"  element={can(profile,'processos.ver') ? <Processos  profile={profile} /> : <Bloqueado />} />
            <Route path="/contratos"  element={can(profile,'contratos.ver') ? <Contratos  profile={profile} /> : <Bloqueado />} />
            <Route path="/partes"     element={can(profile,'processos.ver') ? <PartesCRM  profile={profile} /> : <Bloqueado />} />
            <Route path="/acervo"     element={can(profile,'processos.ver') ? <Acervo     profile={profile} /> : <Bloqueado />} />
            <Route path="/atividades" element={<Atividades profile={profile} />} />
            <Route path="/tarefas"    element={<Navigate to="/atividades" replace />} />
            <Route path="/calendario" element={<Calendario profile={profile} />} />
            <Route path="/financeiro" element={can(profile,'financeiro.ver') ? <Financeiro profile={profile} /> : <Bloqueado />} />
            <Route path="/ia"         element={can(profile,'ia.usar')        ? <IaJuridica profile={profile} /> : <Bloqueado />} />
            <Route path="/notificacoes" element={<Navigate to="/dashboard" replace />} />
            <Route path="/forum"      element={<Forum       profile={profile} />} />
            <Route path="/relatorios" element={<Relatorios  profile={profile} />} />
            <Route path="/equipe"     element={can(profile,'equipe.ver') ? <Equipe profile={profile} /> : <Bloqueado />} />
            <Route path="/perfil"     element={<MeuPerfil   profile={profile} />} />
            <Route path="/compliance" element={can(profile,'compliance.ver') ? <Compliance profile={profile} /> : <Bloqueado />} />
            <Route path="/configuracao-calendario" element={profile?.role === 'gerente' ? <ConfiguracaoCalendario profile={profile} /> : <Bloqueado />} />
            <Route path="*"           element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        {mobile && <MobileNav nav={nav} currentPath={currentPath} onNav={navigate} unreadCount={unreadCount} />}
      </div>
    </div>
  )
}

function MobileNav({ nav, currentPath, onNav, unreadCount }) {
  const primary = nav.filter(item => ['/dashboard','/processos','/atividades','/calendario'].includes(item.path)).slice(0, 5)
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {primary.map(({ path, label, Icon }) => {
        const active = currentPath === path
        return (
          <button key={path} onClick={() => onNav(path)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={20} />
              {path === '/dashboard' && unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -8, width: 10, height: 10, borderRadius: 999, background: '#dc2626', border: '2px solid white' }} />
              )}
            </span>
            <span>{label === 'Atividades' ? 'Ativ.' : label}</span>
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
    <ThemeProvider>
      <PrivacyProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </PrivacyProvider>
    </ThemeProvider>
  )
}
