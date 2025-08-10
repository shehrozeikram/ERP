require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');

const LOCAL_DB = 'sgc_erp';
const ATLAS_URI = process.env.MONGODB_URI;
const BACKUP_DIR = './mongodb-backup';

console.log('🚀 Starting MongoDB Migration to Atlas...');
console.log('📊 Local Database:', LOCAL_DB);
console.log('☁️  Atlas URI:', ATLAS_URI.replace(/\/\/.*@/, '//***:***@'));

async function runCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 ${description}...`);
    console.log(`Command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.log(`⚠️  Stderr: ${stderr}`);
      }
      console.log(`✅ ${description} completed successfully`);
      if (stdout) {
        console.log(`Output: ${stdout}`);
      }
      resolve(stdout);
    });
  });
}

async function migrateToAtlas() {
  try {
    // Step 1: Create backup directory
    console.log('\n📁 Creating backup directory...');
    await runCommand(`mkdir -p ${BACKUP_DIR}`, 'Creating backup directory');
    
    // Step 2: Export all data from local MongoDB
    console.log('\n📤 Exporting data from local MongoDB...');
    const exportCommand = `mongodump --db ${LOCAL_DB} --out ${BACKUP_DIR}`;
    await runCommand(exportCommand, 'Exporting local database');
    
    // Step 3: Import data to MongoDB Atlas
    console.log('\n📥 Importing data to MongoDB Atlas...');
    const importCommand = `mongorestore --uri "${ATLAS_URI}" --db ${LOCAL_DB} ${BACKUP_DIR}/${LOCAL_DB}`;
    await runCommand(importCommand, 'Importing to Atlas');
    
    // Step 4: Verify the migration
    console.log('\n🔍 Verifying migration...');
    const verifyCommand = `mongosh "${ATLAS_URI}" --eval "db.runCommand({dbStats: 1})"`;
    await runCommand(verifyCommand, 'Verifying Atlas database');
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📊 Your data is now in MongoDB Atlas');
    console.log('🗑️  You can now stop your local MongoDB instance');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure local MongoDB is running');
    console.log('2. Check your Atlas connection string');
    console.log('3. Ensure you have network access to Atlas');
    process.exit(1);
  }
}

// Run the migration
migrateToAtlas();
