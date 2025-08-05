const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');

/**
 * @swagger
 * tags:
 *   name: Loans
 *   description: Loan management endpoints
 */

/**
 * @swagger
 * /api/loans:
 *   post:
 *     summary: Create a new loan for a user (Admin only)
 *     tags: [Loans]
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
 *               - amount
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user to create loan for
 *               amount:
 *                 type: number
 *                 description: Loan amount
 *     responses:
 *       200:
 *         description: Loan created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 */
router.post('/loans', authenticate, isAdmin, async (req, res) => {
  const { targetUserId, amount } = req.body;
  const user = await User.findById(targetUserId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const takenDate = new Date();
  const now = new Date();
  const initialMonthsDiff = (now.getFullYear() - takenDate.getFullYear()) * 12 + (now.getMonth() - takenDate.getMonth()) + (now.getDate() - takenDate.getDate()) / 30;
  const initialInterestAccrued = amount * (5 / 100) * (initialMonthsDiff > 0 ? initialMonthsDiff : 1 / 30);
  const initialTotalAmountToPay = amount + initialInterestAccrued;

  user.loans.push({
    amount,
    interestRate: 5,
    takenDate,
    paid: false,
    paidDate: null,
    interestAccrued: Number(initialInterestAccrued.toFixed(2)),
    totalAmountToPay: Number(initialTotalAmountToPay.toFixed(2))
  });
  await user.save();
  res.json({ message: 'Loan added successfully' });
});

/**
 * @swagger
 * /api/loans/mark:
 *   post:
 *     summary: Mark loan as paid/unpaid (Admin only)
 *     tags: [Loans]
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
 *               - loanId
 *               - paid
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user
 *               loanId:
 *                 type: string
 *                 description: ID of the loan
 *               paid:
 *                 type: boolean
 *                 description: Paid status
 *     responses:
 *       200:
 *         description: Loan status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User or loan not found
 */
router.post('/loans/mark', authenticate, isAdmin, async (req, res) => {
  const { targetUserId, loanId, paid } = req.body;
  const user = await User.findById(targetUserId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const loan = user.loans.id(loanId);
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  loan.paid = paid;
  loan.paidDate = paid ? new Date() : null;

  const now = new Date();
  const takenDate = new Date(loan.takenDate);
  const endDate = loan.paid && loan.paidDate ? new Date(loan.paidDate) : now;
  const monthsDiff = (endDate.getFullYear() - takenDate.getFullYear()) * 12 + (endDate.getMonth() - takenDate.getMonth()) + (endDate.getDate() - takenDate.getDate()) / 30;
  loan.interestAccrued = Number((loan.amount * (loan.interestRate / 100) * (monthsDiff > 0 ? monthsDiff : 1 / 30)).toFixed(2));
  loan.totalAmountToPay = Number((loan.amount + loan.interestAccrued).toFixed(2));

  await user.save();
  res.json({ message: 'Loan status updated' });
});

/**
 * @swagger
 * /api/loans:
 *   get:
 *     summary: Get loans (Admin can get any user's loans, regular users can only get their own)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: targetUserId
 *         schema:
 *           type: string
 *         description: User ID (admin only)
 *     responses:
 *       200:
 *         description: List of loans
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 loans:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       interestRate:
 *                         type: number
 *                       takenDate:
 *                         type: string
 *                         format: date
 *                       paid:
 *                         type: boolean
 *                       paidDate:
 *                         type: string
 *                         format: date
 *                       interestAccrued:
 *                         type: number
 *                       totalAmountToPay:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */
router.get('/loans', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    console.log('Authenticated userId:', userId, 'Role:', role, 'TargetUserId:', req.query.targetUserId);

    let user;
    if (role === 'admin' && req.query.targetUserId) {
      user = await User.findById(req.query.targetUserId);
      console.log('Admin querying user:', req.query.targetUserId);
      if (!user) return res.status(404).json({ message: 'User not found' });
    } else {
      user = await User.findById(userId);
      console.log('User or admin querying self:', userId);
      if (!user) return res.status(403).json({ message: 'Access denied' });
    }

    console.log('Raw user loans:', user.loans);

    // Calculate interestAccrued and totalAmountToPay for each loan
    const now = new Date();
    const loansWithInterest = user.loans.map(loan => {
      const takenDate = new Date(loan.takenDate);
      const endDate = loan.paid && loan.paidDate ? new Date(loan.paidDate) : now;
      const monthsDiff = (endDate.getFullYear() - takenDate.getFullYear()) * 12 + (endDate.getMonth() - takenDate.getMonth()) + (endDate.getDate() - takenDate.getDate()) / 30;
      const interestAccrued = loan.amount * (loan.interestRate / 100) * (monthsDiff > 0 ? monthsDiff : 1 / 30);
      const totalAmountToPay = loan.amount + interestAccrued;

      return {
        ...loan.toObject(),
        interestAccrued: Number(interestAccrued.toFixed(2)),
        totalAmountToPay: Number(totalAmountToPay.toFixed(2))
      };
    });

    console.log('Loans with interest:', loansWithInterest);
    res.json({ loans: loansWithInterest });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;