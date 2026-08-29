import express from 'express';
import { completePayment } from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdminTelegramId } from '../middleware/adminAuth.js';

const router = express.Router();

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
