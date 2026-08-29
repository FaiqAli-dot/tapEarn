import mongoose from 'mongoose';

export const CAMPAIGN_TYPES = ['VIDEO', 'SPONSORED_POST'];
export const CAMPAIGN_STATUSES = ['ACTIVE', 'INACTIVE', 'EXPIRED'];

const campaignSchema = new mongoose.Schema({
  type: { type: String, enum: CAMPAIGN_TYPES, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  url: { type: String, default: '' },
  thumbnail: { type: String, default: '' },
  rewardPoints: { type: Number, required: true, min: 0 },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  maxCompletions: { type: Number, default: null },
  status: { type: String, enum: CAMPAIGN_STATUSES, default: 'ACTIVE' },
  completionCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

campaignSchema.pre('save', function saveHook(next) {
  this.updatedAt = new Date();
  next();
});

campaignSchema.methods.isCurrentlyActive = function isCurrentlyActive() {
  if (this.status !== 'ACTIVE') return false;
  const now = new Date();
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  if (this.maxCompletions != null && this.completionCount >= this.maxCompletions) {
    return false;
  }
  return true;
};

const Campaign = mongoose.model('Campaign', campaignSchema);

export default Campaign;
