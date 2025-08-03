const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate } = require('../utils/auth');
const { getCurrentMonth } = require('../utils/helpers');

// Get Total Collection, Paid Interest, and Total Balance (Admin and User)
router.get('/collection', authenticate, async (req, res) => {
  const users = await User.find({ role: 'user' });
  
  // Calculate Total Collection (include all paid payments for the current month)
  const totalCollection = users.reduce((sum, user) => {
    const paidThisMonth = user.payments.find(p => 
      p.month === getCurrentMonth() && 
      p.paid && 
      p.paidDate
    );
    return sum + (paidThisMonth ? user.monthlyAmount : 0);
  }, 0);

  // Calculate Paid Interest from loans that are marked as paid
  const paidInterest = users.reduce((sum, user) => {
    const paidLoans = user.loans.filter(loan => loan.paid);
    const interest = paidLoans.reduce((loanSum, loan) => {
      const takenDate = new Date(loan.takenDate);
      const paidDate = new Date(loan.paidDate);
      const monthsDiff = (paidDate.getFullYear() - takenDate.getFullYear()) * 12 + (paidDate.getMonth() - takenDate.getMonth());
      const interestAmount = loan.amount * 0.05 * (monthsDiff > 0 ? monthsDiff : 1); // Minimum 1 month if paid same month
      return loanSum + interestAmount;
    }, 0);
    return sum + interest;
  }, 0);

  // Calculate Total Balance
  const totalBalance = totalCollection + paidInterest;

  res.json({ totalCollection, paidInterest, totalBalance });
});

module.exports = router;