const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Billing = require('../models/Billing');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

// Generate bill number: MM-DD-XX format
async function generateBillNumber(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const count = await Billing.countDocuments({ date: { $gte: dayStart, $lte: dayEnd } });
  const xx = String(count + 1).padStart(2, '0');
  return `${mm}-${dd}-${xx}`;
}

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

    const total = await Billing.countDocuments(filter);
    const records = await Billing.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalRevenue = await Billing.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
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
    const { customer, bricks, ratePerBrick, workerCharge, transportCharge, gstEnabled, cgstRate, sgstRate, discount, paymentStatus, notes, date } = req.body;
    const billDate = date ? new Date(date) : new Date();
    const billNumber = await generateBillNumber(billDate);

    const bill = new Billing({
      billNumber, date: billDate, customer, bricks,
      ratePerBrick, workerCharge, transportCharge, gstEnabled, cgstRate, sgstRate,
      discount, paymentStatus, notes
    });
    await bill.save();

    // Reduce stock automatically
    const today = new Date(billDate);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(billDate);
    todayEnd.setHours(23, 59, 59, 999);

    let prodRecord = await Production.findOne({ date: { $gte: today, $lte: todayEnd } });
    if (prodRecord) {
      prodRecord.sold += bricks;
      await prodRecord.save();
    } else {
      // Create a production record for today so stock is tracked
      const lastRecord = await Production.findOne({ date: { $lt: today } }).sort({ date: -1 });
      const previousStock = lastRecord ? lastRecord.currentStock : 0;
      prodRecord = new Production({
        date: today,
        produced: 0,
        sold: bricks,
        previousStock,
        notes: 'Auto-created from Billing'
      });
      await prodRecord.save();
    }
    await syncStock();

    res.status(201).json(bill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/billing/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Billing.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
