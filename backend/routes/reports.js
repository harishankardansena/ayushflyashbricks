const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const XLSX = require('xlsx');
const Production = require('../models/Production');
const Inventory = require('../models/Inventory');
const Expense = require('../models/Expense');
const Billing = require('../models/Billing');
const Worker = require('../models/Worker');
const Attendance = require('../models/Attendance');

// GET /api/reports/excel?month=4&year=2026
router.get('/excel', auth, async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ message: 'Month and year required' });

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const monthName = start.toLocaleString('default', { month: 'long' });

    const workbook = XLSX.utils.book_new();

    // === Sheet 1: Production ===
    const productions = await Production.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 });
    const prodData = productions.map(p => ({
      'Date': new Date(p.date).toLocaleDateString('en-IN'),
      'Previous Stock': p.previousStock,
      'Produced': p.produced,
      'Sold': p.sold,
      'Current Stock': p.currentStock,
      'Notes': p.notes || ''
    }));
    if (prodData.length === 0) prodData.push({ 'Date': 'No records' });
    const prodSheet = XLSX.utils.json_to_sheet(prodData);
    prodSheet['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, prodSheet, 'Production');

    // === Sheet 2: Inventory ===
    const inventory = await Inventory.find().sort({ material: 1 });
    const invData = inventory.map(i => ({
      'Material': i.material,
      'Quantity': i.quantity,
      'Unit': i.unit,
      'Minimum Level': i.minimumLevel,
      'Status': i.quantity <= i.minimumLevel ? '⚠️ Low Stock' : '✅ OK',
      'Last Updated': new Date(i.lastUpdated).toLocaleDateString('en-IN'),
      'Notes': i.notes || ''
    }));
    if (invData.length === 0) invData.push({ 'Material': 'No records' });
    const invSheet = XLSX.utils.json_to_sheet(invData);
    invSheet['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, invSheet, 'Inventory');

    // === Sheet 3: Attendance ===
    const workers = await Worker.find({ isActive: true }).sort({ name: 1 });
    const attRecords = await Attendance.find({ date: { $gte: start, $lte: end } });
    const attStats = await Attendance.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $group: { _id: '$worker', totalWages: { $sum: '$wageEarned' } } }
    ]);
    const attStatsMap = {};
    attStats.forEach(s => { attStatsMap[s._id.toString()] = s.totalWages; });

    const lookup = {};
    attRecords.forEach(r => {
      const wid = r.worker.toString();
      const ds = new Date(r.date).toDateString();
      if (!lookup[wid]) lookup[wid] = {};
      lookup[wid][ds] = r.status;
    });

    const dates = [];
    let curr = new Date(start);
    while (curr <= end) { dates.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }

    const attExcelData = workers.map(w => {
      const row = { 'Worker Name': w.name, 'Category': w.category, 'Daily Wage': w.dailyWage };
      dates.forEach(d => {
        const header = `${d.getDate()}/${d.getMonth() + 1}`;
        const status = lookup[w._id.toString()]?.[d.toDateString()] || '-';
        row[header] = status === 'Present' ? 'P' : status === 'Half-Day' ? 'H' : status === 'Absent' ? 'A' : '-';
      });
      row['Total Wage (₹)'] = attStatsMap[w._id.toString()] || 0;
      return row;
    });
    const totalWageExp = attStats.reduce((sum, s) => sum + s.totalWages, 0);
    if (attExcelData.length === 0) attExcelData.push({ 'Worker Name': 'No records' });
    const attSheet = XLSX.utils.json_to_sheet(attExcelData);
    attSheet['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, ...dates.map(() => ({ wch: 6 })), { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, attSheet, 'Attendance');

    // === Sheet 4: Expenses ===
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 });
    const expData = expenses.map(e => ({
      'Date': new Date(e.date).toLocaleDateString('en-IN'),
      'Category': e.category,
      'Description': e.description,
      'Amount (₹)': e.amount,
      'Payment Mode': e.paymentMode
    }));
    const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
    if (expData.length === 0) expData.push({ 'Date': 'No records' });
    expData.push({ 'Date': '', 'Category': '', 'Description': 'TOTAL', 'Amount (₹)': totalExp, 'Payment Mode': '' });
    const expSheet = XLSX.utils.json_to_sheet(expData);
    expSheet['!cols'] = [{ wch: 14 }, { wch: 15 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, expSheet, 'Expenses');

    // === Sheet 5: Inventory Usage ===
    const InventoryUsage = require('../models/InventoryUsage');
    const usages = await InventoryUsage.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 });
    const usageData = usages.map(u => ({
      'Date': new Date(u.date).toLocaleDateString('en-IN'),
      'Material': u.material,
      'Used Quantity': u.usedQuantity,
      'Unit': u.unit,
      'Purpose': u.purpose,
      'Remaining After': u.remainingAfter,
      'Notes': u.notes || ''
    }));
    if (usageData.length === 0) usageData.push({ 'Date': 'No records' });
    const usageSheet = XLSX.utils.json_to_sheet(usageData);
    usageSheet['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, usageSheet, 'Inventory Usage');

    // === Sheet 6: Billing / Sales ===
    const bills = await Billing.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 });
    const billData = bills.map(b => ({
      'Bill No': b.billNumber,
      'Date': new Date(b.date).toLocaleDateString('en-IN'),
      'Customer Name': b.customer.name,
      'Phone': b.customer.phone,
      'Address': b.customer.address,
      'Bricks': b.bricks,
      'Rate/Brick (₹)': b.ratePerBrick,
      'Worker Charge (₹)': b.workerCharge || 0,
      'Transport Charge (₹)': b.transportCharge || 0,
      'GST Enabled': b.gstEnabled ? 'Yes' : 'No',
      'CGST (%)': b.cgstRate || 0,
      'SGST (%)': b.sgstRate || 0,
      'Taxable Amount (₹)': (b.bricks * b.ratePerBrick) + (b.workerCharge || 0) + (b.transportCharge || 0) - (b.discount || 0),
      'Discount (₹)': b.discount || 0,
      'Final Amount (₹)': b.finalAmount,
      'Payment Status': b.paymentStatus,
      'Notes': b.notes || ''
    }));
    const totalRev = bills.reduce((sum, b) => sum + (b.finalAmount || 0), 0);
    if (billData.length === 0) billData.push({ 'Bill No': 'No records' });
    billData.push({ 'Bill No': '', 'Date': '', 'Customer Name': '', 'Phone': '', 'Address': '', 'Bricks': '', 'Rate/Brick (₹)': '', 'Total (₹)': '', 'Discount (₹)': '', 'Final Amount (₹)': totalRev, 'Payment Status': 'TOTAL', 'Notes': '' });
    const billSheet = XLSX.utils.json_to_sheet(billData);
    billSheet['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, billSheet, 'Billing');

    // === Sheet 7: Summary ===
    const totalProd = productions.reduce((sum, p) => sum + p.produced, 0);
    const totalSold = productions.reduce((sum, p) => sum + p.sold, 0);
    const mainExpenses = totalExp;
    const summaryData = [
      { 'Metric': 'Month', 'Value': `${monthName} ${year}` },
      { 'Metric': 'Total Bricks Produced', 'Value': totalProd },
      { 'Metric': 'Total Bricks Sold', 'Value': totalSold },
      { 'Metric': 'Current Brick Stock', 'Value': productions.length > 0 ? productions[productions.length - 1].currentStock : 0 },
      { 'Metric': 'Total Revenue (₹)', 'Value': totalRev },
      { 'Metric': 'Total Expenses (₹)', 'Value': mainExpenses },
      { 'Metric': 'NET PROFIT (₹)', 'Value': totalRev - mainExpenses },
      { 'Metric': 'Total Bills Raised', 'Value': bills.length },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Monthly Summary');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', `attachment; filename="FlyAshBricks_FullReport_${monthName}_${year}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to generate report' });
  }
});

module.exports = router;

