const User = require('../models/User');

async function initializeAdmin() {
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const admin = new User({
      name: 'Admin',
      number: '1234567890',
      address: 'Admin Address',
      monthlyAmount: 0,
      role: 'admin',
      numberpass: 'admin123',
    });
    await admin.save();
    console.log('Admin created with number: 1234567890, password: admin123');
  }
}

module.exports = { initializeAdmin };