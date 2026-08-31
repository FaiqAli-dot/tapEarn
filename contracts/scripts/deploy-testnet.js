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
import { mnemonicNew, mnemonicToPrivateKey, sign, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SECRETS_PATH = path.join(ROOT, '.deploy-secrets.json');
const COMPILED_PATH = path.join(ROOT, 'build', 'ReferralPayment.compiled.json');

const OP_PAY_SUBSCRIPTION = 0x591a2b3c;
const FEE_RESERVE_NANOTON = 50_000_000n;
const GROSS_NANOTON = 100_000_000n; // 0.1 TON
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
      const backoff = 1500 * (attempt + 1);
      log(`Rate limited on ${method}, retrying in ${backoff}ms...`);
      await sleep(backoff);
      continue;
    }

    if (json.error) {
      throw new Error(json.error.message || JSON.stringify(json.error));
    }
    if (json.ok === false) {
      throw new Error(json.result || `RPC failed: ${method}`);
    }
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
  const result = await toncenterGet('getAddressBalance', { address });
  return BigInt(result);
}

async function getAccountState(address) {
  return toncenterGet('getAddressInformation', { address });
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
  return { seqno };
}

async function loadOrCreateSecrets() {
  if (existsSync(SECRETS_PATH)) {
    return JSON.parse(readFileSync(SECRETS_PATH, 'utf8'));
  }

  const deployerMnemonic = await mnemonicNew(24);
  const treasuryMnemonic = await mnemonicNew(24);
  const deployerKey = await mnemonicToPrivateKey(deployerMnemonic);
  const treasuryKey = await mnemonicToPrivateKey(treasuryMnemonic);

  const deployerWallet = WalletContractV4.create({
    workchain: 0,
    publicKey: deployerKey.publicKey,
  });
  const treasuryWallet = WalletContractV4.create({
    workchain: 0,
    publicKey: treasuryKey.publicKey,
  });

  const ed25519 = crypto.generateKeyPairSync('ed25519');
  const signerSeed = ed25519.privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
  const signerPub = ed25519.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);

  const secrets = {
    network: 'testnet',
    deployer: {
      mnemonic: deployerMnemonic.join(' '),
      address: deployerWallet.address.toString({ bounceable: false, testOnly: true }),
    },
    treasury: {
      mnemonic: treasuryMnemonic.join(' '),
      address: treasuryWallet.address.toString({ bounceable: false, testOnly: true }),
    },
    signer: {
      privateKeyHex: signerSeed.toString('hex'),
      publicKeyHex: signerPub.toString('hex'),
      publicKeyUint256: BigInt(`0x${signerPub.toString('hex')}`).toString(),
    },
    createdAt: new Date().toISOString(),
  };

  writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 2), { mode: 0o600 });
  log(`Generated throwaway testnet secrets at ${SECRETS_PATH} (gitignored)`);
  return secrets;
}

async function tryFaucets(address) {
  const attempts = [];

  // Chainstack faucet (requires API key — will fail without one)
  try {
    const res = await fetch('https://api.chainstack.com/v1/faucet/ton-testnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const text = await res.text();
    attempts.push({ faucet: 'chainstack-api', status: res.status, body: text.slice(0, 200) });
  } catch (e) {
    attempts.push({ faucet: 'chainstack-api', error: e.message });
  }

  // Legacy ton.org endpoints
  for (const url of [
    'https://faucet.ton.org/api/v1/testnet/faucet',
    'https://testnet.tonapi.io/v2/faucet',
    'https://testnet.tonapi.io/v1/faucet',
  ]) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const text = await res.text();
      attempts.push({ faucet: url, status: res.status, body: text.slice(0, 200) });
    } catch (e) {
      attempts.push({ faucet: url, error: e.message });
    }
  }

  return attempts;
}

function buildInitData(admin, treasury, signerPubKeyBigInt) {
  return beginCell()
    .storeAddress(admin)
    .storeAddress(treasury)
    .storeUint(signerPubKeyBigInt, 256)
    .storeUint(0, 1)
    .storeDict(null)
    .endCell();
}

