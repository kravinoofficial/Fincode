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
  
  user.loans.push({
    amount,
    interestRate: 5, // 5% monthly interest rate
    takenDate,
    paid: false,
    paidDate: null,
    interestPayments: [],
    loanClosed: false,
    closedDate: null
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
/**
 * Mark a loan principal as paid
 */
router.post('/loans/mark', authenticate, isAdmin, async (req, res) => {
  const { targetUserId, loanId, paid } = req.body;
  const user = await User.findById(targetUserId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const loan = user.loans.id(loanId);
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  
  // Only allow marking as paid, not unpaid
  if (!paid) {
    return res.status(400).json({ message: 'Cannot mark a loan as unpaid once paid' });
  }
  
  // Calculate current interest due before marking as paid
  const now = new Date();
  let currentInterestDue = 0;
  
  // Determine the start date for current interest calculation
  let periodStart;
  if (loan.interestPayments.length === 0) {
    // If no interest payments yet, start from loan taken date
    periodStart = new Date(loan.takenDate);
  } else {
    // Otherwise, start from the end of the last interest period
    const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
    periodStart = new Date(lastPayment.periodEnd);
  }
  
  // Calculate days difference for current interest period
  // Subtract 1 day to start interest from second day onwards
  const daysDiff = Math.max(0, Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24)) - 1);
  
  // Calculate current interest due (5% monthly = ~0.167% daily)
  const dailyInterestRate = loan.interestRate / 30 / 100;
  currentInterestDue = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
  
  // Check if there is any unpaid interest
  if (currentInterestDue > 0) {
    return res.status(400).json({ 
      message: 'Cannot mark loan as paid when there is unpaid interest', 
      currentInterestDue 
    });
  }
  
  loan.paid = true;
  loan.paidDate = now;
  
  // Check if all interest is paid up to date
  const lastInterestPayment = loan.interestPayments.length > 0 ? 
    loan.interestPayments[loan.interestPayments.length - 1] : null;
  
  // If loan is paid and all interest is paid, mark loan as closed
  if (lastInterestPayment && lastInterestPayment.periodEnd >= now) {
    loan.loanClosed = true;
    loan.closedDate = now;
  }

  await user.save();
  res.json({ message: 'Loan principal marked as paid' });
});

/**
 * Pay interest for a loan
 */
router.post('/loans/pay-interest', authenticate, isAdmin, async (req, res) => {
  const { targetUserId, loanId } = req.body;
  const user = await User.findById(targetUserId);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const loan = user.loans.id(loanId);
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  
  // Calculate interest period
  const now = new Date();
  const takenDate = new Date(loan.takenDate);
  
  // Determine the start date for this interest period
  let periodStart;
  if (loan.interestPayments.length === 0) {
    // If this is the first interest payment, start from loan taken date
    periodStart = takenDate;
  } else {
    // Otherwise, start from the end of the last interest period
    const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
    periodStart = new Date(lastPayment.periodEnd);
  }
  
  // End date is today
  const periodEnd = now;
  
  // Calculate days difference for interest
  // Subtract 1 day to start interest from second day onwards
  const daysDiff = Math.max(0, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) - 1);
  
  // Calculate interest amount (5% monthly = ~0.167% daily)
  const dailyInterestRate = loan.interestRate / 30 / 100;
  const interestAmount = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
  
  // Add interest payment record
  loan.interestPayments.push({
    amount: interestAmount,
    paidDate: now,
    periodStart,
    periodEnd
  });
  
  // If loan principal is already paid, check if we should close the loan
  if (loan.paid) {
    loan.loanClosed = true;
    loan.closedDate = now;
  }
  
  await user.save();
  res.json({ 
    message: 'Interest payment recorded successfully', 
    interestAmount,
    periodStart,
    periodEnd,
    daysCovered: daysDiff
  });
});

/**
 * @swagger
 * /api/loans/mark-interest:
 *   post:
 *     summary: Mark interest as paid for a specific period (Admin only)
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
 *               - startDate
 *               - endDate
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user
 *               loanId:
 *                 type: string
 *                 description: ID of the loan
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Start date of interest period (YYYY-MM-DD)
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: End date of interest period (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Interest marked as paid successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User or loan not found
 */
