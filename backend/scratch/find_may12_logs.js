const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');

async function findDiscrepancy() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const logs = await Production.find({
      date: { $gte: new Date('2026-05-12T00:00:00'), $lte: new Date('2026-05-12T23:59:59') }
    });
    
    console.log(`Found ${logs.length} logs for May 12`);
    logs.forEach(l => {
      console.log(`Log ID: ${l._id}, Sold: ${l.sold}, Notes: ${l.notes}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

findDiscrepancy();
