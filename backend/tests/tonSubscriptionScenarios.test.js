/**
 * Scenario coverage A–G against Express + in-memory Mongo + TON_CHAIN_MOCK.
 * These prove backend/business rules without testnet funds.
 * Live on-chain counterparts require faucet-funded wallets (see docs/ton-subscription-testnet.md).
 */
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/middleware/auth.js';
import User from '../src/models/User.js';
import Payment from '../src/models/Payment.js';
import ReferralTonPayout from '../src/models/ReferralTonPayout.js';
import { Address } from 'ton-core';

function testWallet(seed) {
  const hex = BigInt(seed).toString(16).padStart(64, '0');
  return Address.parseRaw(`0:${hex}`).toString();
}

let memoryServer;
let app;

function auth(telegramId) {
  return { Authorization: `Bearer ${signSessionToken({ telegramId: String(telegramId) })}` };
}

async function user(telegramId, overrides = {}) {
  const u = new User({
    telegramId: String(telegramId),
    username: `u${telegramId}`,
    firstName: 'T',
    ...overrides
  });
  await u.save();
  return u;
}

async function verify(telegramId, wallet) {
  await User.findOneAndUpdate(
    { telegramId: String(telegramId) },
    {
      walletAddress: wallet,
      walletConnected: true,
      walletVerified: true,
      walletVerifiedAt: new Date()
    }
  );
}

before(async () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const seed = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ALLOW_DEV_AUTH = 'true';
  process.env.TON_NETWORK = 'testnet';
  process.env.TON_SUBSCRIPTION_AMOUNT = '0.1';
  process.env.TON_SUBSCRIPTION_DURATION_DAYS = '30';
  process.env.TON_TESTNET_TREASURY_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
  process.env.TON_TESTNET_REFERRAL_CONTRACT_ADDRESS =
    'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9d';
  process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY = seed.toString('hex');
  process.env.TON_CHAIN_MOCK = 'true';
  process.env.TON_CONNECT_DOMAIN = 'localhost';
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.TAP_RATE_LIMIT_MAX = '1000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100000';
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('tapearn-scenarios'));
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Payment.deleteMany({}), ReferralTonPayout.deleteMany({})]);
});

describe('Scenario A — referred first purchase', () => {
  it('splits commission to referrer and activates only after confirm', async () => {
    const ref = await user('A1');
    await verify('A1', testWallet(11));
    await user('B1', { referrerId: 'A1', referredBy: ref.referralCode });
    await verify('B1', testWallet(12));

    const intent = await request(app).post('/api/payments/intent').set(auth('B1'));
    assert.equal(intent.body.payment.commissionEligible, true);
    assert.ok(BigInt(intent.body.payment.referrerShareNanoton) > 0n);

    const meBefore = await request(app).get('/api/users/game-state').set(auth('B1'));
    assert.equal(meBefore.body.data.tonSubscription?.active, false);

    const payId = intent.body.payment.id;
    const submit = await request(app)
      .post(`/api/payments/${payId}/submit`)
      .set(auth('B1'))
      .send({ inboundTxHash: 'mock-scenario-a' });
    assert.equal(submit.body.payment.status, 'CONFIRMED');

    const me = await request(app).get('/api/users/game-state').set(auth('B1'));
    assert.equal(me.body.data.tonSubscription.active, true);
    const payout = await ReferralTonPayout.findOne({ referrerId: 'A1' });
    assert.ok(payout);
    assert.equal(payout.amountNanoton, intent.body.payment.referrerShareNanoton);
  });
});

describe('Scenario B — no referrer', () => {
  it('treasury-only commission 0 and still activates after settlement', async () => {
    await user('B2');
    await verify('B2', testWallet(22));
    const intent = await request(app).post('/api/payments/intent').set(auth('B2'));
    assert.equal(intent.body.payment.referrerShareNanoton, '0');
    assert.ok(intent.body.payment.contractPayloadBoc);
    const payId = intent.body.payment.id;
    const submit = await request(app)
      .post(`/api/payments/${payId}/submit`)
      .set(auth('B2'))
      .send({ inboundTxHash: 'mock-scenario-b' });
    assert.equal(submit.body.payment.status, 'CONFIRMED');
    assert.equal(await ReferralTonPayout.countDocuments({}), 0);
    const me = await request(app).get('/api/users/game-state').set(auth('B2'));
    assert.equal(me.body.data.tonSubscription.active, true);
  });
});

describe('Scenario C — renewal', () => {
  it('second payment pays no commission and extends expiry once', async () => {
    const ref = await user('A3');
    await verify('A3', testWallet(31));
    await user('B3', { referrerId: 'A3', referredBy: ref.referralCode });
    await verify('B3', testWallet(32));

    const first = await request(app).post('/api/payments/intent').set(auth('B3'));
    await request(app)
      .post(`/api/payments/${first.body.payment.id}/submit`)
      .set(auth('B3'))
      .send({ inboundTxHash: 'mock-scenario-c1' });

    const afterFirst = await User.findOne({ telegramId: 'B3' });
    const expires1 = afterFirst.tonSubscriptionExpiresAt.getTime();

    const second = await request(app).post('/api/payments/intent').set(auth('B3'));
    assert.equal(second.body.payment.commissionEligible, false);
    assert.equal(second.body.payment.referrerShareNanoton, '0');
    await request(app)
      .post(`/api/payments/${second.body.payment.id}/submit`)
      .set(auth('B3'))
      .send({ inboundTxHash: 'mock-scenario-c2' });

    const afterSecond = await User.findOne({ telegramId: 'B3' });
    assert.ok(afterSecond.tonSubscriptionExpiresAt.getTime() > expires1);

    // Reprocessing same payment cannot extend twice
    const before = afterSecond.tonSubscriptionExpiresAt.getTime();
    await request(app)
      .post(`/api/payments/${second.body.payment.id}/confirm`)
      .set(auth('B3'));
    const again = await User.findOne({ telegramId: 'B3' });
    assert.equal(again.tonSubscriptionExpiresAt.getTime(), before);

    assert.equal(await ReferralTonPayout.countDocuments({}), 1);
  });
});

