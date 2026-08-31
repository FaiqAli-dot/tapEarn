import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  externalPaymentId: { type: String, required: true, unique: true },
  paymentKind: {
    type: String,
    enum: ['LEGACY_YP', 'TON_SUBSCRIPTION'],
    default: 'LEGACY_YP'
  },
  status: {
    type: String,
    enum: [
      'PENDING',
      'AUTHORIZED',
      'SUBMITTED',
      'PROCESSING',
      'CONFIRMED',
      'PARTIALLY_SETTLED',
      'FAILED',
      'EXPIRED'
    ],
    default: 'CONFIRMED'
  },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'TON' },
  isFirstPayment: { type: Boolean, default: false },
  referrerRewardGranted: { type: Boolean, default: false },

  // TON subscription fields (nanotons stored as strings for bigint safety)
  network: { type: String, default: 'testnet' },
  grossAmountNanoton: { type: String, default: null },
  feeReserveNanoton: { type: String, default: null },
  netAmountNanoton: { type: String, default: null },
  referrerShareNanoton: { type: String, default: null },
  treasuryShareNanoton: { type: String, default: null },
  subscriberWallet: { type: String, default: null },
  referrerId: { type: String, default: null },
  referrerWallet: { type: String, default: null },
  treasuryWallet: { type: String, default: null },
  contractAddress: { type: String, default: null },
  inboundTxHash: { type: String, default: null, index: true },
  referrerPayoutTxHash: { type: String, default: null },
  treasuryPayoutTxHash: { type: String, default: null },
  authorizationPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  authorizationSignature: { type: String, default: null },
  feePolicyVersion: { type: String, default: null },
  splitVersion: { type: String, default: null },
  expiresAt: { type: Date, default: null },
  failureReason: { type: String, default: null },
  confirmedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

paymentSchema.pre('save', function saveTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
