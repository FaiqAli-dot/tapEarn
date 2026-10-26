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
import {
  EXEC_RESERVE_NANOTON,
  computePaymentSplit,
  reconcileNetSplit
} from '../src/config/tonConfig.js';
import { buildSignedSubscribePayload } from '../src/services/tonContractPayload.js';
import { Address } from 'ton-core';

function testWallet(seed) {
  const hex = BigInt(seed).toString(16).padStart(64, '0');
  return Address.parseRaw(`0:${hex}`).toString();
}

let memoryServer;
let app;
let testPrivateKeyHex;

function auth(telegramId) {
  return { Authorization: `Bearer ${signSessionToken({ telegramId: String(telegramId) })}` };
}

async function createUser(telegramId, overrides = {}) {
  return new User({
    telegramId: String(telegramId),
    username: `u${telegramId}`,
    firstName: 'T',
    ...overrides
  }).save();
}

async function verify(telegramId, wallet) {
  return User.findOneAndUpdate(
    { telegramId: String(telegramId) },
    {
      walletAddress: wallet,
      walletConnected: true,
      walletVerified: true,
      walletVerifiedAt: new Date()
    },
    { new: true }
  );
}

before(async () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  testPrivateKeyHex = privateKey
    .export({ type: 'pkcs8', format: 'der' })
    .subarray(-32)
    .toString('hex');
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
  delete process.env.TON_TESTNET_FWD_FEE_NANOTON;
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('fee-aware'));
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
    ReferralTonPayout.deleteMany({})
  ]);
});

describe('Fee-aware split math', () => {
  it('accounts every nanoton: reserve + fees + shares == gross', () => {
    for (const eligible of [true, false]) {
      for (const fwd of [0n, 1n, 44_446n, 2_500_000n, 8_000_000n]) {
        const split = computePaymentSplit(100_000_000n, {
          commissionEligible: eligible,
          forwardFeePerMessageNanoton: fwd
        });
        assert.equal(
          split.executionReserveNanoton +
            split.outgoingFeesNanoton +
            split.referrerShareNanoton +
            split.treasuryShareNanoton,
          split.grossNanoton
        );
      }
    }
  });

  it('odd net: floor to referrer, remainder to treasury', () => {
    const split = computePaymentSplit(101_000_001n, {
      commissionEligible: true,
      forwardFeePerMessageNanoton: 0n
    });
    // net = gross - EXEC only
    const net = 101_000_001n - EXEC_RESERVE_NANOTON;
    assert.equal(split.referrerShareNanoton, net / 2n);
    assert.equal(split.treasuryShareNanoton, net - net / 2n);
    if (net % 2n === 1n) {
      assert.equal(split.treasuryShareNanoton, split.referrerShareNanoton + 1n);
    }
  });

  it('zero forward-fee estimate still reserves exec and splits remainder 50/50', () => {
    const split = computePaymentSplit(100_000_000n, {
      commissionEligible: true,
      forwardFeePerMessageNanoton: 0n
    });
    assert.equal(split.outgoingFeesNanoton, 0n);
    assert.equal(split.executionReserveNanoton, EXEC_RESERVE_NANOTON);
    assert.equal(split.referrerShareNanoton, split.treasuryShareNanoton);
    assert.equal(split.commissionAuthNanoton, 1n);
  });

  it('higher-than-gross fee estimate fails safe (no silent underfund)', () => {
    assert.throws(
      () =>
        computePaymentSplit(10_000_000n, {
          commissionEligible: true,
          forwardFeePerMessageNanoton: 20_000_000n
        }),
      /Gross amount must exceed/
    );
  });

  it('reconcileNetSplit accepts equal halves and odd-nano treasury remainder', () => {
    assert.equal(
      reconcileNetSplit({
        referrerValueNanoton: 46143066,
        treasuryValueNanoton: 46143066,
        commissionEligible: true
      }).ok,
      true
    );
    assert.equal(
      reconcileNetSplit({
        referrerValueNanoton: 46143066,
        treasuryValueNanoton: 46143067,
        commissionEligible: true
      }).ok,
      true
    );
    assert.equal(
      reconcileNetSplit({
        referrerValueNanoton: 38250000,
        treasuryValueNanoton: 54036132,
        commissionEligible: true
      }).ok,
      false
    );
  });

  it('no-referrer reconcile: treasury-only net', () => {
    const r = reconcileNetSplit({
      referrerValueNanoton: 0,
      treasuryValueNanoton: 92286132,
      commissionEligible: false
    });
    assert.equal(r.ok, true);
    assert.equal(r.referrerShareNanoton, 0n);
  });
});

