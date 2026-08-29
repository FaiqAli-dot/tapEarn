/**
 * UTC calendar-day helpers for daily quests, streaks, and resets.
 */

export function getUtcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function daysBetweenUtc(dateStrA, dateStrB) {
  const a = new Date(`${dateStrA}T00:00:00.000Z`);
  const b = new Date(`${dateStrB}T00:00:00.000Z`);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function isConsecutiveUtcDay(previousDateStr, currentDateStr) {
  if (!previousDateStr) return false;
  return daysBetweenUtc(previousDateStr, currentDateStr) === 1;
}

export function isSameUtcDay(dateStrA, dateStrB) {
  return dateStrA === dateStrB;
}
