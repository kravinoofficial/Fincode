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
  // Prevent double-paying
  if (loan.paid) {
    return res.status(400).json({ message: 'Loan is already marked as paid' });
  }
  
  // Calculate current interest due before marking as paid
  const today = new Date();
  let currentInterestDue = 0;
  
  // Check if there's any unpaid interest
  if (loan.interestPayments.length === 0) {
    // No interest payments made yet - calculate from loan start
    const loanTakenDate = new Date(loan.takenDate);
    const daysSinceLoan = Math.ceil((today - loanTakenDate) / (1000 * 60 * 60 * 24));
    const dailyInterestRate = loan.interestRate / 30 / 100;
    currentInterestDue = Number((loan.amount * dailyInterestRate * daysSinceLoan).toFixed(2));
  } else {
    // Check if interest is paid up to today
    const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
    const lastPaymentDate = new Date(lastPayment.paidDate);
    const daysSinceLastPayment = Math.ceil((today - lastPaymentDate) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastPayment > 1) {
      const dailyInterestRate = loan.interestRate / 30 / 100;
      currentInterestDue = Number((loan.amount * dailyInterestRate * (daysSinceLastPayment - 1)).toFixed(2));
    }
  }
  
  // Check if there is any unpaid interest
  if (currentInterestDue > 0) {
    return res.status(400).json({ 
      message: 'Cannot mark loan as paid when there is unpaid interest', 
      currentInterestDue,
      suggestion: 'Pay interest first using /loans/pay-interest endpoint'
    });
  }
  
  loan.paid = true;
  loan.paidDate = today;
  
  // Check if all interest is paid up to date
  const lastInterestPayment = loan.interestPayments.length > 0 ? 
    loan.interestPayments[loan.interestPayments.length - 1] : null;
  
  // Mark loan as closed since principal is paid and all interest is up to date
  loan.loanClosed = true;
  loan.closedDate = today;

  await user.save();
  res.json({ message: 'Loan principal marked as paid' });
});

/**
 * Pay interest for a loan - calculates from last payment date to today
 */
