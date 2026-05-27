const mongoose = require('mongoose');
require('dotenv').config();
const Billing = require('../models/Billing');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');

async function reconcileAll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- Full Inventory Reconciliation ---');

    const productions = await Production.find().sort({ date: 1 });
    
    for (const prod of productions) {
      const start = new Date(prod.date);
      start.setHours(0,0,0,0);
      const end = new Date(prod.date);
      end.setHours(23,59,59,999);

      const bills = await Billing.find({ date: { $gte: start, $lte: end } });
      const billTotal = bills.reduce((sum, b) => sum + b.bricks, 0);

      if (prod.sold !== billTotal) {
        console.log(`Mismatch on ${prod.date.toISOString().split('T')[0]}: Production.sold=${prod.sold}, Bills total=${billTotal}`);
        console.log(`Updating ${prod.date.toISOString().split('T')[0]} to ${billTotal}...`);
        prod.sold = billTotal;
        await prod.save();
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
