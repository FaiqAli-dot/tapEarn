const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

const SESSION_TOKEN_KEY = 'tapearn_session_token';

class ApiService {
  private userId: string | null = null;
  private sessionToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    }
  }

  setUserId(userId: string) {
    console.log(`🔗 API Service: Setting user ID to ${userId}`);
    this.userId = userId;
  }

  setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }

  getSessionToken() {
    return this.sessionToken;
  }

  clearSession() {
    this.setSessionToken(null);
    this.userId = null;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.sessionToken) {
      headers.Authorization = `Bearer ${this.sessionToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Telegram Mini App initData (production path).
   * Optional startParam covers /start ref_CODE when it is only present in the URL.
   */
  async authenticateWithTelegram(initData: string, startParam?: string | null) {
    const result = await this.request('/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData, startParam: startParam || null }),
    });
    if (result.token) {
      this.setSessionToken(result.token);
      if (result.user?.telegramId) {
        this.setUserId(result.user.telegramId);
      }
    }
    return result;
  }

  /**
   * Local/browser auth when ALLOW_DEV_AUTH=true on backend.
   */
  async authenticateDev(payload: {
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    start?: string | null;
  }) {
    const result = await this.request('/auth/dev', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (result.token) {
      this.setSessionToken(result.token);
      if (result.user?.telegramId) {
        this.setUserId(result.user.telegramId);
      }
    }
    return result;
  }

  async getAuthMe() {
    return this.request('/auth/me');
  }

  // Initialize / refresh user (requires session)
  async initUser() {
    return this.request('/users/init');
  }

  // Get user game state
  async getGameState() {
    return this.request('/users/game-state');
  }

  // Update user game state
  async updateGameState(gameState: any) {
    return this.request('/users/game-state', {
      method: 'POST',
      body: JSON.stringify(gameState),
    });
  }

  // Tap action (legacy single tap)
  async tap() {
    console.log(`🎯 API Service: Making tap request for user ${this.userId}`);
    const result = await this.request('/users/tap', {
      method: 'POST',
    });
    console.log(`🎯 API Service: Tap response - Points: ${result.points}, Energy: ${result.energy}`);
    return result;
  }

  // Batched sync taps
  async syncTaps(tapCount: number) {
    console.log(`🎯 API Service: Syncing ${tapCount} taps for user ${this.userId}`);
    const result = await this.request('/users/sync-taps', {
      method: 'POST',
      body: JSON.stringify({ tapCount }),
    });
    console.log(`🎯 API Service: Sync response - Points: ${result.points}, Energy: ${result.energy}`);
    return result;
  }

  // Complete daily task
  async completeDailyTask(taskId: string) {
    console.log(`🎯 API Service: Completing daily task ${taskId} for user ${this.userId}`);
    const result = await this.request('/users/complete-task', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
    console.log(`🎯 API Service: Daily task completed - Points: ${result.points}`);
    return result;
  }

  // Purchase upgrade
  async purchaseUpgrade(upgradeId: string, cost: number) {
    console.log(`🎯 API Service: Purchasing upgrade ${upgradeId} for ${cost} points, user ${this.userId}`);
    const result = await this.request('/users/purchase-upgrade', {
      method: 'POST',
      body: JSON.stringify({ upgradeId, cost }),
    });
    console.log(`🎯 API Service: Upgrade purchased - Points: ${result.points}`);
    return result;
  }

  // Get available upgrades
  async getAvailableUpgrades() {
    return this.request('/users/upgrades');
  }

  // Reset daily tasks
  async resetDailyTasks() {
    return this.request('/users/reset-daily-tasks', {
      method: 'POST',
    });
  }

  // Get leaderboard
  async getLeaderboard(limit: number = 10) {
    return this.request(`/users/leaderboard?limit=${limit}`);
  }

  // Get video code by task ID
  async getVideoCode(taskId: string) {
    const result = await this.request(`/video-codes/${taskId}`, {
      method: 'GET',
    });
    return result.data;
  }

  // Verify video code
  async verifyVideoCode(taskId: string, enteredCode: string) {
    const result = await this.request('/video-codes/verify', {
      method: 'POST',
      body: JSON.stringify({ taskId, enteredCode }),
    });
    return result.data;
  }

  // Admin: Get all video codes
  async getAllVideoCodes() {
    const result = await this.request('/video-codes', {
      method: 'GET',
    });
    return result.data;
  }

  // Admin: Create or update video code
  async createOrUpdateVideoCode(taskId: string, data: {
    videoUrl: string;
    code: string;
    hint?: string;
    timeToShow?: number;
    points?: number;
    isActive?: boolean;
  }) {
    const result = await this.request(`/video-codes/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  // Admin: Delete video code
  async deleteVideoCode(taskId: string) {
    const result = await this.request(`/video-codes/${taskId}`, {
      method: 'DELETE',
    });
    return result.data;
  }
}

export const apiService = new ApiService();
