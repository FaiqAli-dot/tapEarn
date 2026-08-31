import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import App from './App.tsx'
import { resolveTonConnectManifestUrl } from './config/ton.ts'
import './index.css'

// Vite BASE_URL is `/` locally and `/tapEarn/` for GitHub Pages builds
const baseUrl = import.meta.env.BASE_URL
const routerBasename = baseUrl === '/' ? undefined : baseUrl.replace(/\/$/, '')
// Telegram Wallet Mini App requires an absolute HTTPS manifest URL in production
const manifestUrl = resolveTonConnectManifestUrl()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </TonConnectUIProvider>
  </React.StrictMode>,
)
