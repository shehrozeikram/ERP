/**
 * Script to fix LeaveBalance collection indexes
 * Drops incorrect indexes and ensures correct ones exist
 * 
 * Usage: node server/scripts/fixLeaveBalanceIndexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixLeaveBalanceIndexes() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;
    const collection = db.collection('leavebalances');

    console.log('\n📋 Checking existing indexes...');
    const existingIndexes = await collection.indexes();
    console.log('Current indexes:', existingIndexes.map(idx => idx.name));

    // Drop all indexes except _id
    console.log('\n🗑️ Dropping old indexes...');
    for (const index of existingIndexes) {
      if (index.name !== '_id_') {
        try {
          await collection.dropIndex(index.name);
          console.log(`✅ Dropped index: ${index.name}`);
        } catch (error) {
          console.log(`⚠️ Could not drop ${index.name}:`, error.message);
        }
      }
    }

    // Create correct indexes
    console.log('\n📝 Creating correct indexes...');
    
    // Unique compound index on employee and year
    await collection.createIndex(
      { employee: 1, year: 1 },
      { unique: true, name: 'employee_1_year_1' }
    );
    console.log('✅ Created index: employee_1_year_1 (unique)');

    // Index on year for queries
    await collection.createIndex(
      { year: 1 },
      { name: 'year_1' }
    );
    console.log('✅ Created index: year_1');

    // Index on employee for queries
    await collection.createIndex(
      { employee: 1 },
      { name: 'employee_1' }
    );
    console.log('✅ Created index: employee_1');

    // Clean up any documents with null employee
    console.log('\n🧹 Cleaning up invalid documents...');
    const deleteResult = await collection.deleteMany({ employee: null });
    console.log(`✅ Deleted ${deleteResult.deletedCount} documents with null employee`);

    // Verify final indexes
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ LeaveBalance indexes fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
fixLeaveBalanceIndexes()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

