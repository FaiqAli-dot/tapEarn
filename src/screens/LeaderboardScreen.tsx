import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Zap, Users, Medal, Loader2 } from 'lucide-react'
import { apiService } from '../services/api'
import type { LeaderboardEntry, LeaderboardMyRank, LeaderboardType } from '../types/game'

const TABS: { type: LeaderboardType; label: string; icon: typeof Trophy }[] = [
  { type: 'points', label: 'Most Points', icon: Trophy },
  { type: 'clicks', label: 'Most Clicks', icon: Zap },
  { type: 'referrals', label: 'Most Referrals', icon: Users },
]

function displayName(entry: LeaderboardEntry): string {
  const u = entry.user
  if (u.username) return `@${u.username}`
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
  return full || 'Player'
}

function scoreLabel(type: LeaderboardType): string {
  if (type === 'clicks') return 'taps'
  if (type === 'referrals') return 'referrals'
  return 'points'
}

const LeaderboardScreen: React.FC = () => {
  const [activeType, setActiveType] = useState<LeaderboardType>('points')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<LeaderboardMyRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLeaderboard = useCallback(async (type: LeaderboardType) => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiService.getLeaderboard(type, 20)
      setEntries(result.data)
      setMyRank(result.myRank)
    } catch (err: any) {
      setError(err?.message || 'Failed to load leaderboard')
      setEntries([])
      setMyRank(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeaderboard(activeType)
  }, [activeType, loadLeaderboard])

  return (
    <div className="min-h-screen p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Leaderboard</h1>
        <p className="text-gray-600">Top players — rankings from the server</p>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeType === type
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4 inline mr-1" />
            {label}
          </button>
        ))}
      </div>

      {myRank && (
        <div className="tg-card p-4 mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Medal className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Your rank</p>
                <p className="text-xl font-bold text-gray-800">#{myRank.rank}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{scoreLabel(activeType)}</p>
              <p className="text-xl font-bold text-blue-600">{myRank.score.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {error && !loading && (
        <div className="tg-card p-4 text-center text-red-600">{error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="tg-card p-8 text-center text-gray-500">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No rankings yet. Be the first!</p>
            </div>
          ) : (
            entries.map((entry, index) => (
              <motion.div
                key={`${entry.user.telegramId}-${entry.rank}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`tg-card p-4 flex items-center justify-between ${
                  myRank?.rank === entry.rank ? 'ring-2 ring-blue-300' : ''
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      entry.rank === 1
                        ? 'bg-yellow-100 text-yellow-700'
                        : entry.rank === 2
                        ? 'bg-gray-200 text-gray-700'
                        : entry.rank === 3
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {entry.rank}
                  </div>
                  <span className="font-medium text-gray-800 truncate">{displayName(entry)}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="font-bold text-gray-800">{entry.score.toLocaleString()}</span>
                  <span className="text-xs text-gray-500 ml-1">{scoreLabel(activeType)}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default LeaderboardScreen
