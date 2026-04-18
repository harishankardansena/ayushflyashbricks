const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

// GET /api/production - List all with pagination
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, month, year } = req.query;
    const filter = {};
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    const total = await Production.countDocuments(filter);
    const records = await Production.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/production - Add new entry
router.post('/', auth, async (req, res) => {
  try {
    const { date, produced, sold, notes } = req.body;
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    // Get the most recent record before this entry's date OR on the same date but created earlier
    const lastRecord = await Production.findOne({ 
      $or: [
        { date: { $lt: entryDate } },
        { date: entryDate }
      ]
    }).sort({ date: -1, createdAt: -1 });

    const previousStock = lastRecord ? lastRecord.currentStock : 0;

    const record = new Production({ date: entryDate, produced, sold, previousStock, notes });
    await record.save();
    await syncStock();
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/production/:id - Update entry
router.put('/:id', auth, async (req, res) => {
  try {
    const { produced, sold, notes } = req.body;
    const record = await Production.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    record.produced = produced;
    record.sold = sold;
    record.notes = notes;
    await record.save();
    await syncStock();
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/production/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Production.findByIdAndDelete(req.params.id);
    await syncStock();
    res.json({ message: 'Record deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
