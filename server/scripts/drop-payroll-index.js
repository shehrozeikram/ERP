require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Payroll = require('../models/hr/Payroll');

async function dropIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI_LOCAL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
    
    await Payroll.collection.dropIndex('employee_1_month_1_year_1');
    console.log('Successfully dropped old unique index');
    
    // Mongoose will automatically build the new index when model is loaded next time, 
    // or we can manually sync:
    await Payroll.syncIndexes();
    console.log('Successfully synced new indexes');
    
  } catch (err) {
    if (err.code === 27) {
      console.log('Index not found, may have already been dropped');
      await Payroll.syncIndexes();
      console.log('Successfully synced new indexes');
    } else {
      console.error('Error:', err);
    }
  } finally {
    process.exit(0);
  }
}

dropIndex();
