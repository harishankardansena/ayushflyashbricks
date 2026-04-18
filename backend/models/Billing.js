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
  workerCharge: { type: Number, default: 0 },
  transportCharge: { type: Number, default: 0 },
  gstEnabled: { type: Boolean, default: false },
  cgstRate: { type: Number, default: 0 },
  sgstRate: { type: Number, default: 0 },
  totalAmount: { type: Number },
  discount: { type: Number, default: 0 },
  finalAmount: { type: Number },
  paymentStatus: { type: String, enum: ['Paid', 'Pending', 'Partial'], default: 'Paid' },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-calculate totals
billingSchema.pre('save', function(next) {
  const itemTotal = this.bricks * this.ratePerBrick;
  const otherCharges = (this.workerCharge || 0) + (this.transportCharge || 0);
  const taxableAmount = itemTotal + otherCharges - (this.discount || 0);
  
  if (this.gstEnabled) {
    const cgst = taxableAmount * ((this.cgstRate || 0) / 100);
    const sgst = taxableAmount * ((this.sgstRate || 0) / 100);
    this.totalAmount = taxableAmount + cgst + sgst;
    this.finalAmount = this.totalAmount;
  } else {
    this.totalAmount = taxableAmount;
    this.finalAmount = taxableAmount;
  }
  next();
});

module.exports = mongoose.model('Billing', billingSchema);
