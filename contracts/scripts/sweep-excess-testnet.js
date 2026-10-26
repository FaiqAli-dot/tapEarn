#!/usr/bin/env node
/**
 * Signer-authorized sweep_excess on TESTNET V3.1 router → treasury.
 * Secrets from env / .secrets — never printed.
 */
import {
  Address,
  beginCell,
  Cell,
  external,
  internal,
  SendMode,
  storeMessage,
} from '@ton/core';
import { mnemonicToPrivateKey, keyPairFromSeed, sign } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const OP_SWEEP_EXCESS = 0x7a3e91d0;
const TESTNET_RPC = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const TESTNET_REST = 'https://testnet.toncenter.com/api/v2';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const OUT = path.join(root, '.secrets', 'sweep-excess-results.json');

let lastRpc = 0;
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function toncenter(method, params = {}) {
  const wait = Math.max(0, 1300 - (Date.now() - lastRpc));
  if (wait) await sleep(wait);
  for (let a = 0; a < 20; a++) {
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
  throw new Error(`rate ${method}`);
}

async function get(pathName, q) {
  const wait = Math.max(0, 1300 - (Date.now() - lastRpc));
  if (wait) await sleep(wait);
  lastRpc = Date.now();
  const url = new URL(`${TESTNET_REST}/${pathName}`);
  Object.entries(q).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const json = await (await fetch(url)).json();
  if (!json.ok) throw new Error(json.error || json.result);
  return json.result;
}

function loadSecrets() {
  const secretsPath = path.join(root, '.secrets', 'ton-testnet-wallets.json');
  if (!existsSync(secretsPath)) throw new Error('missing .secrets/ton-testnet-wallets.json');
  const secrets = JSON.parse(readFileSync(secretsPath, 'utf8'));
  return {
    deployerMnemonic: process.env.TON_DEPLOYER_MNEMONIC || secrets.wallets.deployer.mnemonic,
    signerPrivateKeyHex: (process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY || secrets.signer.privateKeyHex).replace(
      /^0x/,
      ''
    ),
    treasuryAddress: process.env.TON_TESTNET_TREASURY_ADDRESS || secrets.wallets.treasury.address,
    contractAddress: process.env.TON_TESTNET_REFERRAL_CONTRACT_ADDRESS,
  };
}

function buildSweepBody({ sweepId, minLeaveNanoton, expiryUnix, nonce, signerSeed }) {
  const authCell = beginCell()
    .storeUint(OP_SWEEP_EXCESS, 32)
    .storeUint(sweepId, 256)
    .storeCoins(minLeaveNanoton)
    .storeUint(expiryUnix, 64)
    .storeUint(nonce, 64)
    .endCell();
  const sig = sign(authCell.hash(), keyPairFromSeed(Buffer.from(signerSeed, 'hex')).secretKey);
  const sigPart = beginCell().storeUint(BigInt(`0x${sig.toString('hex')}`), 512).endCell();
  return beginCell()
    .storeUint(OP_SWEEP_EXCESS, 32)
    .storeUint(sweepId, 256)
    .storeCoins(minLeaveNanoton)
    .storeUint(expiryUnix, 64)
    .storeUint(nonce, 64)
    .storeRef(sigPart)
    .endCell();
}

async function main() {
  const secrets = loadSecrets();
  if (!secrets.contractAddress) throw new Error('TON_TESTNET_REFERRAL_CONTRACT_ADDRESS required');

  const deployerKey = await mnemonicToPrivateKey(secrets.deployerMnemonic.split(' '));
  const deployerWallet = WalletContractV4.create({ workchain: 0, publicKey: deployerKey.publicKey });
  const deployerAddr = deployerWallet.address.toString({ bounceable: true, testOnly: true });
  const contractStr = secrets.contractAddress;
  const treasury = secrets.treasuryAddress;

  const contractBefore = BigInt(await get('getAddressBalance', { address: contractStr }));
  const treasuryBefore = BigInt(await get('getAddressBalance', { address: treasury }));
  const deployerBal = BigInt(await get('getAddressBalance', { address: deployerAddr }));

  // Leave enough for storage + future ops (exec reserve scale)
  const minLeave = BigInt(process.env.TON_SWEEP_MIN_LEAVE_NANOTON || '10000000'); // 0.01 TON
  if (contractBefore <= minLeave + 5_000_000n) {
    const report = {
      status: 'NOTHING_TO_SWEEP',
      network: 'testnet',
      contractAddress: contractStr,
      contractBalanceNanoton: contractBefore.toString(),
      minLeaveNanoton: minLeave.toString(),
    };
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const sweepMsgValue = BigInt(process.env.TON_SWEEP_MSG_VALUE_NANOTON || '25000000');
  if (deployerBal < sweepMsgValue + 5_000_000n) {
    const report = {
      status: 'INSUFFICIENT_DEPLOYER_BALANCE',
      network: 'testnet',
      deployerAddress: deployerWallet.address.toString({ bounceable: false, testOnly: true }),
      deployerBalanceNanoton: deployerBal.toString(),
      requiredNanoton: (sweepMsgValue + 5_000_000n).toString(),
      shortfallNanoton: (sweepMsgValue + 5_000_000n - deployerBal).toString(),
    };
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  const sweepId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
  const expiryUnix = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const nonce = BigInt(Math.floor(Math.random() * 1e12));
  const body = buildSweepBody({
    sweepId,
    minLeaveNanoton: minLeave,
    expiryUnix,
    nonce,
    signerSeed: secrets.signerPrivateKeyHex,
  });

  const info = await toncenter('getWalletInformation', { address: deployerAddr });
  const seqno = Number(info.seqno ?? 0);
  const transfer = deployerWallet.createTransfer({
    seqno,
    secretKey: deployerKey.secretKey,
    messages: [
      internal({
        to: Address.parse(contractStr),
        value: sweepMsgValue, // cover sweep compute + fwd
        body,
        bounce: true,
      }),
    ],
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  const ext = external({
    to: deployerWallet.address,
    init: seqno === 0 ? deployerWallet.init : undefined,
    body: transfer,
  });
  const boc = beginCell().store(storeMessage(ext)).endCell().toBoc().toString('base64');
  await toncenter('sendBoc', { boc });

  let txHash = null;
  let outs = [];
  const lo = sweepMsgValue - 5_000_000n;
  const hi = sweepMsgValue + 5_000_000n;
  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    const txs = await toncenter('getTransactions', { address: contractStr, limit: 8 });
    for (const tx of txs || []) {
      // Match inbound value near sweepMsgValue from deployer
      const val = BigInt(tx.in_msg?.value || 0);
      if (val < lo || val > hi) continue;
      const src = tx.in_msg?.source || '';
      try {
        if (
          src &&
          Address.parse(src).toRawString() !==
            Address.parse(deployerAddr).toRawString()
        ) {
          continue;
        }
      } catch {
        continue;
      }
      txHash = tx.transaction_id?.hash || null;
      outs = (tx.out_msgs || []).map((o) => ({
        dest: o.destination,
        value: o.value,
        bounced: o.bounced,
      }));
      break;
    }
    if (txHash) break;
  }

  await sleep(5000);
  const contractAfter = BigInt(await get('getAddressBalance', { address: contractStr }));
  const treasuryAfter = BigInt(await get('getAddressBalance', { address: treasury }));

  const report = {
    status: txHash && outs.length > 0 ? 'SWEPT' : 'PENDING_OR_FAILED',
    network: 'testnet',
    contractAddress: contractStr,
    treasuryAddress: treasury,
    sweepId: sweepId.toString(),
    minLeaveNanoton: minLeave.toString(),
    txHash,
    explorer: txHash ? `https://testnet.tonscan.org/tx/${encodeURIComponent(txHash)}` : null,
    outs,
    contractBefore: contractBefore.toString(),
    contractAfter: contractAfter.toString(),
    treasuryBefore: treasuryBefore.toString(),
    treasuryAfter: treasuryAfter.toString(),
    treasuryDelta: (treasuryAfter - treasuryBefore).toString(),
    contractDelta: (contractAfter - contractBefore).toString(),
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
