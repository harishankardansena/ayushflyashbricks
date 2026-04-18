const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Inventory = require('../models/Inventory');
const InventoryUsage = require('../models/InventoryUsage');

// GET /api/inventory
router.get('/', auth, async (req, res) => {
  try {
    const items = await Inventory.find().sort({ material: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory - Add material
router.post('/', auth, async (req, res) => {
  try {
    const { material, quantity, unit, minimumLevel, notes } = req.body;
    const existing = await Inventory.findOne({ material });
    if (existing) {
      return res.status(400).json({ message: 'Material already exists. Update the existing entry.' });
    }
    const item = new Inventory({ material, quantity, unit, minimumLevel, notes });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/inventory/:id - Update (restock)
router.put('/:id', auth, async (req, res) => {
  try {
    const { quantity, unit, minimumLevel, notes } = req.body;
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      { quantity, unit, minimumLevel, notes, lastUpdated: new Date() },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await Inventory.findByIdAndDelete(req.params.id);
    await InventoryUsage.deleteMany({ inventory: req.params.id });
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ============================================================
// USAGE ROUTES
// ============================================================

// GET /api/inventory/usage - All usage logs with filter
router.get('/usage', auth, async (req, res) => {
  try {
    const { inventoryId, month, year, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (inventoryId) filter.inventory = inventoryId;
    if (month && year) {
      filter.date = {
        $gte: new Date(year, month - 1, 1),
        $lte: new Date(year, month, 0, 23, 59, 59, 999)
      };
    }

    const total = await InventoryUsage.countDocuments(filter);
    const records = await InventoryUsage.find(filter)
      .populate('inventory', 'material unit quantity minimumLevel')
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Total used per material this period
    const totalByMaterial = await InventoryUsage.aggregate([
      { $match: filter },
      { $group: { _id: '$material', totalUsed: { $sum: '$usedQuantity' } } }
    ]);

    res.json({ records, total, totalByMaterial, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory/usage - Log usage & deduct from stock
router.post('/usage', auth, async (req, res) => {
  try {
    const { inventoryId, usedQuantity, purpose, date, notes } = req.body;

    if (!inventoryId || !usedQuantity || !purpose) {
      return res.status(400).json({ message: 'Inventory item, quantity, and purpose are required' });
    }

    const item = await Inventory.findById(inventoryId);
    if (!item) return res.status(404).json({ message: 'Inventory item not found' });

    if (usedQuantity > item.quantity) {
      return res.status(400).json({
        message: `Insufficient stock! Available: ${item.quantity} ${item.unit}, Requested: ${usedQuantity} ${item.unit}`
      });
    }

    // Deduct from stock
    item.quantity = item.quantity - usedQuantity;
    item.lastUpdated = new Date();
    await item.save();

    // Save usage record
    const usage = new InventoryUsage({
      inventory: inventoryId,
      material: item.material,
      usedQuantity,
      unit: item.unit,
      purpose,
      date: date || new Date(),
      remainingAfter: item.quantity,
      notes
    });
    await usage.save();

    res.status(201).json({
      usage,
      updatedInventory: item,
      message: `✅ ${usedQuantity} ${item.unit} of ${item.material} used. Remaining: ${item.quantity} ${item.unit}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/inventory/usage/:id - Undo usage (restore stock)
router.delete('/usage/:id', auth, async (req, res) => {
  try {
    const usage = await InventoryUsage.findById(req.params.id);
    if (!usage) return res.status(404).json({ message: 'Usage record not found' });

    // Restore stock
    const item = await Inventory.findById(usage.inventory);
    if (item) {
      item.quantity += usage.usedQuantity;
      item.lastUpdated = new Date();
      await item.save();
    }

    await InventoryUsage.findByIdAndDelete(req.params.id);
    res.json({ message: 'Usage record deleted and stock restored' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/inventory/deduct - Deduct based on production (auto)
router.post('/deduct', auth, async (req, res) => {
  try {
    const { bricksProduced } = req.body;
    const results = [];
    const flyAsh = await Inventory.findOne({ material: 'Fly Ash' });
    const cement = await Inventory.findOne({ material: 'Cement' });
    const bedMaterial = await Inventory.findOne({ material: 'Bed Material' });

    const deductions = [
      { item: flyAsh, qty: bricksProduced * 0.6 },
      { item: cement, qty: bricksProduced * 0.05 },
      { item: bedMaterial, qty: bricksProduced * 0.1 },
    ];

    for (const { item, qty } of deductions) {
      if (item) {
        item.quantity = Math.max(0, item.quantity - qty);
        item.lastUpdated = new Date();
        await item.save();
        results.push({ material: item.material, deducted: qty, remaining: item.quantity });
      }
    }
    res.json({ message: 'Inventory deducted', results });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
