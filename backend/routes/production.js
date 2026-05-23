const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

// GET /api/production - Grouped by day
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 15, month, year } = req.query;
    const filter = {};
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    // Aggregate to group by date
    const grouped = await Production.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        totalProduced: { $sum: "$produced" },
        totalSold: { $sum: "$sold" },
        logs: { $push: "$$ROOT" },
        rawDate: { $first: "$date" } // Keep a raw date for sorting/display
      }},
      { $sort: { _id: -1 } },
      { $skip: (page - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    // Count distinct dates
    const totalDays = await Production.aggregate([
      { $match: filter },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } } },
      { $count: "count" }
    ]);

    const finalRecords = grouped.map(g => ({
      _id: g.rawDate, // Use the raw date object for the frontend formatDate
      totalProduced: g.totalProduced,
      totalSold: g.totalSold,
      logs: g.logs,
      dateString: g._id
    }));

    res.json({ 
      records: finalRecords, 
      total: totalDays[0]?.count || 0, 
      page: parseInt(page), 
      pages: Math.ceil((totalDays[0]?.count || 0) / parseInt(limit)) 
    });
  } catch (err) {
    console.error('Fetch production error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/production - Add new entry
router.post('/', auth, async (req, res) => {
  try {
    const { date, produced, sold, adjustment, notes } = req.body;
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

    const record = new Production({ date: entryDate, produced, sold, adjustment, previousStock, notes });
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
    const { produced, sold, adjustment, notes } = req.body;
    const record = await Production.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (produced !== undefined) record.produced = produced;
    if (sold !== undefined) record.sold = sold;
    if (adjustment !== undefined) record.adjustment = adjustment;
    if (notes !== undefined) record.notes = notes;
    
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
