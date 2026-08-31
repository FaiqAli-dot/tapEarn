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
import { resetTapRateLimits } from '../src/services/clickService.js';

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
  return user;
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ALLOW_DEV_AUTH = 'true';
  process.env.ADMIN_TELEGRAM_IDS = '999';
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.TON_NETWORK = 'testnet';
  process.env.TAP_RATE_LIMIT_MAX = '1000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100000';

  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('tapearn-test'));

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
    mongoose.model('CampaignCompletion')?.deleteMany?.({}) ?? Promise.resolve(),
    mongoose.model('Payment')?.deleteMany?.({}) ?? Promise.resolve(),
    mongoose.model('ReferralReward')?.deleteMany?.({}) ?? Promise.resolve()
  ]);
});

describe('Telegram dev auth', () => {
  it('creates user via dev auth', async () => {
    const res = await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '100', username: 'alice' });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.telegramId, '100');
  });

  it('rejects unauthenticated /api/users/me', async () => {
    const res = await request(app).get('/api/users/me');
    assert.equal(res.status, 401);
  });
});

describe('Referral system', () => {
  it('applies referral on signup and prevents self-referral', async () => {
    const referrer = await createUser('200');

    const ok = await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '201', start: referrer.referralCode });

    assert.equal(ok.status, 200);
    const referred = await User.findOne({ telegramId: '201' });
    assert.equal(referred.referrerId, '200');
    assert.equal(referred.referredBy, referrer.referralCode);

    const selfUser = await createUser('202');
    const selfRes = await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '203', start: selfUser.referralCode });

    assert.equal(selfRes.status, 200);
    const user203 = await User.findOne({ telegramId: '203' });
    assert.notEqual(user203.referrerId, '203');
    assert.equal(user203.referrerId, '202');
  });

  it('locks referrer permanently on re-auth', async () => {
    const referrer = await createUser('300');
    await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '301', start: referrer.referralCode });

    const other = await createUser('302');
    await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '301', start: other.referralCode });

    const user = await User.findOne({ telegramId: '301' });
    assert.equal(user.referrerId, '300');
  });

  it('grants 50% referral reward on first payment idempotently', async () => {
    const referrer = await createUser('400');
    await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '401', start: referrer.referralCode });

    const pay1 = await request(app)
      .post('/api/payments/complete')
      .set('x-payment-webhook-secret', 'test-webhook-secret')
      .send({ userId: '401', externalPaymentId: 'pay-1', amount: 100 });

    assert.equal(pay1.status, 200);
    assert.equal(pay1.body.referralReward.amount, 50);

    const updatedReferrer = await User.findOne({ telegramId: '400' });
    assert.equal(updatedReferrer.referralEarnings, 50);
    assert.equal(updatedReferrer.points, 50);

    const payDup = await request(app)
      .post('/api/payments/complete')
      .set('x-payment-webhook-secret', 'test-webhook-secret')
      .send({ userId: '401', externalPaymentId: 'pay-1', amount: 100 });

    assert.equal(payDup.body.duplicate, true);

    const txCount = await PointTransaction.countDocuments({
      userId: '400',
      type: 'REFERRAL'
    });
    assert.equal(txCount, 1);
  });

  it('does not grant multi-level referral rewards', async () => {
    const a = await createUser('500');
    await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '501', start: a.referralCode });
    const b = await User.findOne({ telegramId: '501' });
    await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '502', start: b.referralCode });

    await request(app)
      .post('/api/payments/complete')
      .set('x-payment-webhook-secret', 'test-webhook-secret')
      .send({ userId: '502', externalPaymentId: 'pay-502', amount: 100 });

    const userA = await User.findOne({ telegramId: '500' });
    const userB = await User.findOne({ telegramId: '501' });
    assert.equal(userB.referralEarnings, 50);
    assert.equal(userA.referralEarnings, 0);
  });
});

describe('Click / tap earning', () => {
  it('awards points server-side and rejects client balance injection', async () => {
    await createUser('600', { energy: 100, maxEnergy: 100, tapPower: 2 });

    const tap = await request(app)
      .post('/api/users/tap')
      .set(authHeader('600'));

    assert.equal(tap.status, 200);
    assert.equal(tap.body.pointsEarned, 2);

    const inject = await request(app)
      .post('/api/users/game-state')
      .set(authHeader('600'))
      .send({ points: 999999, totalTaps: 999999 });

    assert.equal(inject.status, 400);

    const state = await request(app)
      .get('/api/users/game-state')
      .set(authHeader('600'));

    assert.equal(state.body.data.points, 2);
    assert.equal(state.body.data.totalTaps, 1);
  });

  it('syncs batched taps with energy clamp', async () => {
    await createUser('601', { energy: 10, maxEnergy: 10, tapPower: 1 });

    const sync = await request(app)
      .post('/api/users/sync-taps')
      .set(authHeader('601'))
      .send({ tapCount: 5 });

    assert.equal(sync.status, 200);
    assert.equal(sync.body.syncedTaps, 5);
    assert.equal(sync.body.pointsEarned, 5);
  });
});

describe('Campaign completion', () => {
  it('completes campaign and prevents duplicates', async () => {
    await createUser('700');

    const campaign = await Campaign.create({
      type: 'VIDEO',
      title: 'Watch promo',
      rewardPoints: 250,
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 1000)
    });

    const complete = await request(app)
      .post(`/api/campaigns/${campaign._id}/complete`)
      .set(authHeader('700'));

    assert.equal(complete.status, 200);
    assert.equal(complete.body.reward, 250);

    const dup = await request(app)
      .post(`/api/campaigns/${campaign._id}/complete`)
      .set(authHeader('700'));

    assert.equal(dup.body.duplicate, true);

    const user = await User.findOne({ telegramId: '700' });
    assert.equal(user.points, 250);
  });
});

describe('Leaderboards', () => {
  it('returns ranked users by type without sensitive fields', async () => {
    await createUser('800', { points: 100, totalTaps: 50 });
    await createUser('801', { points: 200, totalTaps: 10 });
    await createUser('802');

    const res = await request(app)
      .get('/api/users/leaderboard?type=points&limit=5')
      .set(authHeader('802'));

    assert.equal(res.status, 200);
    assert.equal(res.body.data[0].score, 200);
    assert.equal(res.body.data[0].rank, 1);
    assert.ok(!('energy' in res.body.data[0]));
    assert.ok(res.body.myRank);
  });
});

describe('Admin authorization', () => {
  it('returns 403 for non-admin on admin campaigns', async () => {
    await createUser('900');

    const res = await request(app)
      .get('/api/admin/campaigns')
      .set(authHeader('900'));

    assert.equal(res.status, 403);
  });

  it('allows admin to create and list campaigns', async () => {
    await createUser('999');

    const create = await request(app)
      .post('/api/admin/campaigns')
      .set(authHeader('999'))
      .send({
        type: 'SPONSORED_POST',
        title: 'Sponsor task',
        rewardPoints: 1000
      });

    assert.equal(create.status, 201);

    const list = await request(app)
      .get('/api/admin/campaigns')
      .set(authHeader('999'));

    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
  });

  it('returns 401 for payment webhook without secret', async () => {
    await createUser('901');

    const res = await request(app)
      .post('/api/payments/complete')
      .set(authHeader('901'))
      .send({ userId: '901', externalPaymentId: 'x', amount: 10 });

    assert.equal(res.status, 401);
  });
});