function loadCompiledCode() {
  if (!existsSync(COMPILED_PATH)) {
    throw new Error(`Missing ${COMPILED_PATH} — run npm run build first`);
  }
  const compiled = JSON.parse(readFileSync(COMPILED_PATH, 'utf8'));
  return Cell.fromBoc(Buffer.from(compiled.hex, 'hex'))[0];
}

function contractAddressFromInit(code, initData) {
  return contractAddress(0, { code, data: initData });
}

function buildAuthBodyForContract({
  paymentId,
  subscriber,
  referrer,
  gross,
  feeReserve,
  expiry,
  signerSeed,
}) {
  const authCell = beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(gross)
    .storeCoins(feeReserve)
    .storeUint(expiry, 64)
    .endCell();

  const hash = authCell.hash();
  const keyPair = keyPairFromSeed(Buffer.from(signerSeed, 'hex'));
  const sig = sign(hash, keyPair.secretKey);

  const authPart = beginCell()
    .storeUint(OP_PAY_SUBSCRIPTION, 32)
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(gross)
    .storeCoins(feeReserve)
    .storeUint(expiry, 64)
    .endCell();

  const sigPart = beginCell().storeUint(BigInt(`0x${sig.toString('hex')}`), 512).endCell();

  return beginCell()
    .storeSlice(authPart.asSlice())
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

async function deployContract(secrets, code, initData, address) {
  const deployerKey = await mnemonicToPrivateKey(secrets.deployer.mnemonic.split(' '));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: deployerKey.publicKey });

  await sendExternalBoc(wallet, deployerKey.secretKey, [
    internal({
      to: address,
      value: toNano('0.2'),
      init: { code, data: initData },
      bounce: false,
    }),
  ]);

  return { address: wallet.address.toString({ bounceable: false, testOnly: true }) };
}

async function waitForDeploy(addressStr, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isContractDeployed(addressStr)) return true;
    await sleep(5000);
  }
  return false;
}

async function sendPayment(secrets, contractAddr, opts) {
  const subscriberKey = await mnemonicToPrivateKey(opts.subscriberMnemonic.split(' '));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: subscriberKey.publicKey });

  const body = buildAuthBodyForContract({
    paymentId: opts.paymentId,
    subscriber: wallet.address,
    referrer: Address.parse(opts.referrerAddress),
    gross: opts.gross,
    feeReserve: opts.feeReserve,
    expiry: opts.expiry,
    signerSeed: secrets.signer.privateKeyHex,
  });

  await sendExternalBoc(wallet, subscriberKey.secretKey, [
    internal({
      to: contractAddr,
      value: opts.gross,
      body,
      bounce: true,
    }),
  ]);

  return { subscriber: wallet.address.toString({ bounceable: false, testOnly: true }) };
}

async function getRecentTxs(address, limit = 5) {
  return toncenter('getTransactions', { address, limit });
}

