#!/usr/bin/env node
/**
 * Send testnet subscribe payments against the deployed YORZA V2 router.
 * Secrets from env only — never commit mnemonics or .deploy-secrets.json.
 *
 * Usage:
 *   TON_DEPLOYER_MNEMONIC=... TON_PAYMENT_SIGNER_PRIVATE_KEY=... \
 *   TON_TESTNET_REFERRAL_CONTRACT_ADDRESS=0QDb2mg_... \
 *   TON_TESTNET_TREASURY_ADDRESS=0QBVP_... \
 *   node scripts/pay-testnet.js
 *
 * Replay test (same payment_id must bounce):
 *   ... node scripts/pay-testnet.js --replay <paymentId> <nonce> <referrerAddress>
 */
import crypto from 'node:crypto';
import {
  Address,
  beginCell,
  external,
  internal,
  SendMode,
  storeMessage,
} from '@ton/core';
import { WalletContractV4 } from '@ton/ton';
import { keyPairFromSeed, mnemonicNew, mnemonicToPrivateKey, sign } from '@ton/crypto';

const OP_SUBSCRIBE = 0x591a2b3c;
const GROSS_NANOTON = 100_000_000n;
const TESTNET_RPC = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const TESTNET_REST = 'https://testnet.toncenter.com/api/v2';
let lastRpcAt = 0;

function explorerAddr(addr) {
  return `https://testnet.tonscan.org/address/${addr}`;
}

function explorerTx(hash) {
  return `https://testnet.tonscan.org/tx/${hash}`;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function toncenter(method, params = {}) {
  const minGap = 1300;
  const wait = Math.max(0, minGap - (Date.now() - lastRpcAt));
  if (wait) await sleep(wait);

  for (let attempt = 0; attempt < 15; attempt++) {
    lastRpcAt = Date.now();
    const res = await fetch(TESTNET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    });
    const json = await res.json();

    if (
      res.status === 429 ||
      json.code === 429 ||
      json.result === 'Ratelimit exceed' ||
      String(json.error || '').includes('Ratelimit')
    ) {
      await sleep(1500 * (attempt + 1));
      continue;
    }

    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    if (json.ok === false) throw new Error(json.result || `RPC failed: ${method}`);
    return json.result;
  }
  throw new Error(`Rate limit exceeded for ${method}`);
}

