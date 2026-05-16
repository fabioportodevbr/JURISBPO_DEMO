import Head from 'next/head'
import '../src/styles/theme.css'
import '../src/mobile.css'

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>JurisBPO - Gestão Jurídica</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="#0a2e14" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="JurisBPO" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
