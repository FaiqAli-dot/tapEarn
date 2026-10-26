import jwt from 'jsonwebtoken';
import { isAdminPanelToken } from '../constants/adminPanel.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    return 'dev-only-jwt-secret-change-me';
  }
  return secret;
}

export function signSessionToken(payload) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/**
 * Require a valid session JWT.
 * Accepts Telegram Mini App sessions (telegramId) or admin-panel JWTs.
 * Sets req.telegramId / req.auth / req.isAdminPanel as appropriate.
 */
export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ')
      ? header.slice(7)
      : req.headers['x-session-token'];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const decoded = verifySessionToken(token);

    if (isAdminPanelToken(decoded)) {
      req.auth = decoded;
      req.isAdminPanel = true;
      req.panelUserId = String(decoded.panelUserId);
      return next();
    }

    if (!decoded?.telegramId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session token'
      });
    }

    req.telegramId = String(decoded.telegramId);
    req.auth = decoded;
    req.isAdminPanel = false;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session'
    });
  }
}

export function isDevAuthEnabled() {
  return (
    process.env.ALLOW_DEV_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}
