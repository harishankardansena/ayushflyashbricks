const mongoose = require('mongoose');
require('dotenv').config();
const Production = require('../models/Production');

async function checkAggregation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const filter = {};
    const page = 1;
    const limit = 15;

    const grouped = await Production.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: "$date",
        totalProduced: { $sum: "$produced" },
        totalSold: { $sum: "$sold" },
        logs: { $push: "$$ROOT" }
      }},
      { $sort: { _id: -1 } },
      { $skip: (page - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    console.log(`Found ${grouped.length} days`);
    grouped.forEach(day => {
      console.log(`Date: ${day._id.toISOString()}, Produced: ${day.totalProduced}, Logs: ${day.logs.length}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAggregation();
