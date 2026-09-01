#!/usr/bin/env node
/**
 * Deploy YORZA V2 router to TON testnet and run integration checks.
 * Secrets from env only — never written to git.
 */
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
import { mnemonicToPrivateKey, sign, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMPILED_PATH = path.join(ROOT, 'build', 'ReferralPayment.compiled.json');
const REPORT_PATH = path.join(ROOT, 'deploy-report.json');

const OP_SUBSCRIBE = 0x591a2b3c;
const GROSS_NANOTON = 100_000_000n;
const TESTNET_RPC = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const TESTNET_REST = 'https://testnet.toncenter.com/api/v2';
let lastRpcAt = 0;

function log(msg) {
  console.log(`[deploy] ${msg}`);
}

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

async function toncenterGet(p, query = {}) {
  const minGap = 1300;
  const wait = Math.max(0, minGap - (Date.now() - lastRpcAt));
  if (wait) await sleep(wait);
  lastRpcAt = Date.now();
  const url = new URL(`${TESTNET_REST}/${p}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || json.result || `GET ${p} failed`);
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
  const treasuryAddress = process.env.TON_TESTNET_TREASURY_ADDRESS;
  const signerPrivateKeyHex = process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY?.replace(/^0x/, '');
  const signerPublicKeyHex = process.env.TON_PAYMENT_SIGNER_PUBLIC_KEY?.replace(/^0x/, '');

  if (!deployerMnemonic) throw new Error('TON_DEPLOYER_MNEMONIC is required');
  if (!treasuryAddress) throw new Error('TON_TESTNET_TREASURY_ADDRESS is required');
  if (!signerPrivateKeyHex) throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is required');
  if (!signerPublicKeyHex) throw new Error('TON_PAYMENT_SIGNER_PUBLIC_KEY is required');

  return { deployerMnemonic, treasuryAddress, signerPrivateKeyHex, signerPublicKeyHex };
}

function buildInitData(treasury, signerPubKeyBigInt) {
  return beginCell()
    .storeAddress(treasury)
    .storeUint(signerPubKeyBigInt, 256)
    .storeDict(null)
    .endCell();
}

function loadCompiledCode() {
  if (!existsSync(COMPILED_PATH)) throw new Error(`Missing ${COMPILED_PATH} — run npm run build`);
  const compiled = JSON.parse(readFileSync(COMPILED_PATH, 'utf8'));
  return Cell.fromBoc(Buffer.from(compiled.hex, 'hex'))[0];
}

function buildSubscribeBody({
  paymentId,
  subscriber,
  referrer,
  amount,
  expiry,
  nonce,
  signerSeed,
}) {
  const authCell = beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(amount)
    .storeUint(expiry, 64)
    .storeUint(nonce, 64)
    .endCell();

  const sig = sign(authCell.hash(), keyPairFromSeed(Buffer.from(signerSeed, 'hex')).secretKey);
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

async function isContractDeployed(addressStr) {
  try {
    const result = await toncenter('runGetMethod', {
      address: addressStr,
      method: 'get_treasury',
      stack: [],
    });
    return result.exit_code === 0 || result.exit_code === 9;
  } catch {
    return false;
  }
}

async function tryFaucets(address) {
  const attempts = [];
  for (const url of [
    'https://testnet.tonapi.io/v2/faucet',
    'https://faucet.ton.org/api/v1/testnet/faucet',
  ]) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      attempts.push({ faucet: url, status: res.status, body: (await res.text()).slice(0, 200) });
    } catch (e) {
      attempts.push({ faucet: url, error: e.message });
    }
  }
  return attempts;
}

async function main() {
  const secrets = loadSecretsFromEnv();
  const deployerKey = await mnemonicToPrivateKey(secrets.deployerMnemonic.split(' '));
  const deployerWallet = WalletContractV4.create({ workchain: 0, publicKey: deployerKey.publicKey });
  const deployerAddr = deployerWallet.address.toString({ bounceable: false, testOnly: true });
  const treasuryAddr = secrets.treasuryAddress;

  log(`Deployer: ${deployerAddr}`);
  log(`Treasury: ${treasuryAddr}`);
  log(`Signer pubkey: ${secrets.signerPublicKeyHex}`);

  let balance = await getBalanceNano(deployerAddr);
  log(`Deployer balance: ${balance} nanoton (${Number(balance) / 1e9} TON)`);

  if (balance < 85_000_000n) {
    log('Attempting testnet faucets...');
    const faucetAttempts = await tryFaucets(deployerAddr);
    for (const a of faucetAttempts) log(`Faucet ${a.faucet}: ${JSON.stringify(a)}`);
    await sleep(8000);
    balance = await getBalanceNano(deployerAddr);
    log(`Balance after faucet: ${balance} nanoton`);
  }

  if (balance < 85_000_000n) {
    const report = {
      status: 'FUNDING_REQUIRED',
      network: 'testnet',
      deployerAddress: deployerAddr,
      treasuryAddress: treasuryAddr,
      signerPublicKeyHex: secrets.signerPublicKeyHex,
      deployerExplorer: explorerAddr(deployerAddr),
      requiredNanoton: '90000000',
      currentBalanceNanoton: balance.toString(),
      faucetInstructions: [
        'Open Telegram @testgiver_ton_bot',
        'Tap "Get 2 GRAM in testnet", solve captcha',
        `Paste deployer address: ${deployerAddr}`,
      ],
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  if (!existsSync(COMPILED_PATH)) {
    const { execSync } = await import('node:child_process');
    execSync('node scripts/compile.js', { cwd: ROOT, stdio: 'inherit' });
  }

  const code = loadCompiledCode();
  const treasury = Address.parse(treasuryAddr);
  const signerPub = BigInt(`0x${secrets.signerPublicKeyHex}`);
  const initData = buildInitData(treasury, signerPub);
  const contractAddr = contractAddress(0, { code, data: initData });
  const contractStr = contractAddr.toString({ bounceable: false, testOnly: true });

  log(`Contract address (predicted): ${contractStr}`);

  if (!(await isContractDeployed(contractStr))) {
    log('Deploying V2 router...');
    await sendExternalBoc(
      deployerWallet,
      deployerKey.secretKey,
      [
        internal({
          to: contractAddr,
          value: toNano('0.05'),
          init: { code, data: initData },
          bounce: false,
        }),
      ]
    );
    for (let i = 0; i < 36 && !(await isContractDeployed(contractStr)); i++) {
      await sleep(5000);
    }
    if (!(await isContractDeployed(contractStr))) throw new Error('Contract deploy timed out');
    log('Contract deployed');
  } else {
    log('Contract already active');
  }

  const txs = await toncenter('getTransactions', { address: contractStr, limit: 3 });
  const deployTxHash = txs?.[0]?.transaction_id?.hash || null;

  // Create throwaway referrer wallet for live payment test
  const { mnemonicNew } = await import('@ton/crypto');
  const referrerMnemonic = await mnemonicNew(24);
  const referrerKey = await mnemonicToPrivateKey(referrerMnemonic);
  const referrerWallet = WalletContractV4.create({ workchain: 0, publicKey: referrerKey.publicKey });
  const referrerAddress = referrerWallet.address.toString({ bounceable: false, testOnly: true });

  if (balance < GROSS_NANOTON + 80_000_000n) {
    const report = {
      status: 'DEPLOYED_PAYMENT_BLOCKED',
      network: 'testnet',
      contractAddress: contractStr,
      deployTxHash,
      treasuryAddress: treasuryAddr,
      signerPublicKeyHex: secrets.signerPublicKeyHex,
      deployerAddress: deployerAddr,
      deployerBalanceNanoton: balance.toString(),
      note: 'Contract deployed but deployer balance insufficient for 0.1 TON live payment test',
      explorers: {
        contract: explorerAddr(contractStr),
        deployer: explorerAddr(deployerAddr),
        treasury: explorerAddr(treasuryAddr),
      },
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const nonce = 1n;
  const body = buildSubscribeBody({
    paymentId,
    subscriber: deployerWallet.address,
    referrer: referrerWallet.address,
    amount: GROSS_NANOTON,
    expiry,
    nonce,
    signerSeed: secrets.signerPrivateKeyHex,
  });

  const treBefore = await getBalanceNano(treasuryAddr);
  const refBefore = await getBalanceNano(referrerAddress);

  log('Sending 0.1 TON subscribe payment...');
  await sendExternalBoc(deployerWallet, deployerKey.secretKey, [
    internal({ to: contractAddr, value: GROSS_NANOTON, body, bounce: true }),
  ]);
  await sleep(20000);

  const treAfter = await getBalanceNano(treasuryAddr);
  const refAfter = await getBalanceNano(referrerAddress);
  const paymentTxs = await toncenter('getTransactions', { address: contractStr, limit: 5 });
  const paymentTxHash = paymentTxs?.[0]?.transaction_id?.hash || null;

  const processed = await toncenter('runGetMethod', {
    address: contractStr,
    method: 'get_payment_processed',
    stack: [['num', paymentId.toString()]],
  });

  const report = {
    status: 'DEPLOYED',
    network: 'testnet',
    version: 'v2-router',
    contractAddress: contractStr,
    deployTxHash,
    treasuryAddress: treasuryAddr,
    signerPublicKeyHex: secrets.signerPublicKeyHex,
    deployerAddress: deployerAddr,
    feePolicy: 'RAWRESERVE execution + GETFORWARDFEE ×2; 50/50 distributable; odd nanotons → treasury',
    paymentTest: {
      paymentId: paymentId.toString(),
      grossNanoton: GROSS_NANOTON.toString(),
      referrerBalanceDelta: (refAfter - refBefore).toString(),
      treasuryBalanceDelta: (treAfter - treBefore).toString(),
      processedExitCode: processed.exit_code,
      processedValue: processed.stack?.[0]?.[1],
      txHash: paymentTxHash,
      explorer: paymentTxHash ? explorerTx(paymentTxHash) : null,
    },
    explorers: {
      contract: explorerAddr(contractStr),
      deployTx: deployTxHash ? explorerTx(deployTxHash) : null,
      deployer: explorerAddr(deployerAddr),
      treasury: explorerAddr(treasuryAddr),
    },
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
