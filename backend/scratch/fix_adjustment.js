const mongoose = require('mongoose');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');
require('dotenv').config();

async function fixAdjustment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fly-ash-bricks');
    console.log('Connected to MongoDB');

    // Find the record I just created
    const record = await Production.findOne({ notes: 'Manual stock adjustment: -2167 bricks' });
    if (record) {
      console.log('Found record. Updating sold amount from 2167 to 2176...');
      record.sold = 2176;
      record.notes = 'Manual stock adjustment: -2176 bricks';
      await record.save();
      console.log('Record updated.');
    } else {
      console.log('Record not found.');
    }

    await syncStock();
    console.log('Stock synchronized.');

    const lastRecord = await Production.findOne().sort({ date: -1, createdAt: -1 });
    console.log('Final Current Stock:', lastRecord.currentStock);

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixAdjustment();
