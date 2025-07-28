const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Country = require('../models/hr/Country');
const Province = require('../models/hr/Province');
const City = require('../models/hr/City');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testAzadKashmirData() {
  try {
    console.log('\n🧪 Testing Azad Kashmir and Pakistan Cities Data...\n');

    // Get Pakistan data
    const pakistan = await Country.findOne({ code: 'PK' });
    if (!pakistan) {
      console.log('❌ Pakistan not found in database');
      return;
    }

    console.log(`📋 Pakistan: ${pakistan.name} (${pakistan.code})`);

    // Get all Pakistan provinces
    const pakistanProvinces = await Province.find({ country: pakistan._id, isActive: true })
      .populate('country', 'name code')
      .sort({ name: 1 });

    console.log(`\n🏛️ Pakistan Provinces (${pakistanProvinces.length}):`);
    pakistanProvinces.forEach(province => {
      console.log(`   📋 ${province.name} (${province.code}) - Capital: ${province.capital}`);
    });

    // Get Azad Kashmir specifically
    const azadKashmir = await Province.findOne({ name: 'Azad Kashmir', country: pakistan._id });
    if (!azadKashmir) {
      console.log('❌ Azad Kashmir not found');
      return;
    }

    console.log(`\n🏔️ Azad Kashmir Details:`);
    console.log(`   Name: ${azadKashmir.name}`);
    console.log(`   Code: ${azadKashmir.code}`);
    console.log(`   Capital: ${azadKashmir.capital}`);
    console.log(`   Population: ${azadKashmir.population?.toLocaleString()}`);
    console.log(`   Area: ${azadKashmir.area?.toLocaleString()} km²`);

    // Get Azad Kashmir cities
    const azadKashmirCities = await City.find({ province: azadKashmir._id, isActive: true })
      .populate('province', 'name code')
      .populate('country', 'name code')
      .sort({ name: 1 });

    console.log(`\n🏙️ Azad Kashmir Cities (${azadKashmirCities.length}):`);
    azadKashmirCities.forEach(city => {
      console.log(`   📋 ${city.name} (${city.code}) - Population: ${city.population?.toLocaleString()}`);
    });

    // Get all Pakistan cities by province
    console.log(`\n🏙️ Pakistan Cities by Province:`);
    for (const province of pakistanProvinces) {
      const cities = await City.find({ province: province._id, isActive: true })
        .populate('province', 'name code')
        .sort({ name: 1 });

      console.log(`\n   📋 ${province.name} (${cities.length} cities):`);
      cities.forEach(city => {
        console.log(`      - ${city.name} (${city.code}) - ${city.population?.toLocaleString()}`);
      });
    }

    // Test dynamic relationships
    console.log(`\n🔍 Testing Dynamic Relationships:`);
    
    // Test provinces by country
    const provincesByCountry = await Province.find({ country: pakistan._id, isActive: true });
    console.log(`✅ Found ${provincesByCountry.length} provinces for Pakistan`);

    // Test cities by province (Azad Kashmir)
    const citiesByProvince = await City.find({ province: azadKashmir._id, isActive: true });
    console.log(`✅ Found ${citiesByProvince.length} cities for Azad Kashmir`);

    // Test total Pakistan cities
    const allPakistanCities = await City.find({ 
      'country': pakistan._id, 
      isActive: true 
    }).populate('province', 'name');
    
    console.log(`✅ Total Pakistan cities: ${allPakistanCities.length}`);

    console.log('\n🎉 Azad Kashmir and Pakistan cities data test successful!');

  } catch (error) {
    console.error('❌ Error during Azad Kashmir data test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testAzadKashmirData(); 