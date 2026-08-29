import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateTapRate, recordTapActivity, resetTapRateLimits, MAX_TAPS_PER_MINUTE } from '../src/services/clickService.js';

describe('Tap rate limiting', () => {
  it('blocks when per-minute budget is exhausted', () => {
    resetTapRateLimits();
    const userId = 'rate-test-user';

    recordTapActivity(userId, MAX_TAPS_PER_MINUTE);

    const blocked = validateTapRate(userId, 1);
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /rate limit/i);
  });
});
