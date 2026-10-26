import crypto from 'crypto';
import Payment from '../models/Payment.js';
import ReferralTonPayout from '../models/ReferralTonPayout.js';
import User from '../models/User.js';
import {
  FEE_POLICY_VERSION,
  SPLIT_VERSION,
  TON_NETWORK,
  assertTestnetOnly,
  computePaymentSplit,
  getContractAddress,
  getSubscriptionAmountNanoton,
  getSubscriptionDurationMs,
  getTreasuryAddress
} from '../config/tonConfig.js';
import { buildAuthorizationPayload, isSignerConfigured } from '../services/tonAuthSigner.js';
import {
  buildSignedSubscribePayload,
  generateAuthorizationNonce,
  paymentIdToUint256
} from '../services/tonContractPayload.js';
import {
  discoverContractPaymentTx,
  getTestnetExplorerTxUrl,
  inspectPayoutLegs,
  looksLikeBocNotHash,
  verifyInboundTonPayment,
  verifyOutboundTonPayout
} from '../services/tonChainService.js';
import { requireVerifiedWallet } from '../services/tonProofService.js';

const AUTHORIZATION_TTL_MS = 15 * 60 * 1000;
const COMMISSION_LOCK_TTL_MS = AUTHORIZATION_TTL_MS + 5 * 60 * 1000;

const OPEN_STATUSES = ['AUTHORIZED', 'SUBMITTED', 'PROCESSING', 'PARTIALLY_SETTLED'];

function serializePayment(payment, extras = {}) {
  return {
    id: payment._id,
    status: payment.status,
    paymentKind: payment.paymentKind,
    network: payment.network,
    isFirstPayment: payment.isFirstPayment,
    grossAmountNanoton: payment.grossAmountNanoton,
    executionReserveNanoton: payment.executionReserveNanoton,
    outgoingFeesNanoton: payment.outgoingFeesNanoton,
    netAmountNanoton: payment.netAmountNanoton,
    referrerShareNanoton: payment.referrerShareNanoton,
    treasuryShareNanoton: payment.treasuryShareNanoton,
    commissionNanoton: payment.referrerShareNanoton || '0',
    subscriberWallet: payment.subscriberWallet,
    referrerWallet: payment.referrerWallet,
    treasuryWallet: payment.treasuryWallet,
    contractAddress: payment.contractAddress,
    contractPayloadBoc: payment.contractPayloadBoc,
    paymentIdUint256: payment.paymentIdUint256,
    authorizationNonce: payment.authorizationNonce,
    inboundTxHash: payment.inboundTxHash,
    referrerPayoutTxHash: payment.referrerPayoutTxHash,
    treasuryPayoutTxHash: payment.treasuryPayoutTxHash,
    authorizationPayload: payment.authorizationPayload,
    feePolicyVersion: payment.feePolicyVersion,
    splitVersion: payment.splitVersion,
    expiresAt: payment.expiresAt,
    failureReason: payment.failureReason,
    settlementNotes: payment.settlementNotes,
    confirmedAt: payment.confirmedAt,
    subscriptionStartsAt: payment.subscriptionStartsAt,
    subscriptionExpiresAt: payment.subscriptionExpiresAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    explorerUrls: {
      inbound: payment.inboundTxHash ? getTestnetExplorerTxUrl(payment.inboundTxHash) : null,
      referrerPayout: payment.referrerPayoutTxHash
        ? getTestnetExplorerTxUrl(payment.referrerPayoutTxHash)
        : null,
      treasuryPayout: payment.treasuryPayoutTxHash
        ? getTestnetExplorerTxUrl(payment.treasuryPayoutTxHash)
        : null
    },
    ...extras
  };
}

function economicRuleFor(commissionEligible) {
  if (commissionEligible) {
    return 'First successful payment only: after fees, 50% of distributable goes to the verified referrer and 50% to treasury (odd nanotons → treasury).';
  }
  return 'Renewal or no eligible referrer: after fees, 100% of distributable goes to treasury. Commission is not paid again.';
}

/**
 * Eligibility is consumed only on CONFIRMED with commission > 0.
 * Failed / expired intents release the lock and do not consume eligibility.
 * Concurrent intents: atomic lock on User.tonFirstCommissionLockPaymentId.
 */
