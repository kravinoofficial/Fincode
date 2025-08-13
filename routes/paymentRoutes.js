const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');

// Helper function to get the current payment period (15th to 15th)
const getPaymentPeriodRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JavaScript months are 0-indexed
  const day = now.getDate();
  
  let startMonth, startYear, endMonth, endYear;
  
  if (day < 15) {
    // If before 15th, period is from previous month's 15th to current month's 15th
    if (month === 1) {
      startMonth = 12;
      startYear = year - 1;
    } else {
      startMonth = month - 1;
      startYear = year;
    }
    endMonth = month;
    endYear = year;
  } else {
    // If 15th or after, period is from current month's 15th to next month's 15th
    startMonth = month;
    startYear = year;
    if (month === 12) {
      endMonth = 1;
      endYear = year + 1;
    } else {
      endMonth = month + 1;
      endYear = year;
    }
  }
  
  // Format with padding for months
  const formattedStartMonth = String(startMonth).padStart(2, '0');
  const formattedEndMonth = String(endMonth).padStart(2, '0');
  
  return `${startYear}-${formattedStartMonth}-15 to ${endYear}-${formattedEndMonth}-15`;
};

// Helper function to extract YYYY-MM from a date range string
const extractYearMonth = (dateRange) => {
  if (!dateRange) return null;
  
  // Clean up the input string and handle potential JSON format issues
  const cleanDateRange = dateRange.trim().replace(/",?$/, '').replace(/^"/, '');
  
  // Extract the first date from the range (e.g., "2025-07-15" from "2025-07-15 to 2025-08-15")
  const match = cleanDateRange.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (match) {
    return `${match[1]}-${match[2]}`; // YYYY-MM format
  }
  return null;
};

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management endpoints
 */

/**
 * @swagger
 * /api/payments/current-period:
 *   get:
 *     summary: Get current payment period (15th to 15th)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current payment period
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                   example: "2025-07-15 to 2025-08-15"
 */
router.get('/payments/current-period', authenticate, (req, res) => {
  const periodRange = getPaymentPeriodRange();
  res.json({ period: periodRange });
});

/**
 * @swagger
 * /api/payments/mark:
 *   post:
 *     summary: Mark payment as paid/unpaid for a user
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
 *                 description: Payment period in format "YYYY-MM-DD to YYYY-MM-DD" (defaults to current period if not provided)
 *                 example: "2025-07-15 to 2025-08-15"
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
 *                   example: "Payment status updated"
 *                 user:
 *                   type: string
 *                   example: "John Doe"
 *                 paid:
 *                   type: boolean
 *                   example: true
 *                 paymentPeriod:
 *                   type: string
 *                   example: "2025-07-15 to 2025-08-15"
 *                 monthStored:
 *                   type: string
 *                   example: "2025-07"
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.post('/payments/mark', authenticate, isAdmin, async (req, res) => {
  try {
    let { targetUserId, month, paid } = req.body;
    
    // Handle potential JSON format issues
    if (typeof month === 'string') {
      month = month.trim().replace(/",?$/, '').replace(/^"/, '');
    }
    
    // If month is not provided, use current payment period
    if (!month) {
      month = getPaymentPeriodRange();
    }
    
    // Extract YYYY-MM format for database storage
    const monthStored = extractYearMonth(month);
    if (!monthStored) {
      return res.status(400).json({ message: 'Invalid month format. Expected "YYYY-MM-DD to YYYY-MM-DD"' });
    }
    
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Check if payment for this month already exists
    const existingPaymentIndex = user.payments.findIndex(p => p.month === monthStored);
    
    if (existingPaymentIndex !== -1) {
      // Update existing payment
      user.payments[existingPaymentIndex].paid = paid;
      user.payments[existingPaymentIndex].paidDate = paid ? new Date() : null;
    } else {
      // Add new payment
      user.payments.push({
        month: monthStored, // Store in YYYY-MM format
        paid,
        paidDate: paid ? new Date() : null
      });
    }
    
    await user.save();
    
    res.json({
      message: 'Payment status updated',
      user: user.name,
      paid,
      paymentPeriod: month,
      monthStored
    });
  } catch (error) {
    console.error('Error marking payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;