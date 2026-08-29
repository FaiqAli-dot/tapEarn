import User from '../models/User.js';
import { awardPoints } from './pointsService.js';
import { onTaps, onPointsEarned } from './questService.js';

const MAX_TAPS_PER_REQUEST = 100;
const MIN_TAP_INTERVAL_MS = 50;
const MAX_TAPS_PER_MINUTE = 600;

const recentTapTimestamps = new Map();

function getTapHistory(telegramId) {
  if (!recentTapTimestamps.has(telegramId)) {
    recentTapTimestamps.set(telegramId, []);
  }
  return recentTapTimestamps.get(telegramId);
}

function pruneTapHistory(history, now) {
  const oneMinuteAgo = now - 60_000;
  while (history.length && history[0] < oneMinuteAgo) {
    history.shift();
  }
}

export function validateTapRate(telegramId, tapCount) {
  const now = Date.now();
  const history = getTapHistory(telegramId);
  pruneTapHistory(history, now);

  if (tapCount > MAX_TAPS_PER_REQUEST) {
    return {
      ok: false,
      error: `Maximum ${MAX_TAPS_PER_REQUEST} taps per request`,
      allowedTaps: 0
    };
  }

  const tapsInLastMinute = history.length;
  const remainingMinuteBudget = Math.max(0, MAX_TAPS_PER_MINUTE - tapsInLastMinute);

  if (remainingMinuteBudget <= 0) {
    return {
      ok: false,
      error: 'Tap rate limit exceeded',
      allowedTaps: 0
    };
  }

  const allowedTaps = Math.min(tapCount, remainingMinuteBudget);
  return { ok: true, allowedTaps };
}

export function recordTapActivity(telegramId, tapCount) {
  const now = Date.now();
  const history = getTapHistory(telegramId);
  for (let i = 0; i < tapCount; i += 1) {
    history.push(now);
  }
  pruneTapHistory(history, now);
}

export async function processSingleTap(telegramId) {
  const rateCheck = validateTapRate(telegramId, 1);
  if (!rateCheck.ok) {
    throw new Error(rateCheck.error);
  }

  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  if (!user.useEnergy(1)) {
    throw new Error('Not enough energy');
  }

  const pointsEarned = user.tapPower;
  user.totalTaps += 1;
  await user.save();

  recordTapActivity(telegramId, 1);

  const result = await awardPoints(telegramId, pointsEarned, 'CLICK', {
    referenceId: `tap-${user.totalTaps}`,
    description: 'Single tap'
  });

  await onTaps(telegramId, 1);
  await onPointsEarned(telegramId, pointsEarned);

  const refreshed = await User.findOne({ telegramId });

  return {
    points: result.points,
    energy: refreshed.energy,
    totalTaps: refreshed.totalTaps,
    pointsEarned,
    duplicate: result.duplicate
  };
}

export async function processTapBatch(telegramId, requestedTapCount) {
  if (requestedTapCount < 0) {
    throw new Error('Invalid tap count');
  }
  if (requestedTapCount === 0) {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    return {
      points: user.points,
      energy: user.calculateCurrentEnergy(),
      totalTaps: user.totalTaps,
      pointsEarned: 0,
      syncedTaps: 0
    };
  }

  const rateCheck = validateTapRate(telegramId, requestedTapCount);
  if (!rateCheck.ok && rateCheck.allowedTaps === 0) {
    throw new Error(rateCheck.error);
  }

  let tapCount = rateCheck.allowedTaps;

  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  if (tapCount > user.maxEnergy) {
    tapCount = user.maxEnergy;
  }

  const currentEnergy = user.calculateCurrentEnergy();
  if (tapCount > currentEnergy) {
    tapCount = currentEnergy;
  }

  if (tapCount <= 0) {
    throw new Error('Not enough energy');
  }

  if (!user.useEnergy(tapCount)) {
    throw new Error('Not enough energy');
  }

  const pointsEarned = tapCount * user.tapPower;
  const startTaps = user.totalTaps;
  user.totalTaps += tapCount;
  await user.save();

  recordTapActivity(telegramId, tapCount);

  await awardPoints(telegramId, pointsEarned, 'CLICK', {
    referenceId: `sync-${startTaps + 1}-${tapCount}`,
    description: `Synced ${tapCount} taps`
  });

  await onTaps(telegramId, tapCount);
  await onPointsEarned(telegramId, pointsEarned);

  const refreshed = await User.findOne({ telegramId });

  return {
    points: refreshed.points,
    energy: refreshed.energy,
    totalTaps: refreshed.totalTaps,
    pointsEarned,
    syncedTaps: tapCount
  };
}

export function resetTapRateLimits() {
  recentTapTimestamps.clear();
}

export { MAX_TAPS_PER_REQUEST, MIN_TAP_INTERVAL_MS, MAX_TAPS_PER_MINUTE };
