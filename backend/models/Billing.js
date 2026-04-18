const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema({
  billNumber: { type: String, required: true, unique: true },
  date: { type: Date, required: true, default: Date.now },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true }
  },
  bricks: { type: Number, required: true, min: 1 },
  ratePerBrick: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Partial'], default: 'Paid' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-calculate totals
billingSchema.pre('save', function(next) {
  this.totalAmount = this.bricks * this.ratePerBrick;
  this.finalAmount = this.totalAmount - (this.discount || 0);
  next();
});

module.exports = mongoose.model('Billing', billingSchema);
