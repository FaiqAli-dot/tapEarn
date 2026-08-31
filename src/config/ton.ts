/** Production GitHub Pages origin for TON Connect manifest (must be absolute HTTPS). */
export const PRODUCTION_MANIFEST_URL =
  'https://faiqali-dot.github.io/tapEarn/tonconnect-manifest.json'

export const PRODUCTION_ICON_URL =
  'https://faiqali-dot.github.io/tapEarn/icon.png'

export const TON_TESTNET_EXPLORER_BASE = 'https://testnet.tonscan.org'

export function resolveTonConnectManifestUrl(): string {
  const fromEnv = (import.meta as any).env?.VITE_TON_CONNECT_MANIFEST_URL as string | undefined
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'faiqali-dot.github.io' || host.endsWith('.github.io')) {
      return PRODUCTION_MANIFEST_URL
    }
    // Local dev: absolute URL so Telegram Mini App webviews can fetch the manifest
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${window.location.origin}/tonconnect-manifest.json`
    }
  }

  const baseUrl = import.meta.env.BASE_URL
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return `${baseUrl.replace(/\/$/, '')}/tonconnect-manifest.json`
  }

  if (typeof window !== 'undefined') {
    const base = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`
    return `${window.location.origin}${base}tonconnect-manifest.json`.replace(/([^:]\/)\/+/g, '$1')
  }

  return PRODUCTION_MANIFEST_URL
}

export function tonExplorerAddressUrl(address: string): string {
  return `${TON_TESTNET_EXPLORER_BASE}/address/${address}`
}

export function tonExplorerTxUrl(txHash: string): string {
  return `${TON_TESTNET_EXPLORER_BASE}/tx/${txHash}`
}
