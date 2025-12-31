const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const TajSector = require('../models/tajResidencia/TajSector');
const User = require('../models/User');

// Sectors from the image (with Phase -1 and Phase -2 renamed to Orchid Phase - 1 and Orchid Phase - 2)
const initialSectors = [
  'Blue Bell',
  'Commercial Hub',
  'Cosmos',
  'Cosmos-II',
  'Daffodils',
  'Daisy',
  'Gardenia',
  'Geranium',
  'Iris',
  'Jasmine',
  'Lavender',
  'Lily',
  'Lotus',
  'Lotus (Executive)',
  'Marigold',
  'Orchid',
  'Orchid Phase - 1',  // Was Phase -1
  'Orchid Phase - 2',  // Was Phase -2
  'Rose',
  'Sun Flower',
  'Tulip',
  'Zinnia'
];

async function seedSectors() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get the first admin user for createdBy field
    const adminUser = await User.findOne().sort({ createdAt: 1 });
    if (!adminUser) {
      console.error('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    console.log(`📝 Using user "${adminUser.firstName} ${adminUser.lastName}" as creator`);

    let created = 0;
    let skipped = 0;

    for (const sectorName of initialSectors) {
      try {
        // Check if sector already exists
        const existingSector = await TajSector.findOne({ 
          name: { $regex: new RegExp(`^${sectorName}$`, 'i') } 
        });

        if (existingSector) {
          console.log(`⏭️  Sector "${sectorName}" already exists, skipping...`);
          skipped++;
        } else {
          const sector = new TajSector({
            name: sectorName,
            isActive: true,
            createdBy: adminUser._id
          });
          await sector.save();
          console.log(`✅ Created sector: "${sectorName}"`);
          created++;
        }
      } catch (err) {
        console.error(`❌ Error creating sector "${sectorName}":`, err.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${initialSectors.length}`);
    console.log('\n✅ Seeding completed!');

  } catch (error) {
    console.error('❌ Error seeding sectors:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the seed function
seedSectors();

