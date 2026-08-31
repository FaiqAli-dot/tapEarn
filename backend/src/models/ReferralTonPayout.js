import mongoose from 'mongoose';

/**
 * Real TON testnet monetary payout to referrer (NOT YP / referralEarnings).
 * Created only after on-chain confirmation of referrer payout tx.
 */
const referralTonPayoutSchema = new mongoose.Schema({
  referrerId: { type: String, required: true, index: true },
  referredUserId: { type: String, required: true, index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Payment', unique: true },
  amountNanoton: { type: String, required: true },
  txHash: { type: String, default: null },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'FAILED'],
    default: 'PENDING'
  },
  network: { type: String, default: 'testnet' },
  createdAt: { type: Date, default: Date.now },
  confirmedAt: { type: Date, default: null }
});

const ReferralTonPayout = mongoose.model('ReferralTonPayout', referralTonPayoutSchema);

export default ReferralTonPayout;
