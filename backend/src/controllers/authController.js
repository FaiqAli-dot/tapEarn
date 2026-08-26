import {
  verifyTelegramInitData,
  normalizeReferralCode
} from '../utils/telegramAuth.js';
import {
  signSessionToken,
  isDevAuthEnabled
} from '../middleware/auth.js';
import { getOrCreateUser } from '../controllers/userController.js';

/**
 * POST /api/auth/telegram
 * Body: { initData: string }
 * Verifies Telegram Mini App initData and returns a session JWT.
 */
export async function authenticateWithTelegram(req, res) {
  try {
    const { initData, startParam: bodyStartParam } = req.body || {};
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    const verified = verifyTelegramInitData(initData, botToken);
    if (!verified.ok) {
      return res.status(401).json({ success: false, error: verified.error });
    }

    // Prefer start_param from verified initData; fall back to URL-derived value from the client
    const referralCode = normalizeReferralCode(
      verified.startParam || bodyStartParam || null
    );
    const user = await getOrCreateUser(verified.user.id, {
      username: verified.user.username,
      first_name: verified.user.firstName,
      last_name: verified.user.lastName,
      start: referralCode
    });

    const token = signSessionToken({
      telegramId: verified.user.id,
      username: verified.user.username
    });

    return res.json({
      success: true,
      token,
      user: {
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        referralCode: user.referralCode,
        referredBy: user.referredBy || null
      },
      startParam: verified.startParam || bodyStartParam || null
    });
  } catch (error) {
    console.error('authenticateWithTelegram error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

/**
 * POST /api/auth/dev
 * Local/browser testing only. Disabled unless ALLOW_DEV_AUTH=true and not production.
 * Body: { telegramId, username?, firstName?, lastName?, start? }
 */
export async function authenticateDev(req, res) {
  try {
    if (!isDevAuthEnabled()) {
      return res.status(403).json({
        success: false,
        error: 'Dev auth is disabled'
      });
    }

    const {
      telegramId,
      username = 'devuser',
      firstName = 'Dev',
      lastName = 'User',
      start = null
    } = req.body || {};

    if (!telegramId) {
      return res.status(400).json({
        success: false,
        error: 'telegramId is required'
      });
    }

    const referralCode = normalizeReferralCode(start);
    const user = await getOrCreateUser(String(telegramId), {
      username,
      first_name: firstName,
      last_name: lastName,
      start: referralCode
    });

    const token = signSessionToken({
      telegramId: String(telegramId),
      username: user.username,
      dev: true
    });

    return res.json({
      success: true,
      token,
      user: {
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        referralCode: user.referralCode,
        referredBy: user.referredBy || null
      },
      dev: true
    });
  } catch (error) {
    console.error('authenticateDev error:', error);
    return res.status(500).json({
      success: false,
      error: 'Dev authentication failed'
    });
  }
}

/**
 * GET /api/auth/me
 * Requires Bearer token.
 */
export async function getAuthMe(req, res) {
  return res.json({
    success: true,
    telegramId: req.telegramId,
    auth: {
      username: req.auth?.username,
      dev: Boolean(req.auth?.dev)
    }
  });
}
