import User from '../models/User.js';
import PointTransaction from '../models/PointTransaction.js';

/**
 * Centralized, auditable points awarding.
 * Idempotent when referenceId is provided.
 */
export async function awardPoints(userId, amount, type, options = {}) {
  const { referenceId = null, description = '' } = options;

  if (!amount || amount <= 0) {
    throw new Error('Points amount must be positive');
  }

  if (referenceId) {
    const existing = await PointTransaction.findOne({ userId, type, referenceId });
    if (existing) {
      const user = await User.findOne({ telegramId: userId });
      return {
        duplicate: true,
        points: user?.points ?? 0,
        transaction: existing
      };
    }
  }

  const user = await User.findOne({ telegramId: userId });
  if (!user) {
    throw new Error('User not found');
  }

  let transaction;
  try {
    transaction = await PointTransaction.create({
      userId,
      amount,
      type,
      referenceId,
      description
    });
  } catch (error) {
    if (error.code === 11000 && referenceId) {
      const existing = await PointTransaction.findOne({ userId, type, referenceId });
      return {
        duplicate: true,
        points: user.points,
        transaction: existing
      };
    }
    throw error;
  }

  user.points += amount;
  user.totalPointsEarned += amount;

  if (type === 'REFERRAL') {
    user.referralEarnings += amount;
  }

  await user.save();

  return {
    duplicate: false,
    points: user.points,
    transaction
  };
}

export async function getPointHistory(userId, limit = 50) {
  return PointTransaction.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
}
