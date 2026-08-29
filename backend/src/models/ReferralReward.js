import mongoose from 'mongoose';

const referralRewardSchema = new mongoose.Schema({
  referrerId: { type: String, required: true, index: true },
  referredUserId: { type: String, required: true, index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Payment', unique: true },
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ReferralReward = mongoose.model('ReferralReward', referralRewardSchema);

export default ReferralReward;
