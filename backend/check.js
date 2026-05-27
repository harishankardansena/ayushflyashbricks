const mongoose = require('mongoose');
require('dotenv').config({path: '.env'});
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Attendance = require('./models/Attendance');
  const Employee = require('./models/Employee');
  
  const total = await Attendance.countDocuments();
  console.log('Total Attendance records:', total);

  // Fetch a sample record
  const sample = await Attendance.findOne().populate('worker', 'name salary jobTitle');
  console.log('Sample populated worker:', sample ? sample.worker : 'No sample');

  const start = new Date();
  start.setDate(start.getDate() - 30);
  const end = new Date();
  end.setDate(end.getDate() + 1);

  const stats = await Attendance.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    { $group: {
        _id: '$worker',
        totalWages: { $sum: '$wageEarned' }
      }
    },
    { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'workerInfo' } },
    { $unwind: { path: '$workerInfo', preserveNullAndEmptyArrays: true } }
  ]);
  console.log('Stats length:', stats.length);
  if(stats.length > 0) {
    console.log('First stat workerInfo:', stats[0].workerInfo);
  }

  process.exit(0);
});
