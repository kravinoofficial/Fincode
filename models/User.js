const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - number
 *         - address
 *         - monthlyAmount
 *         - numberpass
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         name:
 *           type: string
 *           description: User's full name
 *         number:
 *           type: string
 *           description: User's phone number
 *         address:
 *           type: string
 *           description: User's address
 *         monthlyAmount:
 *           type: number
 *           description: Monthly payment amount
 *         payments:
 *           type: array
 *           description: List of user's payments
 *           items:
 *             type: object
 *             properties:
 *               month:
 *                 type: string
 *                 description: Payment month in YYYY-MM format
 *               paid:
 *                 type: boolean
 *                 description: Payment status
 *               paidDate:
 *                 type: string
 *                 format: date
 *                 description: Date when payment was made
 *         loans:
 *           type: array
 *           description: List of user's loans
 *           items:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Loan amount
 *               interestRate:
 *                 type: number
 *                 description: Monthly interest rate (5%)
 *               takenDate:
 *                 type: string
 *                 format: date
 *                 description: Date when loan was taken
 *               paid:
 *                 type: boolean
 *                 description: Loan payment status
 *               paidDate:
 *                 type: string
 *                 format: date
 *                 description: Date when loan was repaid
 *               interestPayments:
 *                 type: array
 *                 description: List of interest payments for this loan
 *                 items:
 *                   type: object
 *                   properties:
 *                     amount:
 *                       type: number
 *                       description: Interest amount paid
 *                     paidDate:
 *                       type: string
 *                       format: date
 *                       description: Date when interest was paid
 *                     periodStart:
 *                       type: string
 *                       format: date
 *                       description: Start date of interest period
 *                     periodEnd:
 *                       type: string
 *                       format: date
 *                       description: End date of interest period
 *               loanClosed:
 *                 type: boolean
 *                 description: Whether the loan is fully closed (principal and all interest paid)
 *               closedDate:
 *                 type: string
 *                 format: date
 *                 description: Date when the loan was fully closed
 *         role:
 *           type: string
 *           enum: [admin, user]
 *           default: user
 *           description: User role
 *         numberpass:
 *           type: string
 *           description: User's password
 */

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
    interestPayments: [{
      amount: Number,
      paidDate: Date,
     
    }],
    loanClosed: { type: Boolean, default: false },
    closedDate: Date
  }],
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  numberpass: String, // Plain text password as per requirement
});

module.exports = mongoose.model('User', userSchema);