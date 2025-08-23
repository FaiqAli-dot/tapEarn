import { useState, useEffect, useCallback } from 'react'
import { GameState, DailyTask } from '../types/game'
import { apiService } from '../services/api'

const DEFAULT_GAME_STATE: GameState = {
  // Core game state
  points: 0,
  energy: 1000,
  maxEnergy: 1000,
  energyRegenRate: 3, // 3 energy per second
  
  // Upgrades
  tapPower: 1,
  offlineEarningRate: 4,
  offlineEarningMaxHours: 4,
  
  // Statistics
  totalTaps: 0,
  totalPointsEarned: 0,
  offlineEarnings: 0,
  referralEarnings: 0,
  lastActive: Date.now(),
  
  // Daily tasks
  dailyTasks: [
    {
      id: 'daily_login',
      title: 'Daily Login',
      description: 'Log in to earn bonus points',
      points: 50,
      completed: false,
      type: 'login'
    },
    {
      id: 'watch_youtube',
      title: 'Watch YouTube Video',
      description: 'Watch our featured video',
      points: 100,
      completed: false,
      type: 'youtube',
      url: 'https://youtube.com/watch?v=dQw4w9WgXcQ'
    },
    {
      id: 'streak_bonus',
      title: '7-Day Streak',
      description: 'Maintain daily login for 7 days',
      points: 500,
      completed: false,
      type: 'streak'
    }
  ],
  lastDailyReset: Date.now(),
  
  // Referrals
  referralCode: '',
  referralCount: 0,
  
  // Wallet
  walletConnected: false
}

