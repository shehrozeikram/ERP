/**
 * Script to remove old 'code' field unique index from locations collection
 * This fixes the "code already exists" error when creating locations
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const connectDB = require('../config/database');

async function fixLocationCodeIndex() {
  try {
    await connectDB();
    
    const db = mongoose.connection.db;
    const collection = db.collection('locations');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes on locations collection:');
    indexes.forEach(index => {
      console.log('  -', JSON.stringify(index));
    });
    
    // Check if 'code' index exists
    const codeIndex = indexes.find(idx => idx.key && idx.key.code);
    
    if (codeIndex) {
      console.log('\nFound old code index:', codeIndex);
      console.log('Attempting to drop code index...');
      
      try {
        await collection.dropIndex('code_1');
        console.log('✓ Successfully dropped code index');
      } catch (dropError) {
        if (dropError.code === 27) {
          console.log('✗ Index not found (may have been dropped already)');
        } else {
          // Try dropping with the full index name
          const indexName = Object.keys(codeIndex.key).map(k => `${k}_${codeIndex.key[k]}`).join('_');
          await collection.dropIndex(indexName);
          console.log(`✓ Successfully dropped code index: ${indexName}`);
        }
      }
    } else {
      console.log('\n✓ No code index found - collection is clean');
    }
    
    // List indexes after cleanup
    console.log('\nIndexes after cleanup:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log('  -', JSON.stringify(index));
    });
    
    console.log('\n✓ Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing location code index:', error);
    process.exit(1);
  }
}

// Run the script
fixLocationCodeIndex();

