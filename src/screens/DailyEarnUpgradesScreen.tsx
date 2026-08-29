import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTelegram } from '../hooks/useTelegram'
import { GameState, Campaign } from '../types/game'
import VideoPlayer from '../components/VideoPlayer'
import { apiService } from '../services/api'
import {
  Calendar,
  Zap,
  TrendingUp,
  Clock,
  Play,
  CheckCircle,
  Crown,
  Megaphone,
  ExternalLink,
  Loader2,
} from 'lucide-react'

interface DailyEarnUpgradesScreenProps {
  gameState: GameState
  onCompleteDailyTask: (taskId: string) => void
  onPurchaseUpgrade: (upgradeId: string) => void
  onCampaignReward: (points: number) => void
}

interface ServerUpgrade {
  id: string
  title: string
  description: string
  cost: number
  currentLevel: number
  maxLevel: number
  effect: string
}

const DailyEarnUpgradesScreen: React.FC<DailyEarnUpgradesScreenProps> = ({
  gameState,
  onCompleteDailyTask,
  onPurchaseUpgrade,
  onCampaignReward,
}) => {
  const { openLink, hapticFeedback, showConfirm, showAlert } = useTelegram()
  const [activeTab, setActiveTab] = useState<'daily' | 'campaigns' | 'upgrades'>('daily')
  const [isVideoPlayerOpen, setIsVideoPlayerOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTaskId, setVideoTaskId] = useState('')
  const [videoRewardPoints, setVideoRewardPoints] = useState(0)
  const [videoMode, setVideoMode] = useState<'daily' | 'campaign'>('daily')
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [completedCampaignIds, setCompletedCampaignIds] = useState<Set<string>>(new Set())
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [completingCampaignId, setCompletingCampaignId] = useState<string | null>(null)

  const [upgrades, setUpgrades] = useState<ServerUpgrade[]>([])
  const [upgradesLoading, setUpgradesLoading] = useState(false)

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true)
    try {
      const list = await apiService.getCampaigns()
      setCampaigns(list)
    } catch (error) {
      console.error('Failed to load campaigns:', error)
    } finally {
      setCampaignsLoading(false)
    }
  }, [])

  const loadUpgrades = useCallback(async () => {
    setUpgradesLoading(true)
    try {
      const result = await apiService.getAvailableUpgrades()
      setUpgrades(result.data || [])
    } catch (error) {
      console.error('Failed to load upgrades:', error)
    } finally {
      setUpgradesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'campaigns') loadCampaigns()
    if (activeTab === 'upgrades') loadUpgrades()
  }, [activeTab, loadCampaigns, loadUpgrades])

  const handleTaskComplete = (taskId: string) => {
    hapticFeedback('light')
    onCompleteDailyTask(taskId)
  }

  const handleUpgradePurchase = async (upgradeId: string, cost: number) => {
    if (gameState.points < cost) return
    const confirmed = await showConfirm(`Purchase this upgrade for ${cost} points?`)
    if (confirmed) {
      hapticFeedback('medium')
      await onPurchaseUpgrade(upgradeId)
      loadUpgrades()
    }
  }

  const handleDailyVideoTask = () => {
    hapticFeedback('light')
    const task = gameState.dailyTasks.find((t) => t.id === 'watch video naa')
    setVideoUrl(task?.url || 'https://www.youtube.com/watch?v=pmog2cABaJk')
    setVideoTaskId('watch video naa')
    setVideoRewardPoints(task?.points || 150)
    setVideoMode('daily')
    setActiveCampaignId(null)
    setIsVideoPlayerOpen(true)
  }

  const handleCampaignVideo = (campaign: Campaign) => {
    hapticFeedback('light')
    setVideoUrl(campaign.url)
    setVideoTaskId(campaign._id)
    setVideoRewardPoints(campaign.rewardPoints)
    setVideoMode('campaign')
    setActiveCampaignId(campaign._id)
    setIsVideoPlayerOpen(true)
  }

  const completeCampaign = async (campaignId: string) => {
    setCompletingCampaignId(campaignId)
    try {
      const result = await apiService.completeCampaign(campaignId)
      setCompletedCampaignIds((prev) => new Set(prev).add(campaignId))
      if (result.points !== undefined) {
        onCampaignReward(result.points)
      }
      if (result.duplicate) {
        showAlert('You already completed this campaign.')
      } else {
        showAlert(`+${result.reward} points earned!`)
      }
    } catch (error: any) {
      showAlert(error?.message || 'Could not complete campaign.')
    } finally {
      setCompletingCampaignId(null)
    }
  }

  const handleSponsoredPost = async (campaign: Campaign) => {
    if (campaign.url) openLink(campaign.url)
    hapticFeedback('light')
    const confirmed = await showConfirm(
      'Open the sponsored post, then confirm you have viewed it to claim your reward.'
    )
    if (confirmed) await completeCampaign(campaign._id)
  }

  const handleVideoComplete = async (id: string) => {
    hapticFeedback('medium')
    if (videoMode === 'campaign' && activeCampaignId) {
      await completeCampaign(activeCampaignId)
    } else {
      onCompleteDailyTask(id)
    }
    setIsVideoPlayerOpen(false)
  }


  return (
    <div className="min-h-screen p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Earn & Upgrades</h1>
        <p className="text-gray-600">Tasks, campaigns, and upgrades — rewards from the server</p>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        {(
          [
            { id: 'daily' as const, label: 'Daily', icon: Calendar },
            { id: 'campaigns' as const, label: 'Campaigns', icon: Megaphone },
            { id: 'upgrades' as const, label: 'Upgrades', icon: Zap },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              activeTab === id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Icon className="w-4 h-4 inline mr-1" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'daily' && (
          <motion.div
            key="daily"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {gameState.dailyTasks.map((task) => (
              <div key={task.id} className="tg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{task.title}</h3>
                    <p className="text-sm text-gray-600">{task.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">+{task.points}</div>
                    <div className="text-xs text-gray-500">points</div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    task.type === 'youtube' ? handleDailyVideoTask() : handleTaskComplete(task.id)
                  }
                  disabled={task.completed}
                  className={`w-full mt-3 py-2 px-4 rounded-lg font-medium transition-all ${
                    task.completed
                      ? 'bg-green-100 text-green-700 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {task.completed ? (
                    <>
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Completed
                    </>
                  ) : task.type === 'youtube' ? (
                    <>
                      <Play className="w-4 h-4 inline mr-2" />
                      Watch Video
                    </>
                  ) : (
                    'Claim'
                  )}
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'campaigns' && (
          <motion.div
            key="campaigns"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {campaignsLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            )}
            {!campaignsLoading && campaigns.length === 0 && (
              <div className="tg-card p-8 text-center text-gray-500">
                <Megaphone className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No active campaigns right now. Check back soon!</p>
              </div>
            )}
            {campaigns.map((campaign) => {
              const done = completedCampaignIds.has(campaign._id)
              const busy = completingCampaignId === campaign._id
              return (
                <div key={campaign._id} className="tg-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-medium uppercase text-gray-500">
                        {campaign.type === 'VIDEO' ? 'Video' : 'Sponsored'}
                      </span>
                      <h3 className="font-semibold text-gray-800">{campaign.title}</h3>
                      {campaign.description && (
                        <p className="text-sm text-gray-600 mt-1">{campaign.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-lg font-bold text-green-600">+{campaign.rewardPoints}</div>
                      <div className="text-xs text-gray-500">points</div>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      campaign.type === 'VIDEO'
                        ? handleCampaignVideo(campaign)
                        : handleSponsoredPost(campaign)
                    }
                    disabled={done || busy}
                    className={`w-full mt-2 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                      done
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : 'bg-indigo-500 text-white hover:bg-indigo-600'
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : done ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Completed</span>
                      </>
                    ) : campaign.type === 'VIDEO' ? (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Watch & Earn</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>View & Earn</span>
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </motion.div>
        )}

        {activeTab === 'upgrades' && (
          <motion.div
            key="upgrades"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {upgradesLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            )}
            {!upgradesLoading &&
              upgrades.map((upgrade) => {
                const isMaxLevel = upgrade.currentLevel >= upgrade.maxLevel
                const canAfford = gameState.points >= upgrade.cost
                const icon =
                  upgrade.id === 'tap_power' ? Zap : upgrade.id === 'offline_earning' ? Clock : TrendingUp
                const IconComponent = icon
                const color =
                  upgrade.id === 'tap_power'
                    ? 'from-blue-500 to-blue-600'
                    : upgrade.id === 'offline_earning'
                    ? 'from-green-500 to-green-600'
                    : 'from-purple-500 to-purple-600'

                return (
                  <div key={upgrade.id} className="tg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-10 h-10 bg-gradient-to-r ${color} rounded-full flex items-center justify-center`}
                        >
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{upgrade.title}</h3>
                          <p className="text-sm text-gray-600">{upgrade.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-800">
                          Lv {upgrade.currentLevel}/{upgrade.maxLevel}
                        </div>
                        <div className="text-xs text-gray-500">{upgrade.effect}</div>
                      </div>
                    </div>
                    {!isMaxLevel ? (
                      <>
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span className="text-gray-600">Cost</span>
                          <span className="font-medium">{upgrade.cost.toLocaleString()} points</span>
                        </div>
                        <button
                          onClick={() => handleUpgradePurchase(upgrade.id, upgrade.cost)}
                          disabled={!canAfford}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                            canAfford
                              ? `bg-gradient-to-r ${color} text-white hover:opacity-90`
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? 'Upgrade' : 'Not Enough Points'}
                        </button>
                      </>
                    ) : (
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

      {isVideoPlayerOpen && (
        <VideoPlayer
          videoUrl={videoUrl}
          videoId={videoTaskId}
          rewardPoints={videoRewardPoints}
          requireCodeVerification={false}
          onVideoComplete={handleVideoComplete}
          onClose={() => setIsVideoPlayerOpen(false)}
          isOpen={isVideoPlayerOpen}
        />
      )}
    </div>
  )
}

export default DailyEarnUpgradesScreen
