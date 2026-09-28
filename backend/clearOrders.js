require('dotenv').config();
const mongoose = require('mongoose');
const OrderRequest = require('./models/OrderRequest');

const clearOrders = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    
    const result = await OrderRequest.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} order requests.`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing order requests:', err.message);
    process.exit(1);
  }
};

clearOrders();
