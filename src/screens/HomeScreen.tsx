import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import {
  Zap,
  Coins,
  Battery,
  Trophy,
  Flame,
  Star,
  Target,
  ChevronRight,
  CheckCircle,
} from 'lucide-react'
import { GameState, DailyTask } from '../types/game'
import { apiService } from '../services/api'

interface HomeScreenProps {
  gameState: GameState
  onTap: () => void
  onQuestClaimed?: () => void
}

const HomeScreen: React.FC<HomeScreenProps> = ({ gameState, onTap, onQuestClaimed }) => {
  const { user, hapticFeedback, notificationFeedback } = useTelegram()
  const [isTapping, setIsTapping] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const engagement = gameState.engagement
  const streak = engagement?.streak
  const xp = engagement?.xp
  const milestones = engagement?.milestones
  const questInfo = engagement?.quests
  const primaryQuests = questInfo?.quests.filter((q) => q.isPrimary) ?? gameState.dailyTasks.filter((q) => q.isPrimary !== false).slice(0, 3)

  const handleTap = () => {
    if (gameState.energy <= 0) {
      notificationFeedback('warning')
      return
    }
    setIsTapping(true)
    hapticFeedback('medium')
    setTapCount((prev) => prev + 1)
    onTap()
    setTimeout(() => setIsTapping(false), 100)
  }

  const handleClaimQuest = async (quest: DailyTask) => {
    if (!quest.readyToClaim || quest.completed) return
    setClaimingId(quest.id)
    try {
      await apiService.completeQuest(quest.id)
      hapticFeedback('heavy')
      onQuestClaimed?.()
    } catch {
      notificationFeedback('error')
    } finally {
      setClaimingId(null)
    }
  }

  const energyPercentage = (gameState.energy / gameState.maxEnergy) * 100
  const energyColor =
    energyPercentage > 50
      ? 'from-yellow-400 to-orange-500'
      : energyPercentage > 20
      ? 'from-orange-400 to-red-500'
      : 'from-red-400 to-red-600'

  const greetingName = user?.firstName || user?.username || 'Player'
  const rank = engagement?.leaderboard?.rank

  return (
    <div className="min-h-screen p-4 pb-24 max-w-md mx-auto space-y-4">
      {/* Greeting + Points */}
      <div className="text-center">
        <p className="text-sm text-gray-600">Welcome back,</p>
        <h1 className="text-xl font-bold text-gray-800">{greetingName}</h1>
        <div className="flex items-center justify-center space-x-2 mt-2">
          <Coins className="w-5 h-5 text-yellow-500" />
          <span className="points-display text-3xl font-bold">
            {gameState.points.toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">YP</span>
        </div>
      </div>

      {/* Streak + Level row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="tg-card p-3 flex items-center space-x-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <div>
            <div className="text-lg font-bold text-gray-800">{streak?.currentStreak ?? 0}</div>
            <div className="text-xs text-gray-500">Day streak</div>
          </div>
        </div>
        <div className="tg-card p-3 flex items-center space-x-2">
          <Star className="w-5 h-5 text-purple-500" />
          <div>
            <div className="text-lg font-bold text-gray-800">Lv {xp?.level ?? 1}</div>
            <div className="text-xs text-gray-500">{xp?.xp ?? 0} XP</div>
          </div>
        </div>
      </div>

      {/* XP bar */}
      {xp && (
        <div className="tg-card p-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Level {xp.level}</span>
            <span>
              {xp.progress.current}/{xp.progress.required || 'MAX'} XP
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${xp.progress.percent}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Today's Quests */}
      <div className="tg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center">
            <Target className="w-4 h-4 mr-2 text-blue-500" />
            Today&apos;s Quests
          </h2>
          <Link to="/daily-earn" className="text-xs text-blue-600 flex items-center">
            All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {primaryQuests.map((quest) => {
            const progress = quest.requiredAmount
              ? Math.min(100, Math.floor(((quest.currentProgress ?? 0) / quest.requiredAmount) * 100))
              : 0
            return (
              <div key={quest.id} className="bg-white/60 rounded-lg p-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{quest.title}</p>
                    <p className="text-xs text-gray-500">
                      {quest.currentProgress ?? 0}/{quest.requiredAmount ?? '?'}
                    </p>
                  </div>
                  {quest.completed ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : quest.readyToClaim ? (
                    <button
                      onClick={() => handleClaimQuest(quest)}
                      disabled={claimingId === quest.id}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded-md flex-shrink-0"
                    >
                      Claim
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 flex-shrink-0">+{quest.ypReward ?? quest.points}</span>
                  )}
                </div>
                {!quest.completed && (
                  <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {questInfo && !questInfo.allPrimaryComplete && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            {questInfo.primaryCompleted}/{questInfo.primaryTotal} primary quests done
          </p>
        )}
        {questInfo?.canClaimAllPrimaryBonus && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-2 p-2 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg text-center text-sm font-medium text-orange-800"
          >
            All primary quests done! +{questInfo.allPrimaryBonus.ypReward} YP bonus awarded
          </motion.div>
        )}
      </div>

      {/* Energy */}
      <div className="tg-card p-3">
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
            animate={{ width: `${energyPercentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* TAP */}
      <div className="flex justify-center py-2 relative">
        <motion.button
          className={`tap-button ${gameState.energy <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleTap}
          disabled={gameState.energy <= 0}
          whileHover={{ scale: gameState.energy > 0 ? 1.05 : 1 }}
          whileTap={{ scale: gameState.energy > 0 ? 0.95 : 1 }}
          animate={isTapping ? { scale: [1, 0.9, 1] } : {}}
        >
          <Zap className="w-12 h-12" />
        </motion.button>
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
      </div>
      <p className="text-center text-xs text-gray-500 -mt-2">+{gameState.tapPower} YP per tap</p>

      {/* Leaderboard rank + Milestone */}
      <div className="grid grid-cols-1 gap-3">
        <Link to="/leaderboard" className="tg-card p-3 flex items-center justify-between hover:bg-white/90 transition">
          <div className="flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-gray-700">Leaderboard</span>
          </div>
          <span className="text-sm font-bold text-blue-600">
            {rank ? `#${rank}` : 'Unranked'}
          </span>
        </Link>

        {milestones && (
          <div className="tg-card p-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Next milestone</span>
              <span>
                {milestones.progress.current.toLocaleString()} /{' '}
                {milestones.progress.threshold.toLocaleString()} YP
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
                animate={{ width: `${milestones.progress.percent}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            {milestones.progress.reward > 0 && (
              <p className="text-xs text-gray-500 mt-1 text-center">
                Reward: +{milestones.progress.reward.toLocaleString()} YP
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HomeScreen
