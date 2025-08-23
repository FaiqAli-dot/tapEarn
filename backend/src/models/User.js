import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  // Telegram user info
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  
  // Game state
  points: { type: Number, default: 0 },
  energy: { type: Number, default: 1000 },
  maxEnergy: { type: Number, default: 1000 },
  energyRegenRate: { type: Number, default: 3 },
  
  // Upgrades
  tapPower: { type: Number, default: 1 },
  offlineEarningRate: { type: Number, default: 4 },
  offlineEarningMaxHours: { type: Number, default: 4 },
  
  // Statistics
  totalTaps: { type: Number, default: 0 },
  totalPointsEarned: { type: Number, default: 0 },
  offlineEarnings: { type: Number, default: 0 },
  referralEarnings: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  
  // Daily tasks
  dailyTasks: [{
    id: String,
    title: String,
    description: String,
    points: Number,
    completed: { type: Boolean, default: false },
    type: { type: String, enum: ['login', 'youtube', 'streak', 'custom'] },
    url: String,
    completedAt: Date
  }],
  lastDailyReset: { type: Date, default: Date.now },
  
  // Referral system
  referredBy: String,
  referrals: [{
    userId: String,
    username: String,
    joinedAt: { type: Date, default: Date.now }
  }],
  referralCode: { type: String, unique: true },
  
  // Wallet integration
  walletAddress: String,
  walletConnected: { type: Boolean, default: false },
  
  // Timestamps
  lastDailyReward: Date,
  lastEnergyRefill: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamps on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate referral code and initialize daily tasks for new user
userSchema.pre('save', async function(next) {
  // Generate referral code if not already set (only for new users)
  if (this.isNew && !this.referralCode) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    // Check if code is unique
    let isUnique = false;
    while (!isUnique) {
      code = Array(8).fill('').map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      const existingUser = await mongoose.model('User').findOne({ referralCode: code });
      if (!existingUser) isUnique = true;
    }
    
    this.referralCode = code;
  }
  
  // Initialize daily tasks if empty (for both new and existing users)
  if (!this.dailyTasks || this.dailyTasks.length === 0) {
    this.dailyTasks = [
      {
        id: 'daily_login',
        title: 'Daily Login',
        description: 'Log in to earn bonus points',
        points: 50,
        completed: false,
        type: 'login'
      },
      {
        id: 'watch_youtube',
        title: 'Watch YouTube Video',
        description: 'Watch our featured video',
        points: 100,
        completed: false,
        type: 'youtube',
        url: 'https://youtube.com/watch?v=dQw4w9WgXcQ'
      },
      {
        id: 'streak_bonus',
        title: '7-Day Streak',
        description: 'Maintain daily login for 7 days',
        points: 500,
        completed: false,
        type: 'streak'
      }
    ];
  }
  
  next();
});

// Method to calculate available energy based on last update
userSchema.methods.calculateCurrentEnergy = function() {
  if (!this.lastActive) return this.energy;
  
  const now = new Date();
  const diffInSeconds = (now - this.lastActive) / 1000;
  const energyRegenerated = Math.floor(diffInSeconds * this.energyRegenRate);
  
  return Math.min(this.energy + energyRegenerated, this.maxEnergy);
};

// Method to use energy
userSchema.methods.useEnergy = function(amount = 1) {
  const currentEnergy = this.calculateCurrentEnergy();
  if (currentEnergy < amount) return false;
  
  this.energy = currentEnergy - amount;
  this.lastActive = new Date();
  return true;
};

// Method to add points
userSchema.methods.addPoints = function(amount) {
  this.points += amount;
  this.totalPointsEarned += amount;
  return this.points;
};

// Method to complete daily task
userSchema.methods.completeDailyTask = function(taskId) {
  const task = this.dailyTasks.find(t => t.id === taskId);
  if (task && !task.completed) {
    task.completed = true;
    task.completedAt = new Date();
    this.addPoints(task.points);
    return true;
  }
  return false;
};

// Method to purchase upgrade
userSchema.methods.purchaseUpgrade = function(upgradeId, cost) {
  if (this.points < cost) return false;
  
  this.points -= cost;
  
  switch (upgradeId) {
    case 'tap_power':
      this.tapPower = Math.min(this.tapPower + 1, 5);
      break;
    case 'offline_earning':
      this.offlineEarningRate = Math.min(this.offlineEarningRate + 4, 20);
      break;
    case 'energy_regen':
      this.energyRegenRate = Math.min(this.energyRegenRate + 1, 10);
      break;
  }
  
  return true;
};

// Method to reset daily tasks
userSchema.methods.resetDailyTasks = function() {
  this.dailyTasks = this.dailyTasks.map(task => ({
    ...task,
    completed: false,
    completedAt: null
  }));
  this.lastDailyReset = new Date();
  return this.dailyTasks;
};

// Method to get available upgrades
userSchema.methods.getAvailableUpgrades = function() {
  return [
    {
      id: 'tap_power',
      title: 'Tap Power',
      description: 'Increase points per tap',
      cost: 100,
      currentLevel: this.tapPower,
      maxLevel: 5,
      effect: `+1 point per tap (${this.tapPower}/5)`
    },
    {
      id: 'offline_earning',
      title: 'Offline Earning',
      description: 'Increase offline earning rate',
      cost: 200,
      currentLevel: Math.floor(this.offlineEarningRate / 4),
      maxLevel: 5,
      effect: `+4 points/hour offline (${this.offlineEarningRate}/20)`
    },
    {
      id: 'energy_regen',
      title: 'Energy Regeneration',
      description: 'Increase energy regeneration rate',
      cost: 150,
      currentLevel: this.energyRegenRate - 3, // Starting from 3
      maxLevel: 7,
      effect: `+1 energy/second (${this.energyRegenRate}/10)`
    }
  ];
};

const User = mongoose.model('User', userSchema);

export default User;