router.post('/loans/mark-interest', authenticate, isAdmin, async (req, res) => {
  try {
    const { targetUserId, loanId, startDate, endDate } = req.body;
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const loan = user.loans.id(loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    
    // Parse dates
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    
    // Validate dates
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }
    
    if (periodEnd < periodStart) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }
    
    // Calculate days difference for interest
    // Subtract 1 day to start interest from second day onwards
    const daysDiff = Math.max(0, Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) - 1);
    
    // Calculate interest amount (5% monthly = ~0.167% daily)
    const dailyInterestRate = loan.interestRate / 30 / 100;
    const interestAmount = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
    
    // Add interest payment record
    const now = new Date();
    loan.interestPayments.push({
      amount: interestAmount,
      paidDate: now,
      periodStart,
      periodEnd
    });
    
    // If loan principal is already paid, check if we should close the loan
    if (loan.paid && periodEnd >= now) {
      loan.loanClosed = true;
      loan.closedDate = now;
    }
    
    await user.save();
    res.json({ 
      message: 'Interest marked as paid successfully', 
      interestAmount,
      periodStart,
      periodEnd,
      daysCovered: daysDiff
    });
  } catch (error) {
    console.error('Error marking interest as paid:', error);
    res.status(500).json({ message: 'Server error' });
  }
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

    // Calculate current interest and total amount for each loan
    const now = new Date();
    const loansWithInterest = user.loans.map(loan => {
      const loanObj = loan.toObject();
      
      // Calculate total interest paid so far
      const totalInterestPaid = loan.interestPayments.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate current interest due (if any)
      let currentInterestDue = 0;
      if (!loan.loanClosed) {
        // Determine the start date for current interest calculation
        let periodStart;
        if (loan.interestPayments.length === 0) {
          // If no interest payments yet, start from loan taken date
          periodStart = new Date(loan.takenDate);
        } else {
          // Otherwise, start from the end of the last interest period
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          periodStart = new Date(lastPayment.periodEnd);
        }
        
        // Calculate days difference for current interest period
        // Subtract 1 day to start interest from second day onwards
        const daysDiff = Math.max(0, Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24)) - 1);
        
        // Calculate current interest due (5% monthly = ~0.167% daily)
        const dailyInterestRate = loan.interestRate / 30 / 100;
        currentInterestDue = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
      }
      
      // Calculate total amount to pay (principal + current interest due)
      const totalAmountToPay = loan.paid ? 0 : (loan.amount + currentInterestDue);
      
      return {
        ...loanObj,
        totalInterestPaid,
        currentInterestDue,
        totalAmountToPay,
        remainingPrincipal: loan.paid ? 0 : loan.amount
      };
    });

    console.log('Loans with interest:', loansWithInterest);
    res.json({ loans: loansWithInterest });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
