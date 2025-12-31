require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/hr/Employee');
const Designation = require('../models/hr/Designation');

async function addEvaluator() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Search for employee with employeeId 04530 or name Raza Ali
    let employee = await Employee.findOne({
      $or: [
        { employeeId: '04530' },
        { employeeId: '4530' },
        { firstName: /raza/i, lastName: /ali/i }
      ]
    }).populate('placementDesignation', 'title');

    if (!employee) {
      console.log('Employee not found. Searching for similar names...');
      const similar = await Employee.find({
        $or: [
          { firstName: /raza/i },
          { lastName: /ali/i }
        ]
      }).select('employeeId firstName lastName').limit(10);
      
      if (similar.length > 0) {
        console.log('Found similar employees:');
        similar.forEach(emp => {
          console.log(`  - ${emp.employeeId}: ${emp.firstName} ${emp.lastName}`);
        });
      }
      console.log('\nPlease verify the employee ID and name.');
      process.exit(1);
    }

    console.log(`Found employee: ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
    console.log(`Current designation: ${employee.placementDesignation?.title || employee.designation || 'N/A'}`);

    // Check if designation already includes evaluator keywords
    const currentDesignation = (employee.placementDesignation?.title || employee.designation || '').toLowerCase();
    const evaluatorKeywords = [
      'director', 'assistant vice president', 'chairman steering committee',
      'sr manager', 'senior manager', 'manager', 'head of department', 'hod',
      'assistant manager', 'general manager', 'deputy manager', 'deputy director',
      'executive director', 'principal', 'principle', 'vice principal', 'vice principle',
      'chief executive officer', 'ceo', 'chief operating officer', 'coo',
      'p.s.o', 'pso', 'chief security officer', 'cso', 'program head',
      'sr architect', 'senior architect', 'supervisor'
    ];

    const isAlreadyEvaluator = evaluatorKeywords.some(keyword => 
      currentDesignation.includes(keyword)
    );

    if (isAlreadyEvaluator) {
      console.log('\n✓ Employee already has an evaluator-eligible designation.');
      console.log('They should already appear in the evaluator list.');
    } else {
      // Find or create a designation with "Manager" keyword
      let evaluatorDesignation = await Designation.findOne({
        title: /manager/i
      });

      if (!evaluatorDesignation) {
        // Create a new designation if none exists
        evaluatorDesignation = new Designation({
          title: 'Manager',
          description: 'Manager designation for evaluation purposes'
        });
        await evaluatorDesignation.save();
        console.log('\nCreated new designation: Manager');
      }

      // Update employee's designation
      employee.placementDesignation = evaluatorDesignation._id;
      await employee.save();

      console.log(`\n✓ Updated employee designation to: ${evaluatorDesignation.title}`);
      console.log('Employee should now appear in the evaluator list.');
    }

    // Verify employee is active
    if (employee.isActive !== true || employee.employmentStatus !== 'Active') {
      console.log('\n⚠ Warning: Employee is not active or employment status is not Active.');
      console.log(`  isActive: ${employee.isActive}`);
      console.log(`  employmentStatus: ${employee.employmentStatus}`);
      console.log('Employee must be active to appear in evaluator list.');
    }

    console.log('\n✓ Process completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

addEvaluator();

