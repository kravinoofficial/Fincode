const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');

// Mark Payment (Admin Only)
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