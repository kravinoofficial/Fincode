const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');
const { getCurrentMonth } = require('../utils/helpers');
const mongoose = require('mongoose');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - numberpass
 *             properties:
 *               number:
 *                 type: string
 *                 description: User's phone number
 *               numberpass:
 *                 type: string
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *                 userId:
 *                   type: string
 *                   description: User ID
 *                 role:
 *                   type: string
 *                   description: User role (admin or user)
 *                 name:
 *                   type: string
 *                   description: User name
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  const { number, numberpass } = req.body;
  const user = await User.findOne({ number, numberpass });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET
  );
  res.json({ token, userId: user._id, role: user.role, name: user.name });
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Add a new user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - number
 *               - address
 *               - monthlyAmount
 *               - numberpass
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *               number:
 *                 type: string
 *                 description: User's phone number
 *               address:
 *                 type: string
 *                 description: User's address
 *               monthlyAmount:
 *                 type: number
 *                 description: Monthly payment amount
 *               numberpass:
 *                 type: string
 *                 description: User's password
 *     responses:
 *       200:
 *         description: User added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User added successfully
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.post('/users', async (req, res) => {
  const { name, number, address, monthlyAmount, numberpass } = req.body;
  const user = new User({
    name,
    number,
    address,
    monthlyAmount,
    numberpass,
    role: 'user',
    payments: [{ month: getCurrentMonth(), paid: false }],
  });
  await user.save();
  res.json({ message: 'User added successfully', user });
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   number:
 *                     type: string
 *                   address:
 *                     type: string
 *                   monthlyAmount:
 *                     type: number
 *                   role:
 *                     type: string
  *                   pendingLoanPrincipal:
  *                     type: number
  *                     description: Sum of principal for all active (unpaid) loans
  *                   currentinterestdue:
  *                     type: number
  *                     description: Sum of current unpaid interest across active loans (from interestPayments.currentinterestdue)
  *                   pendingLoanTotal:
  *                     type: number
  *                     description: pendingLoanPrincipal + currentinterestdue
 *       401:
 *         description: Unauthorized
 */
router.get('/users', async (req, res) => {
  const users = await User.find(
    { role: { $ne: 'admin' } },
    { numberpass: 0, payments: 0 } // Exclude 'numberpass' and 'payments' fields
  );
  const now = new Date();

  // Enrich each user with pending loan totals
  const usersWithSummary = users.map(u => {
    const userObj = u.toObject ? u.toObject() : u;
    let pendingLoanPrincipal = 0;
    let currentinterestdue = 0;

    if (Array.isArray(userObj.loans)) {
      userObj.loans.forEach(loan => {
        const isActive = loan && loan.paid !== true && loan.loanClosed !== true;
        if (isActive) {
          // Sum principal of active loans
          pendingLoanPrincipal += Number(loan.amount || 0);

          // Calculate current interest due using days since last payment (or takenDate)
          const payments = Array.isArray(loan.interestPayments)
            ? loan.interestPayments
            : Array.isArray(loan.interestpayments)
              ? loan.interestpayments
              : [];

          let interestStartDate;
          if (payments.length === 0) {
            interestStartDate = loan.takenDate ? new Date(loan.takenDate) : null;
          } else {
            const lastPayment = payments[payments.length - 1];
            if (lastPayment && lastPayment.paidDate) {
              interestStartDate = new Date(lastPayment.paidDate);
              interestStartDate.setDate(interestStartDate.getDate() + 1);
            }
          }

          if (interestStartDate && !isNaN(interestStartDate)) {
            const daysDiff = Math.ceil((now - interestStartDate) / (1000 * 60 * 60 * 24));
            if (daysDiff > 0) {
              const dailyInterestRate = Number(loan.interestRate || 5) / 30 / 100;
              currentinterestdue += Number(((Number(loan.amount || 0) * dailyInterestRate) * daysDiff).toFixed(2));
            }
          }
        }
      });
    }

    userObj.pendingLoanPrincipal = Math.round(pendingLoanPrincipal * 100) / 100;
    userObj.currentinterestdue = Math.round(currentinterestdue * 100) / 100;
    userObj.pendingLoanTotal = Math.round((pendingLoanPrincipal + currentinterestdue) * 100) / 100;
    return userObj;
  });

  // Aggregate high-level loan summary across users
  let totalActiveLoans = 0;
  let totalClosedLoans = 0;
  let totalPaidInterest = 0;
  let totalActiveLoanAmount = 0;

  users.forEach(user => {
    if (Array.isArray(user.loans)) {
      user.loans.forEach(loan => {
        if (loan?.paid) {
          totalClosedLoans++;
          const takenDate = loan.takenDate ? new Date(loan.takenDate) : null;
          const paidDate = loan.paidDate ? new Date(loan.paidDate) : null;
          if (takenDate && paidDate && !isNaN(takenDate) && !isNaN(paidDate)) {
            const monthsDiff = (paidDate.getFullYear() - takenDate.getFullYear()) * 12 + (paidDate.getMonth() - takenDate.getMonth());
            const interestAmount = Number(loan.amount || 0) * 0.05 * (monthsDiff > 0 ? monthsDiff : 1);
            totalPaidInterest += interestAmount;
          }
        } else {
          totalActiveLoans++;
          totalActiveLoanAmount += Number(loan?.amount || 0);
        }
      });
    }
  });

  const peruserpendinginterest = usersWithSummary.map(user => ({
    name: user.name,
    currentinterestdue: user.currentinterestdue
  }));

  // Remove loans from user objects before sending response
  const usersWithoutLoans = usersWithSummary.map(user => {
    const userObj = { ...user };
    delete userObj.loans;
    return userObj;
  });

  res.json({
    users: usersWithSummary,
    peruserpendinginterest,
    usersWithoutLoans,
    loanSummary: {
      totalActiveLoans,
      totalActiveLoanAmount,
      totalClosedLoans,
      totalPaidInterest: Math.round(totalPaidInterest * 100) / 100
    }
  });
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The user ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 number:
 *                   type: string
 *                 address:
 *                   type: string
 *                 monthlyAmount:
 *                   type: number
 *                 role:
 *                   type: string
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
router.get('/users/:id', authenticate, async (req, res) => {
  const user = await User.findById(req.params.id, '-numberpass');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json(user);
});

/**
 * @swagger
 * /api/users/by-date:
 *   get:
 *     summary: Get all users by a date range
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         description: The start date in YYYY-MM-DD format
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         description: The end date in YYYY-MM-DD format
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of users within the date range
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   number:
 *                     type: string
 *                   address:
 *                     type: string
 *                   monthlyAmount:
 *                     type: number
 *                   role:
 *                     type: string
 *       400:
 *         description: Invalid date range
 *       401:
 *         description: Unauthorized
 */
router.get('/users/by-date', authenticate, async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Ensure both dates are provided and valid
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Both startDate and endDate are required' });
  }

  try {
    // Convert strings to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Find users within the date range (assuming you have a createdAt field or similar)
    const users = await User.find({
      createdAt: { $gte: start, $lte: end },
      role: { $ne: 'admin' }
    }, '-numberpass');
    
    // If no users found, return 404
    if (!users.length) {
      return res.status(404).json({ message: 'No users found for the given date range' });
    }
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/users/payments/by-month:
 *   get:
 *     summary: Get all users with their payment data for a specific month (15th to 15th)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: false
 *         description: Optional date in YYYY-MM-DD format to get payments for that month period
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of users with their payment data for the specified month
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   number:
 *                     type: string
 *                   address:
 *                     type: string
 *                   monthlyAmount:
 *                     type: number
 *                   payments:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         month:
 *                           type: string
 *                         paid:
 *                           type: boolean
 *                         paidDate:
 *                           type: string
 *                           format: date
 *       400:
 *         description: Invalid date format
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No users found
 */
router.get('/users/payments/by-month', async (req, res) => {
  try {
    // Get date parameter from query or use current date
    const { date } = req.query;
    let targetMonth;
    
    if (date) {
      // If date is provided, use it
      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      // Format the month based on the provided date
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = targetDate.getDate();
      
      if (day < 15) {
        // If before 15th, use previous month's period
        targetDate.setMonth(targetDate.getMonth() - 1);
        const prevMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
        const prevYear = targetDate.getFullYear();
        const nextMonth = String(month === '12' ? 1 : parseInt(month)).padStart(2, '0');
        const nextYear = month === '12' ? year + 1 : year;
        targetMonth = `${prevYear}-${prevMonth}-15 to ${nextYear}-${nextMonth}-15`;
      } else {
        // If 15th or after, use current month's period
        const nextMonth = String(month === '12' ? 1 : parseInt(month) + 1).padStart(2, '0');
        const nextYear = month === '12' ? year + 1 : year;
        targetMonth = `${year}-${month}-15 to ${nextYear}-${nextMonth}-15`;
      }
    } else {
      // If no date provided, use current month from helper function
      targetMonth = getCurrentMonth();
    }
    
    // Find all users except admins
    const users = await User.find({ role: { $ne: 'admin' } }, '-numberpass');
    
    if (!users.length) {
      return res.status(404).json({ message: 'No users found' });
    }
    
    // Process each user to ensure they have the payment for the target month
    const processedUsers = users.map(user => {
      const userObj = user.toObject();
      
      // Check if user has payment for the target month
      const hasTargetMonthPayment = userObj.payments.some(payment => payment.month === targetMonth);
      
      // If not, add a new payment entry for the target month
      if (!hasTargetMonthPayment) {
        userObj.payments.push({
          month: targetMonth,
          paid: false
        });
        
        // Save the updated user (async operation)
        User.findByIdAndUpdate(userObj._id, { payments: userObj.payments }).exec();
      }
      
      // Filter payments to only include the target month
      userObj.payments = userObj.payments.filter(payment => payment.month === targetMonth);
      
      return userObj;
    });
    
    res.json(processedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
