const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, email: admin.email, name: admin.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: { id: admin._id, email: admin.email, name: admin.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/auth/verify
router.get('/verify', require('../middleware/auth'), (req, res) => {
  res.json({ valid: true, admin: req.admin });
});

// POST /api/auth/employee/login
router.post('/employee/login', async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) {
      return res.status(400).json({ message: 'Employee ID and password are required' });
    }
    const employee = await Employee.findOne({ employeeId });
    if (!employee || !employee.password) {
      return res.status(400).json({ message: 'Invalid credentials or password not set' });
    }
    const isMatch = await bcrypt.compare(password, employee.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: employee._id, employeeId: employee.employeeId, name: employee.name, role: 'employee' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, employee: { id: employee._id, employeeId: employee.employeeId, name: employee.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
