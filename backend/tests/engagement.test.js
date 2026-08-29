import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/middleware/auth.js';
import User from '../src/models/User.js';
import Campaign from '../src/models/Campaign.js';
import PointTransaction from '../src/models/PointTransaction.js';
import XpTransaction from '../src/models/XpTransaction.js';
import { resetTapRateLimits } from '../src/services/clickService.js';
import {
  calculateLevel,
  xpRequiredForLevel,
  awardXp,
  getLevelReward
} from '../src/services/xpService.js';
import {
  ensureDailyQuests,
  getQuestStatus,
  onTaps,
  onPointsEarned,
  claimQuest
} from '../src/services/questService.js';
import { recordStreakActivity, checkStreakMilestones } from '../src/services/streakService.js';
import {
  checkLifetimeMilestones,
  LIFETIME_MILESTONES
} from '../src/services/milestoneService.js';
import { awardPoints } from '../src/services/pointsService.js';

let memoryServer;
let app;

function authHeader(telegramId, extra = {}) {
  const token = signSessionToken({ telegramId: String(telegramId), ...extra });
  return { Authorization: `Bearer ${token}` };
}

async function createUser(telegramId, overrides = {}) {
  const user = new User({
    telegramId: String(telegramId),
    username: overrides.username || `user${telegramId}`,
    firstName: overrides.firstName || 'Test',
    ...overrides
  });
  await user.save();
  ensureDailyQuests(user);
  await user.save();
  return user;
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ALLOW_DEV_AUTH = 'true';
  process.env.ADMIN_TELEGRAM_IDS = '999';
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.TAP_RATE_LIMIT_MAX = '1000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100000';

  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('tapearn-engagement-test'));
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

beforeEach(async () => {
  resetTapRateLimits();
  await Promise.all([
    User.deleteMany({}),
    Campaign.deleteMany({}),
    PointTransaction.deleteMany({}),
    XpTransaction.deleteMany({}),
    mongoose.model('CampaignCompletion')?.deleteMany?.({}) ?? Promise.resolve(),
    mongoose.model('Payment')?.deleteMany?.({}) ?? Promise.resolve(),
    mongoose.model('ReferralReward')?.deleteMany?.({}) ?? Promise.resolve()
  ]);
});

describe('XP and levels', () => {
  it('calculates level from XP curve', () => {
    assert.equal(calculateLevel(0), 1);
    assert.equal(calculateLevel(99), 1);
    assert.equal(calculateLevel(100), 2);
    assert.equal(calculateLevel(xpRequiredForLevel(10)), 10);
  });

  it('awards XP idempotently with referenceId', async () => {
    await createUser('xp1');

    const first = await awardXp('xp1', 50, 'QUEST', {
      referenceId: 'quest-test-1',
      description: 'test'
    });
    assert.equal(first.duplicate, false);
    assert.equal(first.xp, 50);

    const dup = await awardXp('xp1', 50, 'QUEST', {
      referenceId: 'quest-test-1',
      description: 'test'
    });
    assert.equal(dup.duplicate, true);
    assert.equal(dup.xp, 50);

    const txCount = await XpTransaction.countDocuments({ userId: 'xp1' });
    assert.equal(txCount, 1);
  });

  it('grants level-up YP rewards idempotently', async () => {
    await createUser('xp2');

    const xpNeeded = xpRequiredForLevel(2);
    const result = await awardXp('xp2', xpNeeded, 'QUEST', {
      referenceId: 'level-up-test',
      description: 'level up'
    });

    assert.ok(result.levelUp);
    assert.equal(result.level, 2);

    const levelTx = await PointTransaction.findOne({
      userId: 'xp2',
      type: 'LEVEL_REWARD',
      referenceId: 'level-2'
    });
    assert.ok(levelTx);
    assert.equal(levelTx.amount, getLevelReward(2));

    const dup = await awardXp('xp2', 1, 'QUEST', {
      referenceId: 'level-up-test-dup',
      description: 'noop'
    });
    const levelTxCount = await PointTransaction.countDocuments({
      userId: 'xp2',
      type: 'LEVEL_REWARD',
      referenceId: 'level-2'
    });
    assert.equal(levelTxCount, 1);
    assert.equal(dup.duplicate, false);
  });
});

