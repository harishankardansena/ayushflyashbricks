const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

async function finalFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');

    // 1. Fix May 12 (subtract 4000 discrepancy)
    const may12Log = await Production.findById('6a02fff377b0e39376c00f2c');
    if (may12Log) {
      console.log(`Old May 12 Sold: ${may12Log.sold}`);
      may12Log.sold = Math.max(0, may12Log.sold - 4000);
      await may12Log.save();
      console.log(`New May 12 Sold: ${may12Log.sold}`);
    }

    // 2. Fix today (May 13) - Ensure it has the full 6000 sold from today's bills
    // Note: I already set it to 6000 in previous step, but let's be sure.
    // Today's log ID was 6a047801ccc4a8391898bb47 (from previous checkToday output)
    const todayLog = await Production.findById('6a047801ccc4a8391898bb47');
    if (todayLog) {
      console.log(`Today Sold: ${todayLog.sold}`);
      // If it's already 6000, leave it. If not, set it.
      todayLog.sold = 6000; 
      await todayLog.save();
    }

    await syncStock();
    console.log('Final sync complete.');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

finalFix();
