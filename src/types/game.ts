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
  
  // Daily tasks
  dailyTasks: DailyTask[]
  lastDailyReset: number
  
  // Referrals
  referralCode: string
  referredBy?: string
  referralCount: number
  
  // Wallet
  walletConnected: boolean
  walletAddress?: string
}

export interface DailyTask {
  id: string
  title: string
  description: string
  points: number
  completed: boolean
  type: 'login' | 'youtube' | 'streak' | 'custom'
  url?: string
  completedAt?: number
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
  id: string
  username: string
  joinedAt: number
  totalEarnings: number
  bonusEarned: number
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
