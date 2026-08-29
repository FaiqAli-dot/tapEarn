/**
 * CORS: GitHub Pages sends Origin https://<user>.github.io (no repo path).
 * FRONTEND_URL is the full Mini App URL used by the Telegram bot button.
 * FRONTEND_ORIGINS is optional comma-separated browser origins allowed by CORS.
 */
function buildCorsOptions() {
  const originsRaw = process.env.FRONTEND_ORIGINS || process.env.FRONTEND_URL || '';

  if (!originsRaw.trim()) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  FRONTEND_ORIGINS / FRONTEND_URL not set — CORS allows all origins');
    }
    return { origin: true, credentials: true };
  }

  const allowed = originsRaw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      const normalized = origin.replace(/\/$/, '');
      if (allowed.some((entry) => normalized === entry.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  };
}

export default buildCorsOptions;
