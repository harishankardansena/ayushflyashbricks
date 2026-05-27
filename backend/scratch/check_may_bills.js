const mongoose = require('mongoose');
require('dotenv').config();
const Billing = require('../models/Billing');

async function checkMayBills() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const start = new Date(2026, 4, 1);
    const end = new Date(2026, 4, 31, 23, 59, 59);

    const bills = await Billing.find({ date: { $gte: start, $lte: end } });
    const totalBricks = bills.reduce((sum, b) => sum + b.bricks, 0);
    console.log(`Total bricks in May bills: ${totalBricks}`);
    console.log(`Number of bills in May: ${bills.length}`);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMayBills();
