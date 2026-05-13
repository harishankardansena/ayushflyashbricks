const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'Worker', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Half-Day'], default: 'Present' },
  overtimeHours: { type: Number, default: 0 },
  wageEarned: { type: Number, required: true } // Calculated at time of entry: (status multiplier * dailyWage) + (overtime * rate)
}, { timestamps: true });

// Ensure one entry per worker per day
attendanceSchema.index({ worker: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
