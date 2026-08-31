import crypto from 'crypto';
import { Address, Cell, contractAddress, loadStateInit } from 'ton-core';
import Ton from 'ton';
import { sha256, signVerify } from 'ton-crypto';
import TonProofNonce from '../models/TonProofNonce.js';
import User from '../models/User.js';
import { getTonConnectDomain } from '../config/tonConfig.js';

const TON_PROOF_PREFIX = 'ton-proof-item-v2/';
const TON_CONNECT_PREFIX = 'ton-connect';
const VALID_AUTH_SECONDS = 15 * 60;

function loadWalletV1Data(cs) {
  cs.loadUint(32);
  return cs.loadBuffer(32);
}

function loadWalletV3Data(cs) {
  cs.loadUint(32);
  cs.loadUint(32);
  return cs.loadBuffer(32);
}

function loadWalletV4Data(cs) {
  cs.loadUint(32);
  cs.loadUint(32);
  return cs.loadBuffer(32);
}

const {
  WalletContractV1R1,
  WalletContractV1R2,
  WalletContractV1R3,
  WalletContractV2R1,
  WalletContractV2R2,
  WalletContractV3R1,
  WalletContractV3R2,
  WalletContractV4
} = Ton;

const knownWallets = [
  { wallet: WalletContractV1R1.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV1Data },
  { wallet: WalletContractV1R2.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV1Data },
  { wallet: WalletContractV1R3.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV1Data },
  { wallet: WalletContractV2R1.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV1Data },
  { wallet: WalletContractV2R2.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV1Data },
  { wallet: WalletContractV3R1.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV3Data },
  { wallet: WalletContractV3R2.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV3Data },
  { wallet: WalletContractV4.create({ workchain: 0, publicKey: Buffer.alloc(32) }), loadData: loadWalletV4Data }
];

function tryParsePublicKey(stateInit) {
  if (!stateInit.code || !stateInit.data) return null;

  for (const { wallet, loadData } of knownWallets) {
    try {
      if (wallet.init.code.equals(stateInit.code)) {
        return loadData(stateInit.data.beginParse());
      }
    } catch {
      // try next wallet version
    }
  }
  return null;
}

export async function createTonProofChallenge(telegramId) {
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + VALID_AUTH_SECONDS * 1000);

  await TonProofNonce.create({
    telegramId: String(telegramId),
    nonce,
    expiresAt
  });

  return {
    nonce,
    expiresAt: expiresAt.toISOString(),
    domain: getTonConnectDomain(),
    validForSeconds: VALID_AUTH_SECONDS
  };
}

/**
 * Verify TON Connect ton_proof per ton-blockchain/ton-connect spec.
 * @param {{ address: string, publicKey: string, proof: object }} payload
 */
export async function verifyTonProof(telegramId, payload) {
  const { address, publicKey, proof } = payload;
  if (!address || !publicKey || !proof?.payload || !proof?.signature || !proof?.state_init) {
    throw new Error('Invalid ton_proof payload');
  }

  const nonceRecord = await TonProofNonce.findOne({
    telegramId: String(telegramId),
    nonce: proof.payload,
    usedAt: null,
    expiresAt: { $gt: new Date() }
  });

  if (!nonceRecord) {
    throw new Error('Invalid or expired ton_proof nonce');
  }

  const allowedDomain = getTonConnectDomain();
  if (proof.domain?.value !== allowedDomain) {
    throw new Error('Invalid ton_proof domain');
  }

  const now = Math.floor(Date.now() / 1000);
  if (now - VALID_AUTH_SECONDS > proof.timestamp) {
    throw new Error('ton_proof timestamp expired');
  }

  const stateInit = loadStateInit(Cell.fromBase64(proof.state_init).beginParse());
  const parsedPublicKey = tryParsePublicKey(stateInit);
  const wantedPublicKey = Buffer.from(publicKey, 'hex');

  if (!parsedPublicKey || !parsedPublicKey.equals(wantedPublicKey)) {
    throw new Error('Wallet public key mismatch');
  }

  const wantedAddress = Address.parse(address);
  const derivedAddress = contractAddress(wantedAddress.workChain, stateInit);
  if (!derivedAddress.equals(wantedAddress)) {
    throw new Error('Wallet address does not match state init');
  }

  const wc = Buffer.alloc(4);
  wc.writeUInt32BE(derivedAddress.workChain, 0);
  const ts = Buffer.alloc(8);
  ts.writeBigUInt64LE(BigInt(proof.timestamp), 0);
  const dl = Buffer.alloc(4);
  dl.writeUInt32LE(proof.domain.lengthBytes, 0);

  const msg = Buffer.concat([
    Buffer.from(TON_PROOF_PREFIX),
    wc,
    derivedAddress.hash,
    dl,
    Buffer.from(proof.domain.value),
    ts,
    Buffer.from(proof.payload)
  ]);

  const msgHash = Buffer.from(await sha256(msg));
  const fullMsg = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from(TON_CONNECT_PREFIX),
    msgHash
  ]);
  const result = Buffer.from(await sha256(fullMsg));
  const signature = Buffer.from(proof.signature, 'base64');

  if (!signVerify(result, signature, wantedPublicKey)) {
    throw new Error('Invalid ton_proof signature');
  }

  nonceRecord.usedAt = new Date();
  await nonceRecord.save();

  const user = await User.findOne({ telegramId: String(telegramId) });
  if (!user) {
    throw new Error('User not found');
  }

  const normalizedAddress = wantedAddress.toString({ bounceable: false, testOnly: true });

  if (user.walletAddress && user.walletVerified && user.walletAddress !== normalizedAddress) {
    user.walletVerified = false;
    user.walletVerifiedAt = null;
  }

  user.walletAddress = normalizedAddress;
  user.walletConnected = true;
  user.walletVerified = true;
  user.walletVerifiedAt = new Date();
  await user.save();

  return {
    walletAddress: user.walletAddress,
    walletVerified: true,
    walletVerifiedAt: user.walletVerifiedAt
  };
}

export async function requireVerifiedWallet(telegramId) {
  const user = await User.findOne({ telegramId: String(telegramId) });
  if (!user?.walletVerified || !user.walletAddress) {
    throw new Error('Verified TON testnet wallet required');
  }
  return user;
}
