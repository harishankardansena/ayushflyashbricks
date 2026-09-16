const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Billing = require('../models/Billing');
const Production = require('../models/Production');
const OrderRequest = require('../models/OrderRequest');
const { syncStock } = require('../utils/stockUtils');

// Generate bill number: MM-DD-XX format
async function generateBillNumber(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

  // Find the last bill of the day to get the highest sequence number
  const lastBill = await Billing.findOne({
    date: { $gte: dayStart, $lte: dayEnd }
  }).sort({ billNumber: -1 });

  let nextSeq = 1;
  if (lastBill && lastBill.billNumber) {
    const parts = lastBill.billNumber.split('-');
    if (parts.length === 3) {
      const lastSeq = parseInt(parts[2]);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
  }

  const xx = String(nextSeq).padStart(2, '0');
  return `${mm}-${dd}-${xx}`;
}

// GET /api/billing/pending - List pending bill requests
router.get('/pending', auth, async (req, res) => {
  try {
    const bills = await Billing.find({ status: 'Pending Approval' }).sort({ createdAt: -1 }).populate('orderRequestId');
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/billing - List with filters
router.get('/', auth, async (req, res) => {
  try {
    const { month, year, page = 1, limit = 20, search, date } = req.query;
    const filter = {};
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    } else if (month && year) {
      filter.date = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59, 999)
      };
    }
    if (search) {
      filter.$or = [
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
        { billNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Only show approved bills in main billing list unless specified
    filter.status = 'Approved';

    const total = await Billing.countDocuments(filter);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const records = await Billing.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalRevenue = await Billing.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]);

    res.json({
      records, total, totalRevenue: totalRevenue[0]?.total || 0,
      page: parseInt(page), pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/billing/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/billing - Create new bill
router.post('/', auth, async (req, res) => {
  try {
    const { customer, bricks, ratePerBrick, workerCharge, transportCharge, gstEnabled, cgstRate, sgstRate, discount, paymentStatus, amountPaid, notes, date, orderRequestId } = req.body;
    const billDate = date ? new Date(date) : new Date();

    let orderReq = null;
    if (orderRequestId) {
      orderReq = await OrderRequest.findById(orderRequestId);
      if (!orderReq) {
        return res.status(404).json({ message: 'Order Request not found' });
      }
      if (orderReq.status !== 'Accepted') {
        return res.status(400).json({ message: 'Order Request is not accepted' });
      }
      if (orderReq.remainingValue < bricks) {
        return res.status(400).json({ message: 'Not enough quota left in the Order Request' });
      }
    }

    const isEmployee = req.admin && req.admin.role === 'employee';
    const status = isEmployee ? 'Pending Approval' : 'Approved';

    let bill;
    let saved = false;
    let attempts = 0;

    // Retry loop to handle rare race conditions for bill number generation
    while (!saved && attempts < 5) {
      attempts++;
      const billNumber = await generateBillNumber(billDate);

      try {
        bill = new Billing({
          billNumber, date: billDate, customer, bricks,
          ratePerBrick, workerCharge, transportCharge, gstEnabled, cgstRate, sgstRate,
          discount, paymentStatus, amountPaid: amountPaid || 0, notes, status, orderRequestId
        });
        await bill.save();
        saved = true;
      } catch (err) {
        if (err.code === 11000 && attempts < 5) {
          console.warn(`Duplicate bill number detected (attempt ${attempts}), retrying...`);
          continue;
        }
        throw err;
      }
    }

    // Deduct quota if linked to an order request
    if (orderReq) {
      orderReq.remainingValue -= bricks;
      await orderReq.save();
    }

    // Reduce stock automatically
    const today = new Date(billDate);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(billDate);
    todayEnd.setHours(23, 59, 59, 999);

    // Reduce stock automatically by creating a separate production log entry for this sale


    const lastRecord = await Production.findOne({ 
      $or: [
        { date: { $lt: today } },
        { date: today, createdAt: { $lt: new Date() } } // This is a bit loose but syncStock handles it
      ]
    }).sort({ date: -1, createdAt: -1 });
    
    const previousStock = lastRecord ? lastRecord.currentStock : 0;
    
    const prodRecord = new Production({
      date: today,
      produced: 0,
      sold: bricks,
      previousStock,
      notes: `Sold: Bill ${bill.billNumber}`
    });
    
    await prodRecord.save();
    await syncStock();

    res.status(201).json(bill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.code === 11000 ? 'Duplicate bill number conflict' : 'Server error' });
  }
});

// PATCH /api/billing/:id/payment - Update payment for partial/pending
router.patch('/:id/payment', auth, async (req, res) => {
  try {
    const { amountPaid, paymentStatus } = req.body;
    const bill = await Billing.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    if (amountPaid !== undefined) bill.amountPaid = amountPaid;
    if (paymentStatus !== undefined) bill.paymentStatus = paymentStatus;

    // Auto-settle if paid fully
    if (bill.amountPaid >= bill.finalAmount) {
      bill.amountPaid = bill.finalAmount;
      bill.paymentStatus = 'Paid';
    }

    await bill.save();
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/billing/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });

    // Reverse stock deduction by deleting the exact production log entry
    const prodRecord = await Production.findOne({ notes: `Sold: Bill ${bill.billNumber}` });
    if (prodRecord) {
      await Production.findByIdAndDelete(prodRecord._id);
      await syncStock();
    }

    // Refund the quota to the order request if it was linked
    if (bill.orderRequestId) {
      const orderReq = await OrderRequest.findById(bill.orderRequestId);
      if (orderReq) {
        orderReq.remainingValue += bill.bricks;
        await orderReq.save();
      }
    }

    await Billing.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bill deleted and stock reversed' });
  } catch (err) {
    console.error('Delete bill error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// PUT /api/billing/:id/approve
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.status !== 'Pending Approval') return res.status(400).json({ message: 'Bill is not pending approval' });
    
    bill.status = 'Approved';
    await bill.save();
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/billing/:id/reject
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const bill = await Billing.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.status !== 'Pending Approval') return res.status(400).json({ message: 'Bill is not pending approval' });
    
    bill.status = 'Rejected';
    await bill.save();
    
    // Refund the quota
    if (bill.orderRequestId) {
      const orderReq = await OrderRequest.findById(bill.orderRequestId);
      if (orderReq) {
        orderReq.remainingValue += bill.bricks;
        await orderReq.save();
      }
    }
    
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});
