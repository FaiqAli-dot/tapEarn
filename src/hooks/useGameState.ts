import { useState, useEffect, useCallback, useRef } from 'react'
import { GameState, DailyTask } from '../types/game'
import { apiService, getApiBaseUrl } from '../services/api'

const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const notification = document.createElement('div')
  notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white font-medium shadow-lg transform transition-all duration-300 ${
    type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  }`
  notification.textContent = message
  document.body.appendChild(notification)
  setTimeout(() => {
    notification.style.transform = 'translateX(0)'
  }, 100)
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)'
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, 3000)
}

const DEFAULT_GAME_STATE: GameState = {
  points: 0,
  energy: 1000,
  maxEnergy: 1000,
  energyRegenRate: 3,
  tapPower: 1,
  offlineEarningRate: 4,
  offlineEarningMaxHours: 4,
  totalTaps: 0,
  totalPointsEarned: 0,
  offlineEarnings: 0,
  referralEarnings: 0,
  lastActive: Date.now(),
  dailyTasks: [],
  lastDailyReset: Date.now(),
  referralCode: '',
  referralCount: 0,
  walletConnected: false,
}

function normalizeGameState(raw: Partial<GameState>): GameState {
  const lastActive = raw.lastActive
  const lastActiveMs =
    typeof lastActive === 'string' || lastActive instanceof Date
      ? new Date(lastActive).getTime()
      : Number(lastActive) || Date.now()

  const lastDailyReset = raw.lastDailyReset
  const lastDailyResetMs =
    typeof lastDailyReset === 'string' || lastDailyReset instanceof Date
      ? new Date(lastDailyReset).getTime()
      : Number(lastDailyReset) || Date.now()

  return {
    ...DEFAULT_GAME_STATE,
    ...raw,
    lastActive: lastActiveMs,
    lastDailyReset: lastDailyResetMs,
    dailyTasks: raw.dailyTasks || DEFAULT_GAME_STATE.dailyTasks,
    referralCount: raw.referralCount ?? 0,
  }
}

export const useGameState = (userId?: string) => {
  const [gameState, setGameState] = useState<GameState>(DEFAULT_GAME_STATE)
  const [energyTimer, setEnergyTimer] = useState<NodeJS.Timeout | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [unsyncedTaps, setUnsyncedTaps] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const gameStateRef = useRef(gameState)

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  useEffect(() => {
    setGameState(DEFAULT_GAME_STATE)
    setIsInitialized(false)
    setUnsyncedTaps(0)
    if (userId) {
      localStorage.removeItem(`tapEarnGameState_${userId}`)
    }
  }, [userId])

  useEffect(() => {
    if (!isInitialized) return

    if (energyTimer) clearInterval(energyTimer)

    const timer = setInterval(() => {
      setGameState((prev) => {
        if (prev.energy < prev.maxEnergy) {
          return {
            ...prev,
            energy: Math.min(prev.energy + prev.energyRegenRate, prev.maxEnergy),
          }
        }
        return prev
      })
    }, 1000)

    setEnergyTimer(timer)
    return () => clearInterval(timer)
  }, [isInitialized])

  const loadGameState = useCallback((backendState: Partial<GameState>) => {
    setGameState(normalizeGameState(backendState))
    setIsInitialized(true)
  }, [])

  const refreshGameState = useCallback(async () => {
    try {
      const result = await apiService.getGameState()
      loadGameState(result.data)
    } catch (error) {
      console.error('Failed to refresh game state:', error)
    }
  }, [loadGameState])

  const applyServerTapResult = useCallback(
    (result: { points: number; energy: number; totalTaps: number }) => {
      setGameState((prev) => ({
        ...prev,
        points: result.points,
        energy: result.energy,
        totalTaps: result.totalTaps,
        lastActive: Date.now(),
      }))
    },
    []
  )

  const syncPendingTaps = useCallback(async () => {
    if (isSyncing || unsyncedTaps <= 0 || !isInitialized) return

    setIsSyncing(true)
    const tapsToSync = unsyncedTaps

    try {
      const result = await apiService.syncTaps(tapsToSync)
      setUnsyncedTaps((prev) => Math.max(0, prev - tapsToSync))
      applyServerTapResult(result)
    } catch (error) {
      console.error('Failed to sync taps:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [unsyncedTaps, isSyncing, isInitialized, applyServerTapResult])

  useEffect(() => {
    if (unsyncedTaps > 0 && !isSyncing) {
      const timer = setTimeout(syncPendingTaps, 3000)
      return () => clearTimeout(timer)
    }
  }, [unsyncedTaps, isSyncing, syncPendingTaps])

  useEffect(() => {
    const flushTaps = () => {
      if (unsyncedTaps > 0) syncPendingTaps()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushTaps()
    }

    const handlePageHide = () => {
      if (unsyncedTaps <= 0 || !apiService.getSessionToken()) return
      const url = `${getApiBaseUrl()}/users/sync-taps`
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiService.getSessionToken()}`,
        },
        body: JSON.stringify({ tapCount: unsyncedTaps }),
        keepalive: true,
      }).catch(() => {})
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [unsyncedTaps, syncPendingTaps])

  const tap = useCallback(() => {
    const current = gameStateRef.current
    if (current.energy <= 0) {
      showNotification('⚡ No energy left! Wait for it to regenerate.', 'error')
      return
    }

    setUnsyncedTaps((prev) => prev + 1)
    setGameState((prev) => {
      if (prev.energy <= 0) return prev
      const pointsEarned = prev.tapPower
      const newTotalTaps = prev.totalTaps + 1
      if (newTotalTaps % 50 === 0) {
        setTimeout(() => showNotification(`Awesome! ${newTotalTaps} total taps!`, 'info'), 0)
      }
      return {
        ...prev,
        energy: prev.energy - 1,
        points: prev.points + pointsEarned,
        totalTaps: newTotalTaps,
        totalPointsEarned: prev.totalPointsEarned + pointsEarned,
        lastActive: Date.now(),
      }
    })
  }, [])

  const completeDailyTask = useCallback(async (taskId: string) => {
    try {
      const result = await apiService.completeDailyTask(taskId)
      const completedTask = result.dailyTasks?.find((t: DailyTask) => t.id === taskId)
      const pointsEarned = completedTask?.points || 0
      showNotification(`🎉 Task completed! +${pointsEarned} points earned!`, 'success')
      setGameState((prev) => ({
        ...prev,
        dailyTasks: result.dailyTasks || prev.dailyTasks,
        points: result.points,
      }))
    } catch (error: any) {
      console.error('Complete daily task failed:', error)
      showNotification(error?.message || '❌ Failed to complete task.', 'error')
    }
  }, [])

  const applyCampaignReward = useCallback((points: number) => {
    setGameState((prev) => ({ ...prev, points }))
  }, [])

  const purchaseUpgrade = useCallback(async (upgradeId: string) => {
    try {
      const result = await apiService.purchaseUpgrade(upgradeId)
      setGameState((prev) => ({
        ...prev,
        points: result.points,
        tapPower: result.tapPower ?? prev.tapPower,
        offlineEarningRate: result.offlineEarningRate ?? prev.offlineEarningRate,
        energyRegenRate: result.energyRegenRate ?? prev.energyRegenRate,
      }))
      showNotification('Upgrade purchased!', 'success')
    } catch (error: any) {
      console.error('Purchase upgrade failed:', error)
      showNotification(error?.message || 'Failed to purchase upgrade.', 'error')
    }
  }, [])

  const setWalletConnection = useCallback(async (connected: boolean, address?: string) => {
    setGameState((prev) => ({
      ...prev,
      walletConnected: connected,
      walletAddress: connected ? address : undefined,
    }))

    try {
      await apiService.updateWalletState({
        walletConnected: connected,
        walletAddress: connected ? address : undefined,
      })
    } catch (error) {
      console.error('Failed to sync wallet with backend:', error)
    }
  }, [])

  return {
    gameState,
    loadGameState,
    tap,
    completeDailyTask,
    purchaseUpgrade,
    setWalletConnection,
    refreshGameState,
    applyCampaignReward,
    isInitialized,
  }
}
