import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import videoCodeRoutes from './routes/videoCodeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import adminCampaignRoutes from './routes/adminCampaignRoutes.js';
import adminPanelRoutes from './routes/adminPanelRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import tonProofRoutes from './routes/tonProofRoutes.js';
import { requireAuth } from './middleware/auth.js';
import { requireAdmin } from './middleware/adminAuth.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';

function originFromUrl(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, '');
  }
}

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://faiqali-dot.github.io',
];

function getCorsAllowlist() {
  const fromCorsEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const frontendOrigin = originFromUrl(process.env.FRONTEND_URL);
  return [...new Set([
    ...DEFAULT_CORS_ORIGINS,
    ...fromCorsEnv,
    ...(frontendOrigin ? [frontendOrigin] : []),
  ])];
}

export function createApp() {
  const app = express();
  const isDev = process.env.NODE_ENV !== 'production';

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isDev) return callback(null, true);
      const allowed = getCorsAllowlist();
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));

  app.use(express.json());
  app.use(generalRateLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/video-codes', requireAuth, requireAdmin, videoCodeRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/admin/campaigns', adminCampaignRoutes);
  app.use('/api/admin-panel', adminPanelRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/ton-proof', tonProofRoutes);

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date(),
      auth: {
        botTokenConfigured: Boolean(
          process.env.TELEGRAM_BOT_TOKEN &&
          process.env.TELEGRAM_BOT_TOKEN !== 'your_bot_token_here'
        ),
        devAuthEnabled:
          process.env.ALLOW_DEV_AUTH === 'true' &&
          process.env.NODE_ENV !== 'production'
      }
    });
  });

  app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  });

  app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  return app;
}

export default createApp;
