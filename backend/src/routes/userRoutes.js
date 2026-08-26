import express from 'express';
import { 
  getUser, 
  updateUser, 
  handleTap, 
  completeDailyTask,
  purchaseUpgrade,
  getUserGameState,
  updateUserGameState,
  getAvailableUpgrades,
  resetDailyTasks,
  getLeaderboard,
  syncTaps
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// All user routes require a verified session (JWT from /api/auth/*)
router.use(requireAuth);

// Current user profile
router.get('/me', async (req, res) => {
  try {
    const user = await getUser(req.telegramId);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Ensure / refresh user after auth (identity comes from JWT only)
router.get('/init', async (req, res) => {
  try {
    const user = await getUser(req.telegramId);
    const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');

    res.json({
      success: true,
      data: user,
      referralLink: botUsername
        ? `https://t.me/${botUsername}?start=ref_${user.referralCode}`
        : `${frontendUrl}?start=ref_${user.referralCode}`
    });
  } catch (error) {
    console.error('Error initializing user:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize user' });
  }
});

// Handle tap action
router.post('/tap', async (req, res) => {
  try {
    const result = await handleTap(req.telegramId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Handle batched taps sync
router.post('/sync-taps', async (req, res) => {
  try {
    const { tapCount } = req.body;
    if (tapCount === undefined || tapCount < 0) {
      return res.status(400).json({ success: false, error: 'Valid tap count is required' });
    }
    
    const result = await syncTaps(req.telegramId, tapCount);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update user data (non-economy profile fields only — economy lockdown is Phase 3)
router.patch('/update', async (req, res) => {
  try {
    const user = await updateUser(req.telegramId, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user game state
router.get('/game-state', async (req, res) => {
  try {
    const gameState = await getUserGameState(req.telegramId);
    res.json({ success: true, data: gameState });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Update user game state
router.post('/game-state', async (req, res) => {
  try {
    const result = await updateUserGameState(req.telegramId, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Complete daily task
router.post('/complete-task', async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }
    
    const result = await completeDailyTask(req.telegramId, taskId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Purchase upgrade
router.post('/purchase-upgrade', async (req, res) => {
  try {
    const { upgradeId, cost } = req.body;
    if (!upgradeId || cost === undefined) {
      return res.status(400).json({ success: false, error: 'Upgrade ID and cost are required' });
    }
    
    const result = await purchaseUpgrade(req.telegramId, upgradeId, cost);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get available upgrades
router.get('/upgrades', async (req, res) => {
  try {
    const upgrades = await getAvailableUpgrades(req.telegramId);
    res.json({ success: true, data: upgrades });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Reset daily tasks
router.post('/reset-daily-tasks', async (req, res) => {
  try {
    const result = await resetDailyTasks(req.telegramId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get leaderboard (authenticated to reduce abuse)
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

export default router;
