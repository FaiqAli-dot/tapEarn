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
 * Init treasury + ephemeral referrer, then pay (split proof):
 *   TON_TREASURY_MNEMONIC=... (plus vars above) \
 *   node scripts/pay-testnet.js --split-proof
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
const INIT_NANOTON = 50_000_000n;
const TESTNET_RPC = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const TESTNET_REST = 'https://testnet.toncenter.com/api/v2';
const TONAPI = 'https://testnet.tonapi.io/v2';
let lastRpcAt = 0;

function explorerAddr(addr) {
  return `https://testnet.tonscan.org/address/${addr}`;
}

function explorerTx(hash) {
  return `https://testnet.tonscan.org/tx/${hash}`;
}

function addrKey(addr) {
  return Address.parse(addr).toRawString();
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

async function tonapiAccount(rawOrFriendly) {
  const raw = Address.parse(rawOrFriendly).toRawString();
  const res = await fetch(`${TONAPI}/accounts/${encodeURIComponent(raw)}`);
  if (!res.ok) throw new Error(`tonapi account ${raw}: ${res.status}`);
  return res.json();
}

async function tonapiTx(hash) {
  const res = await fetch(`${TONAPI}/blockchain/transactions/${encodeURIComponent(hash)}`);
  if (!res.ok) throw new Error(`tonapi tx ${hash}: ${res.status}`);
  return res.json();
}

async function getBalanceNano(address) {
  return BigInt(await toncenterGet('getAddressBalance', { address }));
}

async function getWalletSeqno(address) {
  const info = await toncenter('getWalletInformation', { address });
  return Number(info.seqno ?? 0);
}

async function sendExternalBoc(wallet, secretKey, messages) {
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
  return seqno;
}

function loadSecretsFromEnv({ requireTreasuryMnemonic = false } = {}) {
  const deployerMnemonic = process.env.TON_DEPLOYER_MNEMONIC;
  const treasuryMnemonic = process.env.TON_TREASURY_MNEMONIC;
  const contractAddress = process.env.TON_TESTNET_REFERRAL_CONTRACT_ADDRESS;
  const treasuryAddress = process.env.TON_TESTNET_TREASURY_ADDRESS;
  const signerPrivateKeyHex = process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY?.replace(/^0x/, '');

  if (!deployerMnemonic) throw new Error('TON_DEPLOYER_MNEMONIC is required');
  if (!contractAddress) throw new Error('TON_TESTNET_REFERRAL_CONTRACT_ADDRESS is required');
  if (!treasuryAddress) throw new Error('TON_TESTNET_TREASURY_ADDRESS is required');
  if (!signerPrivateKeyHex) throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is required');
  if (requireTreasuryMnemonic && !treasuryMnemonic) {
    throw new Error('TON_TREASURY_MNEMONIC is required for --split-proof');
  }

  return {
    deployerMnemonic,
    treasuryMnemonic,
    contractAddress,
    treasuryAddress,
    signerPrivateKeyHex,
  };
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

async function waitForAccountActive(address, timeoutMs = 120000) {
  const key = addrKey(address);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const acct = await tonapiAccount(key);
    if (acct.status === 'active' && BigInt(acct.balance || 0) > 0n) {
      return acct;
    }
    await sleep(5000);
  }
  throw new Error(`Timed out waiting for account ${address} to become active`);
}

async function initWalletFromDeployer(deployerWallet, deployerKey, targetWallet, label) {
  const targetStr = targetWallet.address.toString({ bounceable: false, testOnly: true });
  const acct = await tonapiAccount(targetStr);
  if (acct.status === 'active' && BigInt(acct.balance || 0) > 0n) {
    return {
      address: targetStr,
      status: acct.status,
      balanceNanoton: acct.balance.toString(),
      skipped: true,
      label,
    };
  }

  const deployerStr = deployerWallet.address.toString({ bounceable: true, testOnly: true });
  const preTxs = await toncenter('getTransactions', { address: deployerStr, limit: 1 });
  const afterLt = preTxs?.[0]?.transaction_id?.lt || '0';

  await sendExternalBoc(deployerWallet, deployerKey.secretKey, [
    internal({
      to: targetWallet.address,
      value: INIT_NANOTON,
      init: targetWallet.init,
      bounce: false,
    }),
  ]);

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const txs = await toncenter('getTransactions', { address: deployerStr, limit: 5 });
    const match = txs?.find((tx) => BigInt(tx.transaction_id?.lt || 0) > BigInt(afterLt));
    if (match) break;
    await sleep(4000);
  }

  const active = await waitForAccountActive(targetStr);
  // Let deployer wallet seqno settle before the next outbound transfer.
  await sleep(6000);
  return {
    address: targetStr,
    status: active.status,
    balanceNanoton: active.balance.toString(),
    skipped: false,
    label,
  };
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
  const treasuryKey = addrKey(treasuryStr);
  const referrerKey = addrKey(referrerStr);
  const out = { treasury: 0n, referrer: 0n, messages: [] };
  for (const msg of tx.out_msgs || []) {
    const dest = msg.destination || '';
    const value = BigInt(msg.value || 0);
    out.messages.push({ destination: dest, valueNanoton: value.toString() });
    const destKey = addrKey(dest);
    if (destKey === treasuryKey) out.treasury += value;
    if (destKey === referrerKey) out.referrer += value;
  }
  return out;
}

