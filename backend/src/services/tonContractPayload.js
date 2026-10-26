import crypto from 'crypto';
import { Address, beginCell } from 'ton-core';
import { keyPairFromSeed, sign } from 'ton-crypto';
import { getPaymentSignerPrivateKeyHex, getTreasuryAddress } from '../config/tonConfig.js';

export const OP_SUBSCRIBE = 0x591a2b3c;
export const OP_SWEEP_EXCESS = 0x7a3e91d0;

/** Deterministic uint256 payment id from Mongo ObjectId hex (24 chars). */
export function paymentIdToUint256(objectId) {
  const hex = String(objectId).replace(/[^a-fA-F0-9]/g, '');
  const padded = hex.padStart(64, '0').slice(-64);
  return BigInt(`0x${padded}`);
}

/**
 * Resolve referrer address for the auth cell.
 * When commission is 0 the contract ignores the referrer for payout routing,
 * but still requires a valid address in the signed cell — use treasury.
 */
export function resolveAuthReferrerWallet(payment) {
  const commission = BigInt(payment.referrerShareNanoton || payment.commissionNanoton || '0');
  if (commission > 0n && payment.referrerWallet) {
    return payment.referrerWallet;
  }
  return payment.treasuryWallet || getTreasuryAddress();
}

export function buildAuthCell({
  paymentIdUint256,
  subscriberWallet,
  referrerWallet,
  amountNanoton,
  commissionNanoton,
  expiryUnix,
  nonce
}) {
  return beginCell()
    .storeUint(paymentIdUint256, 256)
    .storeAddress(Address.parse(subscriberWallet))
    .storeAddress(Address.parse(referrerWallet))
    .storeCoins(BigInt(amountNanoton))
    .storeCoins(BigInt(commissionNanoton || 0))
    .storeUint(BigInt(expiryUnix), 64)
    .storeUint(BigInt(nonce), 64)
    .endCell();
}

export function signAuthCell(authCell, privateKeyHex) {
  const hex = privateKeyHex.replace(/^0x/, '');
  const seed = Buffer.from(hex, 'hex');
  const keyPair = keyPairFromSeed(seed.length === 64 ? seed.subarray(0, 32) : seed);
  const sig = sign(authCell.hash(), keyPair.secretKey);
  return sig.toString('hex');
}

export function buildSubscribeMessageBody({
  paymentIdUint256,
  subscriberWallet,
  referrerWallet,
  amountNanoton,
  commissionNanoton,
  expiryUnix,
  nonce,
  signatureHex
}) {
  const authPart = beginCell()
    .storeUint(paymentIdUint256, 256)
    .storeAddress(Address.parse(subscriberWallet))
    .storeAddress(Address.parse(referrerWallet))
    .storeCoins(BigInt(amountNanoton))
    .storeCoins(BigInt(commissionNanoton || 0))
    .storeUint(BigInt(expiryUnix), 64)
    .storeUint(BigInt(nonce), 64)
    .endCell();

  const sigPart = beginCell()
    .storeUint(BigInt(`0x${signatureHex}`), 512)
    .endCell();

  return beginCell()
    .storeUint(OP_SUBSCRIBE, 32)
    .storeSlice(authPart.beginParse())
    .storeRef(sigPart)
    .endCell();
}

export function buildSignedSubscribePayload(payment) {
  const privateKeyHex = getPaymentSignerPrivateKeyHex();
  if (!privateKeyHex) {
    throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is not configured');
  }

  const paymentIdUint256 = paymentIdToUint256(payment._id);
  const expiryUnix = Math.floor(new Date(payment.expiresAt).getTime() / 1000);
  const nonce = BigInt(payment.authorizationNonce);
  const commissionNanoton = payment.referrerShareNanoton || payment.commissionNanoton || '0';
  const referrerWallet = resolveAuthReferrerWallet(payment);

  const authCell = buildAuthCell({
    paymentIdUint256,
    subscriberWallet: payment.subscriberWallet,
    referrerWallet,
    amountNanoton: payment.grossAmountNanoton,
    commissionNanoton,
    expiryUnix,
    nonce
  });

  const signatureHex = signAuthCell(authCell, privateKeyHex);
  const body = buildSubscribeMessageBody({
    paymentIdUint256,
    subscriberWallet: payment.subscriberWallet,
    referrerWallet,
    amountNanoton: payment.grossAmountNanoton,
    commissionNanoton,
    expiryUnix,
    nonce,
    signatureHex
  });

  return {
    paymentIdUint256: paymentIdUint256.toString(),
    authorizationNonce: nonce.toString(),
    signatureHex,
    payloadBoc: body.toBoc().toString('base64'),
    authCellHash: authCell.hash().toString('hex'),
    commissionNanoton: String(commissionNanoton),
    authReferrerWallet: referrerWallet
  };
}

/** Signer-authorized sweep of bounced / excess contract balance to treasury. */
export function buildSignedSweepExcessPayload({ sweepId, minLeaveNanoton = '0', expiryUnix, nonce }) {
  const privateKeyHex = getPaymentSignerPrivateKeyHex();
  if (!privateKeyHex) {
    throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is not configured');
  }

  const authCell = beginCell()
    .storeUint(OP_SWEEP_EXCESS, 32)
    .storeUint(BigInt(sweepId), 256)
    .storeCoins(BigInt(minLeaveNanoton))
    .storeUint(BigInt(expiryUnix), 64)
    .storeUint(BigInt(nonce), 64)
    .endCell();

  const signatureHex = signAuthCell(authCell, privateKeyHex);
  const sigPart = beginCell()
    .storeUint(BigInt(`0x${signatureHex}`), 512)
    .endCell();

  const body = beginCell()
    .storeUint(OP_SWEEP_EXCESS, 32)
    .storeUint(BigInt(sweepId), 256)
    .storeCoins(BigInt(minLeaveNanoton))
    .storeUint(BigInt(expiryUnix), 64)
    .storeUint(BigInt(nonce), 64)
    .storeRef(sigPart)
    .endCell();

  return {
    payloadBoc: body.toBoc().toString('base64'),
    signatureHex,
    authCellHash: authCell.hash().toString('hex')
  };
}

export function generateAuthorizationNonce() {
  return crypto.randomBytes(8).readBigUInt64BE(0).toString();
}
