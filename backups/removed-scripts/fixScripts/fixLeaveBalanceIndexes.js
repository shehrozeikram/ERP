const mongoose = require('mongoose');
require('dotenv').config();

async function fixLeaveBalanceIndexes() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('leavebalances');

    console.log('\n🔍 Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Existing indexes:', JSON.stringify(indexes, null, 2));

    // Drop old duplicate indexes
    console.log('\n🗑️  Dropping old indexes...');
    try {
      await collection.dropIndex('employeeId_1_year_1');
      console.log('✅ Dropped employeeId_1_year_1');
    } catch (err) {
      console.log('⚠️  Could not drop employeeId_1_year_1 (may not exist)');
    }

    try {
      await collection.dropIndex('employee_1_year_1');
      console.log('✅ Dropped employee_1_year_1');
    } catch (err) {
      console.log('⚠️  Could not drop employee_1_year_1 (may not exist)');
    }

    // Create new indexes
    console.log('\n📝 Creating new indexes...');
    await collection.createIndex({ employee: 1, workYear: 1 }, { unique: true });
    console.log('✅ Created employee_1_workYear_1');
    
    await collection.createIndex({ employee: 1, year: 1 }, { unique: true });
    console.log('✅ Created employee_1_year_1');
    
    await collection.createIndex({ year: 1 });
    console.log('✅ Created year_1');
    
    await collection.createIndex({ employee: 1 });
    console.log('✅ Created employee_1');
    
    await collection.createIndex({ expirationDate: 1 });
    console.log('✅ Created expirationDate_1');

    console.log('\n✅ Index fix complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixLeaveBalanceIndexes();
