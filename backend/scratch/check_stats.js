const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');

async function checkStats() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const startOfMonth = new Date(2026, 4, 1); // May 1
    const endOfToday = new Date(2026, 4, 31, 23, 59, 59);

    const monthStats = await Production.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfToday } } },
      { $group: {
        _id: null,
        totalProduced: { $sum: '$produced' },
        totalSold: { $sum: '$sold' }
      }}
    ]);

    const latestRecord = await Production.findOne().sort({ date: -1, createdAt: -1 });
    const firstRecordOfMonth = await Production.findOne({ date: { $gte: startOfMonth } }).sort({ date: 1, createdAt: 1 });

    console.log('--- Stats Check ---');
    console.log(`Month Stats:`, monthStats[0]);
    console.log(`Latest Current Stock: ${latestRecord.currentStock}`);
    console.log(`First Record of Month Previous Stock: ${firstRecordOfMonth.previousStock}`);
    
    const calculatedCurrent = (firstRecordOfMonth.previousStock || 0) + (monthStats[0]?.totalProduced || 0) - (monthStats[0]?.totalSold || 0);
    console.log(`Calculated Current Stock (Start + Prod - Sold): ${calculatedCurrent}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStats();
