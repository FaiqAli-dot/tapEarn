import crypto from 'crypto';
import {
  verifyTelegramInitData,
  normalizeReferralCode
} from '../src/utils/telegramAuth.js';

function buildInitData(botToken, user, extra = {}) {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify(user));
  params.set('auth_date', String(extra.auth_date || Math.floor(Date.now() / 1000)));
  if (extra.start_param) {
    params.set('start_param', extra.start_param);
  }

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  params.set('hash', hash);
  return params.toString();
}

const botToken = '123456:ABC-TEST-TOKEN';
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed += 1;
    console.error('FAIL:', message);
  } else {
    console.log('PASS:', message);
  }
}

const valid = buildInitData(botToken, {
  id: 42,
  first_name: 'Ada',
  username: 'ada'
}, { start_param: 'ref_ABCD1234' });

const ok = verifyTelegramInitData(valid, botToken);
assert(ok.ok === true, 'valid initData verifies');
assert(ok.user?.id === '42', 'user id parsed');
assert(ok.startParam === 'ref_ABCD1234', 'start_param parsed');

const bad = verifyTelegramInitData(valid.replace(/hash=[0-9a-f]+/, 'hash=deadbeef'), botToken);
assert(bad.ok === false, 'tampered hash rejected');

const expired = buildInitData(botToken, { id: 1, first_name: 'Old' }, {
  auth_date: Math.floor(Date.now() / 1000) - (25 * 60 * 60)
});
const expiredResult = verifyTelegramInitData(expired, botToken);
assert(expiredResult.ok === false, 'expired initData rejected');

assert(normalizeReferralCode('ref_XYZ') === 'XYZ', 'strips ref_ prefix');
assert(normalizeReferralCode('XYZ') === 'XYZ', 'plain code kept');
assert(normalizeReferralCode(null) === null, 'null start param');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}

console.log('\nAll telegramAuth checks passed');
