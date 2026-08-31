import crypto from 'crypto';
import { getPaymentSignerPrivateKeyHex, getPaymentSignerPublicKeyHex } from '../config/tonConfig.js';

const SIGNATURE_ALGO = 'ed25519';

function getPrivateKeyObject() {
  const hex = getPaymentSignerPrivateKeyHex();
  if (!hex) {
    throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is not configured');
  }
  const raw = Buffer.from(hex.replace(/^0x/, ''), 'hex');
  if (raw.length !== 32 && raw.length !== 64) {
    throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY must be 32 or 64 byte hex');
  }
  const seed = raw.length === 64 ? raw.slice(0, 32) : raw;
  return crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'),
      seed
    ]),
    format: 'der',
    type: 'pkcs8'
  });
}

export function getSignerPublicKeyHex() {
  const fromEnv = getPaymentSignerPublicKeyHex();
  if (fromEnv) return fromEnv.replace(/^0x/, '');

  const privateKey = getPrivateKeyObject();
  const publicKeyDer = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  return publicKeyDer.subarray(-32).toString('hex');
}

/**
 * Canonical authorization payload signed by backend only (never trust client fields).
 */
export function buildAuthorizationPayload(payment) {
  return {
    v: 1,
    paymentId: String(payment._id),
    subscriberWallet: payment.subscriberWallet,
    referrerWallet: payment.referrerWallet,
    treasuryWallet: payment.treasuryWallet,
    grossAmountNanoton: payment.grossAmountNanoton,
    feeReserveNanoton: payment.feeReserveNanoton,
    netAmountNanoton: payment.netAmountNanoton,
    referrerShareNanoton: payment.referrerShareNanoton,
    treasuryShareNanoton: payment.treasuryShareNanoton,
    contractAddress: payment.contractAddress,
    network: payment.network,
    feePolicyVersion: payment.feePolicyVersion,
    splitVersion: payment.splitVersion,
    expiresAt: payment.expiresAt?.toISOString?.() || payment.expiresAt
  };
}

export function canonicalPayloadString(payload) {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export function signAuthorizationPayload(payload) {
  const privateKey = getPrivateKeyObject();
  const message = Buffer.from(canonicalPayloadString(payload), 'utf8');
  const signature = crypto.sign(null, message, privateKey);
  return signature.toString('hex');
}

export function verifyAuthorizationSignature(payload, signatureHex) {
  try {
    const publicHex = getSignerPublicKeyHex();
    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'),
        Buffer.from(publicHex, 'hex')
      ]),
      format: 'der',
      type: 'spki'
    });
    const message = Buffer.from(canonicalPayloadString(payload), 'utf8');
    return crypto.verify(null, message, publicKey, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

export function isSignerConfigured() {
  return Boolean(getPaymentSignerPrivateKeyHex());
}

export { SIGNATURE_ALGO };
