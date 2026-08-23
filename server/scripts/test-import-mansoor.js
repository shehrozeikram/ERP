const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Employee = require('../models/hr/Employee');
const LeaveBalance = require('../models/hr/LeaveBalance');
const LeaveRequest = require('../models/hr/LeaveRequest');

async function run() {
  try {
    // 1. Connect to DB
    await mongoose.connect(process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/sgc_erp_local');
    console.log('✅ Connected to MongoDB');

    // 2. Find admin user and generate token
    const adminUser = await User.findOne({ email: 'ceo@sgc.com' }) || await User.findOne({ role: 'super_admin' });
    if (!adminUser) {
      throw new Error('Could not find an admin user to generate token');
    }
    const token = adminUser.generateAuthToken();
    console.log(`✅ Generated token for admin: ${adminUser.email}`);

    const mansoor = await Employee.findOne({ employeeId: '3' });
    if (!mansoor) throw new Error('Mansoor not found in DB!');
    
    console.log('🗑️ Clearing previous imported data for Mansoor...');
    await LeaveRequest.deleteMany({ employee: mansoor._id, approvalComments: 'Imported from Excel Leave File' });
    await LeaveBalance.deleteMany({ employee: mansoor._id });

    // 3. Prepare form data with Leave_Mansoor.xlsx
    const filePath = path.resolve(__dirname, '../../docs/Leave_Mansoor.xlsx');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));

    // 4. Send POST request to API
    console.log('📤 Sending import request to API...');
    const port = process.env.PORT || 5001;
    const response = await axios.post(`http://localhost:${port}/api/leaves/import`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log('✅ Import API Response:', JSON.stringify(response.data, null, 2));

    // 5. Verify Database Records for Mansoor (empId: 3)
    console.log('\n🔍 Verifying Database Records for Mansoor (Employee ID: 3)...');
    if (!mansoor) {
      console.log('❌ Mansoor (emp 3) not found in DB!');
      process.exit(1);
    }
    console.log(`✅ Found Employee: ${mansoor.firstName} ${mansoor.lastName}`);

    const balances = await LeaveBalance.find({ employee: mansoor._id }).sort({ year: 1, workYear: 1 }).lean();
    console.log('\n📊 Leave Balances:');
    if (balances.length === 0) {
      console.log('  No LeaveBalance records found.');
    } else {
      balances.forEach(b => {
        console.log(`  - Year: ${b.year}, WorkYear: ${b.workYear}`);
        console.log(`      Annual: Allocated=${b.annual.allocated}, Used=${b.annual.used}, Remaining=${b.annual.remaining}`);
        console.log(`      Sick:   Allocated=${b.sick.allocated}, Used=${b.sick.used}, Remaining=${b.sick.remaining}`);
        console.log(`      Casual: Allocated=${b.casual.allocated}, Used=${b.casual.used}, Remaining=${b.casual.remaining}`);
      });
    }

    const requests = await LeaveRequest.find({ employee: mansoor._id, approvalComments: 'Imported from Excel Leave File' }).sort({ startDate: 1 }).lean();
    console.log(`\n📝 Imported Leave Requests (${requests.length} found):`);
    if (requests.length === 0) {
      console.log('  No imported LeaveRequest records found.');
    } else {
      requests.forEach(r => {
        console.log(`  - ${new Date(r.startDate).toISOString().slice(0, 10)} to ${new Date(r.endDate).toISOString().slice(0, 10)} | ${r.leaveType} | ${r.totalDays} days | Status: ${r.status}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

run();
