import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { GameState } from '../types/game'
import { 
  Calendar, 
  Zap, 
  TrendingUp, 
  Clock, 
  Play, 
  CheckCircle, 
  Coins,
  Crown,
  Star
} from 'lucide-react'

interface DailyEarnUpgradesScreenProps {
  gameState: GameState
  onCompleteDailyTask: (taskId: string) => void
  onPurchaseUpgrade: (upgradeId: string, cost: number, costType: 'points' | 'ton') => void
}

const DailyEarnUpgradesScreen: React.FC<DailyEarnUpgradesScreenProps> = ({ 
  gameState, 
  onCompleteDailyTask, 
  onPurchaseUpgrade 
}) => {
  const { openLink, hapticFeedback, showConfirm } = useTelegram()
  const [activeTab, setActiveTab] = useState<'daily' | 'upgrades'>('daily')

  const handleTaskComplete = async (taskId: string) => {
    hapticFeedback('light')
    onCompleteDailyTask(taskId)
  }

  const handleUpgradePurchase = async (upgradeId: string, cost: number, costType: 'points' | 'ton') => {
    if (costType === 'points' && gameState.points < cost) {
      return
    }

    const confirmed = await showConfirm(
      `Purchase ${upgradeId.replace('_', ' ')} for ${cost} ${costType === 'points' ? 'points' : 'TON'}?`
    )

    if (confirmed) {
      hapticFeedback('medium')
      onPurchaseUpgrade(upgradeId, cost, costType)
    }
  }

  const handleYouTubeTask = (url: string) => {
    openLink(url, true)
    // In a real app, you'd implement verification logic here
    setTimeout(() => {
      handleTaskComplete('watch_youtube')
    }, 5000) // Simulate task completion after 5 seconds
  }

  const upgrades = [
    {
      id: 'tap_power',
      name: 'Tap Power',
      description: 'Increase points earned per tap',
      currentLevel: gameState.tapPower,
      maxLevel: 5,
      cost: gameState.tapPower * 100,
      costType: 'points' as const,
      effect: { type: 'tapPower' as const, value: gameState.tapPower + 1 },
      icon: Zap,
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'offline_earning',
      name: 'Offline Earning',
      description: 'Increase points earned while offline',
      currentLevel: Math.floor(gameState.offlineEarningRate / 4),
      maxLevel: 5,
      cost: Math.floor(gameState.offlineEarningRate / 4) * 200,
      costType: 'points' as const,
      effect: { type: 'offlineEarning' as const, value: gameState.offlineEarningRate + 4 },
      icon: Clock,
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'energy_regen',
      name: 'Energy Regeneration',
      description: 'Increase energy regeneration rate',
      currentLevel: gameState.energyRegenRate - 2,
      maxLevel: 8,
      cost: (gameState.energyRegenRate - 2) * 150,
      costType: 'points' as const,
      effect: { type: 'energyRegen' as const, value: gameState.energyRegenRate + 1 },
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600'
    }
  ]

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Daily Earn & Upgrades</h1>
        <p className="text-gray-600">Complete tasks and upgrade your earning potential</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'daily'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Daily Tasks
        </button>
        <button
          onClick={() => setActiveTab('upgrades')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
            activeTab === 'upgrades'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Zap className="w-4 h-4 inline mr-2" />
          Upgrades
        </button>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'daily' && (
          <motion.div
            key="daily"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Daily Login Task */}
            <div className="tg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Daily Login</h3>
                    <p className="text-sm text-gray-600">Log in to earn bonus points</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">+50</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>
              <button
                onClick={() => handleTaskComplete('daily_login')}
                disabled={gameState.dailyTasks.find(t => t.id === 'daily_login')?.completed}
                className={`w-full mt-3 py-2 px-4 rounded-lg font-medium transition-all ${
                  gameState.dailyTasks.find(t => t.id === 'daily_login')?.completed
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                {gameState.dailyTasks.find(t => t.id === 'daily_login')?.completed ? (
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                ) : null}
                {gameState.dailyTasks.find(t => t.id === 'daily_login')?.completed ? 'Completed' : 'Claim'}
              </button>
            </div>

            {/* YouTube Task */}
            <div className="tg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Play className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">Watch YouTube Video</h3>
                    <p className="text-sm text-gray-600">Watch our featured video</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-red-600">+100</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>
              <button
                onClick={() => handleYouTubeTask('https://youtube.com/watch?v=dQw4w9WgXcQ')}
                disabled={gameState.dailyTasks.find(t => t.id === 'watch_youtube')?.completed}
                className={`w-full mt-3 py-2 px-4 rounded-lg font-medium transition-all ${
                  gameState.dailyTasks.find(t => t.id === 'watch_youtube')?.completed
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {gameState.dailyTasks.find(t => t.id === 'watch_youtube')?.completed ? (
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                ) : (
                  <Play className="w-4 h-4 inline mr-2" />
                )}
                {gameState.dailyTasks.find(t => t.id === 'watch_youtube')?.completed ? 'Completed' : 'Watch Video'}
              </button>
            </div>

            {/* Streak Task */}
            <div className="tg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Star className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">7-Day Streak</h3>
                    <p className="text-sm text-gray-600">Maintain daily login for 7 days</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-yellow-600">+500</div>
                  <div className="text-xs text-gray-500">points</div>
                </div>
              </div>
              <button
                onClick={() => handleTaskComplete('streak_bonus')}
                disabled={gameState.dailyTasks.find(t => t.id === 'streak_bonus')?.completed}
                className={`w-full mt-3 py-2 px-4 rounded-lg font-medium transition-all ${
                  gameState.dailyTasks.find(t => t.id === 'streak_bonus')?.completed
                    ? 'bg-green-100 text-green-700 cursor-not-allowed'
                    : 'bg-yellow-500 text-white hover:bg-yellow-600'
                }`}
              >
                {gameState.dailyTasks.find(t => t.id === 'streak_bonus')?.completed ? (
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                ) : (
                  <Star className="w-4 h-4 inline mr-2" />
                )}
                {gameState.dailyTasks.find(t => t.id === 'streak_bonus')?.completed ? 'Completed' : 'Check Streak'}
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'upgrades' && (
          <motion.div
            key="upgrades"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {upgrades.map((upgrade) => {
              const IconComponent = upgrade.icon
              const isMaxLevel = upgrade.currentLevel >= upgrade.maxLevel
              const canAfford = gameState.points >= upgrade.cost

              return (
                <div key={upgrade.id} className="tg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 bg-gradient-to-r ${upgrade.color} rounded-full flex items-center justify-center`}>
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{upgrade.name}</h3>
                        <p className="text-sm text-gray-600">{upgrade.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-800">
                        Level {upgrade.currentLevel}/{upgrade.maxLevel}
                      </div>
                      <div className="text-xs text-gray-500">
                        {upgrade.effect.type === 'tapPower' && `+${upgrade.effect.value} per tap`}
                        {upgrade.effect.type === 'offlineEarning' && `+${upgrade.effect.value}/hour`}
                        {upgrade.effect.type === 'energyRegen' && `+${upgrade.effect.value}/s`}
                      </div>
                    </div>
                  </div>

                  {!isMaxLevel && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Cost:</span>
                        <span className="font-medium text-gray-800">
                          {upgrade.cost.toLocaleString()} {upgrade.costType === 'points' ? 'points' : 'TON'}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleUpgradePurchase(upgrade.id, upgrade.cost, upgrade.costType)}
                        disabled={!canAfford}
                        className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                          canAfford
                            ? `bg-gradient-to-r ${upgrade.color} text-white hover:opacity-90`
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? 'Upgrade' : 'Not Enough Points'}
                      </button>
                    </div>
                  )}

                  {isMaxLevel && (
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-3 rounded-lg text-center">
                      <Crown className="w-5 h-5 inline mr-2" />
                      Max Level Reached!
                    </div>
                  )}
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DailyEarnUpgradesScreen
