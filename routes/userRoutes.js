const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, isAdmin } = require('../utils/auth');
const { getCurrentMonth } = require('../utils/helpers');

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
router.post('/users', authenticate, isAdmin, async (req, res) => {
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
 *       401:
 *         description: Unauthorized
 */
router.get('/users', authenticate, async (req, res) => {
 const users = await User.find({ role: { $ne: 'admin' } }, '-numberpass');
  res.json(users);
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
 * /api/users/payments/today:
 *   get:
 *     summary: Get all users' payment details for the current month (15th to next 15th), create missing payments
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users with payment details for the current month range (15th to next 15th), creates missing payments
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
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No users found for the given month range
 */
router.get('/users/payments/today', authenticate, async (req, res) => {
  try {
    // Get today's date
    const today = new Date();

    // Determine the current period: 15th of the current month to 15th of the next month
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 15); // 15th of the current month
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 15); // 15th of the next month

    // Format dates as ISO strings for querying
    const startDate = currentMonthStart.toISOString();
    const endDate = nextMonthStart.toISOString();

    // Fetch all users (excluding admin) and check if they have the required payment period
    const users = await User.find({ role: { $ne: 'admin' } }, '-numberpass');

    // Prepare a list to store updated users
    const updatedUsers = [];

    // Loop through each user to check their payments
    for (let user of users) {
      const paymentExists = user.payments.some(p => {
        const paymentDate = new Date(p.month);
        return paymentDate >= currentMonthStart && paymentDate < nextMonthStart;
      });

      // If payment entry for the period doesn't exist, create one
      if (!paymentExists) {
        // Add the missing payment entry
        user.payments.push({
          month: currentMonthStart.toISOString(),
          paid: false
        });

        // Save the user after adding the new payment
        await user.save();
      }

      // Add the updated user to the list
      updatedUsers.push({
        _id: user._id,
        name: user.name,
        number: user.number,
        monthlyAmount: user.monthlyAmount,
        payments: user.payments.filter(p => {
          const paymentDate = new Date(p.month);
          return paymentDate >= currentMonthStart && paymentDate < nextMonthStart;
        })
      });
    }

    // Return the updated users with their payments for the current period
    res.json(updatedUsers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;