describe('Scenario D — tampering / security', () => {
  it('rejects confirm for another user payment (unauthorized)', async () => {
    await user('D1');
    await verify('D1', testWallet(41));
    await user('D2');
    await verify('D2', testWallet(42));
    const intent = await request(app).post('/api/payments/intent').set(auth('D1'));
    const res = await request(app)
      .post(`/api/payments/${intent.body.payment.id}/confirm`)
      .set(auth('D2'));
    assert.equal(res.status, 400);
  });

  it('expired authorization cannot be submitted', async () => {
    await user('D3');
    await verify('D3', testWallet(43));
    const intent = await request(app).post('/api/payments/intent').set(auth('D3'));
    await Payment.findByIdAndUpdate(intent.body.payment.id, {
      expiresAt: new Date(Date.now() - 1000)
    });
    const submit = await request(app)
      .post(`/api/payments/${intent.body.payment.id}/submit`)
      .set(auth('D3'))
      .send({ inboundTxHash: 'mock-expired' });
    assert.equal(submit.status, 400);
    assert.match(submit.body.error, /expired/i);
  });
});

describe('Scenario E — delayed / partial settlement', () => {
  it('partial settlement leaves subscription inactive', async () => {
    const ref = await user('A5');
    await verify('A5', testWallet(51));
    await user('B5', { referrerId: 'A5', referredBy: ref.referralCode });
    await verify('B5', testWallet(52));
    const intent = await request(app).post('/api/payments/intent').set(auth('B5'));
    const payId = intent.body.payment.id;
    await Payment.findByIdAndUpdate(payId, {
      inboundTxHash: 'mock-e-inbound',
      status: 'PROCESSING',
      referrerPayoutTxHash: 'mock-e-ref',
      treasuryPayoutTxHash: 'mock-fail-treasury'
    });
    const confirm = await request(app).post(`/api/payments/${payId}/confirm`).set(auth('B5'));
    assert.equal(confirm.body.payment.status, 'PARTIALLY_SETTLED');
    const me = await request(app).get('/api/users/game-state').set(auth('B5'));
    assert.equal(me.body.data.tonSubscription.active, false);
  });
});

describe('Scenario F — duplicates and concurrency', () => {
  it('duplicate confirm is idempotent; concurrent intents lock commission once', async () => {
    const ref = await user('A6');
    await verify('A6', testWallet(61));
    await user('B6', { referrerId: 'A6', referredBy: ref.referralCode });
    await verify('B6', testWallet(62));

    const [i1, i2] = await Promise.all([
      request(app).post('/api/payments/intent').set(auth('B6')),
      request(app).post('/api/payments/intent').set(auth('B6'))
    ]);
    const eligible = [i1, i2].filter((r) => r.body.payment.commissionEligible);
    assert.equal(eligible.length, 1);

    const payId = eligible[0].body.payment.id;
    await request(app)
      .post(`/api/payments/${payId}/submit`)
      .set(auth('B6'))
      .send({ inboundTxHash: 'mock-f' });
    const c1 = await request(app).post(`/api/payments/${payId}/confirm`).set(auth('B6'));
    const c2 = await request(app).post(`/api/payments/${payId}/confirm`).set(auth('B6'));
    assert.equal(c1.body.payment.status, 'CONFIRMED');
    assert.equal(c2.body.alreadyConfirmed, true);
    assert.equal(await ReferralTonPayout.countDocuments({}), 1);
  });
});

describe('Scenario G — persistence', () => {
  it('status persists across re-fetch; client cannot force active', async () => {
    await user('B7');
    await verify('B7', testWallet(72));
    const intent = await request(app).post('/api/payments/intent').set(auth('B7'));
    await request(app)
      .post(`/api/payments/${intent.body.payment.id}/submit`)
      .set(auth('B7'))
      .send({ inboundTxHash: 'mock-g' });

    const me1 = await request(app).get('/api/users/game-state').set(auth('B7'));
    assert.equal(me1.body.data.tonSubscription.active, true);
    const expires = me1.body.data.tonSubscription.expiresAt;

    // Re-login style fetch
    const me2 = await request(app).get('/api/users/game-state').set(auth('B7'));
    assert.equal(me2.body.data.tonSubscription.active, true);
    assert.equal(me2.body.data.tonSubscription.expiresAt, expires);

    // game-state update cannot set subscription fields (not in allowlist)
    const inject = await request(app)
      .post('/api/users/game-state')
      .set(auth('B7'))
      .send({ tonSubscriptionActive: false, points: 999999 });
    assert.ok(inject.status === 400 || inject.body.data?.points !== 999999);
    const me3 = await request(app).get('/api/users/game-state').set(auth('B7'));
    assert.equal(me3.body.data.tonSubscription.active, true);
  });
});
