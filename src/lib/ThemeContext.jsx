import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} })

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('jurisbpo-theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const initial = getInitialTheme()
    // Aplica a classe imediatamente para evitar flash antes do primeiro render
    if (initial === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    return initial
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('jurisbpo-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
