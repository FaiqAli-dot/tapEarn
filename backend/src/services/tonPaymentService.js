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
  getTreasuryAddress
} from '../config/tonConfig.js';
import {
  buildAuthorizationPayload,
  isSignerConfigured,
  signAuthorizationPayload
} from '../services/tonAuthSigner.js';
import {
  getTestnetExplorerTxUrl,
  verifyInboundTonPayment,
  verifyOutboundTonPayout
} from '../services/tonChainService.js';
import { requireVerifiedWallet } from '../services/tonProofService.js';

const AUTHORIZATION_TTL_MS = 15 * 60 * 1000;

function serializePayment(payment, extras = {}) {
  return {
    id: payment._id,
    status: payment.status,
    paymentKind: payment.paymentKind,
    network: payment.network,
    grossAmountNanoton: payment.grossAmountNanoton,
    feeReserveNanoton: payment.feeReserveNanoton,
    netAmountNanoton: payment.netAmountNanoton,
    referrerShareNanoton: payment.referrerShareNanoton,
    treasuryShareNanoton: payment.treasuryShareNanoton,
    subscriberWallet: payment.subscriberWallet,
    referrerWallet: payment.referrerWallet,
    treasuryWallet: payment.treasuryWallet,
    contractAddress: payment.contractAddress,
    inboundTxHash: payment.inboundTxHash,
    referrerPayoutTxHash: payment.referrerPayoutTxHash,
    treasuryPayoutTxHash: payment.treasuryPayoutTxHash,
    authorizationPayload: payment.authorizationPayload,
    authorizationSignature: payment.authorizationSignature,
    feePolicyVersion: payment.feePolicyVersion,
    splitVersion: payment.splitVersion,
    expiresAt: payment.expiresAt,
    failureReason: payment.failureReason,
    confirmedAt: payment.confirmedAt,
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
  const split = computePaymentSplit(grossNanoton);
  const treasuryWallet = getTreasuryAddress();
  const contractAddress = getContractAddress();

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
    feeReserveNanoton: split.feeReserveNanoton.toString(),
    netAmountNanoton: split.netNanoton.toString(),
    referrerShareNanoton: split.referrerShareNanoton.toString(),
    treasuryShareNanoton: split.treasuryShareNanoton.toString(),
    subscriberWallet: subscriber.walletAddress,
    referrerId,
    referrerWallet,
    treasuryWallet,
    contractAddress,
    feePolicyVersion: FEE_POLICY_VERSION,
    splitVersion: SPLIT_VERSION,
    expiresAt,
    isFirstPayment: false,
    referrerRewardGranted: false
  });

  const priorPayments = await Payment.countDocuments({
    userId: String(telegramId),
    paymentKind: 'TON_SUBSCRIPTION',
    status: 'CONFIRMED'
  });
  if (priorPayments === 0) {
    payment.isFirstPayment = true;
  }

  if (!referrerWallet) {
    payment.status = 'AUTHORIZED';
    payment.failureReason = referrerId
      ? 'Referrer has no verified wallet; referrer payout omitted'
      : 'No referrer; treasury receives full net share on-chain';
    await payment.save();
    return {
      payment: serializePayment(payment, {
        referrerEligible: false,
        canAuthorizePayout: false,
        economicRule:
          'After applicable TON transaction and payout fees are deducted, the remaining net subscription amount is split 50/50 between the verified referrer and YORZA.'
      })
    };
  }

  if (!isSignerConfigured()) {
    payment.status = 'FAILED';
    payment.failureReason = 'Server payment signer not configured';
    await payment.save();
    throw new Error('TON_PAYMENT_SIGNER_PRIVATE_KEY is not configured');
  }

  const authorizationPayload = buildAuthorizationPayload(payment);
  const authorizationSignature = signAuthorizationPayload(authorizationPayload);

  payment.authorizationPayload = authorizationPayload;
  payment.authorizationSignature = authorizationSignature;
  payment.status = 'AUTHORIZED';
  await payment.save();

  return {
    payment: serializePayment(payment, {
      referrerEligible: true,
      canAuthorizePayout: true,
      estimatedFeesNote: 'Fee reserve is an estimate; final fees determined on-chain',
      economicRule:
        'After applicable TON transaction and payout fees are deducted, the remaining net subscription amount is split 50/50 between the verified referrer and YORZA.'
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

export async function submitTonPaymentTx(paymentId, telegramId, inboundTxHash) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.userId !== String(telegramId)) {
    throw new Error('Payment not found');
  }

  if (!['AUTHORIZED', 'SUBMITTED', 'PROCESSING'].includes(payment.status)) {
    throw new Error(`Cannot submit payment in status ${payment.status}`);
  }

  if (payment.expiresAt && payment.expiresAt < new Date()) {
    payment.status = 'EXPIRED';
    await payment.save();
    throw new Error('Payment authorization expired');
  }

  payment.inboundTxHash = String(inboundTxHash);
  payment.status = 'SUBMITTED';
  await payment.save();

  return confirmTonPayment(paymentId, telegramId, { fromSubmit: true });
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

  if (payment.expiresAt && payment.expiresAt < new Date() && payment.status !== 'SUBMITTED') {
    payment.status = 'EXPIRED';
    await payment.save();
    throw new Error('Payment authorization expired');
  }

  if (!payment.inboundTxHash) {
    throw new Error('Inbound transaction hash required');
  }

  payment.status = 'PROCESSING';
  await payment.save();

  const recipient = payment.contractAddress || payment.treasuryWallet;
  const inbound = await verifyInboundTonPayment({
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

  let referrerVerified = false;
  let treasuryVerified = false;

  if (payment.referrerWallet && payment.referrerPayoutTxHash) {
    const refOut = await verifyOutboundTonPayout({
      txHash: payment.referrerPayoutTxHash,
      expectedSender: recipient,
      expectedRecipient: payment.referrerWallet,
      minValueNanoton: payment.referrerShareNanoton
    });
    referrerVerified = refOut.found;
  } else if (!payment.referrerWallet) {
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
  } else {
    treasuryVerified = false;
  }

  if (referrerVerified && treasuryVerified) {
    payment.status = 'CONFIRMED';
    payment.confirmedAt = new Date();
    payment.failureReason = null;
    await payment.save();
    await recordTonReferralPayoutIfNeeded(payment);
    return { payment: serializePayment(payment), confirmed: true };
  }

  if (referrerVerified || treasuryVerified) {
    payment.status = 'PARTIALLY_SETTLED';
    payment.failureReason = 'One or more outbound payouts not yet verified on-chain';
    await payment.save();
    if (referrerVerified) {
      await recordTonReferralPayoutIfNeeded(payment);
    }
    return { payment: serializePayment(payment), partiallySettled: true };
  }

  payment.status = 'PROCESSING';
  payment.failureReason = 'Awaiting outbound payout confirmation';
  await payment.save();
  return { payment: serializePayment(payment), pending: true };
}

async function recordTonReferralPayoutIfNeeded(payment) {
  if (!payment.referrerWallet || !payment.referrerShareNanoton || !payment.referrerId) return null;

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
  } else if (payout.status !== 'CONFIRMED') {
    payment.referrerRewardGranted = false;
  }

  await payment.save();
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
  }).sort({ createdAt: -1 }).limit(50);

  const payouts = await ReferralTonPayout.find({ referrerId: String(telegramId) })
    .populate('paymentId')
    .sort({ createdAt: -1 })
    .limit(50);

  return {
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

export async function getTonSubscriptionQuote() {
  assertTestnetOnly(TON_NETWORK);
  const grossNanoton = getSubscriptionAmountNanoton();
  const split = computePaymentSplit(grossNanoton);

  return {
    network: TON_NETWORK,
    grossAmountNanoton: split.grossNanoton.toString(),
    grossAmountTon: Number(split.grossNanoton) / 1e9,
    feeReserveNanoton: split.feeReserveNanoton.toString(),
    feeReserveTon: Number(split.feeReserveNanoton) / 1e9,
    estimatedNetNanoton: split.netNanoton.toString(),
    estimatedNetTon: Number(split.netNanoton) / 1e9,
    estimatedReferrerShareNanoton: split.referrerShareNanoton.toString(),
    estimatedTreasuryShareNanoton: split.treasuryShareNanoton.toString(),
    feePolicyVersion: FEE_POLICY_VERSION,
    splitVersion: SPLIT_VERSION,
    feePolicy:
      'Fee reserve (estimate) is deducted from gross before 50/50 net split. Odd nanotons go to treasury.',
    contractAddress: getContractAddress(),
    treasuryAddress: process.env.TON_TESTNET_TREASURY_ADDRESS || null,
    economicRule:
      'After applicable TON transaction and payout fees are deducted, the remaining net subscription amount is split 50/50 between the verified referrer and YORZA.'
  };
}
