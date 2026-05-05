import React from 'react'

export function initials(nome='') {
  return String(nome || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0])
    .join('')
    .toUpperCase() || '?'
}

export default function AvatarUsuario({ profile, size = 40, fontSize, style = {} }) {
  const foto = profile?.avatar_url || profile?.foto_url
  const nome = profile?.nome || profile?.email || 'Usuário'
  if (foto) {
    return (
      <img
        src={foto}
        alt={nome}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          ...style,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: profile?.cor || '#0ea5e9',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: fontSize || Math.max(11, Math.floor(size * 0.34)),
        flexShrink: 0,
        ...style,
      }}
    >
      {initials(nome)}
    </div>
  )
}
