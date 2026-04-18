const mongoose = require('mongoose');

const productionSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  produced: { type: Number, required: true, min: 0 },
  sold: { type: Number, required: true, min: 0 },
  previousStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  notes: { type: String, default: '' }
}, { timestamps: true });

// Auto-calculate currentStock before saving
productionSchema.pre('save', function(next) {
  this.currentStock = this.previousStock + this.produced - this.sold;
  next();
});

module.exports = mongoose.model('Production', productionSchema);
