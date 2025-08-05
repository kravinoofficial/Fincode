const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');

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
 *               - month
 *               - paid
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user
 *               month:
 *                 type: string
 *                 description: Payment month in YYYY-MM format
 *               paid:
 *                 type: boolean
 *                 description: Payment status
 *     responses:
 *       200:
 *         description: Payment status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 */
router.post('/payments/mark', authenticate, isAdmin, async (req, res) => {
  const { targetUserId, month, paid } = req.body;
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
  res.json({ message: 'Payment status updated' });
});

module.exports = router;