describe('Daily quests', () => {
  it('generates 3 primary + 1 bonus quest', async () => {
    const user = await createUser('q1');
    const status = getQuestStatus(user);
    assert.equal(status.quests.length, 4);
    assert.equal(status.primaryTotal, 3);
    assert.equal(status.quests.filter((q) => q.isPrimary).length, 3);
    assert.equal(status.quests.filter((q) => !q.isPrimary).length, 1);
  });

  it('tracks tap progress and claims quest reward', async () => {
    await createUser('q2', { energy: 200, maxEnergy: 200, tapPower: 1 });
    await onTaps('q2', 100);

    const claim = await request(app)
      .post('/api/users/quests/quest_easy/complete')
      .set(authHeader('q2'));

    assert.equal(claim.status, 200);
    assert.equal(claim.body.quest.completed, true);

    const dup = await request(app)
      .post('/api/users/quests/quest_easy/complete')
      .set(authHeader('q2'));
    assert.equal(dup.status, 400);
  });

  it('rejects claiming quest before requirements met', async () => {
    await createUser('q3');
    const res = await request(app)
      .post('/api/users/quests/quest_easy/complete')
      .set(authHeader('q3'));
    assert.equal(res.status, 400);
  });

  it('awards all-primary bonus idempotently', async () => {
    const user = await createUser('q4');
    user.dailyStats = {
      date: new Date().toISOString().slice(0, 10),
      taps: 100,
      pointsEarned: 2500,
      campaignsCompleted: 1,
      referralsToday: 0,
      dailyCheckinAwarded: true
    };
    await user.save();

    for (const id of ['quest_easy', 'quest_medium', 'quest_hard']) {
      await claimQuest('q4', id);
    }

    const refreshed = await User.findOne({ telegramId: 'q4' });
    assert.equal(refreshed.primaryQuestBonusClaimed, true);

    const bonusTx = await PointTransaction.findOne({
      userId: 'q4',
      type: 'QUEST_BONUS',
      referenceId: { $regex: /^all-primary-/ }
    });
    assert.ok(bonusTx);
    assert.equal(bonusTx.amount, 1500);
  });
});

describe('Streak system', () => {
  it('starts streak on first activity', async () => {
    await createUser('s1');
    const result = await recordStreakActivity('s1', 'taps');
    assert.equal(result.currentStreak, 1);
  });

  it('does not increment streak twice same day', async () => {
    await createUser('s2');
    await recordStreakActivity('s2', 'taps');
    const second = await recordStreakActivity('s2', 'campaign');
    assert.equal(second.currentStreak, 1);
  });

  it('awards streak milestones idempotently', async () => {
    const user = await createUser('s3');
    user.currentStreak = 7;
    user.lastStreakActivityDate = '2000-01-01';
    await user.save();

    const milestones = await checkStreakMilestones('s3');
    const sevenReward = milestones.find((m) => m.days === 7);
    assert.ok(sevenReward);
    assert.equal(sevenReward.ypReward, 1000);

    const dup = await checkStreakMilestones('s3');
    assert.equal(dup.length, 0);

    const txCount = await PointTransaction.countDocuments({
      userId: 's3',
      type: 'STREAK_MILESTONE',
      referenceId: 'streak-7'
    });
    assert.equal(txCount, 1);
  });
});

describe('Lifetime milestones', () => {
  it('awards milestone when threshold crossed', async () => {
    await createUser('m1', { totalPointsEarned: 900, points: 900 });

    await awardPoints('m1', 200, 'CLICK', {
      referenceId: 'milestone-test-1',
      description: 'push over 1k'
    });

    const tx = await PointTransaction.findOne({
      userId: 'm1',
      type: 'LIFETIME_MILESTONE',
      referenceId: 'lifetime-1000'
    });
    assert.ok(tx);
    assert.equal(tx.amount, 100);
  });

  it('prevents duplicate milestone claims', async () => {
    await createUser('m2', { totalPointsEarned: 5000, points: 5000 });

    const first = await checkLifetimeMilestones('m2');
    assert.ok(first.length > 0);

    const second = await checkLifetimeMilestones('m2');
    assert.equal(second.length, 0);

    for (const m of LIFETIME_MILESTONES.filter((x) => x.threshold <= 5000)) {
      const count = await PointTransaction.countDocuments({
        userId: 'm2',
        referenceId: `lifetime-${m.threshold}`
      });
      assert.equal(count, 1);
    }
  });
});

describe('Engagement API security', () => {
  it('rejects unauthenticated engagement requests', async () => {
    const res = await request(app).get('/api/users/engagement');
    assert.equal(res.status, 401);
  });

  it('rejects client-supplied XP/level in game-state', async () => {
    await createUser('sec1');
    const res = await request(app)
      .post('/api/users/game-state')
      .set(authHeader('sec1'))
      .send({ xp: 99999, level: 50 });
    assert.equal(res.status, 400);
  });

  it('returns engagement data for authenticated user', async () => {
    await createUser('sec2');
    const res = await request(app)
      .get('/api/users/engagement')
      .set(authHeader('sec2'));

    assert.equal(res.status, 200);
    assert.ok(res.body.data.quests);
    assert.ok(res.body.data.xp);
    assert.ok(res.body.data.streak);
    assert.ok(res.body.data.milestones);
  });
});
