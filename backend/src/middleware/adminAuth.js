import { isAdminPanelToken } from '../constants/adminPanel.js';

/**
 * Admin authorization — never trust frontend isAdmin flags.
 * Admins are determined by ADMIN_TELEGRAM_IDS env (comma-separated Telegram IDs)
 * OR a valid admin-panel JWT (type: admin-panel).
 */
export function getAdminTelegramIds() {
  return (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdminTelegramId(telegramId) {
  if (!telegramId) return false;
  return getAdminTelegramIds().includes(String(telegramId));
}

export function requireAdmin(req, res, next) {
  if (req.isAdminPanel || isAdminPanelToken(req.auth)) {
    return next();
  }

  if (!req.telegramId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  if (!isAdminTelegramId(req.telegramId)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  next();
}

/** Panel-only routes (login credentials change) — Telegram admin JWT is not enough. */
export function requireAdminPanel(req, res, next) {
  if (req.isAdminPanel || isAdminPanelToken(req.auth)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: 'Admin panel authentication required'
  });
}
