const express = require('express');
const router = express.Router();
const OrderRequest = require('../models/OrderRequest');
const Billing = require('../models/Billing');

// Get all overdue requests (Admin)
router.get('/overdue', async (req, res) => {
  try {
    const overdueRequests = await OrderRequest.find({
      validUntil: { $lt: new Date() },
      remainingValue: { $gt: 0 },
      isSettled: false,
      status: 'Accepted'
    }).populate('employeeId', 'name employeeId').sort({ validUntil: 1 });
    
    // For each overdue request, fetch the last generated bill for customer details
    const results = [];
    for (const req of overdueRequests) {
      const lastBill = await Billing.findOne({ orderRequestId: req._id }).sort({ createdAt: -1 });
      results.push({
        ...req.toObject(),
        lastCustomerDetails: lastBill ? lastBill.customer : null
      });
    }
    
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new order request (Employee)
router.post('/request', async (req, res) => {
  try {
    const { employeeId, requestedValue, notes } = req.body;
    const newRequest = new OrderRequest({
      employeeId,
      requestedValue,
      remainingValue: requestedValue,
      notes
    });
    await newRequest.save();
    res.status(201).json(newRequest);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all requests for a specific employee
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const requests = await OrderRequest.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all requests (Admin)
router.get('/', async (req, res) => {
  try {
    const requests = await OrderRequest.find().populate('employeeId', 'name employeeId').sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update request status and remaining value (Admin)
router.put('/:id', async (req, res) => {
  try {
    const { status, remainingValue } = req.body;
    
    // Check if there are any overdue requests globally before accepting a new request
    if (status === 'Accepted') {
      const hasOverdue = await OrderRequest.exists({
        validUntil: { $lt: new Date() },
        remainingValue: { $gt: 0 },
        isSettled: false,
        status: 'Accepted'
      });
      if (hasOverdue) {
        return res.status(403).json({ message: 'Cannot accept new requests until overdue 45-day quotas are settled.' });
      }
    }

    const request = await OrderRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Order request not found' });
    }
    
    if (status) {
      if (status === 'Accepted' && request.status !== 'Accepted') {
        // Set validUntil to 45 days from now
        request.validUntil = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
      }
      request.status = status;
    }
    if (remainingValue !== undefined) request.remainingValue = remainingValue;
    
    await request.save();
    res.json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Settle an overdue request
router.put('/:id/settle', async (req, res) => {
  try {
    const { action } = req.body; // 'zero_quota' or 'extend'
    const request = await OrderRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Order request not found' });

    if (action === 'zero_quota') {
      request.remainingValue = 0;
      request.isSettled = true;
    } else if (action === 'extend') {
      request.validUntil = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
      request.isSettled = false; // Ensure it's not marked settled if extended again
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await request.save();
    res.json(request);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
