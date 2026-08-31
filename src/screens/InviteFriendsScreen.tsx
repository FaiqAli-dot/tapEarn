import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { GameState, Referral } from '../types/game'
import { apiService } from '../services/api'
import { tonExplorerTxUrl } from '../config/ton'
import {
  Copy,
  Check,
  Users,
  MessageCircle,
  ExternalLink,
  User,
  Loader2,
  Coins,
} from 'lucide-react'

interface InviteFriendsScreenProps {
  gameState: GameState
  referralLink: string | null
}

const InviteFriendsScreen: React.FC<InviteFriendsScreenProps> = ({ gameState, referralLink }) => {
  const { hapticFeedback, openTelegramLink, showAlert } = useTelegram()
  const [copied, setCopied] = useState(false)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [referredBy, setReferredBy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tonPayouts, setTonPayouts] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])

  const botUsername = (
    (import.meta as any).env?.VITE_TELEGRAM_BOT_USERNAME || 'YORZAEARNBOT'
  ).replace(/^@/, '')
  const link =
    referralLink || `https://t.me/${botUsername}?start=ref_${gameState.referralCode}`
  const referralText = `🎮 Join TapEarn and earn points! Use my referral link:\n\n${link}`

  useEffect(() => {
    const load = async () => {
      try {
        const result = await apiService.getUserProfile()
        const user = result.data
        setReferrals(user.referrals || [])
        setReferredBy(user.referredBy || user.referrerId || null)
        try {
          const history = await apiService.getPaymentHistory()
          setTonPayouts(history.data?.referralTonPayouts || [])
          setSubscriptions(history.data?.subscriptions || [])
        } catch {
          /* payment history optional until wallet flow used */
        }
      } catch (error) {
        console.error('Failed to load referral profile:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      hapticFeedback('light')
      setTimeout(() => setCopied(false), 2000)
      showAlert('Referral link copied!')
    } catch {
      showAlert('Failed to copy link.')
    }
  }

  const handleShareTelegram = () => {
    hapticFeedback('light')
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(referralText)}`
    openTelegramLink(shareUrl)
  }

  const handleShareWhatsApp = () => {
    hapticFeedback('light')
    window.open(`https://wa.me/?text=${encodeURIComponent(referralText)}`, '_blank')
  }

  return (
    <div className="min-h-screen p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Invite Friends</h1>
        <p className="text-gray-600">One-level referrals — your referrer is locked after signup</p>
      </div>

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
            <div className="text-lg font-bold text-green-600">
              +{gameState.referralEarnings.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Referral Earnings</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600 font-mono">{gameState.referralCode}</div>
            <div className="text-xs text-gray-500">Your Code</div>
          </div>
        </div>

        {referredBy && (
          <p className="text-sm text-gray-500 text-center mt-4">
            Referred by code: <span className="font-mono font-medium">{referredBy}</span> (cannot be
            changed)
          </p>
        )}
      </div>

      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Telegram Deep Link</h3>
        <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg mb-3">
          <input
            type="text"
            value={link}
            readOnly
            className="flex-1 bg-transparent text-sm font-mono text-gray-800 focus:outline-none"
          />
          <button onClick={handleCopyLink} className="p-2 text-gray-500 hover:text-gray-700">
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
      </div>

      <div className="tg-card p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Referrals</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : referrals.length > 0 ? (
          <div className="space-y-3">
            {referrals.map((referral, index) => (
              <motion.div
                key={referral.userId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{referral.username || 'User'}</div>
                    <div className="text-xs text-gray-500">
                      Joined{' '}
                      {new Date(referral.joinedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No referrals yet</p>
            <p className="text-sm">Share your link to start earning referral rewards</p>
          </div>
        )}
      </div>

      <div className="tg-card p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">How It Works</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>1. Share your Telegram deep link with friends.</p>
          <p>2. When they open @YORZAEARNBOT with your link, they are linked as your referral.</p>
          <p>3. When they pay a testnet TON subscription, you receive 50% of net (after fees) — not YP.</p>
          <p>4. Referrer assignment is permanent and cannot be changed.</p>
        </div>
      </div>

      {(tonPayouts.length > 0 || subscriptions.length > 0) && (
        <div className="tg-card p-4 mt-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-600" />
            TON Testnet Referral Payments
          </h3>
          {tonPayouts.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs text-gray-500">Referral TON payouts (separate from YP earnings)</p>
              {tonPayouts.map((p) => (
                <div key={p.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span>{(Number(p.amountNanoton) / 1e9).toFixed(4)} TON</span>
                    <span className="text-xs font-medium">{p.status}</span>
                  </div>
                  {p.txHash && (
                    <button
                      className="text-blue-600 text-xs underline mt-1"
                      onClick={() => window.open(p.explorerUrl || tonExplorerTxUrl(p.txHash), '_blank')}
                    >
                      Explorer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {subscriptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Your subscription payments</p>
              {subscriptions.slice(0, 5).map((s) => (
                <div key={s.id} className="p-3 bg-gray-50 rounded-lg text-sm flex justify-between">
                  <span>{(Number(s.grossAmountNanoton) / 1e9).toFixed(4)} TON gross</span>
                  <span className="text-xs">{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default InviteFriendsScreen
