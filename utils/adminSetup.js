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
    } else {
    }
  } catch (error) {
    console.error('Error initializing admin:', error.message);
  }
}

// Run the check every hour
cron.schedule('0 * * * *', async () => {
  
  await initializeAdmin();
});

// Run immediately on startup
initializeAdmin();

module.exports = { initializeAdmin };