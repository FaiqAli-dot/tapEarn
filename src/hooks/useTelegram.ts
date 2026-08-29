import { useState, useEffect } from 'react'
import { User, TelegramWebApp } from '../types/game'

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

/** True when running inside Telegram with a usable WebApp API (not just the stub script in a browser). */
function isRealTelegramWebApp(tg: TelegramWebApp): boolean {
  const hasInitData = Boolean(tg.initData && tg.initData.length > 0)
  const hasUser = Boolean(tg.initDataUnsafe?.user?.id)
  const hasMiniAppUi = Boolean(tg.mainButton && tg.backButton)
  return hasInitData || hasUser || hasMiniAppUi
}

function readDevUserFromUrl(): User {
  const urlParams = new URLSearchParams(window.location.search)
  const urlUserId = urlParams.get('userId')
  const id = urlUserId ? Number(urlUserId) : 123456789

  return {
    id: Number.isFinite(id) ? id : 123456789,
    username: urlParams.get('username') || 'testuser',
    firstName: urlParams.get('firstName') || 'Test',
    lastName: urlParams.get('lastName') || 'User',
    isPremium: false,
    languageCode: 'en'
  }
}

function applyThemeParams(tg: TelegramWebApp) {
  if (!tg.themeParams) return
  document.documentElement.style.setProperty('--tg-bg-color', tg.themeParams.bg_color)
  document.documentElement.style.setProperty('--tg-text-color', tg.themeParams.text_color)
  document.documentElement.style.setProperty('--tg-hint-color', tg.themeParams.hint_color)
  document.documentElement.style.setProperty('--tg-link-color', tg.themeParams.link_color)
  document.documentElement.style.setProperty('--tg-button-color', tg.themeParams.button_color)
  document.documentElement.style.setProperty('--tg-button-text-color', tg.themeParams.button_text_color)
}

function storeReferralFromStartParam(startParam: string | null | undefined) {
  if (!startParam) return
  const referralCode = startParam.startsWith('ref_')
    ? startParam.substring(4)
    : startParam
  if (referralCode) {
    localStorage.setItem('referralCode', referralCode)
  }
}

export const useTelegram = () => {
  const [user, setUser] = useState<User | null>(null)
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const tg = window.Telegram?.WebApp

    if (tg && isRealTelegramWebApp(tg)) {
      setWebApp(tg)

      try {
        tg.ready?.()
        tg.expand?.()
      } catch {
        // ignore — some clients expose partial APIs
      }

      applyThemeParams(tg)

      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user)
      }

      const urlParams = new URLSearchParams(window.location.search)
      const startParam =
        urlParams.get('start') ||
        urlParams.get('tgWebAppStartParam') ||
        tg.initDataUnsafe?.start_param
      storeReferralFromStartParam(startParam)

      if (typeof tg.onEvent === 'function') {
        tg.onEvent('themeChanged', () => applyThemeParams(tg))
        tg.onEvent('viewportChanged', () => {
          // reserved for future layout tweaks
        })
      }

      if (tg.mainButton?.onClick) {
        tg.mainButton.onClick(() => {
          // default main button handler
        })
      }

      if (tg.backButton?.onClick) {
        tg.backButton.onClick(() => {
          if (window.history.length > 1) {
            window.history.back()
          }
        })
      }

      setIsReady(true)
    } else {
      // Browser / local dev — telegram-web-app.js may exist but APIs are incomplete
      setUser(readDevUserFromUrl())

      const urlParams = new URLSearchParams(window.location.search)
      storeReferralFromStartParam(
        urlParams.get('start') || urlParams.get('tgWebAppStartParam')
      )

      setIsReady(true)
    }
  }, [])

  const showAlert = (message: string) => {
    if (webApp?.showAlert) {
      webApp.showAlert(message)
    } else {
      alert(message)
    }
  }

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (webApp?.showConfirm) {
        webApp.showConfirm(message, (confirmed) => {
          resolve(confirmed)
        })
      } else {
        resolve(confirm(message))
      }
    })
  }

  const showPopup = (title: string, message: string, buttons: Array<{ id: string; text: string; type?: string }>) => {
    if (webApp?.showPopup) {
      webApp.showPopup({
        title,
        message,
        buttons: buttons.map(btn => ({
          id: btn.id,
          type: (btn.type as 'default' | 'ok' | 'close' | 'cancel' | 'destructive') || 'default',
          text: btn.text
        }))
      })
    }
  }

  const openLink = (url: string, tryInstantView = false) => {
    if (webApp?.openLink) {
      webApp.openLink(url, { try_instant_view: tryInstantView })
    } else {
      window.open(url, '_blank')
    }
  }

  const openTelegramLink = (url: string) => {
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const sendData = (data: string) => {
    if (webApp?.sendData) {
      webApp.sendData(data)
    }
  }

  const hapticFeedback = (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
    if (webApp?.hapticFeedback?.impactOccurred) {
      webApp.hapticFeedback.impactOccurred(style)
    }
  }

  const notificationFeedback = (type: 'error' | 'success' | 'warning') => {
    if (webApp?.hapticFeedback?.notificationOccurred) {
      webApp.hapticFeedback.notificationOccurred(type)
    }
  }

  const selectionFeedback = () => {
    if (webApp?.hapticFeedback?.selectionChanged) {
      webApp.hapticFeedback.selectionChanged()
    }
  }

  const setMainButton = (text: string, callback?: () => void) => {
    const mainButton = webApp?.mainButton
    if (!mainButton) return

    mainButton.text = text
    if (callback && mainButton.onClick) {
      mainButton.onClick(callback)
    }
    mainButton.show?.()
  }

  const hideMainButton = () => {
    webApp?.mainButton?.hide?.()
  }

  const setBackButton = (callback?: () => void) => {
    const backButton = webApp?.backButton
    if (!backButton) return

    if (callback && backButton.onClick) {
      backButton.onClick(callback)
    }
    backButton.isVisible = true
  }

  const hideBackButton = () => {
    if (webApp?.backButton) {
      webApp.backButton.isVisible = false
    }
  }

  const getInitData = () => webApp?.initData || ''

  const getStartParam = () => {
    const urlParams = new URLSearchParams(window.location.search)
    return (
      urlParams.get('start') ||
      urlParams.get('tgWebAppStartParam') ||
      webApp?.initDataUnsafe?.start_param ||
      localStorage.getItem('referralCode') ||
      null
    )
  }

  return {
    user,
    webApp,
    isReady,
    getInitData,
    getStartParam,
    showAlert,
    showConfirm,
    showPopup,
    openLink,
    openTelegramLink,
    sendData,
    hapticFeedback,
    notificationFeedback,
    selectionFeedback,
    setMainButton,
    hideMainButton,
    setBackButton,
    hideBackButton
  }
}
