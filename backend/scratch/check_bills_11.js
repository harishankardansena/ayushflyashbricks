const mongoose = require('mongoose');
require('dotenv').config();
const Billing = require('../models/Billing');

async function checkBills11() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const start = new Date('2026-05-11T00:00:00');
    start.setHours(0,0,0,0);
    const end = new Date('2026-05-11T23:59:59');
    end.setHours(23,59,59,999);

    const bills = await Billing.find({ date: { $gte: start, $lte: end } });
    console.log(`Found ${bills.length} bills for May 11`);
    bills.forEach(b => console.log(`Bill ${b.billNumber}: ${b.bricks} bricks`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkBills11();
