const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function createSampleProvinces() {
  try {
    console.log('\n🏛️ Creating Sample Provinces...\n');

    // Get existing countries
    const countries = await Country.find({ isActive: true });
    if (countries.length === 0) {
      console.log('❌ No countries found. Please run createSampleCountries.js first.');
      return;
    }

    // Clear existing provinces
    await Province.deleteMany({});
    console.log('🧹 Cleared existing provinces');

    const pakistan = countries.find(c => c.code === 'PK');
    const usa = countries.find(c => c.code === 'US');
    const uk = countries.find(c => c.code === 'GB');
    const canada = countries.find(c => c.code === 'CA');

    const sampleProvinces = [
      // Pakistan Provinces
      {
        name: 'Sindh',
        code: 'SINDH',
        country: pakistan._id,
        capital: 'Karachi',
        population: 47886000,
        area: 140914
      },
      {
        name: 'Punjab',
        code: 'PUNJAB',
        country: pakistan._id,
        capital: 'Lahore',
        population: 110012442,
        area: 205344
      },
      {
        name: 'Khyber Pakhtunkhwa',
        code: 'KP',
        country: pakistan._id,
        capital: 'Peshawar',
        population: 35501964,
        area: 101741
      },
      {
        name: 'Balochistan',
        code: 'BALOCH',
        country: pakistan._id,
        capital: 'Quetta',
        population: 12344408,
        area: 347190
      },
      {
        name: 'Federal Territory',
        code: 'FED',
        country: pakistan._id,
        capital: 'Islamabad',
        population: 2000000,
        area: 906
      },
      {
        name: 'Azad Kashmir',
        code: 'AJK',
        country: pakistan._id,
        capital: 'Muzaffarabad',
        population: 4045366,
        area: 13297
      },
      // US States
      {
        name: 'California',
        code: 'CA',
        country: usa._id,
        capital: 'Sacramento',
        population: 39538223,
        area: 423967
      },
      {
        name: 'Texas',
        code: 'TX',
        country: usa._id,
        capital: 'Austin',
        population: 29145505,
        area: 695662
      },
      {
        name: 'New York',
        code: 'NY',
        country: usa._id,
        capital: 'Albany',
        population: 20201249,
        area: 141297
      },
      {
        name: 'Florida',
        code: 'FL',
        country: usa._id,
        capital: 'Tallahassee',
        population: 21538187,
        area: 170312
      },
      // UK Countries
      {
        name: 'England',
        code: 'ENG',
        country: uk._id,
        capital: 'London',
        population: 55980000,
        area: 130279
      },
      {
        name: 'Scotland',
        code: 'SCT',
        country: uk._id,
        capital: 'Edinburgh',
        population: 5466000,
        area: 77933
      },
      {
        name: 'Wales',
        code: 'WLS',
        country: uk._id,
        capital: 'Cardiff',
        population: 3152000,
        area: 20779
      },
      // Canadian Provinces
      {
        name: 'Ontario',
        code: 'ON',
        country: canada._id,
        capital: 'Toronto',
        population: 14711827,
        area: 1076395
      },
      {
        name: 'Quebec',
        code: 'QC',
        country: canada._id,
        capital: 'Quebec City',
        population: 8574571,
        area: 1667000
      },
      {
        name: 'British Columbia',
        code: 'BC',
        country: canada._id,
        capital: 'Victoria',
        population: 5145851,
        area: 944735
      }
    ];

    // Create new provinces
    const createdProvinces = await Province.insertMany(sampleProvinces);
    
    console.log(`✅ Created ${createdProvinces.length} provinces:`);
    
    // Populate country info for display
    const populatedProvinces = await Province.find({})
      .populate('country', 'name code')
      .sort({ name: 1 });
    
    populatedProvinces.forEach(province => {
      console.log(`   📋 ${province.name} (${province.code}) - ${province.country.name}`);
    });

    console.log('\n🎉 Sample provinces created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample provinces:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleProvinces(); 