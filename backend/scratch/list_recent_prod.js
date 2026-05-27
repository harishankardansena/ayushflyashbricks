const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');

async function listToday() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const logs = await Production.find().sort({ createdAt: -1 }).limit(10);
    logs.forEach(l => {
      console.log(`ID: ${l._id}, Date: ${l.date.toISOString()}, Sold: ${l.sold}, Notes: ${l.notes}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listToday();
