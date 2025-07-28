const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Employee = require('../models/hr/Employee');
const City = require('../models/hr/City');
const Province = require('../models/hr/Province');
const Country = require('../models/hr/Country');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');
const User = require('../models/User');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testAddressFunctionality() {
  try {
    console.log('\n🧪 Testing Address Functionality...\n');

    // Get sample data
    const country = await Country.findOne({ code: 'PK' });
    const province = await Province.findOne({ name: 'Sindh' });
    const city = await City.findOne({ name: 'Karachi' });
    const department = await Department.findOne({ isActive: true });
    const position = await Position.findOne({ isActive: true });
    const bank = await Bank.findOne({ isActive: true });

    if (!country || !province || !city || !department || !position || !bank) {
      console.log('❌ Missing required data. Please ensure all sample data exists.');
      return;
    }

    console.log('📋 Using sample data:');
    console.log(`   Country: ${country.name} (${country.code})`);
    console.log(`   Province: ${province.name} (${province.code})`);
    console.log(`   City: ${city.name} (${city.code})`);
    console.log(`   Department: ${department.name}`);
    console.log(`   Position: ${position.title}`);
    console.log(`   Bank: ${bank.name}`);

    // Create test employee with address data
    const testEmployee = {
      firstName: 'Address',
      lastName: 'Test',
      email: 'address.test@example.com',
      phone: '+1234567890',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      idCard: 'ADDRESS123',
      religion: 'Islam',
      maritalStatus: 'Single',
      department: department._id,
      position: position._id,
      qualification: 'BSc Computer Science',
      bankName: bank._id,
      spouseName: 'Test Spouse',
      appointmentDate: new Date('2024-01-15'),
      probationPeriodMonths: 6,
      endOfProbationDate: new Date('2024-07-15'),
      hireDate: new Date('2024-01-15'),
      salary: 80000,
      address: {
        street: '123 Test Street',
        city: city._id,
        state: province._id,
        country: country._id
      },
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        phone: '+1234567890'
      }
    };

    console.log('\n📝 Creating test employee with address data...');
    const employee = new Employee(testEmployee);
    await employee.save();

    console.log('✅ Test employee created successfully!');
    console.log('Employee ID:', employee._id);
    console.log('Employee Name:', employee.firstName, employee.lastName);

    // Test populated employee data
    console.log('\n🔍 Testing populated address data...');
    const populatedEmployee = await Employee.findById(employee._id)
      .populate('address.city', 'name code')
      .populate('address.state', 'name code')
      .populate('address.country', 'name code');

    console.log('✅ Address data populated:');
    console.log(`   Street: ${populatedEmployee.address.street}`);
    console.log(`   City: ${populatedEmployee.address.city?.name} (${populatedEmployee.address.city?.code})`);
    console.log(`   State: ${populatedEmployee.address.state?.name} (${populatedEmployee.address.state?.code})`);
    console.log(`   Country: ${populatedEmployee.address.country?.name} (${populatedEmployee.address.country?.code})`);

    // Test search functionality
    console.log('\n🔍 Testing address search functionality...');
    const searchResults = await Employee.find({
      $or: [
        { 'address.city.name': { $regex: city.name, $options: 'i' } },
        { 'address.state.name': { $regex: province.name, $options: 'i' } },
        { 'address.country.name': { $regex: country.name, $options: 'i' } }
      ]
    }).populate('address.city address.state address.country');

    console.log(`✅ Search found ${searchResults.length} employees with address data`);

    // Test dynamic dropdown relationships
    console.log('\n🔍 Testing dynamic dropdown relationships...');
    
    // Test provinces by country
    const provincesByCountry = await Province.find({ country: country._id, isActive: true });
    console.log(`✅ Found ${provincesByCountry.length} provinces for ${country.name}:`);
    provincesByCountry.forEach(prov => {
      console.log(`   - ${prov.name} (${prov.code})`);
    });

    // Test cities by province
    const citiesByProvince = await City.find({ province: province._id, isActive: true });
    console.log(`✅ Found ${citiesByProvince.length} cities for ${province.name}:`);
    citiesByProvince.forEach(city => {
      console.log(`   - ${city.name} (${city.code})`);
    });

    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await Employee.findByIdAndDelete(employee._id);
    console.log('✅ Test employee cleaned up');

    console.log('\n🎉 Address functionality test successful!');

  } catch (error) {
    console.error('❌ Error during address functionality test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testAddressFunctionality(); 