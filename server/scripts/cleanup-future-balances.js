const mongoose = require('mongoose');
const LeaveBalance = require('../models/hr/LeaveBalance');
require('dotenv').config();
const { connectDB } = require('../config/database');

async function cleanup() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('🔄 Starting cleanup of future leave balances (workYear >= 50 or year >= 2050)...');
    
    const result = await LeaveBalance.deleteMany({
      $or: [
        { year: { $gte: 2050 } },
        { workYear: { $gte: 50 } }
      ]
    });
    
    console.log(`✅ Cleanup completed. Deleted ${result.deletedCount} anomalous leave balance documents.`);
  } catch (error) {
    console.error('❌ Error cleaning up leave balances:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

cleanup();
