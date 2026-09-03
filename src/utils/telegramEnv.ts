/**
 * Detect a real Telegram Mini App client (not a normal browser / Pages visitor).
 * Shared by routing so /home and /admin-panel stay public.
 */
export function isLocalDevHost(hostname = window.location.hostname): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
}

export function isRealTelegramWebApp(
  tg: { initData?: string; platform?: string; initDataUnsafe?: { user?: { id?: number } } } | null | undefined
): boolean {
  if (!tg) return false
  if (typeof window !== 'undefined' && isLocalDevHost()) {
    return false
  }
  if (tg.initData && tg.initData.length > 0) {
    return true
  }
  const platform = (tg.platform || '').toLowerCase()
  const nativePlatforms = ['ios', 'android', 'macos', 'tdesktop', 'weba', 'webk', 'unigram']
  return nativePlatforms.includes(platform) && Boolean(tg.initDataUnsafe?.user?.id)
}

export function shouldRedirectRootToHome(): boolean {
  if (typeof window === 'undefined') return false
  const tg = window.Telegram?.WebApp
  if (isRealTelegramWebApp(tg)) return false
  // Keep local Mini App / ?userId= flows on `/` for development
  if (isLocalDevHost()) return false
  // GitHub Pages (and other public hosts) in a normal browser → marketing home
  return true
}
