import { useState, useEffect, useCallback } from 'react'
import { GameState, DailyTask } from '../types/game'
import { apiService, getApiBaseUrl } from '../services/api'

// Simple notification function
const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  // Create a simple toast notification
  const notification = document.createElement('div')
  notification.className = `fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white font-medium shadow-lg transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
    }`
  notification.textContent = message

  document.body.appendChild(notification)

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)'
  }, 100)

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(100%)'
    setTimeout(() => {
      document.body.removeChild(notification)
    }, 300)
  }, 3000)
}

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
      id: 'watch video naa',
      title: 'Watch Video',
      description: 'Watch our featured video',
      points: 150,
      completed: false,
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=pmog2cABaJk&t=2595s&ab_channel=JamalRoomi'
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

  // Batched tap syncing
  const [unsyncedTaps, setUnsyncedTaps] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

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

  // Force refresh game state from backend
  const refreshGameState = useCallback(async () => {
    try {
      console.log('🔄 Force refreshing game state from backend...')
      const result = await apiService.getGameState()
      const backendGameState = result.data
      console.log(`📊 Refreshed game state - Points: ${backendGameState.points}, Daily Tasks:`, backendGameState.dailyTasks)

      setGameState(backendGameState)
      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to refresh game state:', error)
    }
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

  const syncPendingTaps = useCallback(async () => {
    // If we're already syncing or have no taps to sync, do nothing
    if (isSyncing || unsyncedTaps <= 0 || !isInitialized) return;

    setIsSyncing(true);
    const tapsToSync = unsyncedTaps;

    try {
      console.log(`🔄 Frontend: Syncing ${tapsToSync} batched taps...`);
      const result = await apiService.syncTaps(tapsToSync);
      console.log(`✅ Frontend: Sync completed - Points: ${result.points}`);

      // Successfully synced, remove these taps from our counter
      setUnsyncedTaps(prev => Math.max(0, prev - tapsToSync));

      // Update our state with the ground truth from server
      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE;
        return {
          ...currentState,
          points: result.points,
          energy: result.energy,
          totalTaps: result.totalTaps,
          lastActive: Date.now()
        };
      });
    } catch (error) {
      console.error('Failed to sync taps:', error);
      // Wait to try again later, taps are still in unsyncedTaps
    } finally {
      setIsSyncing(false);
    }
  }, [unsyncedTaps, isSyncing, isInitialized]);

  // Set up periodic sync (every 3 seconds if there are pending taps)
  useEffect(() => {
    if (unsyncedTaps > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        syncPendingTaps();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [unsyncedTaps, isSyncing, syncPendingTaps]);

  // Set up page unload sync
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsyncedTaps > 0) {
        // We use navigator.sendBeacon for reliable delivery during page unload
        // sendBeacon doesn't wait for a response, perfect for "fire and forget"
        // Since we are unmounting, we construct the request manually
        const url = `${getApiBaseUrl()}/users/sync-taps`;
        const payload = JSON.stringify({ tapCount: unsyncedTaps });
        const blob = new Blob([payload], { type: 'application/json' });

        // Custom headers are tricky in sendBeacon, so we append user ID into URL if needed, 
        // but our backend uses request headers mostly. Let's try standard fetch as fallback inside sync
        navigator.sendBeacon(url + `?userId=${userId}`, blob);

        // Standard confirmation for leaving page if data might be lost
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handleVisibilityChange = () => {
      // Sync immediately when app goes to background
      if (document.visibilityState === 'hidden' && unsyncedTaps > 0) {
        syncPendingTaps();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [unsyncedTaps, userId, syncPendingTaps]);

  // Optimistic UI Tap
  const tap = useCallback(async () => {
    // Prevent tapping safely outside of state updater
    if (gameState.energy <= 0) {
      showNotification('⚡ No energy left! Wait for it to regenerate.', 'error');
      return;
    }

    // Queue tap securely outside the React 18 strict mode state updater
    setUnsyncedTaps(current => current + 1);

    setGameState(prev => {
      const currentState = prev || DEFAULT_GAME_STATE;

      // Fallback double check
      if (currentState.energy <= 0) {
        return currentState;
      }

      const pointsEarned = currentState.tapPower;
      const newEnergy = currentState.energy - 1;
      const newPoints = currentState.points + pointsEarned;
      const newTotalTaps = currentState.totalTaps + 1;
      const newTotalPointsEarned = currentState.totalPointsEarned + pointsEarned;

      // Show occasional notifications synchronously via setTimeout avoiding updater loops
      if (newTotalTaps % 50 === 0) {
        setTimeout(() => showNotification(`Awesome! ${newTotalTaps} total taps!`, 'info'), 0);
      }

      return {
        ...currentState,
        energy: newEnergy,
        points: newPoints,
        totalTaps: newTotalTaps,
        totalPointsEarned: newTotalPointsEarned,
        lastActive: Date.now()
      };
    });
  }, [gameState.energy]); // Depend on energy to conditionally block out of bounds clicks

  const completeDailyTask = useCallback(async (taskId: string) => {
    try {
      console.log(`🎯 Frontend: Completing daily task ${taskId}`)
      const result = await apiService.completeDailyTask(taskId)
      console.log(`✅ Frontend: Daily task completed - Points: ${result.points}, Daily Tasks:`, result.dailyTasks)

      // Find the completed task to show points earned
      const completedTask = result.dailyTasks?.find((t: DailyTask) => t.id === taskId)
      const pointsEarned = completedTask?.points || 0

      // Show success notification
      showNotification(`🎉 Task completed! +${pointsEarned} points earned!`, 'success')

      setGameState(prev => {
        const currentState = prev || DEFAULT_GAME_STATE

        // Use the daily tasks from the backend response instead of updating locally
        const newState = {
          ...currentState,
          dailyTasks: result.dailyTasks || currentState.dailyTasks,
          points: result.points
        }

        console.log(`🔄 Frontend: Updated state - Points: ${newState.points}, Daily Tasks:`, newState.dailyTasks)

        // Force a re-render by updating the state with a timestamp
        setTimeout(() => {
          setGameState(current => ({
            ...current,
            lastUpdate: Date.now()
          }))
        }, 100)

        return newState
      })
    } catch (error) {
      console.error('Complete daily task failed:', error)
      showNotification('❌ Failed to complete task. Please try again.', 'error')

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
    resetDailyTasks,
    refreshGameState
  }
}
