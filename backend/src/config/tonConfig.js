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

/**
 * v3.1-net-50-50:
 * On-chain distributable = amount - RAWRESERVE(exec) - GETFORWARDFEE×N
 * commission>0 → 50/50 of that net (eligibility flag); commission==0 → all to treasury.
 * Off-chain computePaymentSplit values are ESTIMATES only (reserve ≠ actual gas).
 */
export const FEE_POLICY_VERSION = 'v3.1-net-50-50';
export const SPLIT_VERSION = 'v3.1-net-50-50';

/** Default subscription gross amount in TON (testnet). Override via TON_SUBSCRIPTION_AMOUNT. */
export const DEFAULT_SUBSCRIPTION_TON = 0.1;

/** Subscription duration in days after confirmed settlement. */
export const DEFAULT_SUBSCRIPTION_DAYS = 30;

/** Mirrors ReferralPayment.fc OUT_MSG_BITS / OUT_MSG_CELLS forward-fee estimate inputs. */
export const OUT_MSG_BITS = 6 + 267 + 124 + 1 + 4 + 4 + 64 + 32 + 1 + 1;
export const OUT_MSG_CELLS = 1;

/** Mirrors contract EXEC_BASE_GAS + EXEC_DICT_OP (RAWRESERVE lock — not realized gas). */
export const EXEC_RESERVE_NANOTON = BigInt(4_000_000 + 3_500_000);

/**
 * Conservative off-chain estimate of one forward fee (contract uses GETFORWARDFEE on-chain).
 * Override via TON_TESTNET_FWD_FEE_NANOTON for quotes/tests only.
 * Scenario A measured ~44k–107k per msg; default stays conservative for UI estimates.
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
 * ESTIMATE only — mirrors on-chain fee-aware net formula with configurable fwd-fee guess.
 * On-chain truth: RAWRESERVE(exec) + GETFORWARDFEE×N, then 50/50 of remainder when eligible.
 *
 * Rounding: referrer = floor(net/2), treasury = net - referrer (odd nano → treasury).
 * Unused RAWRESERVE stays on the contract (not discarded; recoverable via sweep_excess).
 *
 * @param {bigint|string|number} grossNanoton
 * @param {{ commissionEligible?: boolean, forwardFeePerMessageNanoton?: bigint }} [options]
 */
export function computePaymentSplit(grossNanoton, options = {}) {
  const commissionEligible = Boolean(options.commissionEligible);
  const gross = BigInt(grossNanoton);
  const fwdFee =
    options.forwardFeePerMessageNanoton != null
      ? BigInt(options.forwardFeePerMessageNanoton)
      : getEstimatedForwardFeeNanoton();
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
    commissionEligible,
    /** Signed on-chain eligibility value (>0 when eligible). Payout amounts come from actual net. */
    commissionAuthNanoton: commissionEligible ? 1n : 0n,
    isEstimate: true,
    feePolicyNote:
      'Estimates only. On-chain: RAWRESERVE(exec) + GETFORWARDFEE×N, then 50/50 of net if eligible. Unused reserve stays on contract.'
  };
}

/**
 * From observed outbound legs, derive actual net and whether 50/50 holds.
 * Treasury may be referrerShare or referrerShare+1 (odd nano rule).
 */
export function reconcileNetSplit({ referrerValueNanoton, treasuryValueNanoton, commissionEligible }) {
  const ref = BigInt(referrerValueNanoton || 0);
  const tre = BigInt(treasuryValueNanoton || 0);
  if (!commissionEligible) {
    return {
      ok: ref === 0n && tre > 0n,
      netNanoton: tre,
      referrerShareNanoton: 0n,
      treasuryShareNanoton: tre,
      balanced50_50: false
    };
  }
  const net = ref + tre;
  const expectedRef = net / 2n;
  const expectedTre = net - expectedRef;
  const balanced50_50 = ref === expectedRef && tre === expectedTre;
  return {
    ok: balanced50_50 && ref > 0n,
    netNanoton: net,
    referrerShareNanoton: ref,
    treasuryShareNanoton: tre,
    balanced50_50
  };
}
