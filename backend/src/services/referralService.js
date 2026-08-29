import User from '../models/User.js';
import Payment from '../models/Payment.js';
import ReferralReward from '../models/ReferralReward.js';
import { awardPoints } from './pointsService.js';
import { onReferralSuccess } from './questService.js';

const REFERRAL_COMMISSION_RATE = 0.5;

/**
 * Apply referral on new user signup. Referrer is locked permanently.
 */
export async function applyReferralOnSignup(newUser, referralCode) {
  if (!referralCode || !newUser) {
    return { applied: false, reason: 'no_code' };
  }

  if (newUser.referrerId || newUser.referredBy) {
    return { applied: false, reason: 'already_referred' };
  }

  if (referralCode === newUser.referralCode) {
    return { applied: false, reason: 'self_referral' };
  }

  const referrer = await User.findOne({ referralCode });
  if (!referrer) {
    return { applied: false, reason: 'invalid_referrer' };
  }

  if (referrer.telegramId === newUser.telegramId) {
    return { applied: false, reason: 'self_referral' };
  }

  newUser.referredBy = referralCode;
  newUser.referrerId = referrer.telegramId;

  const displayName = newUser.username ||
    `${newUser.firstName || ''}${newUser.lastName ? ` ${newUser.lastName}` : ''}`.trim() ||
    'User';

  const alreadyListed = referrer.referrals.some((r) => r.userId === newUser.telegramId);
  if (!alreadyListed) {
    referrer.referrals.push({
      userId: newUser.telegramId,
      username: displayName,
      joinedAt: new Date()
    });
    await referrer.save();
  }

  await onReferralSuccess(referrer.telegramId);

  return { applied: true, referrerId: referrer.telegramId };
}

/**
 * Record a payment and grant 50% of first payment to direct referrer (one level only).
 *
 * Trigger: POST /api/payments/complete with PAYMENT_WEBHOOK_SECRET header.
 * Call this when your payment provider confirms a one-time payment.
 */
export async function recordPayment(userId, externalPaymentId, amount, currency = 'TON') {
  if (!externalPaymentId) {
    throw new Error('externalPaymentId is required');
  }
  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be positive');
  }

  const existing = await Payment.findOne({ externalPaymentId });
  if (existing) {
    return { duplicate: true, payment: existing, referralReward: null };
  }

  const user = await User.findOne({ telegramId: userId });
  if (!user) {
    throw new Error('User not found');
  }

  const priorPayments = await Payment.countDocuments({ userId });
  const isFirstPayment = priorPayments === 0;

  const payment = await Payment.create({
    userId,
    externalPaymentId,
    amount,
    currency,
    isFirstPayment,
    referrerRewardGranted: false
  });

  let referralReward = null;

  if (isFirstPayment && !user.hasCompletedFirstPayment) {
    user.hasCompletedFirstPayment = true;
    await user.save();
    referralReward = await grantFirstPaymentReferralReward(user, payment);
  }

  return { duplicate: false, payment, referralReward };
}

async function grantFirstPaymentReferralReward(payer, payment) {
  if (!payer.referrerId) {
    return null;
  }

  const existingReward = await ReferralReward.findOne({ paymentId: payment._id });
  if (existingReward) {
    return existingReward;
  }

  const referrer = await User.findOne({ telegramId: payer.referrerId });
  if (!referrer) {
    return null;
  }

  const rewardAmount = Math.floor(payment.amount * REFERRAL_COMMISSION_RATE);
  if (rewardAmount <= 0) {
    return null;
  }

  try {
    const rewardRecord = await ReferralReward.create({
      referrerId: referrer.telegramId,
      referredUserId: payer.telegramId,
      paymentId: payment._id,
      amount: rewardAmount
    });

    await awardPoints(referrer.telegramId, rewardAmount, 'REFERRAL', {
      referenceId: String(payment._id),
      description: `50% referral reward from ${payer.telegramId} first payment`
    });

    payment.referrerRewardGranted = true;
    await payment.save();

    return rewardRecord;
  } catch (error) {
    if (error.code === 11000) {
      return ReferralReward.findOne({ paymentId: payment._id });
    }
    throw error;
  }
}

export async function getSuccessfulReferralCount(telegramId) {
  const user = await User.findOne({ telegramId });
  if (!user) return 0;
  return user.referrals.filter((r) => {
    return Boolean(r.userId);
  }).length;
}

export async function countPaidReferrals(telegramId) {
  const user = await User.findOne({ telegramId });
  if (!user || !user.referrals.length) return 0;

  const referredIds = user.referrals.map((r) => r.userId);
  return User.countDocuments({
    telegramId: { $in: referredIds },
    hasCompletedFirstPayment: true
  });
}
