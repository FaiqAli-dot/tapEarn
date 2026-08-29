import mongoose from 'mongoose';

const campaignCompletionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  campaignId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Campaign' },
  campaignType: { type: String, required: true },
  reward: { type: Number, required: true },
  completedAt: { type: Date, default: Date.now }
});

campaignCompletionSchema.index({ userId: 1, campaignId: 1 }, { unique: true });

const CampaignCompletion = mongoose.model('CampaignCompletion', campaignCompletionSchema);

export default CampaignCompletion;
