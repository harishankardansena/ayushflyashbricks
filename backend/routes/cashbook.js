const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Billing = require('../models/Billing');

// GET /api/cashbook/dues - Get all customers with pending balances
router.get('/dues', auth, async (req, res) => {
  try {
    // We look for bills that are Pending or Partial, or where amountPaid is less than finalAmount
    const bills = await Billing.find({
      $or: [
        { paymentStatus: { $in: ['Pending', 'Partial'] } },
        { $expr: { $lt: ['$amountPaid', '$finalAmount'] } }
      ]
    }).sort({ date: -1 });

    const customerDues = {};

    bills.forEach(bill => {
      const phone = bill.customer.phone || '';
      const name = bill.customer.name || '';
      const dueAmount = bill.finalAmount - bill.amountPaid;

      if (dueAmount <= 0) return;

      // Group by phone and exact name to prevent overlapping
      const key = `${phone}_${name.trim().toLowerCase()}`;

      if (!customerDues[key]) {
        customerDues[key] = {
          name: name,
          phone: phone,
          address: bill.customer.address || '',
          totalDue: 0,
          bills: []
        };
      }

      customerDues[key].totalDue += dueAmount;
      customerDues[key].bills.push({
        id: bill._id,
        billNumber: bill.billNumber,
        date: bill.date,
        totalAmount: bill.finalAmount,
        amountPaid: bill.amountPaid,
        dueAmount: dueAmount,
        bricks: bill.bricks
      });
    });

    // Convert object to array and sort by totalDue descending
    const duesArray = Object.values(customerDues).sort((a, b) => b.totalDue - a.totalDue);

    res.json(duesArray);
  } catch (err) {
    console.error('Error fetching cashbook dues:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
