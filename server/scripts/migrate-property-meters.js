/**
 * Migration script to convert single meter fields to meters array
 * Run this once to migrate existing property data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const TajProperty = require('../models/tajResidencia/TajProperty');

async function migratePropertyMeters() {
  try {
    console.log('🚀 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to database');

    const properties = await TajProperty.find({
      $or: [
        { hasElectricityWater: true },
        { electricityWaterConsumer: { $exists: true, $ne: '' } },
        { electricityWaterMeterNo: { $exists: true, $ne: '' } }
      ]
    });

    console.log(`\n📋 Found ${properties.length} properties with meter data to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const property of properties) {
      // Skip if already migrated (has meters array with data)
      if (property.meters && property.meters.length > 0) {
        skipped++;
        continue;
      }

      // Only migrate if hasElectricityWater is true or has meter data
      if (property.hasElectricityWater || property.electricityWaterMeterNo || property.electricityWaterConsumer) {
        const meterData = {
          floor: property.floor || property.unit || 'Ground Floor',
          consumer: property.electricityWaterConsumer || '',
          meterNo: property.electricityWaterMeterNo || '',
          connectionType: property.connectionType || '',
          meterType: property.meterType || '',
          dateOfOccupation: property.dateOfOccupation || null,
          occupiedUnderConstruction: property.occupiedUnderConstruction || '',
          isActive: true
        };

        // Only add meter if it has meaningful data
        if (meterData.meterNo || meterData.consumer) {
          property.meters = [meterData];
          await property.save();
          migrated++;
          console.log(`   ✅ Migrated property ${property.srNo || property._id} - ${property.propertyName || 'N/A'}`);
        } else {
          skipped++;
        }
      } else {
        // Initialize empty meters array for properties without meter data
        if (!property.meters) {
          property.meters = [];
          await property.save();
        }
        skipped++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Migrated: ${migrated} properties`);
    console.log(`   ⏭️  Skipped: ${skipped} properties`);
    console.log(`   📦 Total: ${properties.length} properties`);

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

if (require.main === module) {
  migratePropertyMeters()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migratePropertyMeters;



















