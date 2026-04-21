const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Worker = require('../models/Worker');
const Attendance = require('../models/Attendance');

// === ATTENDANCE SPECIFIC ROUTES (must come BEFORE /:id routes) ===

// Get attendance for a specific date range (active workers only)
router.get('/report', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    // Get only active worker IDs
    const activeWorkers = await Worker.find({ isActive: true }).select('_id');
    const activeIds = activeWorkers.map(w => w._id);
    const records = await Attendance.find({
      date: { $gte: new Date(start), $lte: new Date(end) },
      worker: { $in: activeIds }   // only active worker records
    }).populate('worker', 'name dailyWage category');
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk log attendance for a date
router.post('/bulk', auth, async (req, res) => {
  try {
    const { date, entries } = req.body;
    const results = [];

    for (const entry of entries) {
      const worker = await Worker.findById(entry.workerId);
      if (!worker) continue;

      let multiplier = 1;
      if (entry.status === 'Absent')   multiplier = 0;
      if (entry.status === 'Half-Day') multiplier = 0.5;

      const wageEarned = (worker.dailyWage * multiplier) + ((entry.overtimeHours || 0) * (worker.dailyWage / 8));

      const record = await Attendance.findOneAndUpdate(
        { worker: entry.workerId, date: new Date(date) },
        { status: entry.status, overtimeHours: entry.overtimeHours || 0, wageEarned },
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

// Weekly/Monthly stats summary (active workers only)
router.get('/stats', auth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const stats = await Attendance.aggregate([
      { $match: { date: { $gte: new Date(start), $lte: new Date(end) } } },
      { $group: {
          _id: '$worker',
          daysPresent:   { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
          daysHalf:      { $sum: { $cond: [{ $eq: ['$status', 'Half-Day'] }, 1, 0] } },
          totalWages:    { $sum: '$wageEarned' },
          totalOvertime: { $sum: '$overtimeHours' }
        }
      },
      // Only join with ACTIVE workers — soft-deleted workers are excluded
      { $lookup: { from: 'workers', localField: '_id', foreignField: '_id', as: 'workerInfo' } },
      { $unwind: '$workerInfo' },
      { $match: { 'workerInfo.isActive': true } }   // ← exclude deactivated workers
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Excel Export for Attendance
router.get('/excel', auth, async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ message: 'Start and end dates required' });

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Get active workers
    const workers = await Worker.find({ isActive: true }).sort({ name: 1 });
    
    // Get attendance records
    const records = await Attendance.find({
      date: { $gte: startDate, $lte: endDate }
    });

    // Get stats for wages
    const stats = await Attendance.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      { $group: {
          _id: '$worker',
          totalWages: { $sum: '$wageEarned' }
        }
      }
    ]);
    const statsMap = {};
    stats.forEach(s => { statsMap[s._id.toString()] = s.totalWages; });

    // Build date list
    const dates = [];
    let curr = new Date(startDate);
    while (curr <= endDate) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const lookup = {};
    records.forEach(r => {
      const wid = r.worker.toString();
      const ds  = new Date(r.date).toDateString();
      if (!lookup[wid]) lookup[wid] = {};
      lookup[wid][ds] = r.status;
    });

    // Prepare data for Excel
    const excelData = workers.map(w => {
      const row = {
        'Worker Name': w.name,
        'Category': w.category,
        'Daily Wage': w.dailyWage
      };
      
      dates.forEach(d => {
        const ds = d.toDateString();
        const header = `${d.getDate()}/${d.getMonth() + 1}`;
        const status = lookup[w._id.toString()]?.[ds] || '-';
        row[header] = status === 'Present' ? 'P' : status === 'Half-Day' ? 'H' : status === 'Absent' ? 'A' : '-';
      });

      row['Total Wage (₹)'] = statsMap[w._id.toString()] || 0;
      return row;
    });

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(excelData);
    
    // Column widths
    const cols = [{ wch: 18 }, { wch: 12 }, { wch: 10 }];
    dates.forEach(() => cols.push({ wch: 6 }));
    cols.push({ wch: 15 });
    sheet['!cols'] = cols;

    XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `Attendance_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to generate Excel' });
  }
});

// === WORKER CRUD (/:id routes come LAST) ===

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
router.put('/worker/:id', auth, async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.json(worker);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Soft delete worker (isActive: false) — preserves data in DB
router.delete('/worker/:id', auth, async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.json({ message: 'Worker deactivated (data preserved in DB)', attendanceDeleted: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
