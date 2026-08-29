/**
 * Admin authorization — never trust frontend isAdmin flags.
 * Admins are determined by ADMIN_TELEGRAM_IDS env (comma-separated Telegram IDs).
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
  if (!req.telegramId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  if (!isAdminTelegramId(req.telegramId)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }

  next();
}
