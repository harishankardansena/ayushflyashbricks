const Production = require('../models/Production');

async function syncStock() {
  const allRecords = await Production.find().sort({ date: 1, createdAt: 1 });
  let runningStock = 0;
  const bulkOps = [];
  
  for (const record of allRecords) {
    const prevStock = runningStock;
    const currStock = prevStock + (record.produced || 0) - (record.sold || 0) + (record.adjusted || 0);
    
    // Only update if something actually changed
    if (record.previousStock !== prevStock || record.currentStock !== currStock) {
      bulkOps.push({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { previousStock: prevStock, currentStock: currStock } }
        }
      });
    }
    runningStock = currStock;
  }
  
  if (bulkOps.length > 0) {
    await Production.collection.bulkWrite(bulkOps);
  }
}

module.exports = { syncStock };
