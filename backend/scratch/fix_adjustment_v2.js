const mongoose = require('mongoose');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');
require('dotenv').config();

async function fixAdjustmentV2() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fly-ash-bricks');
    console.log('Connected to MongoDB');

    // Find the record I created/updated earlier
    const record = await Production.findOne({ notes: /Manual stock adjustment/ });
    if (record) {
      console.log('Found record. Updating to produced: -2176, sold: 0 to maintain sold count...');
      record.produced = -2176;
      record.sold = 0;
      record.notes = 'Manual stock adjustment (Stock removal): -2176 bricks';
      await record.save();
      console.log('Record updated.');
    } else {
      console.log('Record not found.');
    }

    await syncStock();
    console.log('Stock synchronized.');

    const lastRecord = await Production.findOne().sort({ date: -1, createdAt: -1 });
    console.log('Final Current Stock:', lastRecord.currentStock);

    // Let's also check the monthly sold sum for verification
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const monthlyStats = await Production.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, totalSold: { $sum: '$sold' } } }
    ]);
    
    console.log('Monthly Sold Total:', monthlyStats[0]?.totalSold || 0);

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixAdjustmentV2();
