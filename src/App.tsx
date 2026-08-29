import React, { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useTonAddress } from '@tonconnect/ui-react'
import { motion, AnimatePresence } from 'framer-motion'

import HomeScreen from './screens/HomeScreen'
import DailyEarnUpgradesScreen from './screens/DailyEarnUpgradesScreen'
import ProfileScreen from './screens/ProfileScreen'
import ConnectWalletScreen from './screens/ConnectWalletScreen'
import InviteFriendsScreen from './screens/InviteFriendsScreen'
import LeaderboardScreen from './screens/LeaderboardScreen'
import VideoCodeAdmin from './components/VideoCodeAdmin'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'

import BottomNavigation from './components/BottomNavigation'
import TopBar from './components/TopBar'

import { useGameState } from './hooks/useGameState'
import { useTelegram } from './hooks/useTelegram'
import { apiService } from './services/api'

function App() {
  const location = useLocation()
  const address = useTonAddress()
  const connected = !!address
  const { user, isReady, getInitData, getStartParam } = useTelegram()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [referralLink, setReferralLink] = useState<string | null>(null)

  const {
    gameState,
    loadGameState,
    tap,
    completeDailyTask,
    purchaseUpgrade,
    setWalletConnection,
    refreshGameState,
    applyCampaignReward,
  } = useGameState(currentUserId || undefined)

  useEffect(() => {
    if (!isReady) return

    const initGame = async () => {
      setIsLoading(true)
      setAuthError(null)

      try {
        const initData = getInitData()
        const startParam = getStartParam()
        const urlParams = new URLSearchParams(window.location.search)
        const urlUserId = urlParams.get('userId')

        let telegramUserId: string | null = null

        if (initData) {
          const authResult = await apiService.authenticateWithTelegram(initData, startParam)
          telegramUserId = authResult.user?.telegramId || null
        } else {
          const devUserId = urlUserId || user?.id?.toString()
          if (!devUserId) {
            setAuthError(
              'Open this app from Telegram, or pass ?userId=... with ALLOW_DEV_AUTH enabled on the backend.'
            )
            setIsLoading(false)
            return
          }

          try {
            const authResult = await apiService.authenticateDev({
              telegramId: String(devUserId),
              username: user?.username || 'localuser',
              firstName: user?.firstName || 'Local',
              lastName: user?.lastName || 'User',
              start: startParam,
            })
            telegramUserId = authResult.user?.telegramId || String(devUserId)
          } catch (devAuthError: any) {
            setAuthError(
              devAuthError?.message ||
                'Dev auth failed. Set ALLOW_DEV_AUTH=true on the backend for local testing, or open from Telegram.'
            )
            setIsLoading(false)
            return
          }
        }

        if (!telegramUserId) {
          setAuthError('Could not resolve Telegram user id after authentication.')
          setIsLoading(false)
          return
        }

        setCurrentUserId(telegramUserId)
        localStorage.setItem('current_user_id', telegramUserId)

        const initResult = await apiService.initUser()
        setReferralLink(initResult.referralLink || null)

        const gameStateResult = await apiService.getGameState()
        loadGameState(gameStateResult.data)
      } catch (error: any) {
        console.error('Failed to initialize game:', error)
        setAuthError(error?.message || 'Failed to authenticate with the server.')
      } finally {
        setIsLoading(false)
      }
    }

    initGame()
  }, [isReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).refreshGameState = refreshGameState
    }
  }, [refreshGameState])

  if (isLoading) {
    return (
      <div className="tg-app flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading TapEarn...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="tg-app flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Sign-in required</h1>
          <p className="text-gray-600 mb-4">{authError}</p>
          <p className="text-sm text-gray-500">
            Open TapEarn from @YORZAEARNBOT, or configure local DEV auth.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tg-app">
      <TopBar user={user} gameState={gameState} connected={connected} />

      <main className="pb-20">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <HomeScreen gameState={gameState} onTap={tap} />
                </motion.div>
              }
            />
            <Route
              path="/daily-earn"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <DailyEarnUpgradesScreen
                    gameState={gameState}
                    onCompleteDailyTask={completeDailyTask}
                    onPurchaseUpgrade={purchaseUpgrade}
                    onCampaignReward={applyCampaignReward}
                  />
                </motion.div>
              }
            />
            <Route
              path="/profile"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ProfileScreen gameState={gameState} />
                </motion.div>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <LeaderboardScreen />
                </motion.div>
              }
            />
            <Route
              path="/connect-wallet"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <ConnectWalletScreen
                    gameState={gameState}
                    onSetWalletConnection={setWalletConnection}
                  />
                </motion.div>
              }
            />
            <Route
              path="/invite-friends"
              element={
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <InviteFriendsScreen gameState={gameState} referralLink={referralLink} />
                </motion.div>
              }
            />
            <Route
              path="/admin/video-codes"
              element={
                <ProtectedAdminRoute>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <VideoCodeAdmin />
                  </motion.div>
                </ProtectedAdminRoute>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>

      <BottomNavigation currentPath={location.pathname} />
    </div>
  )
}

export default App
