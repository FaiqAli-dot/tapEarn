import mongoose from 'mongoose';

const videoCodeSchema = new mongoose.Schema({
  taskId: {
    type: String,
    required: true,
    unique: true,
    default: 'watch_youtube'
  },
  videoUrl: {
    type: String,
    required: true,
    default: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  code: {
    type: String,
    required: true,
    default: 'TAP2024'
  },
  hint: {
    type: String,
    required: true,
    default: 'Look for the code that appears in the video'
  },
  timeToShow: {
    type: Number,
    required: true,
    default: 0.5,
    min: 0,
    max: 1
  },
  points: {
    type: Number,
    required: true,
    default: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps on save
videoCodeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get video code by task ID
videoCodeSchema.statics.getByTaskId = async function(taskId) {
  const videoCode = await this.findOne({ taskId, isActive: true });
  if (!videoCode) {
    // Return default if not found
    return {
      taskId: 'watch_youtube',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      code: 'TAP2024',
      hint: 'Look for the code that appears in the video',
      timeToShow: 0.5,
      points: 100
    };
  }
  return videoCode;
};

// Static method to create or update video code
videoCodeSchema.statics.createOrUpdate = async function(taskId, data) {
  const existing = await this.findOne({ taskId });
  if (existing) {
    Object.assign(existing, data);
    return await existing.save();
  } else {
    return await this.create({ taskId, ...data });
  }
};

// Static method to get all active video codes
videoCodeSchema.statics.getAllActive = async function() {
  return await this.find({ isActive: true }).sort({ createdAt: -1 });
};

const VideoCode = mongoose.model('VideoCode', videoCodeSchema);

export default VideoCode;