describe('Signed auth uses eligibility flag', () => {
  it('signs commission auth value 1 when eligible (not the estimated half as payout)', async () => {
    const fakePayment = {
      _id: new mongoose.Types.ObjectId(),
      subscriberWallet: testWallet(2),
      referrerWallet: testWallet(1),
      treasuryWallet: process.env.TON_TESTNET_TREASURY_ADDRESS,
      grossAmountNanoton: '100000000',
      referrerShareNanoton: '38250000',
      commissionAuthNanoton: '1',
      expiresAt: new Date(Date.now() + 600000),
      authorizationNonce: '42'
    };
    const signed = buildSignedSubscribePayload(fakePayment);
    assert.equal(signed.commissionNanoton, '1');
  });
});

describe('API scenarios (mock chain) remain secure', () => {
  it('referred first purchase confirms and activates once', async () => {
    const ref = await createUser('7001');
    await verify('7001', testWallet(71));
    await createUser('7002', { referrerId: '7001', referredBy: ref.referralCode });
    await verify('7002', testWallet(72));
    const intent = await request(app).post('/api/payments/intent').set(auth('7002'));
    assert.equal(intent.body.payment.commissionEligible, true);
    const submit = await request(app)
      .post(`/api/payments/${intent.body.payment.id}/submit`)
      .set(auth('7002'))
      .send({ inboundTxHash: 'mock-fee-a' });
    assert.equal(submit.body.payment.status, 'CONFIRMED');
    const user = await User.findOne({ telegramId: '7002' });
    assert.equal(user.tonSubscriptionActive, true);
    assert.equal(await ReferralTonPayout.countDocuments({}), 1);
  });

  it('no referrer: treasury-only auth flag 0', async () => {
    await createUser('7003');
    await verify('7003', testWallet(73));
    const intent = await request(app).post('/api/payments/intent').set(auth('7003'));
    assert.equal(intent.body.payment.referrerShareNanoton, '0');
    assert.equal(intent.body.payment.commissionAuthNanoton, '0');
  });

  it('renewal: no commission', async () => {
    const ref = await createUser('7004');
    await verify('7004', testWallet(74));
    await createUser('7005', { referrerId: '7004', referredBy: ref.referralCode });
    await verify('7005', testWallet(75));
    const first = await request(app).post('/api/payments/intent').set(auth('7005'));
    await request(app)
      .post(`/api/payments/${first.body.payment.id}/submit`)
      .set(auth('7005'))
      .send({ inboundTxHash: 'mock-fee-c1' });
    const second = await request(app).post('/api/payments/intent').set(auth('7005'));
    assert.equal(second.body.payment.commissionEligible, false);
    assert.equal(second.body.payment.referrerShareNanoton, '0');
  });

  it('underpayment path still requires inbound evidence (unauthorized inactive)', async () => {
    await createUser('7006');
    await verify('7006', testWallet(76));
    const intent = await request(app).post('/api/payments/intent').set(auth('7006'));
    const confirm = await request(app)
      .post(`/api/payments/${intent.body.payment.id}/confirm`)
      .set(auth('7006'));
    assert.notEqual(confirm.body.payment.status, 'CONFIRMED');
    const user = await User.findOne({ telegramId: '7006' });
    assert.equal(user.tonSubscriptionActive, false);
  });

  it('duplicate confirm does not double-pay', async () => {
    const ref = await createUser('7007');
    await verify('7007', testWallet(77));
    await createUser('7008', { referrerId: '7007', referredBy: ref.referralCode });
    await verify('7008', testWallet(78));
    const intent = await request(app).post('/api/payments/intent').set(auth('7008'));
    const id = intent.body.payment.id;
    await request(app)
      .post(`/api/payments/${id}/submit`)
      .set(auth('7008'))
      .send({ inboundTxHash: 'mock-fee-dup' });
    const c2 = await request(app).post(`/api/payments/${id}/confirm`).set(auth('7008'));
    assert.equal(c2.body.alreadyConfirmed, true);
    assert.equal(await ReferralTonPayout.countDocuments({}), 1);
  });

  it('partial / failed treasury leg never activates', async () => {
    const ref = await createUser('7009');
    await verify('7009', testWallet(79));
    await createUser('7010', { referrerId: '7009', referredBy: ref.referralCode });
    await verify('7010', testWallet(80));
    const intent = await request(app).post('/api/payments/intent').set(auth('7010'));
    const id = intent.body.payment.id;
    await Payment.findByIdAndUpdate(id, {
      inboundTxHash: 'mock-fee-partial',
      status: 'PROCESSING',
      referrerPayoutTxHash: 'mock-ref-ok',
      treasuryPayoutTxHash: 'mock-fail-treasury'
    });
    const confirm = await request(app).post(`/api/payments/${id}/confirm`).set(auth('7010'));
    assert.equal(confirm.body.payment.status, 'PARTIALLY_SETTLED');
    const user = await User.findOne({ telegramId: '7010' });
    assert.equal(user.tonSubscriptionActive, false);
  });
});
