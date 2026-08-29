import mongoose from 'mongoose';

export const POINT_TYPES = [
  'CLICK',
  'VIDEO',
  'SPONSORED_TASK',
  'DAILY_STREAK',
  'REFERRAL',
  'LEADERBOARD_REWARD',
  'QUEST_REWARD',
  'QUEST_BONUS',
  'LEVEL_REWARD',
  'STREAK_MILESTONE',
  'LIFETIME_MILESTONE'
];

const pointTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: POINT_TYPES, required: true },
  referenceId: { type: String, default: null },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Prevent duplicate rewards for the same activity
pointTransactionSchema.index(
  { userId: 1, type: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: 'string' } }
  }
);

const PointTransaction = mongoose.model('PointTransaction', pointTransactionSchema);

export default PointTransaction;
