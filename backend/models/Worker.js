const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  dailyWage: { type: Number, required: true, default: 0 },
  category: { type: String, enum: ['Labour', 'Driver', 'Operator', 'Supervisor', 'Other'], default: 'Labour' },
  joiningDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Worker', workerSchema);
