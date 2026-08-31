export interface GameState {
  // Core game state
  points: number
  energy: number
  maxEnergy: number
  energyRegenRate: number // points per second
  
  // Upgrades
  tapPower: number // points per tap (1-5)
  offlineEarningRate: number // points per hour
  offlineEarningMaxHours: number // max hours for offline earning
  
  // Statistics
  totalTaps: number
  totalPointsEarned: number
  offlineEarnings: number
  referralEarnings: number
  lastActive: number
  
  // Daily tasks / quests
  dailyTasks: DailyTask[]
  lastDailyReset: number

  // Engagement loop (server-authoritative)
  engagement?: EngagementData
  
  // Referrals
  referralCode: string
  referredBy?: string
  referralCount: number
  
  // Wallet
  walletConnected: boolean
  walletAddress?: string
  walletVerified?: boolean
  walletVerifiedAt?: string
}

export interface DailyTask {
  id: string
  title: string
  description: string
  points: number
  completed: boolean
  type: 'login' | 'youtube' | 'streak' | 'custom'
  questType?: 'CLICK_COUNT' | 'CAMPAIGN_COMPLETION' | 'POINT_EARNINGS' | 'REFERRAL_SUCCESS' | 'DAILY_ACTIVITY'
  difficulty?: 'easy' | 'medium' | 'hard' | 'bonus'
  isPrimary?: boolean
  requiredAmount?: number
  currentProgress?: number
  ypReward?: number
  xpReward?: number
  readyToClaim?: boolean
  url?: string
  completedAt?: number
}

export interface XpProgress {
  current: number
  required: number
  percent: number
}

export interface EngagementXp {
  xp: number
  level: number
  xpForNextLevel: number | null
  progress: XpProgress
}

export interface EngagementStreak {
  currentStreak: number
  longestStreak: number
  lastStreakActivityDate: string | null
  streakMilestonesClaimed: number[]
  achievements: string[]
  nextMilestone: { days: number; ypReward: number } | null
}

export interface EngagementMilestones {
  totalPointsEarned: number
  claimed: number[]
  progress: {
    next: number | null
    current: number
    threshold: number
    reward: number
    percent: number
  }
  milestones: { threshold: number; reward: number }[]
}

export interface EngagementQuests {
  quests: DailyTask[]
  primaryCompleted: number
  primaryTotal: number
  primaryReady: number
  allPrimaryComplete: boolean
  canClaimAllPrimaryBonus: boolean
  allPrimaryBonus: { ypReward: number; xpReward: number }
}

export interface EngagementData {
  quests: EngagementQuests
  xp: EngagementXp
  streak: EngagementStreak
  milestones: EngagementMilestones
  leaderboard: {
    rank: number | null
    score: number
  }
}

export interface Upgrade {
  id: string
  name: string
  description: string
  currentLevel: number
  maxLevel: number
  cost: number
  costType: 'points' | 'ton'
  effect: {
    type: 'tapPower' | 'offlineEarning' | 'energyRegen'
    value: number
  }
}

export interface Referral {
  userId: string
  username: string
  joinedAt: number | string
}

export type LeaderboardType = 'points' | 'clicks' | 'referrals'

export interface LeaderboardUser {
  telegramId: string
  username: string | null
  firstName: string | null
  lastName: string | null
}

export interface LeaderboardEntry {
  rank: number
  user: LeaderboardUser
  score: number
}

export interface LeaderboardMyRank {
  rank: number
  score: number
}

export type CampaignType = 'VIDEO' | 'SPONSORED_POST'

export interface Campaign {
  _id: string
  type: CampaignType
  title: string
  description: string
  url: string
  thumbnail: string
  rewardPoints: number
  startDate: string
  endDate: string | null
  status: string
}

export interface User {
  id: number
  username: string
  firstName: string
  lastName?: string
  photoUrl?: string
  isPremium?: boolean
  languageCode?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    query_id: string
    user: User
    receiver: User
    chat: any
    chat_type: string
    chat_instance: string
    start_param: string
    can_send_after: number
    auth_date: number
    hash: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: {
    bg_color: string
    text_color: string
    hint_color: string
    link_color: string
    button_color: string
    button_text_color: string
  }
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  isClosingConfirmationEnabled: boolean
  backButton: {
    isVisible: boolean
    onClick: (callback: () => void) => void
  }
  mainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isProgressVisible: boolean
    isActive: boolean
    onClick: (callback: () => void) => void
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
  }
  hapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  ready: () => void
  expand: () => void
  close: () => void
  isVersionAtLeast: (version: string) => boolean
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  enableClosingConfirmation: () => void
  disableClosingConfirmation: () => void
  onEvent: (eventType: string, eventHandler: (event: any) => void) => void
  offEvent: (eventType: string, eventHandler: (event: any) => void) => void
  sendData: (data: string) => void
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  openTelegramLink: (url: string) => void
  openInvoice: (url: string, callback?: (status: string) => void) => void
  showPopup: (params: {
    title: string
    message: string
    buttons: Array<{
      id?: string
      type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive'
      text: string
    }>
  }, callback?: (buttonId: string) => void) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void
  showScanQrPopup: (params: {
    text?: string
  }, callback?: (result: string) => void) => void
  closeScanQrPopup: () => void
  readTextFromClipboard: (callback?: (text: string) => void) => void
  requestWriteAccess: (callback?: (access: boolean) => void) => void
  requestContact: (callback?: (contact: {
    phone_number: string
    first_name: string
    last_name?: string
    user_id?: number
    vcard?: string
  }) => void) => void
  invokeCustomMethod: (method: string, params?: any, callback?: (result: any) => void) => void
  getCustomMethodResult: (callback?: (result: any) => void) => void
}
