const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { connectDB } = require('../config/database');

const KPITemplate = require('../models/hr/KPITemplate');
const KPICycle = require('../models/hr/KPICycle');
const KPIEvaluation = require('../models/hr/KPIEvaluation');
const Employee = require('../models/hr/Employee');
const User = require('../models/User');

const seedKPIs = async () => {
  try {
    console.log('Connecting to DB...');
    await connectDB();
    console.log('Connected to Database');

    // Clean up existing test data
    console.log('Cleaning up existing KPI test data...');
    await KPITemplate.deleteMany({ title: { $regex: /Test/i } });
    await KPICycle.deleteMany({ title: { $regex: /Test/i } });
    
    // Find some existing users/employees to attach data to
    const adminUser = await User.findOne({ role: 'admin' });
    const employees = await Employee.find().limit(3).populate('user');
    
    if (!adminUser || employees.length === 0) {
      console.log('Please ensure there are users and employees in the system before seeding KPIs.');
      process.exit(1);
    }

    console.log(`Found Admin: ${adminUser.firstName} ${adminUser.lastName}`);
    console.log(`Found ${employees.length} Employees to assign KPIs`);

    // 1. Create a Test Template
    const template = new KPITemplate({
      title: 'Annual Software Developer Review (Test)',
      description: 'Standard evaluation for software engineering team members',
      items: [
        {
          title: 'Code Quality',
          description: 'Writes clean, maintainable, and bug-free code.',
          measurementType: 'rating_1_to_5',
          weight: 40
        },
        {
          title: 'Project Delivery',
          description: 'Meets deadlines and delivers features according to specs.',
          measurementType: 'percentage',
          weight: 40
        },
        {
          title: 'Team Collaboration',
          description: 'Helps peers, communicates effectively, and participates in code reviews.',
          measurementType: 'rating_1_to_5',
          weight: 20
        }
      ],
      totalWeight: 100,
      createdBy: adminUser._id
    });

    await template.save();
    console.log('Created KPI Template: ' + template.title);

    // 2. Create an Evaluation Cycle
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const cycle = new KPICycle({
      title: 'Q1 2026 Performance Cycle (Test)',
      template: template._id,
      type: 'quarterly',
      period: {
        startDate: new Date(),
        endDate: nextMonth
      },
      status: 'active',
      employees: employees.map(emp => emp._id),
      createdBy: adminUser._id
    });

    await cycle.save();
    console.log('Created KPI Cycle: ' + cycle.title);

    // 3. Create Evaluations for Employees
    const evaluations = [];
    
    // Employee 1: Draft Status (They need to do self-assessment)
    evaluations.push({
      cycle: cycle._id,
      employee: employees[0]._id,
      template: template._id,
      kpiItems: template.items.map(item => ({
        templateItemId: item._id,
        title: item.title,
        description: item.description,
        weight: item.weight,
        measurementType: item.measurementType
      })),
      status: 'draft'
    });

    // Employee 2: Self Submitted Status (Manager needs to review)
    if (employees.length > 1) {
      evaluations.push({
        cycle: cycle._id,
        employee: employees[1]._id,
        template: template._id,
        kpiItems: template.items.map((item, index) => ({
          templateItemId: item._id,
          title: item.title,
          description: item.description,
          weight: item.weight,
          measurementType: item.measurementType,
          selfScore: index === 1 ? 85 : 4,
          selfComment: 'I worked really hard on this aspect and achieved my goals.'
        })),
        status: 'self_submitted'
      });
    }

    // Employee 3: Completed (Manager has already reviewed)
    if (employees.length > 2) {
      evaluations.push({
        cycle: cycle._id,
        employee: employees[2]._id,
        template: template._id,
        kpiItems: template.items.map((item, index) => ({
          templateItemId: item._id,
          title: item.title,
          description: item.description,
          weight: item.weight,
          measurementType: item.measurementType,
          selfScore: index === 1 ? 90 : 5,
          selfComment: 'Exceeded all expectations.',
          evaluatorScore: index === 1 ? 85 : 4,
          evaluatorComment: 'Good job, but room for slight improvement.'
        })),
        status: 'completed',
        evaluator: adminUser._id,
        hrRemarks: 'Great performance overall.',
        evaluationDate: new Date()
      });
    }

    await KPIEvaluation.deleteMany({ cycle: cycle._id }); // cleanup just in case
    await KPIEvaluation.insertMany(evaluations);
    
    console.log(`Generated ${evaluations.length} Evaluation drafts.`);
    console.log('\n--- Seeding Complete! ---');
    console.log('You can now log in and check:');
    console.log('1. /hr/kpi/templates - to see the generated template');
    console.log('2. /hr/kpi/cycles - to see the active cycle');
    console.log('3. /profile/kpis - (Login as an employee) to see Self-Assessment draft');
    console.log('4. /hr/kpi/review - to see pending manager reviews');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedKPIs();
