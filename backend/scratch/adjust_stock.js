const mongoose = require('mongoose');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');
require('dotenv').config();

async function adjustStock() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fly-ash-bricks');
    console.log('Connected to MongoDB');

    const lastRecord = await Production.findOne().sort({ date: -1, createdAt: -1 });
    const currentStock = lastRecord ? lastRecord.currentStock : 0;
    console.log('Current Stock:', currentStock);

    const adjustment = new Production({
      date: new Date(),
      produced: 0,
      sold: 2167,
      previousStock: currentStock,
      notes: 'Manual stock adjustment: -2167 bricks'
    });

    await adjustment.save();
    console.log('Adjustment record saved.');

    await syncStock();
    console.log('Stock synchronized.');

    const newLastRecord = await Production.findOne().sort({ date: -1, createdAt: -1 });
    console.log('New Current Stock:', newLastRecord.currentStock);

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

adjustStock();
