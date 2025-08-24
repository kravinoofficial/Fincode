const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  description: { type: String, default: 'No description' },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // User who created the expense
});

// Check if the model already exists before defining it
const Expense = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

module.exports = Expense;
