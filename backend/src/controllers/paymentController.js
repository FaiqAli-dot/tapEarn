import { recordPayment } from '../services/referralService.js';

/**
 * POST /api/payments/complete
 *
 * First-payment hook for referral rewards (50% to direct referrer).
 *
 * Authentication: x-payment-webhook-secret header must match PAYMENT_WEBHOOK_SECRET,
 * OR caller must be an admin (via JWT + ADMIN_TELEGRAM_IDS).
 *
 * Body: { userId, externalPaymentId, amount, currency? }
 */
export async function completePayment(req, res) {
  try {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const providedSecret = req.headers['x-payment-webhook-secret'];

    const isWebhookAuth = webhookSecret && providedSecret === webhookSecret;
    const isAdminAuth = req.isAdmin === true;

    if (!isWebhookAuth && !isAdminAuth) {
      return res.status(401).json({ success: false, error: 'Unauthorized payment webhook' });
    }

    const { userId, externalPaymentId, amount, currency } = req.body;

    if (!userId || !externalPaymentId || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId, externalPaymentId, and amount are required'
      });
    }

    const result = await recordPayment(
      String(userId),
      String(externalPaymentId),
      Number(amount),
      currency || 'TON'
    );

    res.json({
      success: true,
      duplicate: result.duplicate,
      payment: result.payment,
      referralReward: result.referralReward
        ? {
            referrerId: result.referralReward.referrerId,
            amount: result.referralReward.amount
          }
        : null
    });
  } catch (error) {
    console.error('completePayment error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}