async function resolveCommissionEligibility(subscriber, referrerWallet) {
  if (!referrerWallet) {
    return { commissionEligible: false, isFirstPayment: false, reason: 'no_verified_referrer' };
  }

  if (subscriber.tonFirstCommissionConsumed) {
    return { commissionEligible: false, isFirstPayment: false, reason: 'first_commission_consumed' };
  }

  const confirmedCount = await Payment.countDocuments({
    userId: String(subscriber.telegramId),
    paymentKind: 'TON_SUBSCRIPTION',
    status: 'CONFIRMED'
  });
  if (confirmedCount > 0) {
    return { commissionEligible: false, isFirstPayment: false, reason: 'prior_confirmed_payment' };
  }

  const lockExpiredBefore = new Date(Date.now() - COMMISSION_LOCK_TTL_MS);
  if (
    subscriber.tonFirstCommissionLockPaymentId &&
    subscriber.tonFirstCommissionLockAt &&
    subscriber.tonFirstCommissionLockAt > lockExpiredBefore
  ) {
    const lockedPayment = await Payment.findById(subscriber.tonFirstCommissionLockPaymentId);
    if (lockedPayment && OPEN_STATUSES.includes(lockedPayment.status)) {
      return {
        commissionEligible: false,
        isFirstPayment: true,
        reason: 'first_commission_locked_by_open_intent',
        lockedPaymentId: String(lockedPayment._id)
      };
    }
  }

  return { commissionEligible: true, isFirstPayment: true, reason: 'eligible' };
}

async function acquireFirstCommissionLock(telegramId, paymentId) {
  const lockExpiredBefore = new Date(Date.now() - COMMISSION_LOCK_TTL_MS);
  const updated = await User.findOneAndUpdate(
    {
      telegramId: String(telegramId),
      tonFirstCommissionConsumed: { $ne: true },
      $or: [
        { tonFirstCommissionLockPaymentId: null },
        { tonFirstCommissionLockPaymentId: { $exists: false } },
        { tonFirstCommissionLockAt: { $lte: lockExpiredBefore } },
        { tonFirstCommissionLockAt: null }
      ]
    },
    {
      tonFirstCommissionLockPaymentId: paymentId,
      tonFirstCommissionLockAt: new Date()
    },
    { new: true }
  );
  return Boolean(updated);
}

async function releaseFirstCommissionLock(telegramId, paymentId) {
  await User.updateOne(
    {
      telegramId: String(telegramId),
      tonFirstCommissionLockPaymentId: paymentId
    },
    {
      $unset: { tonFirstCommissionLockPaymentId: 1, tonFirstCommissionLockAt: 1 }
    }
  );
}

