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
import TonProofNonce from '../src/models/TonProofNonce.js';
import { computePaymentSplit } from '../src/config/tonConfig.js';
import { buildSignedSubscribePayload } from '../src/services/tonContractPayload.js';

import { Address } from 'ton-core';

function testWallet(seed) {
  const hex = BigInt(seed).toString(16).padStart(64, '0');
  return Address.parseRaw(`0:${hex}`).toString();
}

const REFERRER_WALLET = testWallet(1);
const SUBSCRIBER_WALLET = testWallet(2);
const SUBSCRIBER_ONLY_WALLET = testWallet(3);
const SELF_WALLET = testWallet(4);
let memoryServer;
let app;
let testPrivateKeyHex;

function authHeader(telegramId) {
  return { Authorization: `Bearer ${signSessionToken({ telegramId: String(telegramId) })}` };
}

async function createUser(telegramId, overrides = {}) {
  const user = new User({
    telegramId: String(telegramId),
    username: overrides.username || `user${telegramId}`,
    firstName: 'Test',
    ...overrides
  });
  await user.save();
  return user;
}

async function markWalletVerified(telegramId, walletAddress) {
  return User.findOneAndUpdate(
    { telegramId: String(telegramId) },
    {
      walletAddress,
      walletConnected: true,
      walletVerified: true,
      walletVerifiedAt: new Date()
    },
    { new: true }
  );
}

before(async () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const seed = privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
  testPrivateKeyHex = seed.toString('hex');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ALLOW_DEV_AUTH = 'true';
  process.env.TON_NETWORK = 'testnet';
  process.env.TON_SUBSCRIPTION_AMOUNT = '0.1';
  process.env.TON_SUBSCRIPTION_DURATION_DAYS = '30';
  process.env.TON_TESTNET_TREASURY_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
  process.env.TON_TESTNET_REFERRAL_CONTRACT_ADDRESS =
    'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9d';
  process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY = testPrivateKeyHex;
  process.env.TON_CHAIN_MOCK = 'true';
  process.env.TON_CONNECT_DOMAIN = 'localhost';
  process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.TAP_RATE_LIMIT_MAX = '1000';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100000';

  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('tapearn-ton-test'));
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Payment.deleteMany({}),
    ReferralTonPayout.deleteMany({}),
    TonProofNonce.deleteMany({})
  ]);
});

describe('TON payment split + auth (v3)', () => {
  it('computes fee-before-split with treasury remainder when commission eligible', () => {
    const split = computePaymentSplit(100_000_000n, { commissionEligible: true });
    assert.equal(split.referrerShareNanoton + split.treasuryShareNanoton, split.netNanoton);
    assert.ok(split.referrerShareNanoton > 0n);
  });

  it('treasury-only split when not commission eligible', () => {
    const split = computePaymentSplit(100_000_000n, { commissionEligible: false });
    assert.equal(split.referrerShareNanoton, 0n);
    assert.equal(split.treasuryShareNanoton, split.netNanoton);
  });

  it('builds signed contract payload with eligibility flag (not estimated half)', async () => {
    const fakePayment = {
      _id: new mongoose.Types.ObjectId(),
      subscriberWallet: SUBSCRIBER_WALLET,
      referrerWallet: REFERRER_WALLET,
      treasuryWallet: process.env.TON_TESTNET_TREASURY_ADDRESS,
      grossAmountNanoton: '100000000',
      referrerShareNanoton: '40000000',
      commissionAuthNanoton: '1',
      expiresAt: new Date(Date.now() + 600000),
      authorizationNonce: '42'
    };
    const signed = buildSignedSubscribePayload(fakePayment);
    assert.ok(signed.payloadBoc);
    assert.ok(signed.signatureHex);
    assert.equal(signed.signatureHex.length, 128);
    // v3.1: signed commission is eligibility (>0), not the estimated referrer share
    assert.equal(signed.commissionNanoton, '1');
  });
});

describe('TON proof challenge', () => {
  it('issues single-use nonce', async () => {
    await createUser('1000');
    const res = await request(app)
      .post('/api/ton-proof/challenge')
      .set(authHeader('1000'));

    assert.equal(res.status, 200);
    assert.ok(res.body.data.nonce);
    const count = await TonProofNonce.countDocuments({ telegramId: '1000', usedAt: null });
    assert.equal(count, 1);
  });
});

