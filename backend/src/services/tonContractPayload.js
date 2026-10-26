import crypto from 'crypto';
import { Address, beginCell } from 'ton-core';
import { keyPairFromSeed, sign } from 'ton-crypto';
import { getPaymentSignerPrivateKeyHex } from '../config/tonConfig.js';

export const OP_SUBSCRIBE = 0x591a2b3c;

/** Deterministic uint256 payment id from Mongo ObjectId hex (24 chars). */
export function paymentIdToUint256(objectId) {
  const hex = String(objectId).replace(/[^a-fA-F0-9]/g, '');
  const padded = hex.padStart(64, '0').slice(-64);
  return BigInt(`0x${padded}`);
}

export function buildAuthCell({
  paymentIdUint256,
  subscriberWallet,
  referrerWallet,
  amountNanoton,
  expiryUnix,
  nonce
}) {
  return beginCell()
    .storeUint(paymentIdUint256, 256)
    .storeAddress(Address.parse(subscriberWallet))
    .storeAddress(Address.parse(referrerWallet))
    .storeCoins(BigInt(amountNanoton))
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
  expiryUnix,
  nonce,
  signatureHex
}) {
  const authPart = beginCell()
    .storeUint(paymentIdUint256, 256)
    .storeAddress(Address.parse(subscriberWallet))
    .storeAddress(Address.parse(referrerWallet))
    .storeCoins(BigInt(amountNanoton))
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

  const authCell = buildAuthCell({
    paymentIdUint256,
    subscriberWallet: payment.subscriberWallet,
    referrerWallet: payment.referrerWallet,
    amountNanoton: payment.grossAmountNanoton,
    expiryUnix,
    nonce
  });

  const signatureHex = signAuthCell(authCell, privateKeyHex);
  const body = buildSubscribeMessageBody({
    paymentIdUint256,
    subscriberWallet: payment.subscriberWallet,
    referrerWallet: payment.referrerWallet,
    amountNanoton: payment.grossAmountNanoton,
    expiryUnix,
    nonce,
    signatureHex
  });

  return {
    paymentIdUint256: paymentIdUint256.toString(),
    authorizationNonce: nonce.toString(),
    signatureHex,
    payloadBoc: body.toBoc().toString('base64'),
    authCellHash: authCell.hash().toString('hex')
  };
}

export function generateAuthorizationNonce() {
  return crypto.randomBytes(8).readBigUInt64BE(0).toString();
}
