const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');

async function checkExactDates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const prodLogs = await Production.find().sort({ createdAt: -1 }).limit(10);
    console.log('--- Most Recent Production Logs ---');
    prodLogs.forEach(p => console.log(`  - ID: ${p._id}, Date (UTC String): ${p.date.toISOString()}, Date (Local String): ${p.date.toString()}, Produced: ${p.produced}, Sold: ${p.sold}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkExactDates();