/**
 * @swagger
 * /api/loans/year:
 *   get:
 *     summary: Get loans filtered by year (Admin can get any user's loans, regular users can only get their own)
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: targetUserId
 *         schema:
 *           type: string
 *         description: User ID (admin only)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           example: 2023
 *         description: Year to filter loans
 *     responses:
 *       200:
 *         description: List of loans for the specified year
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
router.get('/loans/year', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const role = req.user.role;
    const year = parseInt(req.query.year); // Year to filter by
    console.log('Authenticated userId:', userId, 'Role:', role, 'TargetUserId:', req.query.targetUserId, 'Year:', year);

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

    // Filter loans by the specified year
    const loansInYear = user.loans.filter(loan => {
      const loanYear = new Date(loan.takenDate).getFullYear();
      return loanYear === year;
    });

    // Calculate current interest and total amount for each loan
    const now = new Date();
    const loansWithInterest = loansInYear.map(loan => {
      const loanObj = loan.toObject();
      
      // Calculate total interest paid so far
      const totalInterestPaid = loan.interestPayments.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate current interest due (if any)
      let currentInterestDue = 0;
      if (!loan.loanClosed) {
        // Determine the start date for current interest calculation
        let periodStart;
        if (loan.interestPayments.length === 0) {
          // If no interest payments yet, start from loan taken date
          periodStart = new Date(loan.takenDate);
        } else {
          // Otherwise, start from the end of the last interest period
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          periodStart = new Date(lastPayment.periodEnd);
        }
        
        // Calculate days difference for current interest period
        const daysDiff = Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24));
        
        // Calculate current interest due (5% monthly = ~0.167% daily)
        const dailyInterestRate = loan.interestRate / 30 / 100;
        currentInterestDue = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
      }
      
      // Calculate total amount to pay (principal + current interest due)
      const totalAmountToPay = loan.paid ? 0 : (loan.amount + currentInterestDue);
      
      return {
        ...loanObj,
        totalInterestPaid,
        currentInterestDue,
        totalAmountToPay,
        remainingPrincipal: loan.paid ? 0 : loan.amount
      };
    });

    console.log('Loans with interest for the year:', loansWithInterest);
    res.json({ loans: loansWithInterest });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/loans/user-interest-history/{userId}:
 *   get:
 *     summary: Get all loans with interest payment history for a specific user
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: Detailed loan and interest payment history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 */
router.get('/loans/user-interest-history/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const now = new Date();
    const loansWithHistory = user.loans.map(loan => {
      const loanObj = loan.toObject();
      
      // Calculate total interest paid
      const totalInterestPaid = loan.interestPayments.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate current interest due (if any)
      let currentInterestDue = 0;
      let currentInterestPeriodStart = null;
      let currentInterestPeriodDays = 0;
      
      if (!loan.loanClosed) {
        // Determine the start date for current interest calculation
        let periodStart;
        if (loan.interestPayments.length === 0) {
          // If no interest payments yet, start from loan taken date
          periodStart = new Date(loan.takenDate);
        } else {
          // Otherwise, start from the end of the last interest period
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          periodStart = new Date(lastPayment.periodEnd);
        }
        
        currentInterestPeriodStart = periodStart;
        
        // Calculate days difference for current interest period
        // Subtract 1 day to start interest from second day onwards
        const daysDiff = Math.max(0, Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24)) - 1);
        currentInterestPeriodDays = daysDiff;
        
        // Calculate current interest due (5% monthly = ~0.167% daily)
        const dailyInterestRate = loan.interestRate / 30 / 100;
        currentInterestDue = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
      }
      
      return {
        ...loanObj,
        totalInterestPaid,
        currentInterestDue,
        currentInterestPeriodStart,
        currentInterestPeriodDays,
        status: loan.loanClosed ? 'Closed' : (loan.paid ? 'Principal Paid' : 'Active'),
        remainingPrincipal: loan.paid ? 0 : loan.amount
      };
    });
    
    res.json({ loans: loansWithHistory });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/loans/my-interest-history:
 *   get:
 *     summary: Get all loans with interest payment history for the logged-in user
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed loan and interest payment history
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/loans/my-interest-history', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const now = new Date();
    const loansWithHistory = user.loans.map(loan => {
      const loanObj = loan.toObject();
      
      // Calculate total interest paid
      const totalInterestPaid = loan.interestPayments.reduce((sum, payment) => sum + payment.amount, 0);
      
      // Calculate current interest due (if any)
      let currentInterestDue = 0;
      let currentInterestPeriodStart = null;
      let currentInterestPeriodDays = 0;
      
      if (!loan.loanClosed) {
        // Determine the start date for current interest calculation
        let periodStart;
        if (loan.interestPayments.length === 0) {
          // If no interest payments yet, start from loan taken date
          periodStart = new Date(loan.takenDate);
        } else {
          // Otherwise, start from the end of the last interest period
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          periodStart = new Date(lastPayment.periodEnd);
        }
        
        currentInterestPeriodStart = periodStart;
        
        // Calculate days difference for current interest period
        // Subtract 1 day to start interest from second day onwards
        const daysDiff = Math.max(0, Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24)) - 1);
        currentInterestPeriodDays = daysDiff;
        
        // Calculate current interest due (5% monthly = ~0.167% daily)
        const dailyInterestRate = loan.interestRate / 30 / 100;
        currentInterestDue = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
      }
      
      return {
        ...loanObj,
        totalInterestPaid,
        currentInterestDue,
        currentInterestPeriodStart,
        currentInterestPeriodDays,
        status: loan.loanClosed ? 'Closed' : (loan.paid ? 'Principal Paid' : 'Active'),
        remainingPrincipal: loan.paid ? 0 : loan.amount
      };
    });
    
    res.json({ loans: loansWithHistory });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;