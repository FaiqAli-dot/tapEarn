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

// Components
import BottomNavigation from './components/BottomNavigation'
import TopBar from './components/TopBar'

// Hooks
import { useGameState } from './hooks/useGameState'
import { useTelegram } from './hooks/useTelegram'

// Types
import { GameState } from './types/game'

function App() {
  const location = useLocation()
  const address = useTonAddress()
  const connected = !!address
  const { user } = useTelegram()
  const { gameState, updateGameState } = useGameState()
  
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initialize game state
    const initGame = async () => {
      try {
        // Load saved game state from localStorage or Telegram storage
        const savedState = localStorage.getItem('tapEarnGameState')
        if (savedState) {
          const parsedState = JSON.parse(savedState)
          updateGameState(parsedState)
        }
        
        // Calculate offline earnings
        if (gameState.lastActive) {
          const now = Date.now()
          const timeDiff = now - gameState.lastActive
          const hoursOffline = Math.min(timeDiff / (1000 * 60 * 60), gameState.offlineEarningMaxHours)
          
          if (hoursOffline > 0) {
            const offlinePoints = Math.floor(hoursOffline * gameState.offlineEarningRate)
            if (offlinePoints > 0) {
              updateGameState({
                ...gameState,
                points: gameState.points + offlinePoints,
                lastActive: now,
                offlineEarnings: gameState.offlineEarnings + offlinePoints
              })
            }
          }
        }
        
        updateGameState({ lastActive: Date.now() })
      } catch (error) {
        console.error('Failed to initialize game:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initGame()
  }, [])

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('tapEarnGameState', JSON.stringify(gameState))
    }
  }, [gameState, isLoading])

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
                  <HomeScreen />
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
                  <DailyEarnUpgradesScreen />
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
                  <ProfileScreen />
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
                  <ConnectWalletScreen />
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
                  <InviteFriendsScreen />
                </motion.div>
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
