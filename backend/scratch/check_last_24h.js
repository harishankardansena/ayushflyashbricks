const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');
const Billing = require('../models/Billing');
const Expense = require('../models/Expense');

async function checkLast48h() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    
    console.log(`--- DB Query for Last 48 Hours (Since ${fortyEightHoursAgo.toISOString()}) ---`);
    
    const prodLogs = await Production.find({
      createdAt: { $gte: fortyEightHoursAgo }
    }).sort({ createdAt: -1 });
    console.log(`Production Logs: ${prodLogs.length}`);
    prodLogs.forEach(p => console.log(`  - ID: ${p._id}, Date: ${p.date.toISOString()}, Produced: ${p.produced}, Sold: ${p.sold}, Notes: ${p.notes}, CreatedAt: ${p.createdAt.toISOString()}`));

    const bills = await Billing.find({
      createdAt: { $gte: fortyEightHoursAgo }
    }).sort({ createdAt: -1 });
    console.log(`Billing Logs: ${bills.length}`);
    bills.forEach(b => console.log(`  - ID: ${b._id}, Date: ${b.date.toISOString()}, BillNo: ${b.billNumber}, Bricks: ${b.bricks}, FinalAmount: ${b.finalAmount}, CreatedAt: ${b.createdAt.toISOString()}`));

    const expenses = await Expense.find({
      createdAt: { $gte: fortyEightHoursAgo }
    }).sort({ createdAt: -1 });
    console.log(`Expense Logs: ${expenses.length}`);
    expenses.forEach(e => console.log(`  - ID: ${e._id}, Date: ${e.date.toISOString()}, Cat: ${e.category}, Amount: ${e.amount}, CreatedAt: ${e.createdAt.toISOString()}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkLast48h();
