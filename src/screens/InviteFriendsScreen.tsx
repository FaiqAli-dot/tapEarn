import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { GameState } from '../types/game'
import { 
  Share2, 
  Copy, 
  Check, 
  Users, 
  Coins, 
  TrendingUp,
  MessageCircle,
  ExternalLink,
  Gift,
  Star,
  User
} from 'lucide-react'

interface InviteFriendsScreenProps {
  gameState: GameState
}

const InviteFriendsScreen: React.FC<InviteFriendsScreenProps> = ({ gameState }) => {
  const { user, hapticFeedback, openTelegramLink, showAlert } = useTelegram()
  const [copied, setCopied] = useState(false)
  const [shareMethod, setShareMethod] = useState<'telegram' | 'whatsapp' | 'copy' | null>(null)

  const referralLink = `https://t.me/your_bot_username?start=ref_${gameState.referralCode}`
  const referralText = `🎮 Join my tap-to-earn game and get bonus points! Use my referral code: ${gameState.referralCode}\n\n${referralLink}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      hapticFeedback('light')
      setTimeout(() => setCopied(false), 2000)
      showAlert('Referral link copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy:', error)
      showAlert('Failed to copy link. Please try again.')
    }
  }

  const handleShareTelegram = () => {
    setShareMethod('telegram')
    hapticFeedback('light')
    
    // Open Telegram share dialog
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(referralText)}`
    openTelegramLink(shareUrl)
  }

  const handleShareWhatsApp = () => {
    setShareMethod('whatsapp')
    hapticFeedback('light')
    
    // Open WhatsApp share
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(referralText)}`
    window.open(shareUrl, '_blank')
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join TapEarn Game',
          text: referralText,
          url: referralLink
        })
        hapticFeedback('light')
      } catch (error) {
        console.error('Share failed:', error)
        // Fallback to copy
        handleCopyLink()
      }
    } else {
      // Fallback to copy
      handleCopyLink()
    }
  }

  const referralRewards = [
    {
      level: 1,
      friends: 1,
      bonus: 100,
      icon: Gift,
      color: 'from-green-500 to-emerald-500'
    },
    {
      level: 2,
      friends: 5,
      bonus: 500,
      icon: Star,
      color: 'from-blue-500 to-indigo-500'
    },
    {
      level: 3,
      friends: 10,
      bonus: 1000,
      icon: TrendingUp,
      color: 'from-purple-500 to-pink-500'
    },
    {
      level: 4,
      friends: 25,
      bonus: 2500,
      icon: Coins,
      color: 'from-yellow-500 to-orange-500'
    }
  ]

  const mockReferralHistory = [
    {
      id: '1',
      username: 'john_doe',
      joinedAt: Date.now() - 86400000 * 2,
      status: 'active',
      earnings: 1250,
      bonus: 125
    },
    {
      id: '2',
      username: 'jane_smith',
      joinedAt: Date.now() - 86400000 * 5,
      status: 'active',
      earnings: 2100,
      bonus: 210
    },
    {
      id: '3',
      username: 'mike_wilson',
      joinedAt: Date.now() - 86400000 * 1,
      status: 'pending',
      earnings: 0,
      bonus: 0
    }
  ]

  const getNextReward = () => {
    const currentLevel = Math.floor(gameState.referralCount / 5) + 1
    return referralRewards.find(reward => reward.level === currentLevel)
  }

  const nextReward = getNextReward()

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Invite Friends</h1>
        <p className="text-gray-600">Share your referral link and earn bonus points</p>
      </div>

      {/* Referral Stats */}
      <div className="tg-card p-6 mb-6">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{gameState.referralCount}</h2>
          <p className="text-gray-600">Friends Referred</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">+{gameState.referralEarnings}</div>
            <div className="text-xs text-gray-500">Total Bonus</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">+{nextReward?.bonus || 0}</div>
            <div className="text-xs text-gray-500">Next Reward</div>
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Referral Link</h3>
        
        <div className="space-y-3">
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="flex-1 bg-transparent text-sm font-mono text-gray-800 focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShareTelegram}
              className="tg-button flex items-center justify-center space-x-2 py-3"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Telegram</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="tg-button-secondary flex items-center justify-center space-x-2 py-3"
            >
              <ExternalLink className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          </div>

          <button
            onClick={handleWebShare}
            className="w-full tg-button-secondary flex items-center justify-center space-x-2 py-3"
          >
            <Share2 className="w-4 h-4" />
            <span>Share to Other Apps</span>
          </button>
        </div>
      </div>

      {/* Referral Rewards */}
      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Referral Rewards</h3>
        <div className="space-y-3">
          {referralRewards.map((reward, index) => {
            const IconComponent = reward.icon
            const isCompleted = gameState.referralCount >= reward.friends
            const isCurrent = gameState.referralCount < reward.friends && 
                            (index === 0 || gameState.referralCount >= referralRewards[index - 1].friends)

            return (
              <motion.div
                key={reward.level}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                  isCompleted 
                    ? 'bg-green-50 border-green-200' 
                    : isCurrent 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isCompleted 
                      ? 'bg-green-500' 
                      : isCurrent 
                      ? 'bg-blue-500' 
                      : 'bg-gray-400'
                  }`}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-800">Level {reward.level}</h4>
                    <p className="text-sm text-gray-600">{reward.friends} friends</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">+{reward.bonus}</div>
                  <div className="text-xs text-gray-500">
                    {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Locked'}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Referral History */}
      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Referrals</h3>
        
        {mockReferralHistory.length > 0 ? (
          <div className="space-y-3">
            {mockReferralHistory.map((referral, index) => (
              <motion.div
                key={referral.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    referral.status === 'active' ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    <User className={`w-4 h-4 ${
                      referral.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                    }`} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">@{referral.username}</div>
                    <div className="text-xs text-gray-500">
                      Joined {new Date(referral.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">
                    {referral.status === 'active' ? `+${referral.bonus}` : 'Pending'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {referral.status === 'active' ? 'Bonus earned' : 'Verifying...'}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No referrals yet</p>
            <p className="text-sm">Share your referral link to start earning!</p>
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="tg-card p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">How It Works</h3>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              1
            </div>
            <p>Share your unique referral link with friends</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              2
            </div>
            <p>When they join using your link, they get bonus points</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              3
            </div>
            <p>You earn 10% of their earnings as referral bonus</p>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              4
            </div>
            <p>Unlock milestone rewards as you refer more friends</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteFriendsScreen
