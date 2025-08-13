const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');
const { getPaymentPeriod, getPaymentPeriodRange } = require('../utils/helpers');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management endpoints
 */

/**
 * @swagger
 * /api/payments/mark:
 *   post:
 *     summary: Mark payment as paid/unpaid (Admin only)
 *     description: Marks a payment for a user. If month is not provided, uses the current payment period (15th to 15th of next month).
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - paid
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user
 *               month:
 *                 type: string
 *                 description: Payment month in YYYY-MM format (optional, defaults to current period)
 *               paid:
 *                 type: boolean
 *                 description: Payment status
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Payment status updated
 *                 paymentPeriod:
 *                   type: string
 *                   example: 2023-05
 *                 periodRange:
 *                   type: string
 *                   example: 2023-05-15 to 2023-06-15
 *                 user:
 *                   type: string
 *                   example: John Doe
 *                 paid:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 */
router.post('/payments/mark', authenticate, isAdmin, async (req, res) => {
  let { targetUserId, month, paid } = req.body;
  
  // If month is not provided, use the current payment period (15th to 15th)
  if (!month) {
    month = getPaymentPeriod();
  }
  
  const user = await User.findById(targetUserId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  const payment = user.payments.find(p => p.month === month);
  if (payment) {
    payment.paid = paid;
    payment.paidDate = paid ? new Date() : null;
  } else {
    user.payments.push({ month, paid, paidDate: paid ? new Date() : null });
  }
  
  await user.save();
  res.json({ 
    message: 'Payment status updated',
    paymentPeriod: month,
    periodRange: getPaymentPeriodRange(),
    user: user.name,
    paid: paid
  });
});

/**
 * @swagger
 * /api/payments/current-period:
 *   get:
 *     summary: Get current payment period
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Current payment period information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                   description: Current payment period in YYYY-MM format
 *                 periodRange:
 *                   type: string
 *                   description: Date range for the current payment period (15th to 15th)
 */
router.get('/payments/current-period', async (req, res) => {
  res.json({
    period: getPaymentPeriod(),
    periodRange: getPaymentPeriodRange()
  });
});

module.exports = router;