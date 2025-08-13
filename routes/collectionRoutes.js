const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../utils/auth');
const { getCurrentMonth } = require('../utils/helpers');
const expense = require('../models/expense');

// Helper function to calculate the number of months between two dates
const calculateMonthsDifference = (startMonth, endMonth) => {
  const startDate = new Date(startMonth + '-01'); // First day of the start month
  const endDate = new Date(endMonth + '-01'); // First day of the end month
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  return monthsDiff + 1; // Including the current month
};

/**
 * @swagger
 * tags:
 *   name: Collections
 *   description: Collection management endpoints
 */

/**
 * @swagger
 * /api/collection:
 *   get:
 *     summary: Get total collection, paid interest, total balance, and total months of collection from August 2025 to current month
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Collection summary, including total months from August 2025 to current month
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCollection:
 *                   type: number
 *                   description: Total amount collected from payments
 *                 paidInterest:
 *                   type: number
 *                   description: Total interest paid from loans
 *                 totalBalance:
 *                   type: number
 *                   description: Total balance (collection + interest)
 *                 totalMonthsOfCollection:
 *                   type: number
 *                   description: Total number of months of payment collection from August 2025 to the current month
 *       401:
 *         description: Unauthorized
 */
router.get('/collection', authenticate, async (req, res) => {
  const users = await User.find({ role: 'user' });

// Calculate Total Collection (include all paid payments from all months)
const collectionDb = users.reduce((sum, user) => {
  // Iterate through each payment and add the monthlyAmount for paid payments
  const totalUserCollection = user.payments.reduce((paymentSum, payment) => {
    if (payment.paid && payment.paidDate) {
      return paymentSum + user.monthlyAmount;
    }
    return paymentSum;
  }, 0);

  return sum + totalUserCollection;
}, 0);

const totalCollection = collectionDb + 203650;




  // Calculate Paid Interest from loans that are marked as paid
  const interestDb = users.reduce((sum, user) => {
    const paidLoans = user.loans.filter(loan => loan.paid);
    const interest = paidLoans.reduce((loanSum, loan) => {
      const takenDate = new Date(loan.takenDate);
      const paidDate = new Date(loan.paidDate);
      const monthsDiff = (paidDate.getFullYear() - takenDate.getFullYear()) * 12 + (paidDate.getMonth() - takenDate.getMonth());
      const interestAmount = loan.amount * 0.05 * (monthsDiff > 0 ? monthsDiff : 1); // Minimum 1 month if paid same month
      return loanSum + interestAmount;
    }, 0);
    return sum + interest ;
  }, 0);

const paidInterest = interestDb + 100348;

const expenses = await expense.find({});
const totalExpense = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  // Calculate Total Balance
  const totalBalance = totalCollection + paidInterest - totalExpense;

  // Calculate total months from August 2025 to current month
  const startMonth = "2025-08"; // Starting month (August 2025)
  const currentMonth = new Date(); // Get current date
  const currentMonthStr = currentMonth.toISOString().slice(0, 7); // Current month in YYYY-MM format

  // Calculate the total number of months from August 2025 to current month
  const totalMonthsOfCollection = calculateMonthsDifference(startMonth, currentMonthStr);

  // Return the result
  res.json({
    totalCollection,
    paidInterest,
    totalBalance,
    totalMonthsOfCollection
  });
});

module.exports = router;
