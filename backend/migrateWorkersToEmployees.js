require('dotenv').config();
const mongoose = require('mongoose');
const Worker = require('./models/Worker');
const Employee = require('./models/Employee');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const workers = await Worker.find();
    console.log(`Found ${workers.length} workers.`);

    for (const worker of workers) {
      // Check if employee already exists by name
      const existing = await Employee.findOne({ name: worker.name });
      if (!existing) {
        // Generate a simple ID
        const empId = 'EMP-' + Math.floor(1000 + Math.random() * 9000);
        
        const emp = new Employee({
          name: worker.name,
          employeeId: empId,
          jobTitle: worker.category || 'Worker',
          department: 'Operations',
          phone: worker.phone,
          address: worker.address,
          doj: worker.joiningDate,
          salary: worker.dailyWage * 30, // Rough estimate of monthly salary
          employmentType: 'Full-time',
          status: worker.isActive ? 'Active' : 'Terminated'
        });
        await emp.save();
        console.log(`Migrated: ${emp.name}`);
      } else {
        console.log(`Skipped existing: ${worker.name}`);
      }
    }
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error migrating data:', error);
    process.exit(1);
  }
}

migrate();