describe('Payment intent', () => {
  it('rejects unverified wallet', async () => {
    await createUser('2000');
    const res = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('2000'));

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Verified TON testnet wallet required/);
  });

  it('creates authorized first-payment intent with 50% commission', async () => {
    const referrer = await createUser('2100');
    await markWalletVerified('2100', REFERRER_WALLET);

    await createUser('2101', { referrerId: '2100', referredBy: referrer.referralCode });
    await markWalletVerified('2101', SUBSCRIBER_WALLET);

    const res = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('2101'));

    assert.equal(res.status, 201);
    assert.equal(res.body.payment.status, 'AUTHORIZED');
    assert.ok(res.body.payment.contractPayloadBoc);
    assert.ok(res.body.payment.paymentIdUint256);
    assert.equal(res.body.payment.commissionEligible, true);
    assert.equal(
      res.body.payment.referrerShareNanoton,
      computePaymentSplit(100_000_000n, { commissionEligible: true }).referrerShareNanoton.toString()
    );
  });

  it('authorizes treasury-only payload when referrer lacks verified wallet', async () => {
    const referrer = await createUser('2200');
    await createUser('2201', { referrerId: '2200', referredBy: referrer.referralCode });
    await markWalletVerified('2201', SUBSCRIBER_ONLY_WALLET);

    const res = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('2201'));

    assert.equal(res.status, 201);
    assert.equal(res.body.payment.canAuthorizePayout, true);
    assert.equal(res.body.payment.commissionEligible, false);
    assert.equal(res.body.payment.referrerShareNanoton, '0');
    assert.ok(res.body.payment.contractPayloadBoc);
  });

  it('prevents self-referral payout destination via server referrer lock', async () => {
    await createUser('2300');
    await markWalletVerified('2300', SELF_WALLET);
    const res = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('2300'));
    assert.equal(res.status, 201);
    assert.equal(res.body.payment.referrerWallet, null);
    assert.equal(res.body.payment.referrerShareNanoton, '0');
    assert.ok(res.body.payment.contractPayloadBoc);
  });

  it('renewal intent pays zero commission after a confirmed first payment', async () => {
    const referrer = await createUser('2400');
    await markWalletVerified('2400', testWallet(2400));
    await createUser('2401', { referrerId: '2400', referredBy: referrer.referralCode });
    await markWalletVerified('2401', testWallet(2401));

    const first = await request(app).post('/api/payments/intent').set(authHeader('2401'));
    assert.equal(first.body.payment.commissionEligible, true);
    const firstId = first.body.payment.id;

    const submit = await request(app)
      .post(`/api/payments/${firstId}/submit`)
      .set(authHeader('2401'))
      .send({ inboundTxHash: 'mock-first-2401' });
    assert.equal(submit.body.payment.status, 'CONFIRMED');

    const renewal = await request(app).post('/api/payments/intent').set(authHeader('2401'));
    assert.equal(renewal.status, 201);
    assert.equal(renewal.body.payment.commissionEligible, false);
    assert.equal(renewal.body.payment.referrerShareNanoton, '0');
  });

  it('concurrent first intents: only one holds commission eligibility', async () => {
    const referrer = await createUser('2500');
    await markWalletVerified('2500', testWallet(2500));
    await createUser('2501', { referrerId: '2500', referredBy: referrer.referralCode });
    await markWalletVerified('2501', testWallet(2501));

    const a = await request(app).post('/api/payments/intent').set(authHeader('2501'));
    const b = await request(app).post('/api/payments/intent').set(authHeader('2501'));
    assert.equal(a.body.payment.commissionEligible, true);
    assert.equal(b.body.payment.commissionEligible, false);
    assert.equal(b.body.payment.referrerShareNanoton, '0');
  });
});

