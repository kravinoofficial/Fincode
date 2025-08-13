const User = require('../models/User');
const cron = require('node-cron');

// Function to initialize admin user
async function initializeAdmin() {
  try {
    // Check if an admin user exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      // Create new admin user with plain-text password
      const admin = new User({
        name: 'Admin',
        number: '1234567890',
        address: 'Admin Address',
        monthlyAmount: 0,
        role: 'admin',
        numberpass: 'admin123',
      });

      // Basic validation for phone number (example: 10 digits)
      if (!/^\d{10}$/.test(admin.number)) {
        console.error('Invalid phone number format');
        return;
      }

      await admin.save();
      console.log('Admin created with number: 1234567890, password: admin123');
    } else {
      console.log('Admin already exists');
    }
  } catch (error) {
    console.error('Error initializing admin:', error.message);
  }
}

// Run the check every hour
cron.schedule('0 * * * *', async () => {
  console.log('Checking for admin user...');
  await initializeAdmin();
});

// Run immediately on startup
initializeAdmin();

module.exports = { initializeAdmin };