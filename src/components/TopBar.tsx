import React from 'react'
import { motion } from 'framer-motion'
import { useGameState } from '../hooks/useGameState'
import { useTelegram } from '../hooks/useTelegram'
import { User, Coins, Battery, Zap } from 'lucide-react'

interface TopBarProps {
  user: any
  gameState: any
  connected: boolean
}

const TopBar: React.FC<TopBarProps> = ({ user, gameState, connected }) => {
  const energyPercentage = (gameState.energy / gameState.maxEnergy) * 100
  const energyColor = energyPercentage > 50 ? 'from-yellow-400 to-orange-500' : 
                     energyPercentage > 20 ? 'from-orange-400 to-red-500' : 
                     'from-red-400 to-red-600'

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {/* User Info */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-800 text-sm">
              {user?.firstName || 'User'}
            </h1>
            <p className="text-xs text-gray-500">
              @{user?.username || 'username'}
            </p>
          </div>
        </div>

        {/* Game Stats */}
        <div className="flex items-center space-x-4">
          {/* Points */}
          <div className="text-right">
            <div className="flex items-center space-x-1">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-bold text-gray-800">
                {gameState.points.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-500">Points</p>
          </div>

          {/* Energy */}
          <div className="text-right">
            <div className="flex items-center space-x-1">
              <Battery className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-bold text-gray-800">
                {gameState.energy}
              </span>
            </div>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${energyColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${energyPercentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Wallet Status */}
          <div className="text-right">
            <div className="flex items-center space-x-1">
              <Zap className={`w-4 h-4 ${connected ? 'text-green-500' : 'text-gray-400'}`} />
              <span className={`text-xs ${connected ? 'text-green-600' : 'text-gray-500'}`}>
                {connected ? 'TON' : 'Off'}
              </span>
            </div>
            <p className="text-xs text-gray-500">Wallet</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default TopBar
