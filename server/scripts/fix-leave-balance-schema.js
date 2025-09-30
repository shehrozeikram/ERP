const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc-erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixLeaveBalanceSchema = async () => {
  try {
    console.log('🔧 Fixing leave balance schema issues...');

    // Find employees with incorrect leave balance structure
    const employees = await Employee.find({
      $or: [
        { 'leaveBalance.maternity': { $type: 'number' } },
        { 'leaveBalance.paternity': { $type: 'number' } },
        { 'leaveBalance.annual': { $type: 'number' } },
        { 'leaveBalance.casual': { $type: 'number' } },
        { 'leaveBalance.medical': { $type: 'number' } }
      ]
    });

    console.log(`Found ${employees.length} employees with incorrect leave balance structure`);

    for (const employee of employees) {
      console.log(`Fixing employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
      
      const updates = {};
      
      // Fix each leave type if it's a number instead of object
      const leaveTypes = ['annual', 'casual', 'medical', 'maternity', 'paternity'];
      
      for (const leaveType of leaveTypes) {
        if (typeof employee.leaveBalance[leaveType] === 'number') {
          const value = employee.leaveBalance[leaveType];
          console.log(`  - Converting ${leaveType} from ${value} to object structure`);
          
          updates[`leaveBalance.${leaveType}`] = {
            allocated: leaveType === 'annual' ? 14 : 
                      leaveType === 'casual' ? 10 :
                      leaveType === 'medical' ? 8 : 0,
            used: 0,
            remaining: leaveType === 'annual' ? 14 : 
                      leaveType === 'casual' ? 10 :
                      leaveType === 'medical' ? 8 : 0,
            carriedForward: leaveType === 'maternity' || leaveType === 'paternity' ? undefined : 0
          };
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await Employee.updateOne(
          { _id: employee._id },
          { $set: updates }
        );
        console.log(`  ✅ Fixed ${Object.keys(updates).length} leave balance fields`);
      }
    }

    console.log('✅ Leave balance schema fix completed');
    
    // Verify the fix
    const remainingIssues = await Employee.countDocuments({
      $or: [
        { 'leaveBalance.maternity': { $type: 'number' } },
        { 'leaveBalance.paternity': { $type: 'number' } },
        { 'leaveBalance.annual': { $type: 'number' } },
        { 'leaveBalance.casual': { $type: 'number' } },
        { 'leaveBalance.medical': { $type: 'number' } }
      ]
    });
    
    console.log(`Remaining employees with schema issues: ${remainingIssues}`);
    
  } catch (error) {
    console.error('❌ Error fixing leave balance schema:', error);
  } finally {
    mongoose.connection.close();
  }
};

fixLeaveBalanceSchema();
