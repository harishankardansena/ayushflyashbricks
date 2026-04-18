const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  material: {
    type: String,
    required: true,
    enum: ['Fly Ash', 'Cement', 'Lime', 'Bed Material', 'Other']
  },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, default: 'kg' },
  minimumLevel: { type: Number, default: 100 },
  lastUpdated: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);
