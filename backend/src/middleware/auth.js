import jwt from 'jsonwebtoken';

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
 * Sets req.telegramId and req.auth from the token — never from client-supplied userId.
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
    if (!decoded?.telegramId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session token'
      });
    }

    req.telegramId = String(decoded.telegramId);
    req.auth = decoded;
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
