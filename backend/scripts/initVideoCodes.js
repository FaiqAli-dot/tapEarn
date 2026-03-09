import mongoose from 'mongoose';
import dotenv from 'dotenv';
import VideoCode from '../src/models/VideoCode.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tap-earn');
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize default video codes
const initVideoCodes = async () => {
  try {
    console.log('🚀 Initializing video codes...');

    // Default video code for watch_youtube task
    const defaultVideoCode = {
      taskId: 'watch_youtube',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      code: 'TAP2024',
      hint: 'Look for the code that appears in the video',
      timeToShow: 0.5,
      points: 100,
      isActive: true
    };

    // Check if video code already exists
    const existingCode = await VideoCode.findOne({ taskId: 'watch_youtube' });
    
    if (existingCode) {
      console.log('📹 Video code already exists, updating...');
      Object.assign(existingCode, defaultVideoCode);
      await existingCode.save();
      console.log('✅ Video code updated successfully');
    } else {
      console.log('📹 Creating new video code...');
      await VideoCode.create(defaultVideoCode);
      console.log('✅ Video code created successfully');
    }

    // List all video codes
    const allCodes = await VideoCode.find({});
    console.log('\n📋 Current video codes:');
    allCodes.forEach(code => {
      console.log(`  - ${code.taskId}: ${code.code} (${code.points} points)`);
    });

    console.log('\n🎉 Video codes initialization completed!');
  } catch (error) {
    console.error('❌ Error initializing video codes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
};

// Run the initialization
connectDB().then(initVideoCodes);
