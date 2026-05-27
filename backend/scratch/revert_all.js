const mongoose = require('mongoose');
const Production = require('../models/Production');
const { syncStock } = require('../utils/stockUtils');
require('dotenv').config();

async function revertAll() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fly-ash-bricks');
    console.log('Connected to MongoDB');

    // Delete any adjustment records created by me
    const result = await Production.deleteMany({ notes: /Manual stock adjustment/ });
    console.log(`Deleted ${result.deletedCount} adjustment records.`);

    await syncStock();
    console.log('Stock synchronized.');

    const lastRecord = await Production.findOne().sort({ date: -1, createdAt: -1 });
    console.log('Final Current Stock (Reverted):', lastRecord?.currentStock);

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

revertAll();
