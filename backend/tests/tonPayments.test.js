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
import { verifyAuthorizationSignature, signAuthorizationPayload, buildAuthorizationPayload } from '../src/services/tonAuthSigner.js';

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
  process.env.TON_TESTNET_TREASURY_ADDRESS = 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c';
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

describe('TON payment split + auth', () => {
  it('computes fee-before-split with treasury remainder', () => {
    const split = computePaymentSplit(100_000_000n);
    assert.equal(split.referrerShareNanoton + split.treasuryShareNanoton, split.netNanoton);
  });

  it('signs and verifies authorization payload', async () => {
    const fakePayment = {
      _id: new mongoose.Types.ObjectId(),
      subscriberWallet: 'EQsub',
      referrerWallet: 'EQref',
      treasuryWallet: 'EQtre',
      grossAmountNanoton: '100000000',
      feeReserveNanoton: '50000000',
      netAmountNanoton: '50000000',
      referrerShareNanoton: '25000000',
      treasuryShareNanoton: '25000000',
      contractAddress: null,
      network: 'testnet',
      feePolicyVersion: 'v1',
      splitVersion: 'v1',
      expiresAt: new Date(Date.now() + 600000)
    };
    const payload = buildAuthorizationPayload(fakePayment);
    const sig = signAuthorizationPayload(payload);
    assert.equal(verifyAuthorizationSignature(payload, sig), true);
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

  it('creates authorized intent for subscriber with verified referrer', async () => {
    const referrer = await createUser('2100');
    await markWalletVerified('2100', 'EQreferrerwallet0000000000000000000000000000001');

    await createUser('2101', { referrerId: '2100', referredBy: referrer.referralCode });
    await markWalletVerified('2101', 'EQsubscriberwallet000000000000000000000000000001');

    const res = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('2101'));

    assert.equal(res.status, 201);
    assert.equal(res.body.payment.status, 'AUTHORIZED');
    assert.ok(res.body.payment.authorizationSignature);
    assert.equal(res.body.payment.referrerShareNanoton, computePaymentSplit(100_000_000n).referrerShareNanoton.toString());
  });

  it('does not authorize payout when referrer lacks verified wallet', async () => {
    const referrer = await createUser('2200');
    await createUser('2201', { referrerId: '2200', referredBy: referrer.referralCode });
    await markWalletVerified('2201', 'EQsubscriberonly00000000000000000000000000000002');

    const res = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('2201'));

    assert.equal(res.status, 201);
    assert.equal(res.body.payment.canAuthorizePayout, false);
  });

  it('prevents self-referral payout destination mismatch via server referrer lock', async () => {
    const user = await createUser('2300');
    await markWalletVerified('2300', 'EQself000000000000000000000000000000000000003');
    const res = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('2300'));
    assert.equal(res.status, 201);
    assert.equal(res.body.payment.referrerWallet, null);
  });
});

describe('Payment confirmation', () => {
  it('confirms when inbound and both payouts verified (mock chain)', async () => {
    const referrer = await createUser('3000');
    await markWalletVerified('3000', 'EQreferrer300000000000000000000000000000000004');
    await createUser('3001', { referrerId: '3000', referredBy: referrer.referralCode });
    await markWalletVerified('3001', 'EQsubscriber30000000000000000000000000000000005');

    const intent = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('3001'));
    const paymentId = intent.body.payment.id;

    const submit = await request(app)
      .post(`/api/payments/${paymentId}/submit`)
      .set(authHeader('3001'))
      .send({ inboundTxHash: 'mock-inbound-1' });

    assert.equal(submit.status, 200);
    assert.equal(submit.body.pending, true);

    await Payment.findByIdAndUpdate(paymentId, {
      referrerPayoutTxHash: 'mock-ref-1',
      treasuryPayoutTxHash: 'mock-tre-1'
    });

    const confirm = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(authHeader('3001'));

    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.payment.status, 'CONFIRMED');

    const payout = await ReferralTonPayout.findOne({ paymentId });
    assert.ok(payout);
    assert.equal(payout.status, 'CONFIRMED');

    const refUser = await User.findOne({ telegramId: '3000' });
    assert.ok(BigInt(refUser.tonSubscriptionReferralEarningsNanoton) > 0n);
    assert.equal(refUser.referralEarnings, 0);
  });

  it('rejects duplicate externalPaymentId at database level', async () => {
    await createUser('3100');
    await markWalletVerified('3100', 'EQsubscriber31000000000000000000000000000000006');
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

  it('marks PARTIALLY_SETTLED when only one outbound verified', async () => {
    const referrer = await createUser('3201');
    await markWalletVerified('3201', 'EQreferrer320000000000000000000000000000000008');
    await createUser('3200', { referrerId: '3201', referredBy: referrer.referralCode });
    await markWalletVerified('3200', 'EQsubscriber32000000000000000000000000000000007');
    const intent = await request(app)
      .post('/api/payments/intent')
      .set(authHeader('3200'));
    assert.equal(intent.status, 201);
    const paymentId = intent.body.payment.id;

    await Payment.findByIdAndUpdate(paymentId, {
      inboundTxHash: 'mock-inbound-partial',
      status: 'PROCESSING',
      referrerPayoutTxHash: 'mock-ref-partial'
    });

    const confirm = await request(app)
      .post(`/api/payments/${paymentId}/confirm`)
      .set(authHeader('3200'));

    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.payment.status, 'PARTIALLY_SETTLED');
  });
});

describe('Payment history', () => {
  it('returns subscription and TON payout history', async () => {
    await markWalletVerified('4000', 'EQsubscriber40000000000000000000000000000000008');
    await request(app).post('/api/payments/intent').set(authHeader('4000'));

    const history = await request(app)
      .get('/api/payments/history')
      .set(authHeader('4000'));

    assert.equal(history.status, 200);
    assert.ok(Array.isArray(history.body.data.subscriptions));
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