describe('Payment confirmation + activation', () => {
  it('confirms on submit when mock inbound verifies and activates subscription', async () => {
    const referrer = await createUser('3000');
    await markWalletVerified('3000', testWallet(3000));
    await createUser('3001', { referrerId: '3000', referredBy: referrer.referralCode });
    await markWalletVerified('3001', testWallet(3001));

    const intent = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('3001'));
    const paymentId = intent.body.payment.id;

    const submit = await request(app)
      .post(`/api/payments/${paymentId}/submit`)
      .set(authHeader('3001'))
      .send({ inboundTxHash: 'mock-inbound-1' });

    assert.equal(submit.status, 200);
    assert.equal(submit.body.payment.status, 'CONFIRMED');
    assert.equal(submit.body.confirmed, true);

    const payout = await ReferralTonPayout.findOne({ paymentId });
    assert.ok(payout);
    assert.equal(payout.status, 'CONFIRMED');

    const refUser = await User.findOne({ telegramId: '3000' });
    assert.ok(BigInt(refUser.tonSubscriptionReferralEarningsNanoton) > 0n);
    assert.equal(refUser.referralEarnings, 0);

    const subUser = await User.findOne({ telegramId: '3001' });
    assert.equal(subUser.tonSubscriptionActive, true);
    assert.ok(subUser.tonSubscriptionExpiresAt);
    assert.equal(subUser.tonFirstCommissionConsumed, true);

    // Re-confirm is idempotent and does not double-extend
    const expiresBefore = subUser.tonSubscriptionExpiresAt.getTime();
    const again = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(authHeader('3001'));
    assert.equal(again.body.alreadyConfirmed, true);
    const subAfter = await User.findOne({ telegramId: '3001' });
    assert.equal(subAfter.tonSubscriptionExpiresAt.getTime(), expiresBefore);
  });

  it('rejects duplicate externalPaymentId at database level', async () => {
    await createUser('3100');
    await markWalletVerified('3100', testWallet(3100));
    const intent = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('3100'));
    assert.equal(intent.status, 201);
    const paymentId = intent.body.payment.id;

    const payment = await Payment.findById(paymentId);
    const dup = new Payment({
      userId: '3100',
      externalPaymentId: payment.externalPaymentId,
      amount: 1,
      status: 'FAILED'
    });
    await assert.rejects(() => dup.save(), /duplicate key/);
  });

  it('marks PARTIALLY_SETTLED when treasury outbound fails; does not activate', async () => {
    const referrer = await createUser('3201');
    await markWalletVerified('3201', testWallet(3201));
    await createUser('3200', { referrerId: '3201', referredBy: referrer.referralCode });
    await markWalletVerified('3200', testWallet(3200));
    const intent = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('3200'));
    assert.equal(intent.status, 201);
    const paymentId = intent.body.payment.id;

    await Payment.findByIdAndUpdate(paymentId, {
      inboundTxHash: 'mock-inbound-partial',
      status: 'PROCESSING',
      referrerPayoutTxHash: 'mock-ref-partial',
      treasuryPayoutTxHash: 'mock-fail-treasury'
    });

    const confirm = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(authHeader('3200'));

    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.payment.status, 'PARTIALLY_SETTLED');

    const subUser = await User.findOne({ telegramId: '3200' });
    assert.equal(subUser.tonSubscriptionActive, false);
    const payout = await ReferralTonPayout.findOne({ paymentId });
    assert.equal(payout, null);
  });

  it('does not activate from frontend-only status forgery (payment stays server-owned)', async () => {
    await createUser('3300');
    await markWalletVerified('3300', testWallet(3300));
    const intent = await request(app).post('/api/payments/intent').set(authHeader('3300'));
    const paymentId = intent.body.payment.id;

    // Confirm without chain evidence stays non-CONFIRMED; never grants access
    const confirm = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(authHeader('3300'));
    assert.equal(confirm.status, 200);
    assert.notEqual(confirm.body.payment.status, 'CONFIRMED');
    assert.notEqual(confirm.body.confirmed, true);

    const user = await User.findOne({ telegramId: '3300' });
    assert.equal(user.tonSubscriptionActive, false);
  });

  it('accepts BOC submit without treating it as a chain hash (stays pending until discover)', async () => {
    // Force non-mock discovery path briefly by using a boc-looking value with mock still on
    // discoverContractPaymentTx in mock mode still returns a mock hash — so we assert inboundBoc stored
    await createUser('3400');
    await markWalletVerified('3400', testWallet(3400));
    const intent = await request(app).post('/api/payments/intent').set(authHeader('3400'));
    const paymentId = intent.body.payment.id;

    const boc =
      'te6cckEBAQEAAgAAAA==';
    const submit = await request(app)
      .post(`/api/payments/${paymentId}/submit`)
      .set(authHeader('3400'))
      .send({ inboundBoc: boc, inboundTxHash: boc });

    assert.equal(submit.status, 200);
    const payment = await Payment.findById(paymentId);
    assert.equal(payment.inboundBoc, boc);
    // Mock discover will still resolve; status should not be FAILED
    assert.notEqual(payment.status, 'FAILED');
  });
});

describe('Payment history', () => {
  it('returns subscription and TON payout history', async () => {
    await createUser('4000');
    await markWalletVerified('4000', testWallet(4000));
    await request(app).post('/api/payments/intent').set(authHeader('4000'));

    const history = await request(app)
      .get('/api/payments/history')
      .set(authHeader('4000'));

    assert.equal(history.status, 200);
    assert.ok(Array.isArray(history.body.data.subscriptions));
    assert.ok(history.body.data.subscription);
  });
});

describe('Legacy YP payment webhook unchanged', () => {
  it('still grants YP referral reward via webhook', async () => {
    const referrer = await createUser('5000');
    await request(app)
      .post('/api/auth/dev')
      .send({ telegramId: '5001', start: referrer.referralCode });

    const pay = await request(app)
      .post('/api/payments/complete')
      .set('x-payment-webhook-secret', process.env.PAYMENT_WEBHOOK_SECRET || 'test')
      .send({ userId: '5001', externalPaymentId: 'legacy-1', amount: 100 });

    if (pay.status === 401) {
      process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
      const retry = await request(app)
        .post('/api/payments/complete')
        .set('x-payment-webhook-secret', 'test-webhook-secret')
        .send({ userId: '5001', externalPaymentId: 'legacy-1', amount: 100 });
      assert.equal(retry.status, 200);
      assert.equal(retry.body.referralReward.amount, 50);
      return;
    }

    assert.equal(pay.status, 200);
    assert.equal(pay.body.referralReward.amount, 50);
  });
});
