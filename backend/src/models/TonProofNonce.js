import mongoose from 'mongoose';

const tonProofNonceSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, index: true },
  nonce: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

tonProofNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TonProofNonce = mongoose.model('TonProofNonce', tonProofNonceSchema);

export default TonProofNonce;
