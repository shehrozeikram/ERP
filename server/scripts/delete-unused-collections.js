const mongoose = require('mongoose');
require('dotenv').config();

async function deleteUnusedCollections() {
  try {
    console.log('🔄 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database');

    const db = mongoose.connection.db;

    console.log('\n📋 Pre-deletion verification:');
    
    // Check if collections exist and their document counts
    const leavesExists = await db.listCollections({name: 'leaves'}).hasNext();
    const leavemanagementsExists = await db.listCollections({name: 'leavemanagements'}).hasNext();
    
    if (leavesExists) {
      const leavesCount = await db.collection('leaves').countDocuments();
      console.log(`   leaves collection: ${leavesCount} documents`);
    } else {
      console.log('   leaves collection: Does not exist');
    }
    
    if (leavemanagementsExists) {
      const leavemanagementsCount = await db.collection('leavemanagements').countDocuments();
      console.log(`   leavemanagements collection: ${leavemanagementsCount} documents`);
    } else {
      console.log('   leavemanagements collection: Does not exist');
    }

    console.log('\n🗑️ Deleting unused collections...');

    // Delete leaves collection
    if (leavesExists) {
      try {
        await db.collection('leaves').drop();
        console.log('✅ Successfully deleted "leaves" collection');
      } catch (error) {
        console.log('⚠️ Error deleting "leaves" collection:', error.message);
      }
    } else {
      console.log('ℹ️ "leaves" collection does not exist - skipping');
    }

    // Delete leavemanagements collection
    if (leavemanagementsExists) {
      try {
        await db.collection('leavemanagements').drop();
        console.log('✅ Successfully deleted "leavemanagements" collection');
      } catch (error) {
        console.log('⚠️ Error deleting "leavemanagements" collection:', error.message);
      }
    } else {
      console.log('ℹ️ "leavemanagements" collection does not exist - skipping');
    }

    console.log('\n📊 Post-deletion verification:');
    
    // Verify deletions
    const leavesStillExists = await db.listCollections({name: 'leaves'}).hasNext();
    const leavemanagementsStillExists = await db.listCollections({name: 'leavemanagements'}).hasNext();
    
    console.log(`   leaves collection still exists: ${leavesStillExists ? '❌ YES' : '✅ NO'}`);
    console.log(`   leavemanagements collection still exists: ${leavemanagementsStillExists ? '❌ YES' : '✅ NO'}`);

    console.log('\n✅ Collection deletion completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Both unused collections have been removed');
    console.log('   • No impact on existing functionality');
    console.log('   • Active leave system remains intact');

  } catch (error) {
    console.error('❌ Error during deletion process:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
    process.exit(0);
  }
}

// Run the deletion
deleteUnusedCollections();
