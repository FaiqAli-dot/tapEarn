import User from '../models/User.js';
import { countPaidReferrals } from './referralService.js';

function formatUserEntry(user, score, rank) {
  return {
    rank,
    user: {
      telegramId: user.telegramId,
      username: user.username || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null
    },
    score
  };
}

export async function getLeaderboardByType(type = 'points', limit = 10) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  if (type === 'clicks') {
    const users = await User.find({})
      .sort({ totalTaps: -1 })
      .limit(safeLimit)
      .select('telegramId username firstName lastName totalTaps')
      .lean();

    return users.map((u, i) => formatUserEntry(u, u.totalTaps, i + 1));
  }

  if (type === 'referrals') {
    const users = await User.find({ 'referrals.0': { $exists: true } })
      .select('telegramId username firstName lastName referrals')
      .lean();

    const scored = users.map((u) => ({
      user: u,
      score: u.referrals.length
    }));
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, safeLimit).map((entry, i) =>
      formatUserEntry(entry.user, entry.score, i + 1)
    );
  }

  if (type === 'paid_referrals') {
    const users = await User.find({ 'referrals.0': { $exists: true } })
      .select('telegramId username firstName lastName referrals')
      .lean();

    const scored = await Promise.all(
      users.map(async (u) => ({
        user: u,
        score: await countPaidReferrals(u.telegramId)
      }))
    );
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, safeLimit).map((entry, i) =>
      formatUserEntry(entry.user, entry.score, i + 1)
    );
  }

  // Default: points
  const users = await User.find({})
    .sort({ points: -1 })
    .limit(safeLimit)
    .select('telegramId username firstName lastName points')
    .lean();

  return users.map((u, i) => formatUserEntry(u, u.points, i + 1));
}

export async function getUserRank(telegramId, type = 'points') {
  const user = await User.findOne({ telegramId }).lean();
  if (!user) return null;

  if (type === 'clicks') {
    const higher = await User.countDocuments({ totalTaps: { $gt: user.totalTaps } });
    return { rank: higher + 1, score: user.totalTaps };
  }

  if (type === 'referrals') {
    const count = user.referrals?.length || 0;
    const users = await User.find({ 'referrals.0': { $exists: true } })
      .select('referrals')
      .lean();
    const higher = users.filter((u) => (u.referrals?.length || 0) > count).length;
    return { rank: higher + 1, score: count };
  }

  const higher = await User.countDocuments({ points: { $gt: user.points } });
  return { rank: higher + 1, score: user.points };
}
