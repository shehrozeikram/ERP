const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testPositionCreation() {
  try {
    console.log('\n🧪 Testing Position Creation...\n');

    // Get a department to test with
    const department = await Department.findOne({ isActive: true });
    if (!department) {
      console.log('❌ No departments found. Please create departments first.');
      return;
    }

    console.log(`📋 Using department: ${department.name} (${department._id})`);

    // Test position data
    const testPosition = {
      title: 'Test Position',
      department: department._id,
      level: 'Entry',
      description: 'This is a test position created for testing purposes',
      requirements: [],
      responsibilities: []
    };

    console.log('📝 Creating test position...');
    console.log('Position data:', testPosition);

    // Create the position
    const position = new Position(testPosition);
    await position.save();

    console.log('✅ Test position created successfully!');
    console.log('Position ID:', position._id);
    console.log('Position Title:', position.title);
    console.log('Department:', position.department);

    // Clean up - delete the test position
    await Position.findByIdAndDelete(position._id);
    console.log('🧹 Test position cleaned up');

    console.log('\n🎉 Position creation test completed successfully!');

  } catch (error) {
    console.error('❌ Error during position creation test:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

testPositionCreation(); 