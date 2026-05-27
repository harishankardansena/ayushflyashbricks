const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  jobTitle: { type: String, required: true },
  department: { type: String, required: true },
  profilePictureUrl: { type: String },
  status: { type: String, enum: ['Active', 'On Leave', 'Terminated'], default: 'Active' },
  
  // Personal Info
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  dob: { type: Date },
  emergencyContact: { type: String },
  bloodGroup: { type: String },
  aadharNumber: { type: String },
  
  // Employment & Job Details
  doj: { type: Date },
  reportingManager: { type: String },
  employmentType: { type: String, enum: ['Full-time', 'Contract', 'Part-time'], default: 'Full-time' },
  location: { type: String },
  timezone: { type: String },
  
  // Payroll & Compensation
  salary: { type: Number, default: 0 },
  taxBracket: { type: String },
  bankDetails: { type: String },
  
  // Performance
  performanceRating: { type: String },
  documentUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
