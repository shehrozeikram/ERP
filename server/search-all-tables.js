const mongoose = require('mongoose');
require('./models/hr/Employee');
require('./models/hr/Payroll');
require('./models/hr/Attendance');
require('./models/hr/Application');
require('./models/hr/Candidate');
require('./models/hr/Enrollment');
require('./models/hr/Loan');
require('./models/hr/Payslip');
require('./models/hr/FinalSettlement');
require('./models/hr/JobPosting');
require('./models/hr/TrainingProgram');
require('./models/hr/Course');
require('./models/hr/Department');
require('./models/hr/Position');
require('./models/hr/Designation');
require('./models/hr/Bank');
require('./models/hr/EmployeeOnboarding');
require('./models/hr/JoiningDocument');
require('./models/hr/Project');
require('./models/hr/Section');
require('./models/hr/Sector');
require('./models/hr/Location');
require('./models/hr/Province');
require('./models/hr/City');
require('./models/hr/Country');
require('./models/hr/Company');
require('./models/hr/FBRTaxSlab');
require('./models/crm/Company');
require('./models/crm/Contact');
require('./models/crm/Lead');
require('./models/crm/Opportunity');
require('./models/crm/Campaign');
require('./models/finance/Account');
require('./models/User');

async function searchAllTables() {
  try {
    await mongoose.connect('mongodb://localhost:27017/sgc_erp');
    console.log('Connected to MongoDB');
    
    const searchTerms = ['6377', '06377'];
    
    console.log('\n🔍 SEARCHING FOR:', searchTerms.join(' OR '), 'ACROSS ALL TABLES');
    console.log('=' .repeat(80));
    
    // 1. EMPLOYEE TABLE
    console.log('\n📋 1. EMPLOYEE TABLE');
    console.log('-'.repeat(40));
    const Employee = mongoose.model('Employee');
    for (const term of searchTerms) {
      const employees = await Employee.find({
        $or: [
          { employeeId: term },
          { firstName: { $regex: term, $options: 'i' } },
          { lastName: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
          { phone: { $regex: term, $options: 'i' } }
        ]
      });
      
      if (employees.length > 0) {
        console.log(`✅ Found ${employees.length} employee(s) for "${term}":`);
        employees.forEach(emp => {
          console.log(`   - ${emp.firstName} ${emp.lastName} (ID: ${emp.employeeId}, MongoDB: ${emp._id})`);
        });
      } else {
        console.log(`❌ No employees found for "${term}"`);
      }
    }
    
    // 2. PAYROLL TABLE
    console.log('\n📋 2. PAYROLL TABLE');
    console.log('-'.repeat(40));
    const Payroll = mongoose.model('Payroll');
    for (const term of searchTerms) {
      const payrolls = await Payroll.find({
        $or: [
          { employeeId: term },
          { 'employee.employeeId': term }
        ]
      }).populate('employee', 'firstName lastName employeeId');
      
      if (payrolls.length > 0) {
        console.log(`✅ Found ${payrolls.length} payroll(s) for "${term}":`);
        payrolls.forEach(payroll => {
          const empName = payroll.employee ? `${payroll.employee.firstName} ${payroll.employee.lastName}` : 'Unknown';
          console.log(`   - ${empName} (Month: ${payroll.month}, Year: ${payroll.year}, MongoDB: ${payroll._id})`);
        });
      } else {
        console.log(`❌ No payrolls found for "${term}"`);
      }
    }
    
    // 3. ATTENDANCE TABLE
    console.log('\n📋 3. ATTENDANCE TABLE');
    console.log('-'.repeat(40));
    const Attendance = mongoose.model('Attendance');
    for (const term of searchTerms) {
      const attendances = await Attendance.find({
        $or: [
          { employeeId: term },
          { 'employee.employeeId': term }
        ]
      }).populate('employee', 'firstName lastName employeeId');
      
      if (attendances.length > 0) {
        console.log(`✅ Found ${attendances.length} attendance record(s) for "${term}":`);
        attendances.slice(0, 5).forEach(att => {
          const empName = att.employee ? `${att.employee.firstName} ${att.employee.lastName}` : 'Unknown';
          console.log(`   - ${empName} (Date: ${att.date}, MongoDB: ${att._id})`);
        });
        if (attendances.length > 5) {
          console.log(`   ... and ${attendances.length - 5} more records`);
        }
      } else {
        console.log(`❌ No attendance records found for "${term}"`);
      }
    }
    
    // 4. PAYSLIP TABLE
    console.log('\n📋 4. PAYSLIP TABLE');
    console.log('-'.repeat(40));
    const Payslip = mongoose.model('Payslip');
    for (const term of searchTerms) {
      const payslips = await Payslip.find({
        $or: [
          { employeeId: term },
          { 'employee.employeeId': term }
        ]
      }).populate('employee', 'firstName lastName employeeId');
      
      if (payslips.length > 0) {
        console.log(`✅ Found ${payslips.length} payslip(s) for "${term}":`);
        payslips.forEach(payslip => {
          const empName = payslip.employee ? `${payslip.employee.firstName} ${payslip.employee.lastName}` : 'Unknown';
          console.log(`   - ${empName} (Month: ${payslip.month}, Year: ${payslip.year}, MongoDB: ${payslip._id})`);
        });
      } else {
        console.log(`❌ No payslips found for "${term}"`);
      }
    }
    
    // 5. LOAN TABLE
    console.log('\n📋 5. LOAN TABLE');
    console.log('-'.repeat(40));
    const Loan = mongoose.model('Loan');
    for (const term of searchTerms) {
      const loans = await Loan.find({
        $or: [
          { employeeId: term },
          { 'employee.employeeId': term }
        ]
      }).populate('employee', 'firstName lastName employeeId');
      
      if (loans.length > 0) {
        console.log(`✅ Found ${loans.length} loan(s) for "${term}":`);
        loans.forEach(loan => {
          const empName = loan.employee ? `${loan.employee.firstName} ${loan.employee.lastName}` : 'Unknown';
          console.log(`   - ${empName} (Amount: ${loan.amount}, MongoDB: ${loan._id})`);
        });
      } else {
        console.log(`❌ No loans found for "${term}"`);
      }
    }
    
    // 6. FINAL SETTLEMENT TABLE
    console.log('\n📋 6. FINAL SETTLEMENT TABLE');
    console.log('-'.repeat(40));
    const FinalSettlement = mongoose.model('FinalSettlement');
    for (const term of searchTerms) {
      const settlements = await FinalSettlement.find({
        $or: [
          { employeeId: term },
          { 'employee.employeeId': term }
        ]
      }).populate('employee', 'firstName lastName employeeId');
      
      if (settlements.length > 0) {
        console.log(`✅ Found ${settlements.length} final settlement(s) for "${term}":`);
        settlements.forEach(settlement => {
          const empName = settlement.employee ? `${settlement.employee.firstName} ${settlement.employee.lastName}` : 'Unknown';
          console.log(`   - ${empName} (Date: ${settlement.settlementDate}, MongoDB: ${settlement._id})`);
        });
      } else {
        console.log(`❌ No final settlements found for "${term}"`);
      }
    }
    
    // 7. ENROLLMENT TABLE
    console.log('\n📋 7. ENROLLMENT TABLE');
    console.log('-'.repeat(40));
    const Enrollment = mongoose.model('Enrollment');
    for (const term of searchTerms) {
      const enrollments = await Enrollment.find({
        $or: [
          { employeeId: term },
          { 'employee.employeeId': term }
        ]
      }).populate('employee', 'firstName lastName employeeId');
      
      if (enrollments.length > 0) {
        console.log(`✅ Found ${enrollments.length} enrollment(s) for "${term}":`);
        enrollments.forEach(enrollment => {
          const empName = enrollment.employee ? `${enrollment.employee.firstName} ${enrollment.employee.lastName}` : 'Unknown';
          console.log(`   - ${empName} (Course: ${enrollment.course}, MongoDB: ${enrollment._id})`);
        });
      } else {
        console.log(`❌ No enrollments found for "${term}"`);
      }
    }
    
    // 8. USER TABLE
    console.log('\n📋 8. USER TABLE');
    console.log('-'.repeat(40));
    const User = mongoose.model('User');
    for (const term of searchTerms) {
      const users = await User.find({
        $or: [
          { username: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
          { employeeId: term }
        ]
      });
      
      if (users.length > 0) {
        console.log(`✅ Found ${users.length} user(s) for "${term}":`);
        users.forEach(user => {
          console.log(`   - ${user.username} (Email: ${user.email}, MongoDB: ${user._id})`);
        });
      } else {
        console.log(`❌ No users found for "${term}"`);
      }
    }
    
    // 9. SEARCH IN ALL COLLECTIONS (Generic search)
    console.log('\n📋 9. GENERIC SEARCH IN ALL COLLECTIONS');
    console.log('-'.repeat(40));
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in database`);
    
    for (const collection of collections) {
      const collectionName = collection.name;
      if (collectionName === 'system.indexes' || collectionName === 'system.profile') continue;
      
      try {
        const collectionObj = mongoose.connection.db.collection(collectionName);
        let found = false;
        
        for (const term of searchTerms) {
          const results = await collectionObj.find({
            $or: [
              { employeeId: term },
              { 'employee.employeeId': term },
              { employee: term },
              { name: { $regex: term, $options: 'i' } },
              { title: { $regex: term, $options: 'i' } },
              { description: { $regex: term, $options: 'i' } }
            ]
          }).limit(5).toArray();
          
          if (results.length > 0) {
            if (!found) {
              console.log(`\n   📁 Collection: ${collectionName}`);
              found = true;
            }
            console.log(`      ✅ Found ${results.length} record(s) for "${term}":`);
            results.forEach((result, index) => {
              console.log(`         ${index + 1}. MongoDB ID: ${result._id}`);
              if (result.name) console.log(`            Name: ${result.name}`);
              if (result.title) console.log(`            Title: ${result.title}`);
              if (result.employeeId) console.log(`            Employee ID: ${result.employeeId}`);
            });
          }
        }
      } catch (error) {
        // Skip collections that can't be queried
        continue;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 SEARCH COMPLETED');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

searchAllTables();
