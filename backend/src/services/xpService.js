import User from '../models/User.js';
import XpTransaction from '../models/XpTransaction.js';
import { awardPoints } from './pointsService.js';

export const MAX_LEVEL = 50;

/** Total XP required to reach a given level (level 1 = 0). */
export function xpRequiredForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.35));
}

/** Derive level from total XP (server-authoritative). */
export function calculateLevel(totalXp) {
  let level = 1;
  while (level < MAX_LEVEL && totalXp >= xpRequiredForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function xpProgressInLevel(totalXp, level) {
  const currentThreshold = xpRequiredForLevel(level);
  const nextThreshold = level >= MAX_LEVEL ? null : xpRequiredForLevel(level + 1);
  if (nextThreshold === null) {
    return { current: totalXp - currentThreshold, required: 0, percent: 100 };
  }
  const span = nextThreshold - currentThreshold;
  const current = totalXp - currentThreshold;
  return {
    current,
    required: span,
    percent: span > 0 ? Math.min(100, Math.floor((current / span) * 100)) : 100
  };
}

/** YP reward for reaching a level (idempotent per level). */
export function getLevelReward(level) {
  if (level < 2 || level > MAX_LEVEL) return 0;
  let reward = 100;
  if (level % 5 === 0) reward += 1000;
  if ([10, 20, 30, 40].includes(level)) reward += 5000;
  if (level === 50) reward += 50000;
  return reward;
}

/**
 * Award XP with dedup via XpTransaction referenceId.
 * Returns { duplicate, xp, level, levelUp, rewards }.
 */
export async function awardXp(userId, amount, source, options = {}) {
  const { referenceId = null, description = '' } = options;

  if (!amount || amount <= 0) {
    throw new Error('XP amount must be positive');
  }

  const user = await User.findOne({ telegramId: userId });
  if (!user) throw new Error('User not found');

  if (referenceId) {
    const existing = await XpTransaction.findOne({ userId, source, referenceId });
    if (existing) {
      return {
        duplicate: true,
        xp: user.xp,
        level: user.level,
        levelUp: null,
        rewards: []
      };
    }
  }

  let tx;
  try {
    tx = await XpTransaction.create({
      userId,
      amount,
      source,
      referenceId,
      description
    });
  } catch (error) {
    if (error.code === 11000 && referenceId) {
      return {
        duplicate: true,
        xp: user.xp,
        level: user.level,
        levelUp: null,
        rewards: []
      };
    }
    throw error;
  }

  const previousLevel = user.level || calculateLevel(user.xp || 0);
  user.xp = (user.xp || 0) + amount;
  const newLevel = calculateLevel(user.xp);
  user.level = newLevel;
  await user.save();

  const levelUpRewards = [];
  if (newLevel > previousLevel) {
    for (let lvl = previousLevel + 1; lvl <= newLevel; lvl += 1) {
      const ypReward = getLevelReward(lvl);
      if (ypReward > 0) {
        const result = await awardPoints(userId, ypReward, 'LEVEL_REWARD', {
          referenceId: `level-${lvl}`,
          description: `Level ${lvl} reward`
        });
        levelUpRewards.push({
          level: lvl,
          ypReward,
          duplicate: result.duplicate
        });
      }
    }
  }

  return {
    duplicate: false,
    xp: user.xp,
    level: newLevel,
    levelUp: newLevel > previousLevel ? { from: previousLevel, to: newLevel } : null,
    rewards: levelUpRewards,
    transaction: tx
  };
}

export function buildXpSummary(user) {
  const xp = user.xp || 0;
  const level = user.level || calculateLevel(xp);
  const progress = xpProgressInLevel(xp, level);
  return {
    xp,
    level,
    xpForNextLevel: level >= MAX_LEVEL ? null : xpRequiredForLevel(level + 1),
    progress
  };
}
