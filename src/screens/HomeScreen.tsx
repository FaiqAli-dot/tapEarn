import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { Zap, Coins, Battery } from 'lucide-react'
import { GameState } from '../types/game'

interface HomeScreenProps {
  gameState: GameState
  onTap: () => void
}

const HomeScreen: React.FC<HomeScreenProps> = ({ gameState, onTap }) => {
  const { hapticFeedback, notificationFeedback } = useTelegram()
  const [isTapping, setIsTapping] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const [showOfflineEarnings, setShowOfflineEarnings] = useState(false)

  // Check for offline earnings on mount
  useEffect(() => {
    const lastActive = localStorage.getItem('lastActive')
    if (lastActive) {
      const timeDiff = Date.now() - parseInt(lastActive)
      const hoursOffline = Math.min(timeDiff / (1000 * 60 * 60), gameState.offlineEarningMaxHours)
      
      if (hoursOffline > 0) {
        const offlinePoints = Math.floor(hoursOffline * gameState.offlineEarningRate)
        if (offlinePoints > 0) {
          setShowOfflineEarnings(true)
          setTimeout(() => setShowOfflineEarnings(false), 5000)
        }
      }
    }
    
    localStorage.setItem('lastActive', Date.now().toString())
  }, [])

  const handleTap = () => {
    if (gameState.energy <= 0) {
      notificationFeedback('warning')
      return
    }

    setIsTapping(true)
    hapticFeedback('medium')
    
    // Animate tap count
    setTapCount(prev => prev + 1)
    
    // Perform tap action
    onTap()
    
    // Reset tap animation
    setTimeout(() => setIsTapping(false), 100)
  }

  const energyPercentage = (gameState.energy / gameState.maxEnergy) * 100
  const energyColor = energyPercentage > 50 ? 'from-yellow-400 to-orange-500' : 
                     energyPercentage > 20 ? 'from-orange-400 to-red-500' : 
                     'from-red-400 to-red-600'

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-center">
      {/* Offline Earnings Notification */}
      <AnimatePresence>
        {showOfflineEarnings && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            className="fixed top-20 left-4 right-4 bg-green-500 text-white p-4 rounded-xl shadow-lg z-50"
          >
            <div className="flex items-center justify-center space-x-2">
              <Coins className="w-5 h-5" />
              <span className="font-semibold">
                Welcome back! You earned {Math.floor(gameState.offlineEarningRate * 4)} points while away!
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Points Display */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Coins className="w-6 h-6 text-yellow-500" />
          <span className="text-sm text-gray-600">Total Points</span>
        </div>
        <div className="points-display text-5xl font-bold">
          {gameState.points.toLocaleString()}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          +{gameState.tapPower} per tap
        </div>
      </div>

      {/* Energy Bar */}
      <div className="w-full max-w-sm mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Battery className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-600">Energy</span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {gameState.energy} / {gameState.maxEnergy}
          </span>
        </div>
        <div className="energy-bar">
          <motion.div
            className={`energy-fill ${energyColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${energyPercentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1 text-center">
          Regenerating {gameState.energyRegenRate}/s
        </div>
      </div>

      {/* Main Tap Button */}
      <div className="relative mb-8">
        <motion.button
          className={`tap-button ${gameState.energy <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleTap}
          disabled={gameState.energy <= 0}
          whileHover={{ scale: gameState.energy > 0 ? 1.05 : 1 }}
          whileTap={{ scale: gameState.energy > 0 ? 0.95 : 1 }}
          animate={isTapping ? { scale: [1, 0.9, 1] } : {}}
          transition={{ duration: 0.1 }}
        >
          <Zap className="w-12 h-12" />
        </motion.button>

        {/* Tap Count Animation */}
        <AnimatePresence>
          {tapCount > 0 && (
            <motion.div
              key={tapCount}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -20, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-white text-lg font-bold drop-shadow-lg">
                +{gameState.tapPower}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Energy Warning */}
        {gameState.energy <= 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Out of energy! Wait for regeneration or use upgrades.
          </motion.div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        <div className="tg-card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{gameState.totalTaps}</div>
          <div className="text-sm text-gray-600">Total Taps</div>
        </div>
        <div className="tg-card p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{gameState.referralCount}</div>
          <div className="text-sm text-gray-600">Referrals</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 space-y-3 w-full max-w-sm">
        <button className="tg-button-secondary w-full flex items-center justify-center space-x-2">
          <Zap className="w-5 h-5" />
          <span>Upgrade Tap Power</span>
        </button>
        <button className="tg-button-secondary w-full flex items-center justify-center space-x-2">
          <Coins className="w-5 h-5" />
          <span>Claim Daily Bonus</span>
        </button>
      </div>
    </div>
  )
}

export default HomeScreen
