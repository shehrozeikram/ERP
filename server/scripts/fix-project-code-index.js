/**
 * Script to remove old 'code' field unique index from projects collection
 * This fixes duplicate key errors when creating projects
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

async function fixProjectCodeIndex() {
  try {
    // Connect to MongoDB
    console.log('🌐 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
    
    const db = mongoose.connection.db;
    const collection = db.collection('projects');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('\nCurrent indexes on projects collection:');
    indexes.forEach(index => {
      console.log('  -', JSON.stringify(index));
    });
    
    // Check if 'code' index exists and needs to be dropped
    const codeIndex = indexes.find(idx => idx.key && idx.key.code);
    
    if (codeIndex && codeIndex.unique) {
      console.log('\nFound unique code index:', codeIndex);
      console.log('Attempting to drop code index...');
      
      try {
        await collection.dropIndex('code_1');
        console.log('✓ Successfully dropped code_1 index');
      } catch (dropError) {
        if (dropError.code === 27 || dropError.codeName === 'IndexNotFound') {
          console.log('✗ Index not found (may have been dropped already)');
        } else {
          // Try dropping with the full index name
          const indexName = Object.keys(codeIndex.key).map(k => `${k}_${codeIndex.key[k]}`).join('_');
          try {
            await collection.dropIndex(indexName);
            console.log(`✓ Successfully dropped code index: ${indexName}`);
          } catch (err) {
            console.log('✗ Could not drop index:', err.message);
          }
        }
      }
    } else if (codeIndex && !codeIndex.unique) {
      console.log('\n✓ Found non-unique code index (keeping it)');
    } else {
      console.log('\n✓ No unique code index found - collection is clean');
    }
    
    // List indexes after cleanup
    console.log('\nIndexes after cleanup:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log('  -', JSON.stringify(index));
    });
    
    console.log('\n✓ Done!');
  } catch (error) {
    console.error('Error fixing project code index:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the script
fixProjectCodeIndex();

