const mongoose = require('mongoose');
require('dotenv').config();
const Billing = require('../models/Billing');
const Production = require('../models/Production');

async function syncSold() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');

    const today = new Date('2026-05-13T00:00:00');
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date('2026-05-13T23:59:59');
    todayEnd.setHours(23, 59, 59, 999);

    const bills = await Billing.find({
      date: { $gte: today, $lte: todayEnd }
    });
    
    const totalBricksSold = bills.reduce((sum, b) => sum + b.bricks, 0);
    console.log(`Total bricks in bills for today: ${totalBricksSold}`);
    bills.forEach(b => console.log(`Bill ${b.billNumber}: ${b.bricks} bricks`));

    const prodRecords = await Production.find({
      date: { $gte: today, $lte: todayEnd }
    });

    console.log(`Found ${prodRecords.length} production records for today`);
    prodRecords.forEach(r => {
      console.log(`Record ID: ${r._id}, Sold: ${r.sold}, Notes: ${r.notes}`);
    });

    if (prodRecords.length > 0 && totalBricksSold > 0) {
      // If the sum of 'sold' in records is less than totalBricksSold, we fix it
      const currentSumSold = prodRecords.reduce((sum, r) => sum + r.sold, 0);
      if (currentSumSold < totalBricksSold) {
        console.log(`Fixing: Adding ${totalBricksSold - currentSumSold} bricks to the first record`);
        prodRecords[0].sold += (totalBricksSold - currentSumSold);
        await prodRecords[0].save();
        console.log('Fixed.');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

syncSold();
