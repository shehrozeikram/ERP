const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Location = require('../models/hr/Location');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function createSampleLocations() {
  try {
    console.log('\n📋 Creating Sample Locations...\n');

    // Clear existing locations
    await Location.deleteMany({});
    console.log('🧹 Cleared existing locations');

    const sampleLocations = [
      {
        name: 'Karachi Main Office',
        code: 'KHI001',
        type: 'Office',
        address: {
          street: '123 Business Avenue',
          city: 'Karachi',
          state: 'Sindh',
          zipCode: '75000',
          country: 'Pakistan'
        },
        contactInfo: {
          phone: '+92-21-1234567',
          email: 'karachi@sgc.com',
          fax: '+92-21-1234568'
        },
        capacity: 150,
        facilities: ['Conference Rooms', 'Cafeteria', 'Parking', 'WiFi', 'Security']
      },
      {
        name: 'Islamabad Branch',
        code: 'ISB001',
        type: 'Branch',
        address: {
          street: '456 Corporate Plaza',
          city: 'Islamabad',
          state: 'Federal Territory',
          zipCode: '44000',
          country: 'Pakistan'
        },
        contactInfo: {
          phone: '+92-51-2345678',
          email: 'islamabad@sgc.com',
          fax: '+92-51-2345679'
        },
        capacity: 80,
        facilities: ['Meeting Rooms', 'Kitchen', 'Parking', 'WiFi']
      },
      {
        name: 'Lahore Development Center',
        code: 'LHR001',
        type: 'Site',
        address: {
          street: '789 Tech Park',
          city: 'Lahore',
          state: 'Punjab',
          zipCode: '54000',
          country: 'Pakistan'
        },
        contactInfo: {
          phone: '+92-42-3456789',
          email: 'lahore@sgc.com',
          fax: '+92-42-3456790'
        },
        capacity: 120,
        facilities: ['Development Labs', 'Testing Center', 'Cafeteria', 'Gym', 'WiFi']
      },
      {
        name: 'Remote Work Hub',
        code: 'REM001',
        type: 'Remote',
        address: {
          street: 'Virtual Office',
          city: 'Remote',
          state: 'Virtual',
          zipCode: '00000',
          country: 'Pakistan'
        },
        contactInfo: {
          phone: '+92-21-4567890',
          email: 'remote@sgc.com'
        },
        capacity: 50,
        facilities: ['Virtual Meeting Rooms', 'Cloud Infrastructure', '24/7 Support']
      },
      {
        name: 'Client Site - TechCorp',
        code: 'CLI001',
        type: 'Client Site',
        address: {
          street: '321 Innovation Drive',
          city: 'Karachi',
          state: 'Sindh',
          zipCode: '75001',
          country: 'Pakistan'
        },
        contactInfo: {
          phone: '+92-21-5678901',
          email: 'techcorp@sgc.com'
        },
        capacity: 25,
        facilities: ['Dedicated Workspace', 'Client Network Access', 'Security Clearance']
      },
      {
        name: 'Peshawar Regional Office',
        code: 'PES001',
        type: 'Branch',
        address: {
          street: '654 Regional Center',
          city: 'Peshawar',
          state: 'Khyber Pakhtunkhwa',
          zipCode: '25000',
          country: 'Pakistan'
        },
        contactInfo: {
          phone: '+92-91-6789012',
          email: 'peshawar@sgc.com',
          fax: '+92-91-6789013'
        },
        capacity: 60,
        facilities: ['Regional HQ', 'Training Center', 'Parking', 'WiFi', 'Security']
      },
      {
        name: 'Quetta Satellite Office',
        code: 'QUE001',
        type: 'Office',
        address: {
          street: '987 Satellite Plaza',
          city: 'Quetta',
          state: 'Balochistan',
          zipCode: '87300',
          country: 'Pakistan'
        },
        contactInfo: {
          phone: '+92-81-7890123',
          email: 'quetta@sgc.com'
        },
        capacity: 30,
        facilities: ['Local Support', 'Meeting Room', 'WiFi', 'Security']
      }
    ];

    // Create new locations
    const createdLocations = await Location.insertMany(sampleLocations);
    
    console.log(`✅ Created ${createdLocations.length} locations:`);
    
    createdLocations.forEach(location => {
      console.log(`   📋 ${location.name} (${location.code}) - ${location.type} - ${location.address.city}`);
    });

    console.log('\n🎉 Sample locations created successfully!');

  } catch (error) {
    console.error('❌ Error creating sample locations:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

createSampleLocations(); 