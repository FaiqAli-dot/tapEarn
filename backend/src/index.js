import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB, { stopMemoryMongo } from './config/db.js';
import { createApp } from './app.js';
import { startTelegramBot, stopTelegramBot } from './bot/telegramBot.js';
import { bootstrapAdminPanelUser } from './services/adminPanelService.js';

dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 3001;

async function start() {
  await connectDB();

  try {
    const bootstrap = await bootstrapAdminPanelUser();
    if (bootstrap.seeded) {
      console.log(`🔐 Admin panel user seeded: ${bootstrap.username}`);
    }
  } catch (error) {
    console.error('Admin panel bootstrap failed:', error.message);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TapEarn Backend Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/tapearn'}`);
    startTelegramBot();
  });

  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    try {
      stopTelegramBot();
      await mongoose.connection.close();
      await stopMemoryMongo();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5000);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
