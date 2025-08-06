const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');

/**
 * @swagger
 * /api/expenses:
 *   post:
 *     summary: Add a new expense (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 required: true
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Expense added successfully
 *       403:
 *         description: Admin access required
 *       500:
 *         description: Server error
 */
router.post('/expenses', authenticate, isAdmin, async (req, res) => {
  try {
    const { amount, description, date } = req.body;
    const userId = req.user._id;

    const expense = new Expense({
      amount: Number(amount),
      description: description || 'No description',
      date: date ? new Date(date) : new Date(),
      createdBy: userId,
    });
    await expense.save();
    res.json({ message: 'Expense added successfully', expense });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/expenses:
 *   get:
 *     summary: Get all expenses with total
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of expenses with total
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 expenses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       description:
 *                         type: string
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       createdBy:
 *                         type: string
 *                       __v:
 *                         type: number
 *                 totalExpense:
 *                   type: number
 *       500:
 *         description: Server error
 */
router.get('/expenses', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const expenses = await Expense.find({ createdBy: userId }).sort({ date: -1 });
    const totalExpense = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    res.json({ expenses, totalExpense: Number(totalExpense.toFixed(2)) });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;