async function toncenterGet(path, query = {}) {
  const minGap = 1300;
  const wait = Math.max(0, minGap - (Date.now() - lastRpcAt));
  if (wait) await sleep(wait);
  lastRpcAt = Date.now();
  const url = new URL(`${TESTNET_REST}/${path}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || json.result || `GET ${path} failed`);
  return json.result;
}

async function getBalanceNano(address) {
  return BigInt(await toncenterGet('getAddressBalance', { address }));
}

async function getWalletSeqno(address) {
  const info = await toncenter('getWalletInformation', { address });
  return Number(info.seqno ?? 0);
}

async function sendExternalBoc(wallet, secretKey, messages, init) {
  const seqno = await getWalletSeqno(wallet.address.toString({ bounceable: true, testOnly: true }));
  const transfer = wallet.createTransfer({
    seqno,
    secretKey,
    messages,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
  });
  const ext = external({
    to: wallet.address,
    init: seqno === 0 ? wallet.init : undefined,
    body: transfer,
  });
  const boc = beginCell().store(storeMessage(ext)).endCell().toBoc().toString('base64');
  await toncenter('sendBoc', { boc });
}

function loadSecretsFromEnv() {
  const deployerMnemonic = process.env.TON_DEPLOYER_MNEMONIC;
  const contractAddress = process.env.TON_TESTNET_REFERRAL_CONTRACT_ADDRESS;
  const treasuryAddress = process.env.TON_TESTNET_TREASURY_ADDRESS;
  const signerPrivateKeyHex = process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY?.replace(/^0x/, '');

  if (!deployerMnemonic) throw new Error('TON_DEPLOYER_MNEMONIC is required');
  if (!contractAddress) throw new Error('TON_TESTNET_REFERRAL_CONTRACT_ADDRESS is required');
  if (!treasuryAddress) throw new Error('TON_TESTNET_TREASURY_ADDRESS is required');
  if (!signerPrivateKeyHex) throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is required');

  return { deployerMnemonic, contractAddress, treasuryAddress, signerPrivateKeyHex };
}

/** Match backend/src/services/tonContractPayload.js — buildAuthCell */
function buildAuthCell({ paymentId, subscriber, referrer, amount, expiry, nonce }) {
  return beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(amount)
    .storeUint(expiry, 64)
    .storeUint(nonce, 64)
    .endCell();
}

/** Match backend/src/services/tonContractPayload.js — buildSubscribeMessageBody */
function buildSubscribeBody({ paymentId, subscriber, referrer, amount, expiry, nonce, signerSeed }) {
  const authCell = buildAuthCell({ paymentId, subscriber, referrer, amount, expiry, nonce });
  const seed = Buffer.from(signerSeed, 'hex');
  const sig = sign(authCell.hash(), keyPairFromSeed(seed.length === 64 ? seed.subarray(0, 32) : seed).secretKey);

  const authPart = beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(amount)
    .storeUint(expiry, 64)
    .storeUint(nonce, 64)
    .endCell();

  const sigPart = beginCell().storeUint(BigInt(`0x${sig.toString('hex')}`), 512).endCell();

  return beginCell()
    .storeUint(OP_SUBSCRIBE, 32)
    .storeSlice(authPart.beginParse())
    .storeRef(sigPart)
    .endCell();
}

async function waitForContractTx(contractStr, afterLt, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const txs = await toncenter('getTransactions', { address: contractStr, limit: 5 });
    const match = txs?.find((tx) => BigInt(tx.transaction_id?.lt || 0) > BigInt(afterLt));
    if (match) return match;
    await sleep(5000);
  }
  return null;
}

function parseInboundValue(tx) {
  const inMsg = tx.in_msg;
  if (!inMsg || inMsg.source === '') return null;
  return BigInt(inMsg.value || 0);
}

function parseOutboundDeltas(tx, treasuryStr, referrerStr) {
  const out = { treasury: 0n, referrer: 0n, messages: [] };
  for (const msg of tx.out_msgs || []) {
    const dest = msg.destination || '';
    const value = BigInt(msg.value || 0);
    out.messages.push({ destination: dest, valueNanoton: value.toString() });
    if (dest === treasuryStr) out.treasury += value;
    if (dest === referrerStr) out.referrer += value;
  }
  return out;
}

async function main() {
  const secrets = loadSecretsFromEnv();
  const contractStr = secrets.contractAddress;
  const treasuryStr = secrets.treasuryAddress;
  const contract = Address.parse(contractStr);

  const deployerKey = await mnemonicToPrivateKey(secrets.deployerMnemonic.split(' '));
  const deployerWallet = WalletContractV4.create({ workchain: 0, publicKey: deployerKey.publicKey });
  const deployerStr = deployerWallet.address.toString({ bounceable: false, testOnly: true });

  const balance = await getBalanceNano(deployerStr);
  if (balance < 500_000_000n) {
    console.log(JSON.stringify({
      status: 'INSUFFICIENT_DEPLOYER_BALANCE',
      deployerAddress: deployerStr,
      balanceNanoton: balance.toString(),
      requiredMinNanoton: '500000000',
      explorer: explorerAddr(deployerStr),
    }, null, 2));
    process.exit(2);
  }

  const treasuryCheck = await toncenter('runGetMethod', {
    address: contractStr,
    method: 'get_treasury',
    stack: [],
  });
  if (treasuryCheck.exit_code !== 0 && treasuryCheck.exit_code !== 9) {
    throw new Error(`Contract not active at ${contractStr} (exit ${treasuryCheck.exit_code})`);
  }

  const isReplay = process.argv[2] === '--replay';
  let paymentId;
  let nonce;
  let referrerAddress;
  let referrerStr;

  if (isReplay) {
    paymentId = BigInt(process.argv[3]);
    nonce = BigInt(process.argv[4]);
    referrerStr = process.argv[5];
    referrerAddress = Address.parse(referrerStr);
  } else {
    paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    nonce = BigInt(crypto.randomBytes(8).readBigUInt64BE(0));
    const referrerMnemonic = await mnemonicNew(24);
    const referrerKey = await mnemonicToPrivateKey(referrerMnemonic);
    const referrerWallet = WalletContractV4.create({ workchain: 0, publicKey: referrerKey.publicKey });
    referrerAddress = referrerWallet.address;
    referrerStr = referrerAddress.toString({ bounceable: false, testOnly: true });
  }

  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const body = buildSubscribeBody({
    paymentId,
    subscriber: deployerWallet.address,
    referrer: referrerAddress,
    amount: GROSS_NANOTON,
    expiry,
    nonce,
    signerSeed: secrets.signerPrivateKeyHex,
  });

  const contractBefore = await getBalanceNano(contractStr);
  const treBefore = await getBalanceNano(treasuryStr);
  const refBefore = await getBalanceNano(referrerStr);

  const preTxs = await toncenter('getTransactions', { address: contractStr, limit: 1 });
  const afterLt = preTxs?.[0]?.transaction_id?.lt || '0';

  await sendExternalBoc(deployerWallet, deployerKey.secretKey, [
    internal({ to: contract, value: GROSS_NANOTON, body, bounce: true }),
  ]);

  const tx = await waitForContractTx(contractStr, afterLt);
  if (!tx) throw new Error('Timed out waiting for contract transaction');

  const txHash = tx.transaction_id?.hash;
  const inbound = parseInboundValue(tx);
  const outbound = parseOutboundDeltas(tx, treasuryStr, referrerStr);
  const computeExit = tx.description?.compute_ph?.exit_code;
  const actionExit = tx.description?.action?.result_code;
  const aborted = tx.description?.aborted ?? false;

  await sleep(8000);

  const contractAfter = await getBalanceNano(contractStr);
  const treAfter = await getBalanceNano(treasuryStr);
  const refAfter = await getBalanceNano(referrerStr);

  const processed = await toncenter('runGetMethod', {
    address: contractStr,
    method: 'get_payment_processed',
    stack: [['num', paymentId.toString()]],
  });

  const refDelta = refAfter - refBefore;
  const treDelta = treAfter - treBefore;
  const distributableApprox = refDelta + treDelta;

  console.log(JSON.stringify({
    mode: isReplay ? 'replay' : 'payment',
    network: 'testnet',
    version: 'v2-router',
    contractAddress: contractStr,
    contractExplorer: explorerAddr(contractStr),
    deployerAddress: deployerStr,
    treasuryAddress: treasuryStr,
    treasuryExplorer: explorerAddr(treasuryStr),
    referrerAddress: referrerStr,
    referrerExplorer: explorerAddr(referrerStr),
    paymentId: paymentId.toString(),
    nonce: nonce.toString(),
    grossNanoton: GROSS_NANOTON.toString(),
    txHash,
    txExplorer: txHash ? explorerTx(txHash) : null,
    inboundValueNanoton: inbound?.toString() ?? null,
    referrerReceivedNanoton: refDelta.toString(),
    treasuryReceivedNanoton: treDelta.toString(),
    outboundFromContract: {
      treasuryNanoton: outbound.treasury.toString(),
      referrerNanoton: outbound.referrer.toString(),
      messages: outbound.messages,
    },
    contractBalanceBeforeNanoton: contractBefore.toString(),
    contractBalanceAfterNanoton: contractAfter.toString(),
    splitSumNanoton: distributableApprox.toString(),
    splitApprox5050: refDelta > 0n && treDelta > 0n && (refDelta === treDelta || treDelta === refDelta + 1n),
    computeExitCode: computeExit ?? null,
    actionExitCode: actionExit ?? null,
    aborted,
    processedExitCode: processed.exit_code,
    processedValue: processed.stack?.[0]?.[1],
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
