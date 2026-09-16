require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('./models/Employee');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const employees = await Employee.find({});
  for (let emp of employees) {
    // We update everyone who doesn't have a password yet or if we just want to enforce this rule
    if (!emp.password || !emp.password.startsWith('$2a$')) { // rudimentary check if hashed
      const namePart = (emp.name || 'Emp').substring(0, 4).replace(/\s/g, ''); // in case of spaces
      const phoneStr = emp.phone || '0000';
      const phonePart = phoneStr.length >= 4 ? phoneStr.slice(-4) : '0000';
      const rawPassword = `${namePart}@${phonePart}`;
      emp.password = await bcrypt.hash(rawPassword, 10);
      await emp.save();
      console.log(`Updated password for ${emp.name} to ${rawPassword}`);
    }
  }
  console.log('Done migrating passwords');
  process.exit(0);
}

migrate();
