const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Company = require('../models/hr/Company');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

const sampleCompanies = [
  {
    name: 'TechCorp Solutions',
    code: 'TCS001',
    type: 'Client',
    industry: 'Technology',
    website: 'https://techcorp.com',
    contactInfo: {
      phone: '+92-21-1234567',
      email: 'info@techcorp.com',
      address: 'Karachi, Pakistan'
    },
    establishedDate: new Date('2015-01-15')
  },
  {
    name: 'Global Industries Ltd',
    code: 'GIL002',
    type: 'Partner',
    industry: 'Manufacturing',
    website: 'https://globalindustries.com',
    contactInfo: {
      phone: '+92-51-2345678',
      email: 'contact@globalindustries.com',
      address: 'Islamabad, Pakistan'
    },
    establishedDate: new Date('2010-03-20')
  },
  {
    name: 'Digital Innovations',
    code: 'DI003',
    type: 'Client',
    industry: 'Software Development',
    website: 'https://digitalinnovations.com',
    contactInfo: {
      phone: '+92-42-3456789',
      email: 'hello@digitalinnovations.com',
      address: 'Lahore, Pakistan'
    },
    establishedDate: new Date('2018-07-10')
  },
  {
    name: 'SGC Enterprise',
    code: 'SGC004',
    type: 'Parent',
    industry: 'Consulting',
    website: 'https://sgcenterprise.com',
    contactInfo: {
      phone: '+92-21-4567890',
      email: 'info@sgcenterprise.com',
      address: 'Karachi, Pakistan'
    },
    establishedDate: new Date('2005-11-05')
  },
  {
    name: 'Future Systems',
    code: 'FS005',
    type: 'Subsidiary',
    industry: 'IT Services',
    website: 'https://futuresystems.com',
    contactInfo: {
      phone: '+92-51-5678901',
      email: 'contact@futuresystems.com',
      address: 'Islamabad, Pakistan'
    },
    establishedDate: new Date('2012-09-15')
  }
];

async function createSampleCompanies() {
  try {
    console.log('\n🏢 Creating Sample Companies...\n');

    // Clear existing companies
    await Company.deleteMany({});
    console.log('🧹 Cleared existing companies');

    // Create new companies
    const createdCompanies = await Company.insertMany(sampleCompanies);
    
    console.log(`✅ Created ${createdCompanies.length} companies:`);
    createdCompanies.forEach(company => {
      console.log(`   📋 ${company.name} (${company.code}) - ${company.type}`);
    });

    console.log('\n🎉 Sample companies created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample companies:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleCompanies(); 