export async function createTonSubscriptionIntent(telegramId) {
  assertTestnetOnly(TON_NETWORK);

  const subscriber = await requireVerifiedWallet(telegramId);

  let referrerWallet = null;
  let referrerId = null;

  if (subscriber.referrerId) {
    const referrer = await User.findOne({ telegramId: subscriber.referrerId });
    if (referrer?.walletVerified && referrer.walletAddress) {
      referrerWallet = referrer.walletAddress;
      referrerId = referrer.telegramId;
    }
  }

  const grossNanoton = getSubscriptionAmountNanoton();
  const treasuryWallet = getTreasuryAddress();
  const contractAddress = getContractAddress();

  const eligibility = await resolveCommissionEligibility(subscriber, referrerWallet);
  let commissionEligible = eligibility.commissionEligible;

  const split = computePaymentSplit(grossNanoton, { commissionEligible });
  const externalPaymentId = `ton-sub-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + AUTHORIZATION_TTL_MS);

  const payment = await Payment.create({
    userId: String(telegramId),
    externalPaymentId,
    paymentKind: 'TON_SUBSCRIPTION',
    status: 'PENDING',
    amount: Number(grossNanoton) / 1e9,
    currency: 'TON',
    network: TON_NETWORK,
    grossAmountNanoton: split.grossNanoton.toString(),
    executionReserveNanoton: split.executionReserveNanoton.toString(),
    outgoingFeesNanoton: split.outgoingFeesNanoton.toString(),
    netAmountNanoton: split.netAmountNanoton.toString(),
    referrerShareNanoton: split.referrerShareNanoton.toString(),
    treasuryShareNanoton: split.treasuryShareNanoton.toString(),
    subscriberWallet: subscriber.walletAddress,
    referrerId: commissionEligible ? referrerId : referrerId,
    referrerWallet: commissionEligible ? referrerWallet : null,
    treasuryWallet,
    contractAddress,
    feePolicyVersion: FEE_POLICY_VERSION,
    splitVersion: SPLIT_VERSION,
    expiresAt,
    isFirstPayment: eligibility.isFirstPayment || commissionEligible,
    referrerRewardGranted: false
  });

  payment.paymentIdUint256 = paymentIdToUint256(payment._id).toString();

  if (commissionEligible) {
    const locked = await acquireFirstCommissionLock(telegramId, payment._id);
    if (!locked) {
      commissionEligible = false;
      const renewalSplit = computePaymentSplit(grossNanoton, { commissionEligible: false });
      payment.executionReserveNanoton = renewalSplit.executionReserveNanoton.toString();
      payment.outgoingFeesNanoton = renewalSplit.outgoingFeesNanoton.toString();
      payment.netAmountNanoton = renewalSplit.netAmountNanoton.toString();
      payment.referrerShareNanoton = '0';
      payment.treasuryShareNanoton = renewalSplit.treasuryShareNanoton.toString();
      payment.referrerWallet = null;
      payment.isFirstPayment = false;
      payment.settlementNotes = 'Concurrent first-commission lock held by another intent; treating as treasury-only';
    }
  }

  if (!contractAddress) {
    payment.status = 'FAILED';
    payment.failureReason = 'TON_TESTNET_REFERRAL_CONTRACT_ADDRESS is not configured';
    await payment.save();
    if (commissionEligible) await releaseFirstCommissionLock(telegramId, payment._id);
    throw new Error('TON_TESTNET_REFERRAL_CONTRACT_ADDRESS is not configured');
  }

  if (!isSignerConfigured()) {
    payment.status = 'FAILED';
    payment.failureReason = 'Server payment signer not configured';
    await payment.save();
    if (commissionEligible) await releaseFirstCommissionLock(telegramId, payment._id);
    throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is not configured');
  }

  payment.authorizationNonce = generateAuthorizationNonce();
  const signed = buildSignedSubscribePayload(payment);
  payment.contractPayloadBoc = signed.payloadBoc;
  payment.authorizationPayload = buildAuthorizationPayload(payment);
  payment.status = 'AUTHORIZED';
  await payment.save();

  return {
    payment: serializePayment(payment, {
      referrerEligible: commissionEligible,
      canAuthorizePayout: true,
      commissionEligible,
      eligibilityReason: eligibility.reason,
      estimatedFeesNote:
        'Execution and forward fees are reserved on-chain via RAWRESERVE/GETFORWARDFEE; estimates may differ slightly from actual.',
      economicRule: economicRuleFor(commissionEligible)
    })
  };
}

export async function getTonPaymentForUser(paymentId, telegramId) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.userId !== String(telegramId)) {
    throw new Error('Payment not found');
  }
  if (payment.paymentKind !== 'TON_SUBSCRIPTION') {
    throw new Error('Not a TON subscription payment');
  }
  return serializePayment(payment);
}

export async function submitTonPaymentTx(paymentId, telegramId, inboundTxHash, options = {}) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.userId !== String(telegramId)) {
    throw new Error('Payment not found');
  }

  if (!['AUTHORIZED', 'SUBMITTED', 'PROCESSING', 'PARTIALLY_SETTLED'].includes(payment.status)) {
    throw new Error(`Cannot submit payment in status ${payment.status}`);
  }

  if (payment.expiresAt && payment.expiresAt < new Date() && payment.status === 'AUTHORIZED') {
    payment.status = 'EXPIRED';
    await payment.save();
    await releaseFirstCommissionLock(telegramId, payment._id);
    throw new Error('Payment authorization expired');
  }

  const raw = inboundTxHash != null ? String(inboundTxHash) : '';
  if (looksLikeBocNotHash(raw) || options.inboundBoc) {
    payment.inboundBoc = options.inboundBoc || raw;
    // Do not treat BOC as a chain hash — discover later
    if (!payment.inboundTxHash || looksLikeBocNotHash(payment.inboundTxHash)) {
      payment.inboundTxHash = null;
    }
  } else if (raw) {
    payment.inboundTxHash = raw;
  }

  payment.status = 'SUBMITTED';
  await payment.save();

  return confirmTonPayment(paymentId, telegramId, { fromSubmit: true, allowPending: true });
}

async function activateSubscription(payment) {
  const durationMs = getSubscriptionDurationMs();
  const user = await User.findOne({ telegramId: payment.userId });
  if (!user) return null;

  const now = new Date();
  const base =
    user.tonSubscriptionExpiresAt && user.tonSubscriptionExpiresAt > now
      ? user.tonSubscriptionExpiresAt
      : now;
  const expiresAt = new Date(base.getTime() + durationMs);

  if (
    user.tonSubscriptionLastPaymentId &&
    String(user.tonSubscriptionLastPaymentId) === String(payment._id)
  ) {
    payment.subscriptionStartsAt = user.tonSubscriptionActivatedAt || now;
    payment.subscriptionExpiresAt = user.tonSubscriptionExpiresAt;
    return user;
  }

  user.tonSubscriptionActive = true;
  user.tonSubscriptionActivatedAt = user.tonSubscriptionActivatedAt || now;
  user.tonSubscriptionExpiresAt = expiresAt;
  user.tonSubscriptionLastPaymentId = payment._id;

  const commission = BigInt(payment.referrerShareNanoton || '0');
  if (commission > 0n && payment.isFirstPayment) {
    user.tonFirstCommissionConsumed = true;
  }
  user.tonFirstCommissionLockPaymentId = undefined;
  user.tonFirstCommissionLockAt = undefined;
  await user.save();

  payment.subscriptionStartsAt = now;
  payment.subscriptionExpiresAt = expiresAt;
  return user;
}

export async function confirmTonPayment(paymentId, telegramId, options = {}) {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (telegramId && payment.userId !== String(telegramId)) {
    throw new Error('Payment not found');
  }

  if (payment.paymentKind !== 'TON_SUBSCRIPTION') {
    throw new Error('Not a TON subscription payment');
  }

  if (payment.status === 'CONFIRMED') {
    return { payment: serializePayment(payment), alreadyConfirmed: true };
  }

  if (
    payment.expiresAt &&
    payment.expiresAt < new Date() &&
    !['SUBMITTED', 'PROCESSING', 'PARTIALLY_SETTLED'].includes(payment.status)
  ) {
    payment.status = 'EXPIRED';
    await payment.save();
    await releaseFirstCommissionLock(payment.userId, payment._id);
    throw new Error('Payment authorization expired');
  }

  payment.status = 'PROCESSING';
  payment.reconciliationAttempts = (payment.reconciliationAttempts || 0) + 1;
  await payment.save();

  const recipient = payment.contractAddress || payment.treasuryWallet;
  const needsCommission = BigInt(payment.referrerShareNanoton || '0') > 0n;

  // Resolve real inbound tx (BOC from TON Connect is not a hash).
  // Never invent a settlement without submit evidence (hash or BOC).
  let inboundMeta = null;
  const hasSubmitEvidence = Boolean(
    payment.inboundBoc ||
      (payment.inboundTxHash && !looksLikeBocNotHash(payment.inboundTxHash))
  );

  if (!hasSubmitEvidence) {
    payment.status = options.allowPending ? 'AUTHORIZED' : 'FAILED';
    payment.failureReason = 'No submitted transaction evidence (hash or BOC)';
    payment.settlementNotes =
      'Frontend success alone never activates subscription; submit a chain tx first.';
    await payment.save();
    if (options.allowPending) {
      return { payment: serializePayment(payment), pending: true };
    }
    throw new Error(payment.failureReason);
  }

  if (!payment.inboundTxHash || looksLikeBocNotHash(payment.inboundTxHash)) {
    inboundMeta = await discoverContractPaymentTx({
      contractAddress: recipient,
      expectedSender: payment.subscriberWallet,
      minValueNanoton: payment.grossAmountNanoton,
      exactValueNanoton: payment.grossAmountNanoton,
      knownTxHash: looksLikeBocNotHash(payment.inboundTxHash) ? null : payment.inboundTxHash
    });
    if (inboundMeta.found && inboundMeta.txHash) {
      // Never bind an inbound hash already claimed by another payment (prevents false confirm)
      const claimed = await Payment.findOne({
        _id: { $ne: payment._id },
        inboundTxHash: inboundMeta.txHash,
        status: { $in: ['SUBMITTED', 'PROCESSING', 'PARTIALLY_SETTLED', 'CONFIRMED'] }
      });
      if (claimed) {
        inboundMeta = { found: false, reason: 'inbound_tx_already_claimed' };
      } else {
        payment.inboundTxHash = inboundMeta.txHash;
        await payment.save();
      }
    }
  }

  if (!payment.inboundTxHash || looksLikeBocNotHash(payment.inboundTxHash)) {
    payment.status = options.allowPending ? 'PROCESSING' : 'FAILED';
    payment.failureReason = inboundMeta?.reason || 'Inbound transaction not yet visible on-chain';
    payment.settlementNotes =
      'Waiting for contract inbound tx. TON Connect BOC alone never activates subscription.';
    await payment.save();
    if (options.allowPending) {
      return { payment: serializePayment(payment), pending: true };
    }
    throw new Error(payment.failureReason);
  }

  const inbound = inboundMeta?.found
    ? inboundMeta
    : await verifyInboundTonPayment({
        txHash: payment.inboundTxHash,
        expectedRecipient: recipient,
        expectedSender: payment.subscriberWallet,
        minValueNanoton: payment.grossAmountNanoton
      });

  if (!inbound.found) {
    payment.status = options.allowPending ? 'PROCESSING' : 'FAILED';
    payment.failureReason = inbound.reason || 'Inbound tx not verified';
    await payment.save();
    if (options.allowPending) {
      return { payment: serializePayment(payment), pending: true };
    }
    throw new Error(payment.failureReason);
  }

  // Auto-attach payout hashes: on TON, outbound messages are on the same contract tx
  if (!payment.treasuryPayoutTxHash) {
    payment.treasuryPayoutTxHash = payment.inboundTxHash;
  }
  if (needsCommission && payment.referrerWallet && !payment.referrerPayoutTxHash) {
    payment.referrerPayoutTxHash = payment.inboundTxHash;
  }

  const outMsgs = inbound.outMsgs || [];
  let referrerVerified = !needsCommission;
  let treasuryVerified = false;

  if (outMsgs.length > 0) {
    const legs = inspectPayoutLegs({
      outMsgs,
      referrerWallet: payment.referrerWallet,
      treasuryWallet: payment.treasuryWallet,
      referrerShareNanoton: payment.referrerShareNanoton,
      treasuryShareNanoton: payment.treasuryShareNanoton
    });
    if (needsCommission) {
      referrerVerified = Boolean(legs.referrer);
    }
    treasuryVerified = Boolean(legs.treasury);
    if (legs.bouncedCount > 0) {
      payment.settlementNotes = `Detected ${legs.bouncedCount} bounced out_msg(s); funds may be locked in contract pending sweep_excess`;
    }
  } else {
    if (needsCommission && payment.referrerWallet && payment.referrerPayoutTxHash) {
      const refOut = await verifyOutboundTonPayout({
        txHash: payment.referrerPayoutTxHash,
        expectedSender: recipient,
        expectedRecipient: payment.referrerWallet,
        minValueNanoton: payment.referrerShareNanoton
      });
      referrerVerified = refOut.found;
    }
    if (payment.treasuryPayoutTxHash) {
      const treOut = await verifyOutboundTonPayout({
        txHash: payment.treasuryPayoutTxHash,
        expectedSender: recipient,
        expectedRecipient: payment.treasuryWallet,
        minValueNanoton: payment.treasuryShareNanoton
      });
      treasuryVerified = treOut.found;
    }
  }

  // Mock chain path: when TON_CHAIN_MOCK and mock hashes, trust verifyOutbound helpers
  if (process.env.TON_CHAIN_MOCK === 'true' && String(payment.inboundTxHash).startsWith('mock-')) {
    if (needsCommission && payment.referrerPayoutTxHash) {
      const refOut = await verifyOutboundTonPayout({
        txHash: payment.referrerPayoutTxHash,
        expectedSender: recipient,
        expectedRecipient: payment.referrerWallet,
        minValueNanoton: payment.referrerShareNanoton
      });
      referrerVerified = refOut.found;
    } else if (!needsCommission) {
      referrerVerified = true;
    }
    if (payment.treasuryPayoutTxHash) {
      const treOut = await verifyOutboundTonPayout({
        txHash: payment.treasuryPayoutTxHash,
        expectedSender: recipient,
        expectedRecipient: payment.treasuryWallet,
        minValueNanoton: payment.treasuryShareNanoton
      });
      treasuryVerified = treOut.found;
    }
  }

  await payment.save();

  if (referrerVerified && treasuryVerified) {
    payment.status = 'CONFIRMED';
    payment.confirmedAt = new Date();
    payment.failureReason = null;
    await activateSubscription(payment);
    await payment.save();
    if (needsCommission) {
      await recordTonReferralPayoutIfNeeded(payment);
    }
    return { payment: serializePayment(payment), confirmed: true };
  }

  if (referrerVerified || treasuryVerified) {
    payment.status = 'PARTIALLY_SETTLED';
    payment.failureReason = 'One or more outbound payouts not yet verified on-chain (or bounced)';
    await payment.save();
    // Do NOT grant referral ledger or activate subscription on partial settlement
    return { payment: serializePayment(payment), partiallySettled: true };
  }

  payment.status = 'PROCESSING';
  payment.failureReason = 'Awaiting outbound payout confirmation';
  await payment.save();
  return { payment: serializePayment(payment), pending: true };
}

async function recordTonReferralPayoutIfNeeded(payment) {
  if (!payment.referrerWallet || !payment.referrerShareNanoton || !payment.referrerId) return null;
  if (BigInt(payment.referrerShareNanoton) <= 0n) return null;
  if (payment.status !== 'CONFIRMED') return null;

  const existing = await ReferralTonPayout.findOne({ paymentId: payment._id });
  if (existing?.status === 'CONFIRMED') return existing;

  let payout = existing;
  if (!payout) {
    payout = await ReferralTonPayout.create({
      referrerId: payment.referrerId,
      referredUserId: payment.userId,
      paymentId: payment._id,
      amountNanoton: payment.referrerShareNanoton,
      txHash: payment.referrerPayoutTxHash,
      status: payment.referrerPayoutTxHash ? 'CONFIRMED' : 'PENDING',
      network: TON_NETWORK,
      confirmedAt: payment.referrerPayoutTxHash ? new Date() : null
    });
  } else if (payment.referrerPayoutTxHash && payout.status !== 'CONFIRMED') {
    payout.status = 'CONFIRMED';
    payout.txHash = payment.referrerPayoutTxHash;
    payout.confirmedAt = new Date();
    await payout.save();
  }

  if (payout.status === 'CONFIRMED' && payment.referrerId && !payment.referrerRewardGranted) {
    const referrer = await User.findOne({ telegramId: payment.referrerId });
    if (referrer) {
      const current = BigInt(referrer.tonSubscriptionReferralEarningsNanoton || '0');
      const add = BigInt(payment.referrerShareNanoton || '0');
      referrer.tonSubscriptionReferralEarningsNanoton = (current + add).toString();
      await referrer.save();
    }
    payment.referrerRewardGranted = true;
    await payment.save();
  }

  return payout;
}

export async function recordOutboundPayoutTxHashes(paymentId, telegramId, payload) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.userId !== String(telegramId)) {
    throw new Error('Payment not found');
  }

  if (payload.referrerPayoutTxHash) {
    payment.referrerPayoutTxHash = String(payload.referrerPayoutTxHash);
  }
  if (payload.treasuryPayoutTxHash) {
    payment.treasuryPayoutTxHash = String(payload.treasuryPayoutTxHash);
  }

  await payment.save();
  return confirmTonPayment(paymentId, telegramId, { allowPending: true });
}

export async function getTonPaymentHistory(telegramId) {
  const asSubscriber = await Payment.find({
    userId: String(telegramId),
    paymentKind: 'TON_SUBSCRIPTION'
  })
    .sort({ createdAt: -1 })
    .limit(50);

  const payouts = await ReferralTonPayout.find({ referrerId: String(telegramId) })
    .populate('paymentId')
    .sort({ createdAt: -1 })
    .limit(50);

  const user = await User.findOne({ telegramId: String(telegramId) });

  return {
    subscription: user
      ? {
          active: Boolean(
            user.tonSubscriptionActive &&
              user.tonSubscriptionExpiresAt &&
              new Date(user.tonSubscriptionExpiresAt) > new Date()
          ),
          expiresAt: user.tonSubscriptionExpiresAt || null,
          activatedAt: user.tonSubscriptionActivatedAt || null,
          firstCommissionConsumed: Boolean(user.tonFirstCommissionConsumed)
        }
      : null,
    subscriptions: asSubscriber.map((p) => serializePayment(p)),
    referralTonPayouts: payouts.map((p) => ({
      id: p._id,
      referredUserId: p.referredUserId,
      amountNanoton: p.amountNanoton,
      status: p.status,
      txHash: p.txHash,
      network: p.network,
      createdAt: p.createdAt,
      confirmedAt: p.confirmedAt,
      explorerUrl: p.txHash ? getTestnetExplorerTxUrl(p.txHash) : null,
      paymentStatus: p.paymentId?.status || null
    }))
  };
}

export async function getTonSubscriptionQuote(telegramId) {
  assertTestnetOnly(TON_NETWORK);
  const grossNanoton = getSubscriptionAmountNanoton();

  let commissionEligible = false;
  if (telegramId) {
    try {
      const subscriber = await User.findOne({ telegramId: String(telegramId) });
      let referrerWallet = null;
      if (subscriber?.referrerId) {
        const referrer = await User.findOne({ telegramId: subscriber.referrerId });
        if (referrer?.walletVerified && referrer.walletAddress) {
          referrerWallet = referrer.walletAddress;
        }
      }
      if (subscriber) {
        const eligibility = await resolveCommissionEligibility(subscriber, referrerWallet);
        commissionEligible = eligibility.commissionEligible;
      }
    } catch {
      commissionEligible = false;
    }
  }

  const split = computePaymentSplit(grossNanoton, { commissionEligible });

  return {
    network: TON_NETWORK,
    grossAmountNanoton: split.grossNanoton.toString(),
    grossAmountTon: Number(split.grossNanoton) / 1e9,
    executionReserveNanoton: split.executionReserveNanoton.toString(),
    executionReserveTon: Number(split.executionReserveNanoton) / 1e9,
    outgoingFeesNanoton: split.outgoingFeesNanoton.toString(),
    outgoingFeesTon: Number(split.outgoingFeesNanoton) / 1e9,
    estimatedNetNanoton: split.netAmountNanoton.toString(),
    estimatedNetTon: Number(split.netAmountNanoton) / 1e9,
    estimatedReferrerShareNanoton: split.referrerShareNanoton.toString(),
    estimatedTreasuryShareNanoton: split.treasuryShareNanoton.toString(),
    commissionEligible,
    subscriptionDurationDays: Number(process.env.TON_SUBSCRIPTION_DURATION_DAYS || 30),
    feePolicyVersion: FEE_POLICY_VERSION,
    splitVersion: SPLIT_VERSION,
    feePolicy:
      'On-chain V3 router reserves execution gas (RAWRESERVE) and forward fees (GETFORWARDFEE × outbound count), then routes commission (if any) and remainder to treasury. Odd nanotons → treasury on 50/50.',
    contractAddress: getContractAddress(),
    treasuryAddress: process.env.TON_TESTNET_TREASURY_ADDRESS || null,
    economicRule: economicRuleFor(commissionEligible)
  };
}
