const mongoose = require('mongoose');

const orderRequestSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  requestedValue: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
  remainingValue: { type: Number, default: 0 },
  validUntil: { type: Date },
  isSettled: { type: Boolean, default: false },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('OrderRequest', orderRequestSchema);
