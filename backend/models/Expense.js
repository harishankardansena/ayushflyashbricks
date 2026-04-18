const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  category: {
    type: String,
    required: true,
    enum: ['Labour', 'Electricity', 'Transport', 'Raw Material', 'Maintenance', 'Miscellaneous']
  },
  description: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, enum: ['Cash', 'Online', 'Cheque'], default: 'Cash' }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
