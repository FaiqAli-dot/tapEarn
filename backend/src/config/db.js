import mongoose from 'mongoose';

let memoryServer = null;

/**
 * Connect to MongoDB.
 * If USE_MEMORY_MONGO=true (local/dev without a real MongoDB), start mongodb-memory-server.
 */
const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tapearn';

    if (process.env.USE_MEMORY_MONGO === 'true') {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri('tapearn');
      console.log('🧠 Using in-memory MongoDB (USE_MEMORY_MONGO=true)');
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export async function stopMemoryMongo() {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

export default connectDB;
