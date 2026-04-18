const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Production = require('../models/Production');
const Inventory = require('../models/Inventory');
const Expense = require('../models/Expense');
const Billing = require('../models/Billing');

// GET /api/dashboard - Summary stats
router.get('/', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Today's production
    const todayProduction = await Production.findOne({ date: { $gte: today, $lte: todayEnd } });

    // Latest stock (most recent production entry)
    const latestProduction = await Production.findOne().sort({ date: -1 });

    // Monthly production totals
    const monthlyProduction = await Production.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, totalProduced: { $sum: '$produced' }, totalSold: { $sum: '$sold' } } }
    ]);

    // Monthly expenses
    const monthlyExpenses = await Expense.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Today's expenses
    const todayExpenses = await Expense.aggregate([
      { $match: { date: { $gte: today, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Today's bricks sold and revenue (from billing)
    const todayBilling = await Billing.aggregate([
      { $match: { date: { $gte: today, $lte: todayEnd } } },
      { $group: { _id: null, totalBricks: { $sum: '$bricks' }, totalRevenue: { $sum: '$finalAmount' } } }
    ]);

    // Monthly revenue (from billing)
    const monthlyRevenue = await Billing.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    // Low stock alerts
    const inventory = await Inventory.find();
    const lowStockAlerts = inventory.filter(item => item.quantity <= item.minimumLevel);

    // Production chart data (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);
      d.setHours(0, 0, 0, 0);
      const prod = await Production.findOne({ date: { $gte: d, $lte: dEnd } });
      last7Days.push({
        date: d.toISOString().split('T')[0],
        produced: prod ? prod.produced : 0,
        sold: prod ? prod.sold : 0
      });
    }

    // Expense breakdown by category (this month)
    const expenseBreakdown = await Expense.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } }
    ]);

    const mp = monthlyProduction[0] || { totalProduced: 0, totalSold: 0 };
    const me = monthlyExpenses[0] || { total: 0 };
    const mr = monthlyRevenue[0] || { total: 0 };
    const tb = todayBilling[0] || { totalBricks: 0, totalRevenue: 0 };
    const te = todayExpenses[0] || { total: 0 };

    res.json({
      today: {
        produced: todayProduction ? todayProduction.produced : 0,
        sold: tb.totalBricks,
        expenses: te.total,
        revenue: tb.totalRevenue
      },
      currentStock: latestProduction ? latestProduction.currentStock : 0,
      monthly: {
        produced: mp.totalProduced,
        sold: mp.totalSold,
        expenses: me.total,
        revenue: mr.total,
        profit: mr.total - me.total
      },
      lowStockAlerts,
      chartData: last7Days,
      expenseBreakdown
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
