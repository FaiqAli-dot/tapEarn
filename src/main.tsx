import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import App from './App.tsx'
import './index.css'

const baseUrl = import.meta.env.BASE_URL || '/'
const routerBasename = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
const manifestUrl = `${baseUrl}tonconnect-manifest.json`

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <BrowserRouter basename={routerBasename || undefined}>
        <App />
      </BrowserRouter>
    </TonConnectUIProvider>
  </React.StrictMode>,
)
