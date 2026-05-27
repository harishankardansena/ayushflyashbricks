const mongoose = require('mongoose');
require('dotenv').config();
const Billing = require('../models/Billing');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

async function splitToday() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // 1. Target the specific record found
    const combinedRecord = await Production.findById('6a047801ccc4a8391898bb47');

    if (!combinedRecord) {
      console.log('Combined record not found.');
      process.exit(0);
    }

    // 2. Find all bills for May 13
    const start = new Date('2026-05-13T00:00:00');
    start.setHours(0,0,0,0);
    const end = new Date('2026-05-13T23:59:59');
    end.setHours(23,59,59,999);

    const bills = await Billing.find({ date: { $gte: start, $lte: end } }).sort({ createdAt: 1 });
    
    console.log(`Splitting today's log (${combinedRecord.sold} bricks) into ${bills.length} separate bill logs...`);

    // 3. Create separate records for each bill
    for (const b of bills) {
      const newProd = new Production({
        date: combinedRecord.date,
        produced: 0,
        sold: b.bricks,
        notes: `Sold: Bill ${b.billNumber}`,
        createdAt: b.createdAt
      });
      await newProd.save();
      console.log(`Created log for Bill ${b.billNumber}: ${b.bricks} bricks`);
    }

    // 4. Update the original combined record to have sold: 0
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
