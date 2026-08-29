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
  getUserRank,
  syncTaps,
  getEngagement,
  completeQuest,
  claimQuestBonus
} from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';
import { tapRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.use(requireAuth);

router.get('/me', async (req, res) => {
  try {
    const user = await getUser(req.telegramId);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.get('/init', async (req, res) => {
  try {
    const user = await getUser(req.telegramId);
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');

    res.json({
      success: true,
      data: user,
      referralLink: botUsername
        ? `https://t.me/${botUsername}?start=ref_${user.referralCode}`
        : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to initialize user' });
  }
});

router.post('/tap', tapRateLimiter, async (req, res) => {
  try {
    const result = await handleTap(req.telegramId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/sync-taps', tapRateLimiter, async (req, res) => {
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

router.patch('/update', async (req, res) => {
  try {
    const user = await updateUser(req.telegramId, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/game-state', async (req, res) => {
  try {
    const gameState = await getUserGameState(req.telegramId);
    res.json({ success: true, data: gameState });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/game-state', async (req, res) => {
  try {
    if (
      req.body.points !== undefined ||
      req.body.totalTaps !== undefined ||
      req.body.xp !== undefined ||
      req.body.level !== undefined
    ) {
      return res.status(400).json({
        success: false,
        error: 'Economy fields cannot be set by the client'
      });
    }
    const result = await updateUserGameState(req.telegramId, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

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

router.get('/engagement', async (req, res) => {
  try {
    const data = await getEngagement(req.telegramId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/quests/:id/complete', async (req, res) => {
  try {
    const result = await completeQuest(req.telegramId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/quests/claim-all-primary-bonus', async (req, res) => {
  try {
    const result = await claimQuestBonus(req.telegramId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/purchase-upgrade', async (req, res) => {
  try {
    const { upgradeId } = req.body;
    if (!upgradeId) {
      return res.status(400).json({ success: false, error: 'Upgrade ID is required' });
    }
    const result = await purchaseUpgrade(req.telegramId, upgradeId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/upgrades', async (req, res) => {
  try {
    const upgrades = await getAvailableUpgrades(req.telegramId);
    res.json({ success: true, data: upgrades });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/reset-daily-tasks', async (req, res) => {
  try {
    const result = await resetDailyTasks(req.telegramId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const type = req.query.type || 'points';
    const leaderboard = await getLeaderboard(type, limit);
    const myRank = await getUserRank(req.telegramId, type);
    res.json({ success: true, data: leaderboard, myRank });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

export default router;
