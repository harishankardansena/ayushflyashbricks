const mongoose = require('mongoose');
require('dotenv').config();
const Billing = require('../models/Billing');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

async function splitToday() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const today = new Date('2026-05-13T00:00:00');
    today.setHours(0,0,0,0);
    const todayEnd = new Date('2026-05-13T23:59:59');
    todayEnd.setHours(23,59,59,999);

    // 1. Find the current combined record for today
    const combinedRecord = await Production.findOne({ 
      date: { $gte: today, $lte: todayEnd },
      notes: 'Auto-created during reconciliation' // This is the one from my recent script
    });

    if (!combinedRecord) {
      console.log('No combined record found for today.');
      process.exit(0);
    }

    // 2. Find all bills for today
    const bills = await Billing.find({ date: { $gte: today, $lte: todayEnd } }).sort({ createdAt: 1 });
    
    console.log(`Splitting today's log into ${bills.length} separate bill logs...`);

    // 3. Create separate records for each bill
    for (const b of bills) {
      const newProd = new Production({
        date: today,
        produced: 0,
        sold: b.bricks,
        notes: `Sold: Bill ${b.billNumber}`,
        createdAt: b.createdAt // Match the creation time for logical sorting
      });
      await newProd.save();
    }

    // 4. Update the original combined record to have sold: 0 (it might have produced bricks if any)
    combinedRecord.sold = 0;
    combinedRecord.notes = 'Production log (Sales split into separate entries)';
    await combinedRecord.save();

    await syncStock();
    console.log('Done splitting today logs.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

splitToday();