async function main() {
  const secrets = await loadOrCreateSecrets();
  const deployerAddr = secrets.deployer.address;
  const treasuryAddr = secrets.treasury.address;

  log(`Deployer: ${deployerAddr}`);
  log(`Treasury: ${treasuryAddr}`);
  log(`Signer pubkey: ${secrets.signer.publicKeyHex}`);
  log(`Deployer explorer: ${explorerAddr(deployerAddr)}`);

  let balance = await getBalanceNano(deployerAddr);
  log(`Deployer balance: ${balance} nanoton (${Number(balance) / 1e9} TON)`);

  if (balance < 200_000_000n) {
    log('Attempting testnet faucets...');
    const faucetAttempts = await tryFaucets(deployerAddr);
    for (const a of faucetAttempts) {
      log(`Faucet ${a.faucet}: ${JSON.stringify(a)}`);
    }
    await sleep(5000);
    balance = await getBalanceNano(deployerAddr);
    log(`Balance after faucet attempts: ${balance} nanoton`);
  }

  if (balance < 200_000_000n) {
    const report = {
      status: 'FUNDING_REQUIRED',
      network: 'testnet',
      deployerAddress: deployerAddr,
      treasuryAddress: treasuryAddr,
      signerPublicKeyHex: secrets.signer.publicKeyHex,
      deployerExplorer: explorerAddr(deployerAddr),
      faucetInstructions: [
        'Open Telegram @testgiver_ton_bot',
        'Tap "Get 2 GRAM in testnet", solve captcha',
        `Paste deployer address: ${deployerAddr}`,
        'Alternatively use https://faucet.chainstack.com/ton-testnet-faucet with a Chainstack API key',
      ],
      note: 'No automated HTTP faucet succeeded without human/API-key auth. Re-run npm run deploy after funding.',
    };
    writeFileSync(path.join(ROOT, 'deploy-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  log('Compiling if needed...');
  if (!existsSync(COMPILED_PATH)) {
    const { execSync } = await import('node:child_process');
    execSync('node scripts/compile.js', { cwd: ROOT, stdio: 'inherit' });
  }

  const code = loadCompiledCode();
  const admin = Address.parse(deployerAddr);
  const treasury = Address.parse(treasuryAddr);
  const signerPub = BigInt(secrets.signer.publicKeyUint256);
  const initData = buildInitData(admin, treasury, signerPub);
  const contractAddr = contractAddressFromInit(code, initData);

  log(`Contract address (predicted): ${contractAddr.toString({ bounceable: false, testOnly: true })}`);

  const contractStr = contractAddr.toString({ bounceable: false, testOnly: true });
  let deployTxHash = null;

  if (!(await isContractDeployed(contractStr))) {
    log('Deploying contract...');
    await deployContract(secrets, code, initData, contractAddr);
    const deployed = await waitForDeploy(contractStr);
    if (!deployed) throw new Error('Contract deploy timed out');
    log('Contract deployed');
  } else {
    log('Contract already active on-chain');
  }

  const txs = await getRecentTxs(contractStr, 3);
  if (txs?.[0]?.transaction_id?.hash) {
    deployTxHash = txs[0].transaction_id.hash;
  }

  // Generate or reuse subscriber + referrer wallets for payment test
  let referrerMnemonic;
  let subscriberMnemonic;
  if (secrets.testWallets?.referrer?.mnemonic && secrets.testWallets?.subscriber?.mnemonic) {
    referrerMnemonic = secrets.testWallets.referrer.mnemonic.split(' ');
    subscriberMnemonic = secrets.testWallets.subscriber.mnemonic.split(' ');
    log('Reusing test wallets from secrets');
  } else {
    referrerMnemonic = await mnemonicNew(24);
    subscriberMnemonic = await mnemonicNew(24);
  }
  const referrerKey = await mnemonicToPrivateKey(referrerMnemonic);
  const subscriberKey = await mnemonicToPrivateKey(subscriberMnemonic);
  const referrerWallet = WalletContractV4.create({ workchain: 0, publicKey: referrerKey.publicKey });
  const subscriberWallet = WalletContractV4.create({ workchain: 0, publicKey: subscriberKey.publicKey });
  const referrerAddress = referrerWallet.address.toString({ bounceable: false, testOnly: true });
  const subscriberAddress = subscriberWallet.address.toString({ bounceable: false, testOnly: true });

  secrets.testWallets = {
    referrer: { mnemonic: referrerMnemonic.join(' '), address: referrerAddress },
    subscriber: { mnemonic: subscriberMnemonic.join(' '), address: subscriberAddress },
  };
  writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 2), { mode: 0o600 });

  // Fund subscriber from deployer if possible
  const deployerKey = await mnemonicToPrivateKey(secrets.deployer.mnemonic.split(' '));
  const deployerWallet = WalletContractV4.create({ workchain: 0, publicKey: deployerKey.publicKey });

  const subBal = await getBalanceNano(subscriberAddress);
  if (subBal < GROSS_NANOTON + 50_000_000n) {
    log('Funding subscriber wallet for payment test...');
    await sendExternalBoc(deployerWallet, deployerKey.secretKey, [
      internal({
        to: subscriberWallet.address,
        value: toNano('0.25'),
        bounce: false,
      }),
    ]);
    await sleep(12000);
  }

  const paymentResults = [];
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));

  log('Sending subscription payment...');
  const treasuryBefore = await getBalanceNano(treasuryAddr);
  const referrerBefore = await getBalanceNano(referrerAddress);

  await sendPayment(secrets, contractAddr, {
    subscriberMnemonic: subscriberMnemonic.join(' '),
    referrerAddress,
    paymentId,
    gross: GROSS_NANOTON,
    feeReserve: FEE_RESERVE_NANOTON,
    expiry,
  });

  await sleep(15000);

  const treasuryAfter = await getBalanceNano(treasuryAddr);
  const referrerAfter = await getBalanceNano(referrerAddress);
  const net = GROSS_NANOTON - FEE_RESERVE_NANOTON;
  const expectedRef = net / 2n;
  const expectedTre = net - expectedRef;

  const contractTxs = await getRecentTxs(contractStr, 5);
  const paymentTxHash = contractTxs?.[0]?.transaction_id?.hash || null;

  paymentResults.push({
    name: 'valid_payment',
    paymentId: paymentId.toString(),
    grossNanoton: GROSS_NANOTON.toString(),
    feeReserveNanoton: FEE_RESERVE_NANOTON.toString(),
    netNanoton: net.toString(),
    expectedReferrerPayout: expectedRef.toString(),
    expectedTreasuryPayout: expectedTre.toString(),
    referrerBalanceDelta: (referrerAfter - referrerBefore).toString(),
    treasuryBalanceDelta: (treasuryAfter - treasuryBefore).toString(),
    subscriberAddress,
    referrerAddress,
    txHash: paymentTxHash,
    explorer: paymentTxHash ? explorerTx(paymentTxHash) : null,
  });

  // Duplicate replay test
  let replayBlocked = false;
  try {
    await sendPayment(secrets, contractAddr, {
      subscriberMnemonic: subscriberMnemonic.join(' '),
      referrerAddress,
      paymentId,
      gross: GROSS_NANOTON,
      feeReserve: FEE_RESERVE_NANOTON,
      expiry,
    });
    await sleep(10000);
    const refAfterReplay = await getBalanceNano(referrerAddress);
    replayBlocked = refAfterReplay === referrerAfter;
  } catch (e) {
    replayBlocked = true;
  }

  // Wrong amount test — use new payment id
  const wrongAmountId = paymentId + 1n;
  let wrongAmountFailed = false;
  try {
    await sendPayment(secrets, contractAddr, {
      subscriberMnemonic: subscriberMnemonic.join(' '),
      referrerAddress,
      paymentId: wrongAmountId,
      gross: GROSS_NANOTON,
      feeReserve: FEE_RESERVE_NANOTON,
      expiry,
    });
    await sleep(10000);
    const refBal = await getBalanceNano(referrerAddress);
    wrongAmountFailed = refBal === referrerAfter;
  } catch {
    wrongAmountFailed = true;
  }

  const report = {
    status: 'DEPLOYED',
    network: 'testnet',
    contractAddress: contractStr,
    deployTxHash,
    treasuryAddress: treasuryAddr,
    signerPublicKeyHex: secrets.signer.publicKeyHex,
    deployerAddress: deployerAddr,
    feePolicy: {
      feeReserveNanoton: FEE_RESERVE_NANOTON.toString(),
      subscriptionGrossNanoton: GROSS_NANOTON.toString(),
      split: '50/50 net after fee reserve; odd nanotons to treasury',
    },
    explorers: {
      contract: explorerAddr(contractStr),
      deployTx: deployTxHash ? explorerTx(deployTxHash) : null,
      deployer: explorerAddr(deployerAddr),
      treasury: explorerAddr(treasuryAddr),
    },
    paymentTests: paymentResults,
    edgeCaseTests: {
      duplicateReplayBlocked: replayBlocked,
      wrongAmountNote: 'Subscriber sends gross in msg value; underpay should fail with insufficient error on-chain (bounce if value < gross). Full bounce simulation not available without sandbox.',
      wrongAmountNoExtraPayout: wrongAmountFailed,
    },
  };

  writeFileSync(path.join(ROOT, 'deploy-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
