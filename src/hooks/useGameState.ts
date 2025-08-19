import { useState, useEffect, useCallback } from 'react'
import { GameState, DailyTask } from '../types/game'

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

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>(DEFAULT_GAME_STATE)
  const [energyTimer, setEnergyTimer] = useState<NodeJS.Timeout | null>(null)

  // Generate referral code
  useEffect(() => {
    if (!gameState.referralCode) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      setGameState(prev => ({ ...prev, referralCode: code }))
    }
  }, [gameState.referralCode])

  // Energy regeneration timer
  useEffect(() => {
    if (energyTimer) {
      clearInterval(energyTimer)
    }

    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.energy < prev.maxEnergy) {
          const newEnergy = Math.min(prev.energy + prev.energyRegenRate, prev.maxEnergy)
          return { ...prev, energy: newEnergy }
        }
        return prev
      })
    }, 1000)

    setEnergyTimer(timer)

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [gameState.energyRegenRate, gameState.maxEnergy])

  // Daily reset timer
  useEffect(() => {
    const now = Date.now()
    const lastReset = new Date(gameState.lastDailyReset)
    const nextReset = new Date(lastReset)
    nextReset.setDate(nextReset.getDate() + 1)
    nextReset.setHours(0, 0, 0, 0)

    if (now >= nextReset.getTime()) {
      resetDailyTasks()
    }
  }, [gameState.lastDailyReset])

  const resetDailyTasks = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      dailyTasks: prev.dailyTasks.map(task => ({ ...task, completed: false })),
      lastDailyReset: Date.now()
    }))
  }, [])

  const updateGameState = useCallback((updates: Partial<GameState>) => {
    setGameState(prev => ({ ...prev, ...updates }))
  }, [])

  const tap = useCallback(() => {
    setGameState(prev => {
      if (prev.energy <= 0) return prev

      const pointsEarned = prev.tapPower
      const newEnergy = prev.energy - 1
      const newPoints = prev.points + pointsEarned
      const newTotalTaps = prev.totalTaps + 1
      const newTotalPointsEarned = prev.totalPointsEarned + pointsEarned

      return {
        ...prev,
        energy: newEnergy,
        points: newPoints,
        totalTaps: newTotalTaps,
        totalPointsEarned: newTotalPointsEarned,
        lastActive: Date.now()
      }
    })
  }, [])

  const completeDailyTask = useCallback((taskId: string) => {
    setGameState(prev => {
      const task = prev.dailyTasks.find(t => t.id === taskId)
      if (!task || task.completed) return prev

      const updatedTasks = prev.dailyTasks.map(t =>
        t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t
      )

      return {
        ...prev,
        dailyTasks: updatedTasks,
        points: prev.points + task.points,
        totalPointsEarned: prev.totalPointsEarned + task.points
      }
    })
  }, [])

  const purchaseUpgrade = useCallback((upgradeId: string, cost: number, costType: 'points' | 'ton') => {
    setGameState(prev => {
      if (costType === 'points' && prev.points < cost) return prev

      // Apply upgrade effects
      let newState = { ...prev }
      
      if (upgradeId === 'tap_power') {
        newState.tapPower = Math.min(prev.tapPower + 1, 5)
      } else if (upgradeId === 'offline_earning') {
        newState.offlineEarningRate = Math.min(prev.offlineEarningRate + 4, 20)
      } else if (upgradeId === 'energy_regen') {
        newState.energyRegenRate = Math.min(prev.energyRegenRate + 1, 10)
      }

      if (costType === 'points') {
        newState.points = prev.points - cost
      }

      return newState
    })
  }, [])

  const addReferral = useCallback((referralData: { username: string; totalEarnings: number }) => {
    setGameState(prev => {
      const bonus = Math.floor(referralData.totalEarnings * 0.1) // 10% bonus
      return {
        ...prev,
        referralCount: prev.referralCount + 1,
        points: prev.points + bonus,
        referralEarnings: prev.referralEarnings + bonus,
        totalPointsEarned: prev.totalPointsEarned + bonus
      }
    })
  }, [])

  const setWalletConnection = useCallback((connected: boolean, address?: string) => {
    setGameState(prev => ({
      ...prev,
      walletConnected: connected,
      walletAddress: address
    }))
  }, [])

  const calculateOfflineEarnings = useCallback(() => {
    const now = Date.now()
    const timeDiff = now - gameState.lastActive
    const hoursOffline = Math.min(timeDiff / (1000 * 60 * 60), gameState.offlineEarningMaxHours)
    
    if (hoursOffline > 0) {
      const offlinePoints = Math.floor(hoursOffline * gameState.offlineEarningRate)
      if (offlinePoints > 0) {
        setGameState(prev => ({
          ...prev,
          points: prev.points + offlinePoints,
          offlineEarnings: prev.offlineEarnings + offlinePoints,
          totalPointsEarned: prev.totalPointsEarned + offlinePoints,
          lastActive: now
        }))
        return offlinePoints
      }
    }
    return 0
  }, [gameState.lastActive, gameState.offlineEarningMaxHours, gameState.offlineEarningRate])

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
