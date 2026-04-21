const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Worker = require('../models/Worker');
const Attendance = require('../models/Attendance');

// === WORKER CRUD ===

// Get all active workers
router.get('/', auth, async (req, res) => {
  try {
    const workers = await Worker.find({ isActive: true }).sort({ name: 1 });
    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new worker
router.post('/', auth, async (req, res) => {
  try {
    const worker = new Worker(req.body);
    await worker.save();
    res.status(201).json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update worker
router.put('/:id', auth, async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// "Remove" worker (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    await Worker.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Worker removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// === ATTENDANCE LOGIC ===

// Get attendance for a specific date range (for weekly/monthly reports)
router.get('/report', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const filter = {
      date: { $gte: new Date(start), $lte: new Date(end) }
    };
    const records = await Attendance.find(filter).populate('worker', 'name dailyWage category');
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk log attendance for a date
router.post('/bulk', auth, async (req, res) => {
  try {
    const { date, entries } = req.body; // entries: [{ workerId, status, overtime }]
    const results = [];

    for (const entry of entries) {
      const worker = await Worker.findById(entry.workerId);
      if (!worker) continue;

      // Calculate wage for this entry
      let multiplier = 1;
      if (entry.status === 'Absent') multiplier = 0;
      if (entry.status === 'Half-Day') multiplier = 0.5;
      
      const wageEarned = (worker.dailyWage * multiplier) + (entry.overtimeHours * (worker.dailyWage / 8));

      const record = await Attendance.findOneAndUpdate(
        { worker: entry.workerId, date: new Date(date) },
        { 
          status: entry.status, 
          overtimeHours: entry.overtimeHours,
          wageEarned: wageEarned
        },
        { upsert: true, new: true }
      );
      results.push(record);
    }
    res.json({ message: 'Attendance updated', count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Weekly/Monthly stats summary
router.get('/stats', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const stats = await Attendance.aggregate([
      { $match: { date: { $gte: new Date(start), $lte: new Date(end) } } },
      { $group: { 
          _id: '$worker', 
          daysPresent: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          daysHalf: { $sum: { $cond: [{ $eq: ['$status', 'Half-Day'] }, 1, 0] } },
          totalWages: { $sum: '$wageEarned' },
          totalOvertime: { $sum: '$overtimeHours' }
        }
      },
      { $lookup: { from: 'workers', localField: '_id', foreignField: '_id', as: 'workerInfo' } },
      { $unwind: '$workerInfo' }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
