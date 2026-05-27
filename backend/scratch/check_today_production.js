const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');

async function checkToday() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const logs = await Production.find({
      date: { $gte: today, $lte: todayEnd }
    });
    
    console.log(`Found ${logs.length} production logs for today (${today.toISOString().split('T')[0]})`);
    logs.forEach(l => {
      console.log(`Log: Produced=${l.produced}, Sold=${l.sold}, CreatedAt=${l.createdAt.toISOString()}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkToday();
