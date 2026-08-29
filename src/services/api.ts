import type {
  Campaign,
  LeaderboardEntry,
  LeaderboardMyRank,
  LeaderboardType,
} from '../types/game';

const SESSION_TOKEN_KEY = 'tapearn_session_token';
const API_BASE_STORAGE_KEY = 'tapearn_api_base_url';
const PRODUCTION_API_BASE_URL = 'https://yorza.onrender.com/api';

function builtInApiBaseUrl(): string {
  const fromEnv = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location.hostname === 'faiqali-dot.github.io') {
    return PRODUCTION_API_BASE_URL;
  }
  return 'http://localhost:3001/api';
}

/**
 * HTTPS pages cannot call http:// (mixed content → "Failed to fetch").
 */
function isUsableApiBase(url: string): boolean {
  if (typeof window === 'undefined') return true;
  if (window.location.protocol === 'https:' && url.startsWith('http://')) {
    return false;
  }
  return true;
}

/**
 * Normalize an API base so callers can pass either
 * `https://host/api` or `https://host` (we append `/api`).
 */
export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return builtInApiBaseUrl();
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
}

function apiParamFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const fromSearch = new URLSearchParams(window.location.search).get('api');
  if (fromSearch) return fromSearch;
  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;
  return new URLSearchParams(hash.startsWith('?') ? hash.slice(1) : hash).get('api');
}

/**
 * Resolve API base at runtime so a GitHub Pages build can point at a
 * tunnel/public HTTPS backend without rebuilding:
 *   ?api=https://xxxx.ngrok-free.app
 * Persists to localStorage when set via query param.
 */
export function getApiBaseUrl(): string {
  const fallback = builtInApiBaseUrl();
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const fromQuery = apiParamFromLocation();
    if (fromQuery) {
      const normalized = normalizeApiBaseUrl(fromQuery);
      if (isUsableApiBase(normalized)) {
        localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
        return normalized;
      }
    }

    const stored = localStorage.getItem(API_BASE_STORAGE_KEY);
    if (stored && isUsableApiBase(stored)) return stored;
  } catch {
    // ignore storage / URL errors and fall through
  }

  return fallback;
}

export interface WalletStatePayload {
  walletConnected: boolean;
  walletAddress?: string;
}

class ApiService {
  private userId: string | null = null;
  private sessionToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
      getApiBaseUrl();
    }
  }

  setUserId(userId: string) {
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
    const url = `${getApiBaseUrl()}${endpoint}`;

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
        const err = new Error(data.error || 'API request failed') as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      if (error instanceof TypeError) {
        throw new Error(`Failed to fetch ${url}`);
      }
      throw error;
    }
  }

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

  async initUser() {
    return this.request('/users/init');
  }

  async getUserProfile() {
    return this.request('/users/me');
  }

  async getGameState() {
    return this.request('/users/game-state');
  }

  /** Wallet-only game-state sync (server rejects points/totalTaps). */
  async updateWalletState(payload: WalletStatePayload) {
    return this.request('/users/game-state', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async tap() {
    return this.request('/users/tap', { method: 'POST' });
  }

  async syncTaps(tapCount: number) {
    return this.request('/users/sync-taps', {
      method: 'POST',
      body: JSON.stringify({ tapCount }),
    });
  }

  async completeDailyTask(taskId: string) {
    return this.request('/users/complete-task', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }

  async purchaseUpgrade(upgradeId: string) {
    return this.request('/users/purchase-upgrade', {
      method: 'POST',
      body: JSON.stringify({ upgradeId }),
    });
  }

  async getAvailableUpgrades() {
    return this.request('/users/upgrades');
  }

  async resetDailyTasks() {
    return this.request('/users/reset-daily-tasks', { method: 'POST' });
  }

  async getLeaderboard(
    type: LeaderboardType = 'points',
    limit: number = 10
  ): Promise<{ data: LeaderboardEntry[]; myRank: LeaderboardMyRank | null }> {
    const result = await this.request(
      `/users/leaderboard?type=${encodeURIComponent(type)}&limit=${limit}`
    );
    return { data: result.data, myRank: result.myRank ?? null };
  }

  async getCampaigns(): Promise<Campaign[]> {
    const result = await this.request('/campaigns');
    return result.data;
  }

  async completeCampaign(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/complete`, { method: 'POST' });
  }

  /** Returns true if the current session has admin JWT access to video-codes. */
  async checkAdminAccess(): Promise<boolean> {
    try {
      await this.request('/video-codes');
      return true;
    } catch (error: any) {
      if (error?.status === 403 || error?.status === 401) return false;
      throw error;
    }
  }

  async getVideoCode(taskId: string) {
    const result = await this.request(`/video-codes/${taskId}`, { method: 'GET' });
    return result.data;
  }

  async verifyVideoCode(taskId: string, enteredCode: string) {
    const result = await this.request('/video-codes/verify', {
      method: 'POST',
      body: JSON.stringify({ taskId, enteredCode }),
    });
    return result.data;
  }

  async getAllVideoCodes() {
    const result = await this.request('/video-codes', { method: 'GET' });
    return result.data;
  }

  async createOrUpdateVideoCode(
    taskId: string,
    data: {
      videoUrl: string;
      code: string;
      hint?: string;
      timeToShow?: number;
      points?: number;
      isActive?: boolean;
    }
  ) {
    const result = await this.request(`/video-codes/${taskId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return result.data;
  }

  async deleteVideoCode(taskId: string) {
    const result = await this.request(`/video-codes/${taskId}`, { method: 'DELETE' });
    return result.data;
  }
}

export const apiService = new ApiService();
