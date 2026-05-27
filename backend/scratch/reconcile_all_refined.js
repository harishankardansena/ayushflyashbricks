const mongoose = require('mongoose');
require('dotenv').config();
const Billing = require('../models/Billing');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

async function reconcileAll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- Refined Full Inventory Reconciliation ---');

    // 1. Reset all sold counts to 0 first to avoid double counting across multiple logs of same day
    await Production.updateMany({}, { $set: { sold: 0 } });
    console.log('Reset all production sold counts to 0.');

    // 2. Get all bills and group them by date string (YYYY-MM-DD)
    const bills = await Billing.find();
    const billGroups = {};
    bills.forEach(b => {
      const dateStr = new Date(b.date).toISOString().split('T')[0];
      billGroups[dateStr] = (billGroups[dateStr] || 0) + b.bricks;
    });

    // 3. Apply totals to the first production record found for each date
    for (const [dateStr, totalBricks] of Object.entries(billGroups)) {
      const start = new Date(dateStr);
      start.setHours(0,0,0,0);
      const end = new Date(dateStr);
      end.setHours(23,59,59,999);

      const prodRecord = await Production.findOne({ date: { $gte: start, $lte: end } }).sort({ createdAt: 1 });
      if (prodRecord) {
        console.log(`Setting ${dateStr} sold count to ${totalBricks}`);
        prodRecord.sold = totalBricks;
        await prodRecord.save();
      } else {
        console.log(`No production record found for ${dateStr}. Creating one...`);
        const newProd = new Production({
          date: start,
          produced: 0,
          sold: totalBricks,
          notes: 'Auto-created during reconciliation'
        });
        await newProd.save();
      }
    }

    console.log('Syncing stock...');
    await syncStock();
    console.log('Reconciliation Complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

reconcileAll();
