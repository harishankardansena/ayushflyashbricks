const mongoose = require('mongoose');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');
require('dotenv').config();

async function applyHiddenAdjustment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fly-ash-bricks');
    console.log('Connected to MongoDB');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const adjustment = new Production({
      date: today,
      produced: 0,
      sold: 0,
      adjustment: 2176,
      notes: 'Initial hidden stock adjustment'
    });

    await adjustment.save();
    console.log('Hidden adjustment record saved.');

    await syncStock();
    console.log('Stock synchronized.');

    const lastRecord = await Production.findOne().sort({ date: -1, createdAt: -1 });
    console.log('Current Stock after adjustment:', lastRecord.currentStock);

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

applyHiddenAdjustment();
