/**
 * TON testnet configuration. MAINNET is intentionally unsupported in V2.
 */

export const TON_NETWORK = 'testnet';

export const PAYMENT_STATUSES = [
  'PENDING',
  'AUTHORIZED',
  'SUBMITTED',
  'PROCESSING',
  'CONFIRMED',
  'PARTIALLY_SETTLED',
  'FAILED',
  'EXPIRED'
];

export const FEE_POLICY_VERSION = 'v1';
export const SPLIT_VERSION = 'v1';

/** Default subscription gross amount in TON (testnet). Override via TON_SUBSCRIPTION_AMOUNT. */
export const DEFAULT_SUBSCRIPTION_TON = 0.1;

/** Reserved nanotons deducted from gross before 50/50 split (forward fees + processing). */
export const FEE_RESERVE_NANOTON = BigInt(50_000_000); // 0.05 TON

export function getSubscriptionAmountNanoton() {
  const ton = parseFloat(process.env.TON_SUBSCRIPTION_AMOUNT || String(DEFAULT_SUBSCRIPTION_TON));
  if (!Number.isFinite(ton) || ton <= 0) {
    throw new Error('TON_SUBSCRIPTION_AMOUNT must be a positive number');
  }
  return BigInt(Math.round(ton * 1e9));
}

export function getTreasuryAddress() {
  const addr = process.env.TON_TESTNET_TREASURY_ADDRESS;
  if (!addr) {
    throw new Error('TON_TESTNET_TREASURY_ADDRESS is not configured');
  }
  return addr;
}

export function getContractAddress() {
  return process.env.TON_TESTNET_REFERRAL_CONTRACT_ADDRESS || null;
}

export function getTestnetRpcBase() {
  const custom = process.env.TON_TESTNET_RPC_URL;
  if (custom) return custom.replace(/\/$/, '');
  return 'https://testnet.toncenter.com/api/v2';
}

export function getTonApiKey() {
  return process.env.TONCENTER_API_KEY || '';
}

export function getPaymentSignerPrivateKeyHex() {
  return process.env.TON_PAYMENT_SIGNER_PRIVATE_KEY || null;
}

export function getPaymentSignerPublicKeyHex() {
  return process.env.TON_PAYMENT_SIGNER_PUBLIC_KEY || null;
}

export function getTonConnectDomain() {
  return process.env.TON_CONNECT_DOMAIN || 'faiqali-dot.github.io';
}

export function assertTestnetOnly(network) {
  if (network && network !== 'testnet') {
    throw new Error('MAINNET is not supported. Use testnet only.');
  }
}

/**
 * Economic rule: after fee reserve, net is split 50/50 with odd-nanoton remainder to treasury.
 * @returns {{ grossNanoton: bigint, feeReserveNanoton: bigint, netNanoton: bigint, referrerShareNanoton: bigint, treasuryShareNanoton: bigint }}
 */
export function computePaymentSplit(grossNanoton, feeReserveNanoton = FEE_RESERVE_NANOTON) {
  const gross = BigInt(grossNanoton);
  const fees = BigInt(feeReserveNanoton);
  if (gross <= fees) {
    throw new Error('Gross amount must exceed fee reserve');
  }
  const net = gross - fees;
  const referrerShare = net / 2n;
  const treasuryShare = net - referrerShare;
  return {
    grossNanoton: gross,
    feeReserveNanoton: fees,
    netNanoton: net,
    referrerShareNanoton: referrerShare,
    treasuryShareNanoton: treasuryShare
  };
}
