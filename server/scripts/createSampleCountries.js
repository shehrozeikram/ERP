const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Country = require('../models/hr/Country');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const sampleCountries = [
  {
    name: 'Pakistan',
    code: 'PK',
    iso3: 'PAK',
    capital: 'Islamabad',
    population: 220892340,
    area: 881913,
    currency: 'PKR',
    language: 'Urdu, English',
    timezone: 'UTC+5',
    phoneCode: '+92'
  },
  {
    name: 'United States',
    code: 'US',
    iso3: 'USA',
    capital: 'Washington, D.C.',
    population: 331002651,
    area: 9833517,
    currency: 'USD',
    language: 'English',
    timezone: 'UTC-12 to UTC+12',
    phoneCode: '+1'
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    iso3: 'GBR',
    capital: 'London',
    population: 67886011,
    area: 242495,
    currency: 'GBP',
    language: 'English',
    timezone: 'UTC+0',
    phoneCode: '+44'
  },
  {
    name: 'Canada',
    code: 'CA',
    iso3: 'CAN',
    capital: 'Ottawa',
    population: 37742154,
    area: 9984670,
    currency: 'CAD',
    language: 'English, French',
    timezone: 'UTC-8 to UTC-3',
    phoneCode: '+1'
  },
  {
    name: 'Australia',
    code: 'AU',
    iso3: 'AUS',
    capital: 'Canberra',
    population: 25499884,
    area: 7692024,
    currency: 'AUD',
    language: 'English',
    timezone: 'UTC+8 to UTC+10',
    phoneCode: '+61'
  },
  {
    name: 'Germany',
    code: 'DE',
    iso3: 'DEU',
    capital: 'Berlin',
    population: 83783942,
    area: 357022,
    currency: 'EUR',
    language: 'German',
    timezone: 'UTC+1',
    phoneCode: '+49'
  },
  {
    name: 'France',
    code: 'FR',
    iso3: 'FRA',
    capital: 'Paris',
    population: 65273511,
    area: 551695,
    currency: 'EUR',
    language: 'French',
    timezone: 'UTC+1',
    phoneCode: '+33'
  },
  {
    name: 'India',
    code: 'IN',
    iso3: 'IND',
    capital: 'New Delhi',
    population: 1380004385,
    area: 3287263,
    currency: 'INR',
    language: 'Hindi, English',
    timezone: 'UTC+5:30',
    phoneCode: '+91'
  },
  {
    name: 'China',
    code: 'CN',
    iso3: 'CHN',
    capital: 'Beijing',
    population: 1439323776,
    area: 9596961,
    currency: 'CNY',
    language: 'Chinese',
    timezone: 'UTC+8',
    phoneCode: '+86'
  },
  {
    name: 'Japan',
    code: 'JP',
    iso3: 'JPN',
    capital: 'Tokyo',
    population: 126476461,
    area: 377975,
    currency: 'JPY',
    language: 'Japanese',
    timezone: 'UTC+9',
    phoneCode: '+81'
  }
];

async function createSampleCountries() {
  try {
    console.log('\n🌍 Creating Sample Countries...\n');

    // Clear existing countries
    await Country.deleteMany({});
    console.log('🧹 Cleared existing countries');

    // Create new countries
    const createdCountries = await Country.insertMany(sampleCountries);
    
    console.log(`✅ Created ${createdCountries.length} countries:`);
    createdCountries.forEach(country => {
      console.log(`   📋 ${country.name} (${country.code}) - ${country.capital}`);
    });

    console.log('\n🎉 Sample countries created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample countries:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleCountries(); 