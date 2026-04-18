const mongoose = require('mongoose');

const inventoryUsageSchema = new mongoose.Schema({
  inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  material: { type: String, required: true },
  usedQuantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  purpose: { type: String, required: true }, // e.g. "Production - 5000 bricks"
  date: { type: Date, required: true, default: Date.now },
  remainingAfter: { type: Number, default: 0 },  // stock remaining after this usage
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('InventoryUsage', inventoryUsageSchema);
