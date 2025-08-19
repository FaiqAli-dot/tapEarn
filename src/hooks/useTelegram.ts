import { useState, useEffect } from 'react'
import { User, TelegramWebApp } from '../types/game'

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}

export const useTelegram = () => {
  const [user, setUser] = useState<User | null>(null)
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Check if running in Telegram Web App
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      setWebApp(tg)

      // Initialize Telegram Web App
      tg.ready()
      tg.expand()

      // Set theme colors
      if (tg.themeParams) {
        document.documentElement.style.setProperty('--tg-bg-color', tg.themeParams.bg_color)
        document.documentElement.style.setProperty('--tg-text-color', tg.themeParams.text_color)
        document.documentElement.style.setProperty('--tg-hint-color', tg.themeParams.hint_color)
        document.documentElement.style.setProperty('--tg-link-color', tg.themeParams.link_color)
        document.documentElement.style.setProperty('--tg-button-color', tg.themeParams.button_color)
        document.documentElement.style.setProperty('--tg-button-text-color', tg.themeParams.button_text_color)
      }

      // Get user data
      if (tg.initDataUnsafe?.user) {
        setUser(tg.initDataUnsafe.user)
      }

      // Check for referral parameter
      const urlParams = new URLSearchParams(window.location.search)
      const startParam = urlParams.get('start') || tg.initDataUnsafe?.start_param
      
      if (startParam && startParam.startsWith('ref_')) {
        const referralCode = startParam.substring(4)
        // Store referral code for later use
        localStorage.setItem('referralCode', referralCode)
      }

      setIsReady(true)

      // Handle theme changes
      tg.onEvent('themeChanged', () => {
        if (tg.themeParams) {
          document.documentElement.style.setProperty('--tg-bg-color', tg.themeParams.bg_color)
          document.documentElement.style.setProperty('--tg-text-color', tg.themeParams.text_color)
          document.documentElement.style.setProperty('--tg-hint-color', tg.themeParams.hint_color)
          document.documentElement.style.setProperty('--tg-link-color', tg.themeParams.link_color)
          document.documentElement.style.setProperty('--tg-button-color', tg.themeParams.button_color)
          document.documentElement.style.setProperty('--tg-button-text-color', tg.themeParams.button_text_color)
        }
      })

      // Handle viewport changes
      tg.onEvent('viewportChanged', () => {
        // Handle viewport changes if needed
      })

      // Handle main button clicks
      tg.mainButton.onClick(() => {
        // Handle main button click
      })

      // Handle back button clicks
      tg.backButton.onClick(() => {
        // Handle back button click
        if (window.history.length > 1) {
          window.history.back()
        }
      })

    } else {
      // Not running in Telegram, create mock data for development
      setUser({
        id: 123456789,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isPremium: false,
        languageCode: 'en'
      })
      setIsReady(true)
    }
  }, [])

  const showAlert = (message: string) => {
    if (webApp) {
      webApp.showAlert(message)
    } else {
      alert(message)
    }
  }

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (webApp) {
        webApp.showConfirm(message, (confirmed) => {
          resolve(confirmed)
        })
      } else {
        resolve(confirm(message))
      }
    })
  }

  const showPopup = (title: string, message: string, buttons: Array<{ id: string; text: string; type?: string }>) => {
    if (webApp) {
      webApp.showPopup({
        title,
        message,
        buttons: buttons.map(btn => ({
          id: btn.id,
          type: (btn.type as any) || 'default',
          text: btn.text
        }))
      })
    }
  }

  const openLink = (url: string, tryInstantView = false) => {
    if (webApp) {
      webApp.openLink(url, { try_instant_view: tryInstantView })
    } else {
      window.open(url, '_blank')
    }
  }

  const openTelegramLink = (url: string) => {
    if (webApp) {
      webApp.openTelegramLink(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const sendData = (data: string) => {
    if (webApp) {
      webApp.sendData(data)
    }
  }

  const hapticFeedback = (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => {
    if (webApp) {
      webApp.hapticFeedback.impactOccurred(style)
    }
  }

  const notificationFeedback = (type: 'error' | 'success' | 'warning') => {
    if (webApp) {
      webApp.hapticFeedback.notificationOccurred(type)
    }
  }

  const selectionFeedback = () => {
    if (webApp) {
      webApp.hapticFeedback.selectionChanged()
    }
  }

  const setMainButton = (text: string, callback?: () => void) => {
    if (webApp) {
      webApp.mainButton.text = text
      if (callback) {
        webApp.mainButton.onClick(callback)
      }
      webApp.mainButton.show()
    }
  }

  const hideMainButton = () => {
    if (webApp) {
      webApp.mainButton.hide()
    }
  }

  const setBackButton = (callback?: () => void) => {
    if (webApp) {
      if (callback) {
        webApp.backButton.onClick(callback)
      }
      webApp.backButton.isVisible = true
    }
  }

  const hideBackButton = () => {
    if (webApp) {
      webApp.backButton.isVisible = false
    }
  }

  return {
    user,
    webApp,
    isReady,
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