async function runSplitProof() {
  const secrets = loadSecretsFromEnv({ requireTreasuryMnemonic: true });
  const contractStr = secrets.contractAddress;
  const treasuryStr = secrets.treasuryAddress;
  const contract = Address.parse(contractStr);

  const deployerKey = await mnemonicToPrivateKey(secrets.deployerMnemonic.split(' '));
  const deployerWallet = WalletContractV4.create({ workchain: 0, publicKey: deployerKey.publicKey });
  const deployerStr = deployerWallet.address.toString({ bounceable: false, testOnly: true });

  const treasuryKey = await mnemonicToPrivateKey(secrets.treasuryMnemonic.split(' '));
  const treasuryWallet = WalletContractV4.create({ workchain: 0, publicKey: treasuryKey.publicKey });
  const treasuryFromMnemonic = treasuryWallet.address.toString({ bounceable: false, testOnly: true });
  if (addrKey(treasuryFromMnemonic) !== addrKey(treasuryStr)) {
    throw new Error(`Treasury mnemonic address ${treasuryFromMnemonic} != env ${treasuryStr}`);
  }

  const balance = await getBalanceNano(deployerStr);
  const minRequired = INIT_NANOTON * 2n + GROSS_NANOTON + 100_000_000n;
  if (balance < minRequired) {
    console.log(JSON.stringify({
      status: 'INSUFFICIENT_DEPLOYER_BALANCE',
      deployerAddress: deployerStr,
      balanceNanoton: balance.toString(),
      requiredMinNanoton: minRequired.toString(),
      explorer: explorerAddr(deployerStr),
    }, null, 2));
    process.exit(2);
  }

  const treasuryInit = await initWalletFromDeployer(
    deployerWallet,
    deployerKey,
    treasuryWallet,
    'treasury'
  );

  const referrerMnemonic = await mnemonicNew(24);
  const referrerKey = await mnemonicToPrivateKey(referrerMnemonic);
  const referrerWallet = WalletContractV4.create({ workchain: 0, publicKey: referrerKey.publicKey });
  const referrerInit = await initWalletFromDeployer(
    deployerWallet,
    deployerKey,
    referrerWallet,
    'referrer'
  );
  const referrerStr = referrerInit.address;

  // Ensure deployer seqno and chain state are settled before subscribe payment.
  await sleep(8000);

  const paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
  const nonce = BigInt(crypto.randomBytes(8).readBigUInt64BE(0));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const body = buildSubscribeBody({
    paymentId,
    subscriber: deployerWallet.address,
    referrer: referrerWallet.address,
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

  let tonapiDetails = null;
  try {
    tonapiDetails = await tonapiTx(txHash);
  } catch {
    // tonapi may lag; fall back to toncenter fields
  }

  await sleep(10000);

  const contractAfter = await getBalanceNano(contractStr);
  const treAfter = await getBalanceNano(treasuryStr);
  const refAfter = await getBalanceNano(referrerStr);
  const treAcct = await tonapiAccount(treasuryStr);
  const refAcct = await tonapiAccount(referrerStr);

  const refDelta = refAfter - refBefore;
  const treDelta = treAfter - treBefore;

  const computeExit = tonapiDetails?.compute_phase?.exit_code
    ?? tx.description?.compute_ph?.exit_code
    ?? null;
  const actionExit = tonapiDetails?.action_phase?.result_code
    ?? tx.description?.action?.result_code
    ?? null;
  const success = tonapiDetails?.success ?? null;

  const bounced = (refDelta === 0n && outbound.referrer > 0n)
    || (treDelta === 0n && outbound.treasury > 0n);
  const paymentSucceeded = success === true || computeExit === 0;

  console.log(JSON.stringify({
    mode: 'split-proof',
    network: 'testnet',
    version: 'v2-router',
    contractAddress: contractStr,
    contractExplorer: explorerAddr(contractStr),
    deployerAddress: deployerStr,
    initTransfers: {
      treasury: { ...treasuryInit, explorer: explorerAddr(treasuryInit.address) },
      referrer: { ...referrerInit, explorer: explorerAddr(referrerInit.address) },
    },
    treasuryAddress: treasuryStr,
    treasuryExplorer: explorerAddr(treasuryStr),
    treasuryStatusAfter: treAcct.status,
    referrerAddress: referrerStr,
    referrerExplorer: explorerAddr(referrerStr),
    referrerStatusAfter: refAcct.status,
    paymentId: paymentId.toString(),
    nonce: nonce.toString(),
    grossNanoton: GROSS_NANOTON.toString(),
    txHash,
    txExplorer: txHash ? explorerTx(txHash) : null,
    inboundValueNanoton: inbound?.toString() ?? null,
    treasuryBalanceBeforeNanoton: treBefore.toString(),
    treasuryBalanceAfterNanoton: treAfter.toString(),
    treasuryReceivedNanoton: treDelta.toString(),
    referrerBalanceBeforeNanoton: refBefore.toString(),
    referrerBalanceAfterNanoton: refAfter.toString(),
    referrerReceivedNanoton: refDelta.toString(),
    outboundFromContract: {
      treasuryNanoton: outbound.treasury.toString(),
      referrerNanoton: outbound.referrer.toString(),
      messages: outbound.messages,
    },
    contractBalanceBeforeNanoton: contractBefore.toString(),
    contractBalanceAfterNanoton: contractAfter.toString(),
    splitApprox5050: refDelta > 0n && treDelta > 0n && (refDelta === treDelta || treDelta === refDelta + 1n),
    payoutsBounced: bounced,
    paymentSucceeded,
    computeExitCode: computeExit,
    actionExitCode: actionExit,
    txSuccess: success,
  }, null, 2));

  if (!paymentSucceeded || bounced) process.exit(3);
}

async function main() {
  if (process.argv[2] === '--split-proof') {
    await runSplitProof();
    return;
  }

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
