const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

class ApiService {
  private userId: string | null = null;

  setUserId(userId: string) {
    console.log(`🔗 API Service: Setting user ID to ${userId}`);
    this.userId = userId;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.userId && { 'x-user-id': this.userId }),
        ...options.headers,
      },
      ...options,
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

  // Initialize user
  async initUser(userId: string, userData: any) {
    const params = new URLSearchParams({ userId, ...userData });
    return this.request(`/users/init?${params}`);
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