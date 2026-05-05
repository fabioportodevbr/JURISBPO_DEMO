import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

export default function NextApp() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      })
    }
  }, [])

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  )
}
