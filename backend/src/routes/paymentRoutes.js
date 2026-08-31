import express from 'express';
import { completePayment } from '../controllers/paymentController.js';
import {
  confirmPayment,
  createPaymentIntent,
  getPayment,
  paymentHistory,
  paymentQuote,
  recordPayoutTxs,
  submitPayment
} from '../controllers/tonPaymentController.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdminTelegramId } from '../middleware/adminAuth.js';

const router = express.Router();

router.get('/quote', requireAuth, paymentQuote);
router.post('/intent', requireAuth, createPaymentIntent);
router.get('/history', requireAuth, paymentHistory);
router.get('/:id', requireAuth, getPayment);
router.post('/:id/submit', requireAuth, submitPayment);
router.post('/:id/confirm', requireAuth, confirmPayment);
router.post('/:id/payouts', requireAuth, recordPayoutTxs);

/**
 * Payment completion hook.
 * Auth: x-payment-webhook-secret OR admin JWT session.
 */
router.post('/complete', (req, res, next) => {
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  const providedSecret = req.headers['x-payment-webhook-secret'];

  if (webhookSecret && providedSecret === webhookSecret) {
    req.isAdmin = false;
    return completePayment(req, res);
  }

  return requireAuth(req, res, () => {
    req.isAdmin = isAdminTelegramId(req.telegramId);
    return completePayment(req, res);
  });
});

export default router;