router.post('/loans/pay-interest', authenticate, isAdmin, async (req, res) => {
  try {
    const { targetUserId, loanId } = req.body;
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const loan = user.loans.id(loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    
    if (loan.loanClosed) {
      return res.status(400).json({ message: 'Loan is already closed' });
    }
    
    const today = new Date();
    const loanTakenDate = new Date(loan.takenDate);
    
    // Determine the start date for interest calculation
    let interestStartDate;
    if (loan.interestPayments.length === 0) {
      // First interest payment - start from loan taken date
      interestStartDate = loanTakenDate;
    } else {
      // Subsequent payments - start from the day after last payment
      const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
      interestStartDate = new Date(lastPayment.paidDate);
      interestStartDate.setDate(interestStartDate.getDate() + 1);
    }
    
    // Calculate days between start date and today
    const daysDiff = Math.ceil((today - interestStartDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) {
      return res.status(400).json({ 
        message: 'No interest due - payment already made for this period',
        lastPaymentDate: loan.interestPayments.length > 0 ? loan.interestPayments[loan.interestPayments.length - 1].paidDate : null
      });
    }
    
    // Calculate interest amount (5% monthly = ~0.167% daily)
    const dailyInterestRate = loan.interestRate / 30 / 100;
    const interestAmount = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
    
    // Add interest payment record
    loan.interestPayments.push({
      amount: interestAmount,
      paidDate: today
    });
    
    // Check if loan should be closed (principal paid and no pending interest)
    if (loan.paid) {
      loan.loanClosed = true;
      loan.closedDate = today;
    }
    
    await user.save();
    
    res.json({ 
      message: 'Interest payment recorded successfully', 
      interestAmount,
      daysCovered: daysDiff,
      interestPeriod: {
        from: interestStartDate.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0]
      },
      loanStatus: loan.loanClosed ? 'Closed' : (loan.paid ? 'Principal Paid' : 'Active')
    });
  } catch (error) {
    console.error('Error paying interest:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/loans/mark-interest:
 *   post:
 *     summary: Mark interest as paid until today (Admin only)
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
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: ID of the user
 *               loanId:
 *                 type: string
 *                 description: ID of the loan
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
    const { targetUserId, loanId } = req.body;
    const user = await User.findById(targetUserId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const loan = user.loans.id(loanId);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    
    if (loan.loanClosed) {
      return res.status(400).json({ message: 'Loan is already closed' });
    }
    
    const today = new Date();
    const loanTakenDate = new Date(loan.takenDate);
    
    // Calculate interest due until today
    let interestStartDate;
    if (loan.interestPayments.length === 0) {
      // First interest payment - start from loan taken date
      interestStartDate = loanTakenDate;
    } else {
      // Subsequent payments - start from the day after last payment
      const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
      interestStartDate = new Date(lastPayment.paidDate);
      interestStartDate.setDate(interestStartDate.getDate() + 1);
    }
    
    // Calculate days between start date and today
    const daysCovered = Math.ceil((today - interestStartDate) / (1000 * 60 * 60 * 24));
    
    if (daysCovered <= 0) {
      return res.status(400).json({ 
        message: 'No interest due - payment already made for this period',
        lastPaymentDate: loan.interestPayments.length > 0 ? loan.interestPayments[loan.interestPayments.length - 1].paidDate : null
      });
    }
    
    // Calculate interest amount (5% monthly = ~0.167% daily)
    const dailyInterestRate = loan.interestRate / 30 / 100;
    const interestAmount = Number((loan.amount * dailyInterestRate * daysCovered).toFixed(2));
    
    const interestPeriod = {
      from: interestStartDate.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
    
    // Add interest payment record
    loan.interestPayments.push({
      amount: interestAmount,
      paidDate: today
    });
    
    // Check if loan should be closed (principal paid and no pending interest)
    if (loan.paid) {
      loan.loanClosed = true;
      loan.closedDate = today;
    }
    
    await user.save();
    
    res.json({ 
      message: 'Interest marked as paid until today', 
      interestAmount,
      daysCovered,
      interestPeriod,
      loanStatus: loan.loanClosed ? 'Closed' : (loan.paid ? 'Principal Paid' : 'Active')
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
        let interestStartDate;
        if (loan.interestPayments.length === 0) {
          // No payments yet - start from loan taken date
          interestStartDate = new Date(loan.takenDate);
        } else {
          // Start from day after last payment
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          interestStartDate = new Date(lastPayment.paidDate);
          interestStartDate.setDate(interestStartDate.getDate() + 1);
        }
        
        const daysDiff = Math.ceil((now - interestStartDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) {
          const dailyInterestRate = loan.interestRate / 30 / 100;
          currentInterestDue = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
        }
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
        let interestStartDate;
        if (loan.interestPayments.length === 0) {
          // No payments yet - start from loan taken date
          interestStartDate = new Date(loan.takenDate);
        } else {
          // Start from day after last payment
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          interestStartDate = new Date(lastPayment.paidDate);
          interestStartDate.setDate(interestStartDate.getDate() + 1);
        }
        
        const daysDiff = Math.ceil((now - interestStartDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > 0) {
          const dailyInterestRate = loan.interestRate / 30 / 100;
          currentInterestDue = Number((loan.amount * dailyInterestRate * daysDiff).toFixed(2));
        }
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
        let interestStartDate;
        if (loan.interestPayments.length === 0) {
          // No payments yet - start from loan taken date
          interestStartDate = new Date(loan.takenDate);
        } else {
          // Start from day after last payment
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          interestStartDate = new Date(lastPayment.paidDate);
          interestStartDate.setDate(interestStartDate.getDate() + 1);
        }
        
        currentInterestPeriodStart = interestStartDate;
        
        const daysDiff = Math.ceil((now - interestStartDate) / (1000 * 60 * 60 * 24));
        currentInterestPeriodDays = Math.max(0, daysDiff);
        
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
        let interestStartDate;
        if (loan.interestPayments.length === 0) {
          // No payments yet - start from loan taken date
          interestStartDate = new Date(loan.takenDate);
        } else {
          // Start from day after last payment
          const lastPayment = loan.interestPayments[loan.interestPayments.length - 1];
          interestStartDate = new Date(lastPayment.paidDate);
          interestStartDate.setDate(interestStartDate.getDate() + 1);
        }
        
        currentInterestPeriodStart = interestStartDate;
        
        const daysDiff = Math.ceil((now - interestStartDate) / (1000 * 60 * 60 * 24));
        currentInterestPeriodDays = Math.max(0, daysDiff);
        
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