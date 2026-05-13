const mongoose = require('mongoose');

const inventoryRestockSchema = new mongoose.Schema({
  inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', required: true },
  material: { type: String, required: true },
  quantityAdded: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('InventoryRestock', inventoryRestockSchema);
