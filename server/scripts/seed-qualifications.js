/**
 * Script to seed the database with default qualifications
 * This adds all the previous hardcoded qualifications to the database
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const Qualification = require('../models/hr/Qualification');

const defaultQualifications = [
  'LLB',
  'MBA',
  'BBA',
  'BSc',
  'MSc',
  'PhD',
  'CA',
  'ACCA',
  'CMA',
  'CFA',
  'Diploma',
  'Certificate',
  'High School',
  'Intermediate',
  'Other'
];

async function seedQualifications() {
  try {
    // Connect to MongoDB
    console.log('🌐 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    console.log('\n📝 Seeding qualifications...');
    let created = 0;
    let skipped = 0;

    for (const qualificationName of defaultQualifications) {
      try {
        // Check if qualification already exists
        const existing = await Qualification.findOne({ name: qualificationName });
        if (existing) {
          console.log(`  ⏭️  Skipped: "${qualificationName}" (already exists)`);
          skipped++;
          continue;
        }

        // Create new qualification
        const qualification = new Qualification({
          name: qualificationName,
          status: 'Active'
        });

        await qualification.save();
        console.log(`  ✅ Created: "${qualificationName}"`);
        created++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`  ⏭️  Skipped: "${qualificationName}" (duplicate)`);
          skipped++;
        } else {
          console.error(`  ❌ Error creating "${qualificationName}":`, error.message);
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Created: ${created}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  📦 Total: ${defaultQualifications.length}`);

    // List all active qualifications
    const allQualifications = await Qualification.find({ status: 'Active' }).sort({ name: 1 });
    console.log(`\n📋 All active qualifications (${allQualifications.length}):`);
    allQualifications.forEach((q, index) => {
      console.log(`  ${index + 1}. ${q.name}`);
    });

    console.log('\n✓ Done!');
  } catch (error) {
    console.error('❌ Error seeding qualifications:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the script
seedQualifications();

