import dynamic from 'next/dynamic'

const ClientApp = dynamic(() => import('../src/NextApp.jsx'), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#64748b', fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,sans-serif' }}>
      Carregando...
    </div>
  ),
})

export default function SpaPage() {
  return <ClientApp />
}
