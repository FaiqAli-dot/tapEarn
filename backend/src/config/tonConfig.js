/**
 * TON testnet configuration. MAINNET is intentionally unsupported.
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

export const FEE_POLICY_VERSION = 'v3-router';
export const SPLIT_VERSION = 'v3-first-commission';

/** Default subscription gross amount in TON (testnet). Override via TON_SUBSCRIPTION_AMOUNT. */
export const DEFAULT_SUBSCRIPTION_TON = 0.1;

/** Subscription duration in days after confirmed settlement. */
export const DEFAULT_SUBSCRIPTION_DAYS = 30;

/** Mirrors ReferralPayment.fc OUT_MSG_BITS / OUT_MSG_CELLS forward-fee estimate inputs. */
export const OUT_MSG_BITS = 6 + 267 + 124 + 1 + 4 + 4 + 64 + 32 + 1 + 1;
export const OUT_MSG_CELLS = 1;

/** Mirrors contract EXEC_BASE_GAS + EXEC_DICT_OP. */
export const EXEC_RESERVE_NANOTON = BigInt(4_000_000 + 3_500_000);

/**
 * Testnet forward-fee lump from config param 25 (approx; contract uses GETFORWARDFEE on-chain).
 * Override via TON_TESTNET_FWD_FEE_NANOTON for integration tests.
 */
export function getEstimatedForwardFeeNanoton() {
  const override = process.env.TON_TESTNET_FWD_FEE_NANOTON;
  if (override) return BigInt(override);
  return 2_500_000n;
}

export function getSubscriptionAmountNanoton() {
  const ton = parseFloat(process.env.TON_SUBSCRIPTION_AMOUNT || String(DEFAULT_SUBSCRIPTION_TON));
  if (!Number.isFinite(ton) || ton <= 0) {
    throw new Error('TON_SUBSCRIPTION_AMOUNT must be a positive number');
  }
  return BigInt(Math.round(ton * 1e9));
}

export function getSubscriptionDurationMs() {
  const days = parseFloat(process.env.TON_SUBSCRIPTION_DURATION_DAYS || String(DEFAULT_SUBSCRIPTION_DAYS));
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('TON_SUBSCRIPTION_DURATION_DAYS must be a positive number');
  }
  return Math.round(days * 24 * 60 * 60 * 1000);
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
 * Estimate split using same formula as on-chain V3 router.
 *
 * @param {bigint|string|number} grossNanoton
 * @param {{ commissionEligible?: boolean }} [options]
 *   commissionEligible true → 50% of distributable to referrer (first payment only).
 *   false → commission 0, full distributable to treasury (1 outbound msg → 1 fwd fee).
 *
 * Odd nanotons: when splitting 50/50, referrer = floor(distributable/2), treasury gets remainder.
 */
export function computePaymentSplit(grossNanoton, options = {}) {
  const commissionEligible = Boolean(options.commissionEligible);
  const gross = BigInt(grossNanoton);
  const fwdFee = getEstimatedForwardFeeNanoton();
  const outCount = commissionEligible ? 2n : 1n;
  const outgoingFees = fwdFee * outCount;
  const executionReserve = EXEC_RESERVE_NANOTON;
  const totalFees = outgoingFees + executionReserve;

  if (gross <= totalFees) {
    throw new Error('Gross amount must exceed estimated execution and forward fees');
  }

  const distributable = gross - totalFees;

  let referrerShare = 0n;
  let treasuryShare = distributable;
  if (commissionEligible) {
    // floor division; odd nanoton remainder → treasury
    referrerShare = distributable / 2n;
    treasuryShare = distributable - referrerShare;
  }

  return {
    grossNanoton: gross,
    executionReserveNanoton: executionReserve,
    outgoingFeesNanoton: outgoingFees,
    forwardFeePerMessageNanoton: fwdFee,
    outboundMessageCount: Number(outCount),
    distributableNanoton: distributable,
    netAmountNanoton: distributable,
    netNanoton: distributable,
    referrerShareNanoton: referrerShare,
    treasuryShareNanoton: treasuryShare,
    commissionNanoton: referrerShare,
    commissionEligible
  };
}
