import { useEffect, useMemo, useState } from 'react'
import { supabase, updateProfile, ROLES, can } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { CheckCircle, AlertCircle, Key, Upload, Image as ImageIcon } from 'lucide-react'
import AvatarUsuario from './common/AvatarUsuario.jsx'

const C = { navy:'#050505', gold:'#064e3b', bg:'#f8fafc', white:'#ffffff', text:'#0f172a', muted:'#64748b', border:'#e5e7eb', green:'#16a34a', greenBg:'#dcfce7', red:'#dc2626', redBg:'#fee2e2', purple:'#064e3b' }
const INP = { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid '+C.border, fontSize:14, color:C.text, background:C.white, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }
const CORES = ['#064e3b','#064e3b','#1d4ed8','#16a34a','#dc2626','#b45309','#065f46','#be185d']

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>{children}</div>
}
function Message({ m }) {
  if (!m) return null
  return <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: m.type === 'success' ? C.greenBg : C.redBg, color: m.type === 'success' ? C.green : C.red }}>{m.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{m.text}</div>
}

export default function MeuPerfil({ profile }) {
  const { refreshProfile } = useAuth()
  const [form, setForm] = useState(() => ({
    nome: profile?.nome || '', cargo: profile?.cargo || '', email: profile?.email || '', telefone: profile?.telefone || '', oab: profile?.oab || '', cor: profile?.cor || '#1d4ed8', avatar_url: profile?.avatar_url || profile?.foto_url || '',
  }))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [newPass, setNewPass] = useState('')
  const [changingPass, setChangingPass] = useState(false)
  const [passMsg, setPassMsg] = useState(null)
  const canEditProfile = can(profile, 'perfil.editar')

  useEffect(() => {
    setForm({ nome: profile?.nome || '', cargo: profile?.cargo || '', email: profile?.email || '', telefone: profile?.telefone || '', oab: profile?.oab || '', cor: profile?.cor || '#1d4ed8', avatar_url: profile?.avatar_url || profile?.foto_url || '' })
  }, [profile?.id])

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const uploadAvatar = async (file) => {
    if (!canEditProfile) { setMsg({ type:'error', text:'Visitante possui acesso somente leitura.' }); return }
    if (!file) return
    if (!file.type?.startsWith('image/')) { setMsg({ type:'error', text:'Envie apenas imagens para a foto de perfil.' }); return }
    setUploading(true); setMsg(null)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profile.escritorio_id || 'sem-escritorio'}/${profile.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data?.publicUrl
      if (!url) throw new Error('Não foi possível gerar a URL pública da imagem.')
      setForm(prev => ({ ...prev, avatar_url: url }))
      await updateProfile(profile.id, { avatar_url: url })
      await refreshProfile()
      setMsg({ type:'success', text:'Foto de perfil atualizada.' })
    } catch(e) {
      setMsg({ type:'error', text:'Erro ao enviar foto: '+e.message })
    } finally { setUploading(false) }
  }

  const saveProfile = async () => {
    if (!canEditProfile) { setMsg({ type:'error', text:'Visitante possui acesso somente leitura.' }); return }
    setSaving(true); setMsg(null)
    try {
      await updateProfile(profile.id, { nome: form.nome, cargo: form.cargo, email: form.email, telefone: form.telefone, oab: form.oab, cor: form.cor, avatar_url: form.avatar_url })
      await refreshProfile()
      setMsg({ type: 'success', text: 'Perfil atualizado com sucesso!' })
    } catch (e) { setMsg({ type: 'error', text: 'Erro ao salvar: ' + e.message }) }
    finally { setSaving(false) }
  }

  const changePassword = async () => {
    if (!canEditProfile) { setPassMsg({ type:'error', text:'Visitante possui acesso somente leitura.' }); return }
    if (newPass.length < 8) { setPassMsg({ type: 'error', text: 'A senha deve ter pelo menos 8 caracteres.' }); return }
    setChangingPass(true); setPassMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) setPassMsg({ type: 'error', text: error.message })
    else { setPassMsg({ type: 'success', text: 'Senha alterada com sucesso!' }); setNewPass('') }
    setChangingPass(false)
  }

  const avatarProfile = useMemo(() => ({...profile, ...form}), [profile, form])

  return <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
    <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 22px' }}>Meu Perfil</h1>

    <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:24, padding:20, background:C.white, borderRadius:12, border:'1px solid '+C.border, flexWrap:'wrap' }}>
      <AvatarUsuario profile={avatarProfile} size={78} fontSize={22} />
      <div style={{ flex:1, minWidth:240 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{form.nome || profile?.nome}</div>
        <div style={{ fontSize: 13, color: C.muted }}>{form.cargo}</div>
        <div style={{ fontSize: 12, color: C.purple, fontWeight: 700, marginTop: 2 }}>{ROLES[profile?.role]?.label || profile?.papel || ''}</div>
      </div>
      <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 14px', border:'1px solid '+C.border, borderRadius:8, cursor: uploading?'wait':'pointer', fontWeight:700, color:C.text, background:C.white }}>
        {uploading ? <Upload size={16}/> : <ImageIcon size={16}/>} {uploading?'Enviando...':'Enviar foto'}
        <input type="file" accept="image/*" style={{display:'none'}} disabled={uploading} onChange={e=>uploadAvatar(e.target.files?.[0])} />
      </label>
    </div>

    <div style={{ background: C.white, borderRadius: 12, border: '1px solid ' + C.border, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Dados pessoais</h2>
      <Message m={msg} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <Field label="Nome completo"><input style={INP} value={form.nome} onChange={handleChange('nome')} /></Field>
        <Field label="Cargo"><input style={INP} value={form.cargo} onChange={handleChange('cargo')} /></Field>
        <Field label="E-mail"><input style={INP} value={form.email} onChange={handleChange('email')} /></Field>
        <Field label="Telefone"><input style={INP} value={form.telefone} onChange={handleChange('telefone')} placeholder="(11) 99999-9999" /></Field>
        <Field label="OAB"><input style={INP} value={form.oab} onChange={handleChange('oab')} placeholder="SP 123456" /></Field>
      </div>
      <Field label="Cor do avatar">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{CORES.map(cor => <button key={cor} type="button" aria-label={`Cor ${cor}`} onClick={() => setForm(prev => ({ ...prev, cor }))} style={{ width: 30, height: 30, borderRadius: '50%', background: cor, cursor: 'pointer', border: form.cor === cor ? '3px solid ' + C.text : '3px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>{form.cor === cor && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'block' }} />}</button>)}</div>
      </Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={saveProfile} disabled={saving} style={{ padding: '9px 20px', background: saving ? C.muted : C.navy, color: 'white', border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
    </div>

    <div style={{ background: C.white, borderRadius: 12, border: '1px solid ' + C.border, padding: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Key size={16} color={C.muted} />Alterar senha</h2>
      <Message m={passMsg} />
      <Field label="Nova senha"><input type="password" style={INP} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" /></Field>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={changePassword} disabled={changingPass || !newPass} style={{ padding: '9px 20px', background: (!newPass || changingPass) ? C.muted : C.navy, color: 'white', border: 'none', borderRadius: 8, cursor: (!newPass || changingPass) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>{changingPass ? 'Alterando...' : 'Alterar senha'}</button></div>
    </div>
  </div>
}
