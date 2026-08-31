#!/usr/bin/env node
/** Send one testnet payment against deployed contract (payment-only helper). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Address,
  beginCell,
  Cell,
  contractAddress,
  external,
  internal,
  SendMode,
  storeMessage,
  toNano,
} from '@ton/core';
import { WalletContractV4 } from '@ton/ton';
import { mnemonicToPrivateKey, keyPairFromSeed, sign } from '@ton/crypto';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RPC = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const OP = 0x591a2b3c;
let lastRpc = 0;

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function tc(method, params = {}) {
  const wait = Math.max(0, 1300 - (Date.now() - lastRpc));
  if (wait) await sleep(wait);
  lastRpc = Date.now();
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(JSON.stringify(json));
  return json.result;
}

function buildBody({ paymentId, subscriber, referrer, gross, feeReserve, expiry, signerSeed }) {
  const authCell = beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(gross)
    .storeCoins(feeReserve)
    .storeUint(expiry, 64)
    .endCell();
  const sig = sign(authCell.hash(), keyPairFromSeed(Buffer.from(signerSeed, 'hex')).secretKey);
  const authPart = beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(gross)
    .storeCoins(feeReserve)
    .storeUint(expiry, 64)
    .endCell();
  const sigPart = beginCell().storeUint(BigInt(`0x${sig.toString('hex')}`), 512).endCell();
  return beginCell()
    .storeUint(OP, 32)
    .storeSlice(authPart.asSlice())
    .storeRef(sigPart)
    .endCell();
}

async function sendBoc(wallet, secretKey, messages) {
  const seqno = Number((await tc('getWalletInformation', { address: wallet.address.toString() })).seqno);
  const transfer = wallet.createTransfer({ seqno, secretKey, messages, sendMode: SendMode.PAY_GAS_SEPARATELY });
  const ext = external({ to: wallet.address, init: seqno === 0 ? wallet.init : undefined, body: transfer });
  const boc = beginCell().store(storeMessage(ext)).endCell().toBoc().toString('base64');
  await tc('sendBoc', { boc });
}

const secrets = JSON.parse(readFileSync(path.join(ROOT, '.deploy-secrets.json'), 'utf8'));
const compiled = JSON.parse(readFileSync(path.join(ROOT, 'build/ReferralPayment.compiled.json'), 'utf8'));
const code = Cell.fromBoc(Buffer.from(compiled.hex, 'hex'))[0];
const initData = beginCell()
  .storeAddress(Address.parse(secrets.deployer.address))
  .storeAddress(Address.parse(secrets.treasury.address))
  .storeUint(BigInt(secrets.signer.publicKeyUint256), 256)
  .storeUint(0, 1)
  .storeDict(null)
  .endCell();
const contract = contractAddress(0, { code, data: initData });

const deployerKey = await mnemonicToPrivateKey(secrets.deployer.mnemonic.split(' '));
const deployerWallet = WalletContractV4.create({ workchain: 0, publicKey: deployerKey.publicKey });
const referrerKey = await mnemonicToPrivateKey(secrets.testWallets.referrer.mnemonic.split(' '));
const referrerWallet = WalletContractV4.create({ workchain: 0, publicKey: referrerKey.publicKey });

const gross = 85_000_000n; // deployer balance insufficient for 0.1 TON; use 0.085 for live split proof
const fee = 50_000_000n;
const paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
const body = buildBody({
  paymentId,
  subscriber: deployerWallet.address,
  referrer: referrerWallet.address,
  gross,
  feeReserve: fee,
  expiry,
  signerSeed: secrets.signer.privateKeyHex,
});

const treBefore = BigInt(await tc('getAddressBalance', { address: secrets.treasury.address }));
const refBefore = BigInt(await tc('getAddressBalance', { address: secrets.testWallets.referrer.address }));

await sendBoc(deployerWallet, deployerKey.secretKey, [
  internal({ to: contract, value: gross, body, bounce: true }),
]);

await sleep(20000);

const treAfter = BigInt(await tc('getAddressBalance', { address: secrets.treasury.address }));
const refAfter = BigInt(await tc('getAddressBalance', { address: secrets.testWallets.referrer.address }));
const txs = await tc('getTransactions', { address: contract.toString({ testOnly: true, bounceable: false }), limit: 1 });
const txHash = txs[0]?.transaction_id?.hash;
const processed = await tc('runGetMethod', {
  address: contract.toString({ testOnly: true, bounceable: false }),
  method: 'get_payment_processed',
  stack: [['num', paymentId.toString()]],
});

console.log(JSON.stringify({
  contract: contract.toString({ testOnly: true, bounceable: false }),
  paymentId: paymentId.toString(),
  grossNanoton: gross.toString(),
  feeReserveNanoton: fee.toString(),
  expectedReferrerPayout: '25000000',
  expectedTreasuryPayout: '25000000',
  referrerBalanceDelta: (refAfter - refBefore).toString(),
  treasuryBalanceDelta: (treAfter - treBefore).toString(),
  processedExitCode: processed.exit_code,
  processedValue: processed.stack?.[0]?.[1],
  txHash,
  explorer: `https://testnet.tonscan.org/tx/${txHash}`,
}, null, 2));
