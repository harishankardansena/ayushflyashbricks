const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');

async function checkDetailed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const logs = await Production.find().sort({ createdAt: -1 }).limit(5);
    
    logs.forEach(l => {
      console.log(`ID: ${l._id}, Date: ${l.date.toISOString()}, Produced: ${l.produced}, Sold: ${l.sold}, CreatedAt: ${l.createdAt.toISOString()}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDetailed();
