import mongoose from 'mongoose';

export const XP_SOURCES = [
  'QUEST',
  'QUEST_BONUS',
  'CAMPAIGN',
  'REFERRAL',
  'DAILY_CHECKIN',
  'LEVEL_UP'
];

const xpTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  source: { type: String, enum: XP_SOURCES, required: true },
  referenceId: { type: String, default: null },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

xpTransactionSchema.index(
  { userId: 1, source: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: 'string' } }
  }
);

const XpTransaction = mongoose.model('XpTransaction', xpTransactionSchema);

export default XpTransaction;
