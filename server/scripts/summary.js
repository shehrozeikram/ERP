const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Bank = require('../models/hr/Bank');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function showSummary() {
  try {
    console.log('\n📊 SGC ERP SYSTEM DATA SUMMARY');
    console.log('================================\n');

    // Departments
    const departments = await Department.find({ isActive: true });
    console.log(`🏢 DEPARTMENTS (${departments.length}):`);
    departments.forEach(dept => {
      console.log(`   - ${dept.name} (${dept.code})`);
    });

    // Positions
    const positions = await Position.find({ isActive: true }).populate('department', 'name');
    console.log(`\n💼 POSITIONS (${positions.length}):`);
    
    const positionSummary = {};
    positions.forEach(pos => {
      const deptName = pos.department.name;
      if (!positionSummary[deptName]) positionSummary[deptName] = [];
      positionSummary[deptName].push(`${pos.title} (${pos.level})`);
    });

    Object.entries(positionSummary).forEach(([dept, posList]) => {
      console.log(`   ${dept}:`);
      posList.forEach(pos => {
        console.log(`     - ${pos}`);
      });
    });

    // Banks
    const banks = await Bank.find({ isActive: true });
    console.log(`\n🏦 BANKS (${banks.length}):`);
    
    const bankSummary = {};
    banks.forEach(bank => {
      if (!bankSummary[bank.type]) bankSummary[bank.type] = [];
      bankSummary[bank.type].push(`${bank.name} (${bank.code})`);
    });

    Object.entries(bankSummary).forEach(([type, bankList]) => {
      console.log(`   ${type}:`);
      bankList.forEach(bank => {
        console.log(`     - ${bank}`);
      });
    });

    console.log('\n🎉 SUMMARY:');
    console.log(`   - ${departments.length} Departments`);
    console.log(`   - ${positions.length} Positions`);
    console.log(`   - ${banks.length} Banks`);
    console.log('\n✨ All data is ready for use in the Employee Form!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

showSummary(); 