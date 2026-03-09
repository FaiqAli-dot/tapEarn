import React, { useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useTonAddress } from '@tonconnect/ui-react'
import { motion, AnimatePresence } from 'framer-motion'

// Screens
import HomeScreen from './screens/HomeScreen'
import DailyEarnUpgradesScreen from './screens/DailyEarnUpgradesScreen'
import ProfileScreen from './screens/ProfileScreen'
import ConnectWalletScreen from './screens/ConnectWalletScreen'
import InviteFriendsScreen from './screens/InviteFriendsScreen'
import VideoCodeAdmin from './components/VideoCodeAdmin'
import ProtectedAdminRoute from './components/ProtectedAdminRoute'

// Components
import BottomNavigation from './components/BottomNavigation'
import TopBar from './components/TopBar'

// Hooks
import { useGameState } from './hooks/useGameState'
import { useTelegram } from './hooks/useTelegram'
import { apiService } from './services/api'

// Types
import { GameState } from './types/game'

// Import default game state
const DEFAULT_GAME_STATE = {
  points: 0,
  energy: 1000,
  maxEnergy: 1000,
  energyRegenRate: 3,
  tapPower: 1,
  offlineEarningRate: 4,
  offlineEarningMaxHours: 4,
  totalTaps: 0,
  totalPointsEarned: 0,
  offlineEarnings: 0,
  referralEarnings: 0,
  lastActive: Date.now(),
  dailyTasks: [],
  lastDailyReset: Date.now(),
  referralCode: '',
  referralCount: 0,
  walletConnected: false
}

function App() {
  const location = useLocation()
  const address = useTonAddress()
  const connected = !!address
  const { user } = useTelegram()
  
  // Get user ID from URL or Telegram user, and store it in state to persist across navigation
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentStartParam, setCurrentStartParam] = useState<string | null>(null)
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlUserId = urlParams.get('userId')
    const startParam = urlParams.get('start')
    // Prioritize URL parameter over Telegram user ID for local development
    const telegramUserId = urlUserId || user?.id?.toString()
    
    // Only update if we have a new user ID
    if (telegramUserId && telegramUserId !== currentUserId) {
      console.log(`🔍 URL User ID: ${urlUserId}, Telegram User ID: ${user?.id}, Final User ID: ${telegramUserId}`)
      setCurrentUserId(telegramUserId)
      // Store user ID in localStorage for admin access
      localStorage.setItem('current_user_id', telegramUserId)
    }
    
    // Store startParam for later use
    if (startParam !== currentStartParam) {
      setCurrentStartParam(startParam)
    }
  }, [user?.id, currentUserId, currentStartParam])
  
  // Use the stored user ID
  const telegramUserId = currentUserId
  
  const { gameState, updateGameState, tap, completeDailyTask, purchaseUpgrade, setWalletConnection, refreshGameState } = useGameState(telegramUserId || undefined)
  
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize game state
    const initGame = async () => {
      try {
        if (!telegramUserId) {
          console.error('No user ID available from Telegram or URL')
          setIsLoading(false)
          return
        }

        // Set user ID in API service
        apiService.setUserId(telegramUserId)
        console.log(`🔗 Frontend: Setting user ID to ${telegramUserId}`)

        try {
          // Initialize user with backend
          const initResult = await apiService.initUser(telegramUserId, {
            username: user?.username || 'localuser',
            firstName: user?.firstName || 'Local',
            lastName: user?.lastName || 'User',
            startParam: currentStartParam
          })
          console.log(`✅ Frontend: User initialized - ${telegramUserId}`)

          // Get game state from backend
          const gameStateResult = await apiService.getGameState()
          const backendGameState = gameStateResult.data
          console.log(`📊 Frontend: Got game state for ${telegramUserId} - Points: ${backendGameState.points}, Energy: ${backendGameState.energy}`)

          // Calculate offline earnings
          const now = Date.now()
          const timeDiff = now - backendGameState.lastActive
          const hoursOffline = Math.min(timeDiff / (1000 * 60 * 60), backendGameState.offlineEarningMaxHours)
          
          let finalState = { ...backendGameState, lastActive: now }
          
          if (hoursOffline > 0) {
            const offlinePoints = Math.floor(hoursOffline * backendGameState.offlineEarningRate)
            if (offlinePoints > 0) {
              finalState = {
                ...finalState,
                points: backendGameState.points + offlinePoints,
                offlineEarnings: backendGameState.offlineEarnings + offlinePoints
              }
            }
          }
          
          updateGameState(finalState)
        } catch (backendError) {
          console.error('Backend not available, using local storage:', backendError)
          // Fallback to localStorage if backend fails - make it user-specific
          const savedState = localStorage.getItem(`tapEarnGameState_${telegramUserId}`)
          if (savedState) {
            const parsedState = JSON.parse(savedState)
            console.log(`💾 Frontend: Loading from localStorage for ${telegramUserId} - Points: ${parsedState.points}`)
            updateGameState(parsedState)
          } else {
            // Create a new user state for local development
            const newUserState = {
              ...DEFAULT_GAME_STATE,
              lastActive: Date.now(),
              referralCode: Math.random().toString(36).substring(2, 8).toUpperCase()
            }
            console.log(`🆕 Frontend: Creating new local state for ${telegramUserId} - Points: ${newUserState.points}`)
            updateGameState(newUserState)
          }
        }
              } catch (error) {
          console.error('Failed to initialize game:', error)
          // Final fallback - also user-specific
          const newUserState = {
            ...DEFAULT_GAME_STATE,
            lastActive: Date.now(),
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase()
          }
          updateGameState(newUserState)
        } finally {
          setIsLoading(false)
        }
    }

    initGame()
  }, [telegramUserId]) // Only depend on telegramUserId, not updateGameState or user

  // Save game state to localStorage whenever it changes - make it user-specific
  useEffect(() => {
    if (!isLoading && gameState && telegramUserId) {
      // Debounce localStorage saves to prevent excessive writes
      const timeoutId = setTimeout(() => {
        localStorage.setItem(`tapEarnGameState_${telegramUserId}`, JSON.stringify(gameState))
      }, 1000) // Save after 1 second of no changes

      return () => clearTimeout(timeoutId)
    }
  }, [gameState, isLoading, telegramUserId])

  // Add refresh function to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).refreshGameState = refreshGameState
      ;(window as any).logGameState = () => {
        console.log('🎮 Current Game State:', gameState)
        console.log('📋 Daily Tasks:', gameState?.dailyTasks)
      }
      console.log('🔄 Debug: Call window.refreshGameState() to force refresh from backend')
      console.log('📊 Debug: Call window.logGameState() to see current state')
    }
  }, [refreshGameState, gameState])

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

  return (
    <div className="tg-app">
      <TopBar 
        user={user}
        gameState={gameState}
        connected={connected}
      />
      
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
                  <InviteFriendsScreen gameState={gameState} />
                </motion.div>
              } 
            />
            <Route 
              path="/admin/video-codes" 
              element={
                <ProtectedAdminRoute allowedUserIds={['123456789']}>
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
