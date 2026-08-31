import {
  confirmTonPayment,
  createTonSubscriptionIntent,
  getTonPaymentForUser,
  getTonPaymentHistory,
  getTonSubscriptionQuote,
  recordOutboundPayoutTxHashes,
  submitTonPaymentTx
} from '../services/tonPaymentService.js';

export async function paymentQuote(_req, res) {
  try {
    const quote = await getTonSubscriptionQuote();
    res.json({ success: true, data: quote });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function createPaymentIntent(req, res) {
  try {
    const result = await createTonSubscriptionIntent(req.telegramId);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function getPayment(req, res) {
  try {
    const payment = await getTonPaymentForUser(req.params.id, req.telegramId);
    res.json({ success: true, payment });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
}

export async function submitPayment(req, res) {
  try {
    const { inboundTxHash } = req.body;
    if (!inboundTxHash) {
      return res.status(400).json({ success: false, error: 'inboundTxHash is required' });
    }
    const result = await submitTonPaymentTx(req.params.id, req.telegramId, inboundTxHash);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function confirmPayment(req, res) {
  try {
    const result = await confirmTonPayment(req.params.id, req.telegramId, { allowPending: true });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function recordPayoutTxs(req, res) {
  try {
    const { referrerPayoutTxHash, treasuryPayoutTxHash } = req.body;
    const result = await recordOutboundPayoutTxHashes(req.params.id, req.telegramId, {
      referrerPayoutTxHash,
      treasuryPayoutTxHash
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function paymentHistory(req, res) {
  try {
    const history = await getTonPaymentHistory(req.telegramId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}
