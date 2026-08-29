import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { GameState } from '../types/game'
import {
  User,
  Trophy,
  Users,
  Coins,
  Zap,
  Clock,
  TrendingUp,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react'

interface ProfileScreenProps {
  gameState: GameState
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ gameState }) => {
  const { user, hapticFeedback } = useTelegram()
  const [copied, setCopied] = useState(false)

  const copyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(gameState.referralCode)
      setCopied(true)
      hapticFeedback('light')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const stats = [
    {
      label: 'Total Points Earned',
      value: gameState.totalPointsEarned.toLocaleString(),
      icon: Coins,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      label: 'Total Taps',
      value: gameState.totalTaps.toLocaleString(),
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Offline Earnings',
      value: gameState.offlineEarnings.toLocaleString(),
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      label: 'Referral Earnings',
      value: gameState.referralEarnings.toLocaleString(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ]

  const upgrades = [
    {
      name: 'Tap Power',
      level: gameState.tapPower,
      maxLevel: 5,
      icon: Zap,
      color: 'from-blue-500 to-blue-600',
    },
    {
      name: 'Offline Earning',
      level: Math.floor(gameState.offlineEarningRate / 4),
      maxLevel: 5,
      icon: Clock,
      color: 'from-green-500 to-green-600',
    },
    {
      name: 'Energy Regen',
      level: gameState.energyRegenRate - 2,
      maxLevel: 8,
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600',
    },
  ]

  return (
    <div className="min-h-screen p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Profile</h1>
        <p className="text-gray-600">Stats synced from the server</p>
      </div>

      <Link
        to="/leaderboard"
        className="tg-card p-4 mb-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <Trophy className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Leaderboard</h3>
            <p className="text-sm text-gray-600">Points, taps & referrals</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </Link>

      <div className="tg-card p-6 mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{user?.firstName || 'Player'}</h2>
            <p className="text-gray-600">@{user?.username || 'player'}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Referral Code</p>
              <p className="text-xl font-bold font-mono">{gameState.referralCode}</p>
            </div>
            <button
              onClick={copyReferralCode}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="tg-card p-4 text-center"
            >
              <div
                className={`w-12 h-12 ${stat.bgColor} rounded-full flex items-center justify-center mx-auto mb-3`}
              >
                <IconComponent className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </motion.div>
          )
        })}
      </div>

      <div className="tg-card p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
          Current Upgrades
        </h3>
        <div className="space-y-3">
          {upgrades.map((upgrade, index) => {
            const IconComponent = upgrade.icon
            return (
              <motion.div
                key={upgrade.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 bg-gradient-to-r ${upgrade.color} rounded-full flex items-center justify-center`}
                  >
                    <IconComponent className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-gray-700">{upgrade.name}</span>
                </div>
                <div className="text-sm font-bold text-gray-800">
                  Lv {upgrade.level}/{upgrade.maxLevel}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ProfileScreen
