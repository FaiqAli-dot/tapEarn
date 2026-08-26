import crypto from 'crypto';

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Verify Telegram Mini App initData (HMAC-SHA256).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') {
    return { ok: false, error: 'initData is required' };
  }
  if (!botToken) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    return { ok: false, error: 'Missing hash in initData' };
  }

  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const hashBuffer = Buffer.from(hash, 'hex');
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

  if (
    hashBuffer.length !== calculatedBuffer.length ||
    !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)
  ) {
    return { ok: false, error: 'Invalid initData signature' };
  }

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Number.isNaN(authDate)) {
    return { ok: false, error: 'Missing auth_date' };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, error: 'initData expired' };
  }

  let user = null;
  const userRaw = params.get('user');
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      return { ok: false, error: 'Invalid user payload in initData' };
    }
  }

  if (!user?.id) {
    return { ok: false, error: 'No Telegram user in initData' };
  }

  return {
    ok: true,
    user: {
      id: String(user.id),
      username: user.username || '',
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      languageCode: user.language_code,
      isPremium: Boolean(user.is_premium),
      photoUrl: user.photo_url
    },
    startParam: params.get('start_param') || null,
    authDate
  };
}

export function normalizeReferralCode(startParam) {
  if (!startParam || typeof startParam !== 'string') return null;
  const trimmed = startParam.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('ref_')) {
    return trimmed.slice(4) || null;
  }
  return trimmed;
}
