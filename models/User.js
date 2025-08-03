const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  number: String,
  address: String,
  monthlyAmount: Number,
  payments: [{
    month: String, // Format: YYYY-MM
    paid: Boolean,
    paidDate: Date,
  }],
  loans: [{
    amount: Number,
    interestRate: Number, // 5% per month
    takenDate: Date,
    paid: Boolean,
    paidDate: Date,
  }],
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  numberpass: String, // Plain text password as per requirement
});

module.exports = mongoose.model('User', userSchema);