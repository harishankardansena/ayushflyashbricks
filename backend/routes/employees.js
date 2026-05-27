const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { upload } = require('../utils/cloudinary');

// GET all employees
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Server error fetching employees' });
  }
});

// GET a single employee
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Server error fetching employee' });
  }
});

// POST a new employee
router.post('/', upload.fields([{ name: 'profilePicture' }, { name: 'document' }]), async (req, res) => {
  try {
    const employeeData = { ...req.body };
    if (req.files) {
      if (req.files.profilePicture) {
        employeeData.profilePictureUrl = req.files.profilePicture[0].path;
      }
      if (req.files.document) {
        employeeData.documentUrl = req.files.document[0].path;
      }
    }
    
    // Auto-generate employeeId: EMP-YYMMXX
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const prefix = `EMP-${yy}${mm}`;
    
    // Find the latest employee in this month
    const latestEmp = await Employee.findOne({ employeeId: new RegExp(`^${prefix}`) }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (latestEmp && latestEmp.employeeId) {
      const numStr = latestEmp.employeeId.slice(8);
      if (!isNaN(numStr) && numStr.length > 0) {
        nextNum = parseInt(numStr) + 1;
      }
    }
    employeeData.employeeId = `${prefix}${String(nextNum).padStart(2, '0')}`;
    
    const newEmployee = new Employee(employeeData);
    const savedEmployee = await newEmployee.save();
    res.status(201).json(savedEmployee);
  } catch (error) {
    console.error('Error saving employee:', error);
    res.status(400).json({ error: error.message || 'Error saving employee' });
  }
});

// PUT update an employee
router.put('/:id', upload.fields([{ name: 'profilePicture' }, { name: 'document' }]), async (req, res) => {
  try {
    const employeeData = { ...req.body };
    if (req.files) {
      if (req.files.profilePicture) {
        employeeData.profilePictureUrl = req.files.profilePicture[0].path;
      }
      if (req.files.document) {
        employeeData.documentUrl = req.files.document[0].path;
      }
    }
    const updatedEmployee = await Employee.findByIdAndUpdate(
      req.params.id,
      employeeData,
      { new: true, runValidators: true }
    );
    if (!updatedEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(updatedEmployee);
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(400).json({ error: error.message || 'Error updating employee' });
  }
});

module.exports = router;
