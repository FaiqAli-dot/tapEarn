import React, { useState } from 'react'
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
  Edit3,
  Copy,
  Check
} from 'lucide-react'

interface ProfileScreenProps {
  gameState: GameState
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ gameState }) => {
  const { user, hapticFeedback, showConfirm } = useTelegram()
  const [isEditing, setIsEditing] = useState(false)
  const [customName, setCustomName] = useState(user?.firstName || '')
  const [copied, setCopied] = useState(false)

  const handleEditProfile = () => {
    setIsEditing(true)
  }

  const handleSaveProfile = async () => {
    if (customName.trim()) {
      hapticFeedback('light')
      setIsEditing(false)
      // In a real app, you'd save this to backend
    }
  }

  const handleCancelEdit = () => {
    setCustomName(user?.firstName || '')
    setIsEditing(false)
  }

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

  const mockReferrals = [
    {
      id: '1',
      username: 'john_doe',
      joinedAt: Date.now() - 86400000 * 3, // 3 days ago
      totalEarnings: 1250,
      bonusEarned: 125
    },
    {
      id: '2',
      username: 'jane_smith',
      joinedAt: Date.now() - 86400000 * 7, // 7 days ago
      totalEarnings: 2100,
      bonusEarned: 210
    }
  ]

  const stats = [
    {
      label: 'Total Points Earned',
      value: gameState.totalPointsEarned.toLocaleString(),
      icon: Coins,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      label: 'Total Taps',
      value: gameState.totalTaps.toLocaleString(),
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Offline Earnings',
      value: gameState.offlineEarnings.toLocaleString(),
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Referral Earnings',
      value: gameState.referralEarnings.toLocaleString(),
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    }
  ]

  const upgrades = [
    {
      name: 'Tap Power',
      level: gameState.tapPower,
      maxLevel: 5,
      icon: Zap,
      color: 'from-blue-500 to-blue-600'
    },
    {
      name: 'Offline Earning',
      level: Math.floor(gameState.offlineEarningRate / 4),
      maxLevel: 5,
      icon: Clock,
      color: 'from-green-500 to-green-600'
    },
    {
      name: 'Energy Regen',
      level: gameState.energyRegenRate - 2,
      maxLevel: 8,
      icon: TrendingUp,
      color: 'from-purple-500 to-purple-600'
    }
  ]

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Profile</h1>
        <p className="text-gray-600">Your gaming statistics and achievements</p>
      </div>

      {/* Profile Card */}
      <div className="tg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              {isEditing ? (
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="text-xl font-bold text-gray-800 bg-transparent border-b-2 border-blue-500 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h2 className="text-xl font-bold text-gray-800">{customName}</h2>
              )}
              <p className="text-gray-600">@{user?.username}</p>
            </div>
          </div>
          
          {isEditing ? (
            <div className="flex space-x-2">
              <button
                onClick={handleSaveProfile}
                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={handleEditProfile}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Referral Code */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Your Referral Code</p>
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

      {/* Statistics Grid */}
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
              <div className={`w-12 h-12 ${stat.bgColor} rounded-full flex items-center justify-center mx-auto mb-3`}>
                <IconComponent className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-800 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </motion.div>
          )
        })}
      </div>

      {/* Current Upgrades */}
      <div className="tg-card p-4 mb-6">
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
                  <div className={`w-8 h-8 bg-gradient-to-r ${upgrade.color} rounded-full flex items-center justify-center`}>
                    <IconComponent className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-gray-700">{upgrade.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">
                    Level {upgrade.level}/{upgrade.maxLevel}
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.round((upgrade.level / upgrade.maxLevel) * 100)}% Complete
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Referrals */}
      <div className="tg-card p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-purple-600" />
          Referrals ({gameState.referralCount})
        </h3>
        
        {mockReferrals.length > 0 ? (
          <div className="space-y-3">
            {mockReferrals.map((referral, index) => (
              <motion.div
                key={referral.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">@{referral.username}</div>
                    <div className="text-xs text-gray-500">
                      Joined {new Date(referral.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">+{referral.bonusEarned}</div>
                  <div className="text-xs text-gray-500">Bonus earned</div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No referrals yet</p>
            <p className="text-sm">Share your referral code to earn bonuses!</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProfileScreen
