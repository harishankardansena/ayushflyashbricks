const Production = require('../models/Production');

async function syncStock() {
  const allRecords = await Production.find().sort({ date: 1, createdAt: 1 });
  let runningStock = 0;
  for (const record of allRecords) {
    record.previousStock = runningStock;
    // currentStock is auto-calculated in pre-save hook
    await record.save();
    runningStock = record.currentStock;
  }
}

module.exports = { syncStock };
