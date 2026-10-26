#!/usr/bin/env node
/**
 * Run scenario C only against TON_TESTNET_REFERRAL_CONTRACT_ADDRESS and merge results.
 * Never prints secrets.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Address, beginCell, Cell, external, internal, storeMessage } from 'ton-core';
import { mnemonicToPrivateKey } from 'ton-crypto';
import Ton from 'ton';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/middleware/auth.js';
import User from '../src/models/User.js';
import ReferralTonPayout from '../src/models/ReferralTonPayout.js';

const { WalletContractV4 } = Ton;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const secrets = JSON.parse(readFileSync(path.join(root, '.secrets/ton-testnet-wallets.json'), 'utf8'));
const OUT = path.join(root, '.secrets/live-e2e-results.json');
const CONTRACT = process.env.TON_TESTNET_REFERRAL_CONTRACT_ADDRESS;
if (!CONTRACT) {
  console.error('TON_TESTNET_REFERRAL_CONTRACT_ADDRESS required');
  process.exit(2);
}

process.env.TON_NETWORK = 'testnet';
process.env.TON_TESTNET_TREASURY_ADDRESS =
  process.env.TON_TESTNET_TREASURY_ADDRESS || secrets.wallets.treasury.address;
process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY =
  process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY || secrets.signer.privateKeyHex;
process.env.TON_PAYMENT_SIGNER_PUBLIC_KEY =
  process.env.TON_PAYMENT_SIGNER_PUBLIC_KEY || secrets.signer.publicKeyHex;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'live-e2e-jwt-secret';
process.env.ALLOW_DEV_AUTH = 'true';
process.env.TON_SUBSCRIPTION_AMOUNT = process.env.TON_SUBSCRIPTION_AMOUNT || '0.1';
process.env.TON_SUBSCRIPTION_DURATION_DAYS = process.env.TON_SUBSCRIPTION_DURATION_DAYS || '30';
delete process.env.TON_CHAIN_MOCK;

const TESTNET_RPC = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const TESTNET_REST = 'https://testnet.toncenter.com/api/v2';
let lastRpc = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function toncenter(method, params = {}) {
  const wait = Math.max(0, 1500 - (Date.now() - lastRpc));
  if (wait) await sleep(wait);
  for (let a = 0; a < 25; a++) {
    lastRpc = Date.now();
    const res = await fetch(TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    });
    const json = await res.json();
    if (res.status === 429 || String(json.error || json.result || '').includes('Ratelimit')) {
      await sleep(2000 * (a + 1));
      continue;
    }
    if (json.error) throw new Error(JSON.stringify(json.error));
    if (json.ok === false) throw new Error(String(json.result));
    return json.result;
  }
  throw new Error('rate');
}

async function get(pathName, q) {
  const wait = Math.max(0, 1500 - (Date.now() - lastRpc));
  if (wait) await sleep(wait);
  lastRpc = Date.now();
  const url = new URL(`${TESTNET_REST}/${pathName}`);
  Object.entries(q).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const json = await (await fetch(url)).json();
  if (!json.ok) throw new Error(json.error || json.result);
  return json.result;
}

async function bal(addr) {
  return BigInt(await get('getAddressBalance', { address: addr }));
}

function auth(telegramId) {
  return { Authorization: `Bearer ${signSessionToken({ telegramId: String(telegramId) })}` };
}

async function api(app, method, urlPath, telegramId, body) {
  const { default: request } = await import('supertest');
  let req = request(app)[method](urlPath).set(auth(telegramId));
  if (body) req = req.send(body);
  return req;
}

async function walletFromMnemonic(mnemonic) {
  const key = await mnemonicToPrivateKey(mnemonic.split(' '));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  return { key, wallet, address: wallet.address.toString({ bounceable: false, testOnly: true }) };
}

async function sendFromWallet(wallet, secretKey, messages) {
  const addr = wallet.address.toString({ bounceable: true, testOnly: true });
  const info = await toncenter('getWalletInformation', { address: addr });
  const seqno = Number(info.seqno ?? 0);
  const transfer = wallet.createTransfer({ seqno, secretKey, messages, sendMode: 3 });
  const ext = external({ to: wallet.address, body: transfer });
  const boc = beginCell().store(storeMessage(ext)).endCell().toBoc().toString('base64');
  await toncenter('sendBoc', { boc });
  for (let i = 0; i < 40; i++) {
    await sleep(2000);
    const n = Number((await toncenter('getWalletInformation', { address: addr })).seqno ?? 0);
    if (n > seqno) break;
  }
}

async function findContractTx({ sender, valueNanoton, afterMs }) {
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const txs = await toncenter('getTransactions', { address: CONTRACT, limit: 15 });
    for (const tx of txs || []) {
      const utime = (tx.utime || 0) * 1000;
      if (afterMs && utime + 5000 < afterMs) continue;
      const val = BigInt(tx.in_msg?.value || 0);
      const src = tx.in_msg?.source || '';
      if (val !== BigInt(valueNanoton)) continue;
      if (src && sender) {
        try {
          if (Address.parse(src).toRawString() !== Address.parse(sender).toRawString()) continue;
        } catch {
          continue;
        }
      }
      return { hash: tx.transaction_id?.hash, outMsgs: tx.out_msgs || [] };
    }
  }
  return null;
}

async function pay(sub, payment) {
  const body = Cell.fromBoc(Buffer.from(payment.contractPayloadBoc, 'base64'))[0];
  const amount = BigInt(payment.grossAmountNanoton);
  const started = Date.now();
  await sendFromWallet(sub.wallet, sub.key.secretKey, [
    internal({ to: Address.parse(CONTRACT), value: amount, body, bounce: true }),
  ]);
  return findContractTx({ sender: sub.address, valueNanoton: amount, afterMs: started - 2000 });
}

async function confirmUntil(app, paymentId, telegramId) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < 120000) {
    const res = await api(app, 'post', `/api/payments/${paymentId}/confirm`, telegramId);
    last = res.body;
    if (res.body?.payment?.status === 'CONFIRMED') return res.body;
    await sleep(4000);
  }
  return last;
}

async function main() {
  const memory = await MongoMemoryServer.create();
  await mongoose.connect(memory.getUri('c-only'));
  const app = createApp();
  const subRen = await walletFromMnemonic(secrets.wallets.subscriberRenewal.mnemonic);
  const refA = await walletFromMnemonic(secrets.wallets.referrerA.mnemonic);

  const referrer = await User.create({ telegramId: '900004', username: 'refc', firstName: 'R' });
  await User.findOneAndUpdate(
    { telegramId: '900004' },
    {
      walletAddress: refA.address,
      walletVerified: true,
      walletConnected: true,
      walletVerifiedAt: new Date(),
    }
  );
  await User.create({
    telegramId: '900005',
    username: 'renc',
    firstName: 'S',
    referrerId: '900004',
    referredBy: referrer.referralCode,
  });
  await User.findOneAndUpdate(
    { telegramId: '900005' },
    {
      walletAddress: subRen.address,
      walletVerified: true,
      walletConnected: true,
      walletVerifiedAt: new Date(),
    }
  );

  const firstIntent = await api(app, 'post', '/api/payments/intent', '900005');
  const firstPay = firstIntent.body.payment;
  const firstTx = await pay(subRen, firstPay);
  if (!firstTx?.hash) throw new Error('first tx missing');
  await api(app, 'post', `/api/payments/${firstPay.id}/submit`, '900005', {
    inboundTxHash: firstTx.hash,
  });
  await confirmUntil(app, firstPay.id, '900005');
  const afterFirst = await User.findOne({ telegramId: '900005' });
  const exp1 = afterFirst.tonSubscriptionExpiresAt.getTime();
  const payoutCount1 = await ReferralTonPayout.countDocuments({ referredUserId: '900005' });
  const refBefore = await bal(refA.address);

  const secondIntent = await api(app, 'post', '/api/payments/intent', '900005');
  const secondPay = secondIntent.body.payment;
  if (secondPay.commissionEligible || secondPay.referrerShareNanoton !== '0') {
    throw new Error('renewal still has commission');
  }
  const secondTx = await pay(subRen, secondPay);
  if (!secondTx?.hash) throw new Error('renewal tx missing');
  await api(app, 'post', `/api/payments/${secondPay.id}/submit`, '900005', {
    inboundTxHash: secondTx.hash,
  });
  await confirmUntil(app, secondPay.id, '900005');
  const afterSecond = await User.findOne({ telegramId: '900005' });
  const refAfter = await bal(refA.address);
  const payoutCount2 = await ReferralTonPayout.countDocuments({ referredUserId: '900005' });

  const scenarioC = {
    result:
      secondPay.referrerShareNanoton === '0' &&
      afterSecond.tonSubscriptionExpiresAt.getTime() > exp1 &&
      payoutCount2 === payoutCount1 &&
      refAfter <= refBefore + 1000n
        ? 'PASS'
        : 'FAIL',
    firstTx: firstTx.hash,
    renewalTx: secondTx.hash,
    firstExplorer: `https://testnet.tonscan.org/tx/${encodeURIComponent(firstTx.hash)}`,
    renewalExplorer: `https://testnet.tonscan.org/tx/${encodeURIComponent(secondTx.hash)}`,
    referrerDeltaRenewal: (refAfter - refBefore).toString(),
    expiryExtended: afterSecond.tonSubscriptionExpiresAt.getTime() > exp1,
    commissionPayoutCount: payoutCount2,
  };
  console.log('C', scenarioC.result, scenarioC.renewalTx);

  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { scenarios: {}, feeScenarios: {} };
  prev.contractAddress = CONTRACT;
  prev.scenarios = prev.scenarios || {};
  prev.scenarios.C = scenarioC;
  prev.feeScenarios = prev.feeScenarios || {};
  prev.feeScenarios.renewal_no_commission = {
    result: scenarioC.result,
    renewalTx: scenarioC.renewalTx,
    referrerDeltaRenewal: scenarioC.referrerDeltaRenewal,
    note: 'Renewal pays no commission',
  };
  prev.balances = {
    deployer: (await bal(secrets.wallets.deployer.address)).toString(),
    treasury: (await bal(secrets.wallets.treasury.address)).toString(),
    referrerA: (await bal(refA.address)).toString(),
    subscriberB: (await bal(secrets.wallets.subscriberB.address)).toString(),
    subscriberNoRef: (await bal(secrets.wallets.subscriberNoRef.address)).toString(),
    subscriberRenewal: (await bal(subRen.address)).toString(),
    contract: (await bal(CONTRACT)).toString(),
    oldV3Preserved: (await bal('0QB0YFU64VFWC5H7cgvVUSxmuS8FOB5JGPEYpzZBhRUUZEj4')).toString(),
  };
  prev.finishedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(prev, null, 2));
  console.log(
    JSON.stringify(
      {
        C: scenarioC.result,
        feeRenewal: prev.feeScenarios.renewal_no_commission.result,
        balances: prev.balances,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
  await memory.stop();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
