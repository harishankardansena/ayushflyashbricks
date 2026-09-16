const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Production = require('./models/Production');
const Billing = require('./models/Billing');
const Expense = require('./models/Expense');
const Attendance = require('./models/Attendance');

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Create indexes on 'date' for faster aggregations
    await Production.collection.createIndex({ date: -1 });
    await Billing.collection.createIndex({ date: -1, status: 1 });
    await Expense.collection.createIndex({ date: -1 });
    await Attendance.collection.createIndex({ date: -1 });

    console.log('Indexes created successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

createIndexes();
