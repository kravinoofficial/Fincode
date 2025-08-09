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

module.exports = router;