export const useGameState = (userId?: string) => {
  console.log(`🎮 useGameState initialized for user: ${userId}`)
  const [gameState, setGameState] = useState<GameState>(DEFAULT_GAME_STATE)
  const [energyTimer, setEnergyTimer] = useState<NodeJS.Timeout | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Reset state when user ID changes
  useEffect(() => {
    console.log(`🔄 Resetting game state for user: ${userId}`)
    setGameState(DEFAULT_GAME_STATE)
    setIsInitialized(false)
    
    // Clear any existing localStorage data for this user to ensure fresh start
    if (userId) {
      localStorage.removeItem(`tapEarnGameState_${userId}`)
    }
  }, [userId])

  // Generate referral code only if not already set
  useEffect(() => {
    if (!gameState.referralCode && isInitialized) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      setGameState(prev => ({ ...prev, referralCode: code }))
    }
  }, [gameState.referralCode, isInitialized])

  // Energy regeneration timer - only run when initialized and not already at max energy
  useEffect(() => {
    if (!isInitialized) return
    
    if (energyTimer) {
      clearInterval(energyTimer)
    }

    const timer = setInterval(() => {
      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE
        if (currentState.energy < currentState.maxEnergy) {
          const newEnergy = Math.min(currentState.energy + currentState.energyRegenRate, currentState.maxEnergy)
          return { ...currentState, energy: newEnergy }
        }
        return currentState
      })
    }, 1000)

    setEnergyTimer(timer)

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isInitialized]) // Only depend on isInitialized, not on gameState properties

  const resetDailyTasks = useCallback(() => {
    setGameState(prev => {
      const currentState = prev || DEFAULT_GAME_STATE
      return {
        ...currentState,
        dailyTasks: currentState.dailyTasks.map(task => ({ ...task, completed: false })),
        lastDailyReset: Date.now()
      }
    })
  }, [])

  // Daily reset timer - only check once per minute
  useEffect(() => {
    if (!gameState?.lastDailyReset || !isInitialized) return
    
    const checkDailyReset = () => {
      const now = Date.now()
      const lastReset = new Date(gameState.lastDailyReset)
      const nextReset = new Date(lastReset)
      nextReset.setDate(nextReset.getDate() + 1)
      nextReset.setHours(0, 0, 0, 0)

      if (now >= nextReset.getTime()) {
        resetDailyTasks()
      }
    }

    // Check immediately
    checkDailyReset()
    
    // Then check every minute instead of on every render
    const timer = setInterval(checkDailyReset, 60000) // 60 seconds

    return () => clearInterval(timer)
  }, [gameState?.lastDailyReset, isInitialized]) // Only depend on lastDailyReset and isInitialized

  const updateGameState = useCallback(async (updates: Partial<GameState>) => {
    console.log(`🔄 Frontend: updateGameState called with updates:`, updates)
    setGameState(prev => {
      const newState = { ...prev, ...updates }
      // Ensure referral code is generated if not present
      if (!newState.referralCode) {
        newState.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      }
      console.log(`🔄 Frontend: State updated - Points: ${newState.points}, Daily Tasks:`, newState.dailyTasks?.length || 0)
      return newState
    })
    setIsInitialized(true)

    // Sync with backend - use the updated state
    try {
      const updatedState = { ...(gameState || DEFAULT_GAME_STATE), ...updates }
      console.log(`🔄 Frontend: Syncing state with backend - Points: ${updatedState.points}`)
      await apiService.updateGameState(updatedState)
    } catch (error) {
      console.error('Failed to sync game state with backend:', error)
    }
  }, [gameState]) // Add gameState dependency back to ensure we have the latest state

  const tap = useCallback(async () => {
    try {
      const result = await apiService.tap()
      console.log(`🎯 Frontend: Tap result - Points: ${result.points}, Energy: ${result.energy}, Total Taps: ${result.totalTaps}`)
      
      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE
        return {
          ...currentState,
          points: result.points,
          energy: result.energy,
          totalTaps: result.totalTaps,
          lastActive: Date.now()
        }
      })
    } catch (error) {
      console.error('Tap failed:', error)
      // Fallback to local state if API fails
      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE
        if (currentState.energy <= 0) return currentState

        const pointsEarned = currentState.tapPower
        const newEnergy = currentState.energy - 1
        const newPoints = currentState.points + pointsEarned
        const newTotalTaps = currentState.totalTaps + 1
        const newTotalPointsEarned = currentState.totalPointsEarned + pointsEarned

        return {
          ...currentState,
          energy: newEnergy,
          points: newPoints,
          totalTaps: newTotalTaps,
          totalPointsEarned: newTotalPointsEarned,
          lastActive: Date.now()
        }
      })
    }
  }, [])

  const completeDailyTask = useCallback(async (taskId: string) => {
    try {
      console.log(`🎯 Frontend: Completing daily task ${taskId}`)
      const result = await apiService.completeDailyTask(taskId)
      console.log(`✅ Frontend: Daily task completed - Points: ${result.points}, Daily Tasks:`, result.dailyTasks)
      
      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE
        
        // Use the daily tasks from the backend response instead of updating locally
        const newState = {
          ...currentState,
          dailyTasks: result.dailyTasks || currentState.dailyTasks,
          points: result.points
        }
        
        console.log(`🔄 Frontend: Updated state - Points: ${newState.points}, Daily Tasks:`, newState.dailyTasks)
        return newState
      })
    } catch (error) {
      console.error('Complete daily task failed:', error)
      // Fallback to local state if API fails
      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE
        const task = currentState.dailyTasks.find(t => t.id === taskId)
        if (!task || task.completed) return currentState

        const updatedTasks = currentState.dailyTasks.map(t =>
          t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t
        )

        return {
          ...currentState,
          dailyTasks: updatedTasks,
          points: currentState.points + task.points,
          totalPointsEarned: currentState.totalPointsEarned + task.points
        }
      })
    }
  }, [])

  const purchaseUpgrade = useCallback(async (upgradeId: string, cost: number, costType: 'points' | 'ton') => {
    try {
      if (costType === 'points') {
        console.log(`🎯 Frontend: Purchasing upgrade ${upgradeId} for ${cost} points`)
        const result = await apiService.purchaseUpgrade(upgradeId, cost)
        console.log(`✅ Frontend: Upgrade purchased - Points: ${result.points}, Tap Power: ${result.tapPower}`)
        
        setGameState(prev => {
          const currentState = prev || DEFAULT_GAME_STATE
          // Apply upgrade effects
          let newState = { ...currentState, points: result.points }
          
          if (upgradeId === 'tap_power') {
            newState.tapPower = result.tapPower || Math.min(currentState.tapPower + 1, 5)
          } else if (upgradeId === 'offline_earning') {
            newState.offlineEarningRate = result.offlineEarningRate || Math.min(currentState.offlineEarningRate + 4, 20)
          } else if (upgradeId === 'energy_regen') {
            newState.energyRegenRate = result.energyRegenRate || Math.min(currentState.energyRegenRate + 1, 10)
          }

          console.log(`🔄 Frontend: Updated state after upgrade - Points: ${newState.points}, Tap Power: ${newState.tapPower}`)
          return newState
        })
      }
    } catch (error) {
      console.error('Purchase upgrade failed:', error)
      // Fallback to local state if API fails
      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE
        if (costType === 'points' && currentState.points < cost) return currentState

        // Apply upgrade effects
        let newState = { ...currentState }
        
        if (upgradeId === 'tap_power') {
          newState.tapPower = Math.min(currentState.tapPower + 1, 5)
        } else if (upgradeId === 'offline_earning') {
          newState.offlineEarningRate = Math.min(currentState.offlineEarningRate + 4, 20)
        } else if (upgradeId === 'energy_regen') {
          newState.energyRegenRate = Math.min(currentState.energyRegenRate + 1, 10)
        }

        if (costType === 'points') {
          newState.points = currentState.points - cost
        }

        return newState
      })
    }
  }, [])

  const addReferral = useCallback((referralData: { username: string; totalEarnings: number }) => {
    setGameState(prev => {
      const currentState = prev || DEFAULT_GAME_STATE
      const bonus = Math.floor(referralData.totalEarnings * 0.1) // 10% bonus
      return {
        ...currentState,
        referralCount: currentState.referralCount + 1,
        points: currentState.points + bonus,
        referralEarnings: currentState.referralEarnings + bonus,
        totalPointsEarned: currentState.totalPointsEarned + bonus
      }
    })
  }, [])

  const setWalletConnection = useCallback((connected: boolean, address?: string) => {
    setGameState(prev => {
      const currentState = prev || DEFAULT_GAME_STATE
      return {
        ...currentState,
        walletConnected: connected,
        walletAddress: address
      }
    })
  }, [])

  const calculateOfflineEarnings = useCallback(() => {
    const currentState = gameState || DEFAULT_GAME_STATE
    const now = Date.now()
    const timeDiff = now - (currentState.lastActive || now)
    const hoursOffline = Math.min(timeDiff / (1000 * 60 * 60), currentState.offlineEarningMaxHours || 4)
    
    if (hoursOffline > 0) {
      const offlinePoints = Math.floor(hoursOffline * currentState.offlineEarningRate)
      if (offlinePoints > 0) {
        setGameState(prev => {
          const prevState = prev || DEFAULT_GAME_STATE
          return {
            ...prevState,
            points: prevState.points + offlinePoints,
            offlineEarnings: prevState.offlineEarnings + offlinePoints,
            totalPointsEarned: prevState.totalPointsEarned + offlinePoints,
            lastActive: now
          }
        })
        return offlinePoints
      }
    }
    return 0
  }, [gameState?.lastActive, gameState?.offlineEarningMaxHours, gameState?.offlineEarningRate])

  return {
    gameState,
    updateGameState,
    tap,
    completeDailyTask,
    purchaseUpgrade,
    addReferral,
    setWalletConnection,
    calculateOfflineEarnings,
    resetDailyTasks
  }
}
