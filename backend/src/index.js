import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB, { stopMemoryMongo } from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import videoCodeRoutes from './routes/videoCodeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { startTelegramBot, stopTelegramBot } from './bot/telegramBot.js';
import { requireAuth } from './middleware/auth.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Always allow local frontend + GitHub Pages origin.
// FRONTEND_URL is the Mini App URL (may include a path); CORS uses its origin only.
// Development keeps allow-all so `npm run mobile` / LAN IPs still work.
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://faiqali-dot.github.io',
];

function originFromUrl(value) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, '');
  }
}

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

const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser clients (curl, same-origin, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    // Existing development behavior: allow any origin (mobile LAN testing)
    if (isDev) {
      return callback(null, true);
    }

    const allowed = getCorsAllowlist();
    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/video-codes', requireAuth, videoCodeRoutes);

// Health check endpoint
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 TapEarn Backend Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/tapearn'}`);
  startTelegramBot();
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  
  try {
    stopTelegramBot();
    await mongoose.connection.close();
    await stopMemoryMongo();
    console.log('MongoDB connection closed');
    
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force close server after 5 seconds
    setTimeout(() => {
      console.error('Forcing shutdown...');
      process.exit(1);
    }, 5000);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
