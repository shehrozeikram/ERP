const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Import models
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');

// Sample positions data organized by department
const samplePositions = {
  'Human Resources': [
    {
      title: 'HR Director',
      level: 'Director',
      description: 'Oversee all HR operations and strategic planning',
      minSalary: 150000,
      maxSalary: 250000,
      requirements: [
        'Master\'s degree in HR or related field',
        '10+ years of HR experience',
        'Strong leadership skills',
        'Knowledge of labor laws and regulations'
      ],
      responsibilities: [
        'Develop HR strategies and policies',
        'Lead HR team and operations',
        'Manage employee relations',
        'Oversee recruitment and retention'
      ]
    },
    {
      title: 'HR Manager',
      level: 'Manager',
      description: 'Manage day-to-day HR operations and team',
      minSalary: 80000,
      maxSalary: 120000,
      requirements: [
        'Bachelor\'s degree in HR or related field',
        '5+ years of HR experience',
        'Excellent communication skills',
        'HR certification preferred'
      ],
      responsibilities: [
        'Manage recruitment processes',
        'Handle employee relations',
        'Oversee performance management',
        'Coordinate training programs'
      ]
    },
    {
      title: 'HR Specialist',
      level: 'Senior',
      description: 'Specialized HR functions and employee support',
      minSalary: 50000,
      maxSalary: 75000,
      requirements: [
        'Bachelor\'s degree in HR or related field',
        '3+ years of HR experience',
        'Strong organizational skills',
        'Knowledge of HRIS systems'
      ],
      responsibilities: [
        'Process employee benefits',
        'Maintain employee records',
        'Assist with recruitment',
        'Support HR initiatives'
      ]
    },
    {
      title: 'HR Coordinator',
      level: 'Mid',
      description: 'Coordinate HR activities and administrative tasks',
      minSalary: 35000,
      maxSalary: 50000,
      requirements: [
        'Bachelor\'s degree in HR or related field',
        '1-2 years of HR experience',
        'Strong administrative skills',
        'Proficiency in MS Office'
      ],
      responsibilities: [
        'Schedule interviews and meetings',
        'Maintain HR documentation',
        'Assist with onboarding',
        'Support HR projects'
      ]
    },
    {
      title: 'HR Assistant',
      level: 'Entry',
      description: 'Entry-level HR support and administrative tasks',
      minSalary: 25000,
      maxSalary: 35000,
      requirements: [
        'Bachelor\'s degree in HR or related field',
        'Strong communication skills',
        'Attention to detail',
        'Willingness to learn'
      ],
      responsibilities: [
        'Answer HR inquiries',
        'File and organize documents',
        'Assist with data entry',
        'Support HR team'
      ]
    }
  ],
  'Information Technology': [
    {
      title: 'CTO',
      level: 'Executive',
      description: 'Chief Technology Officer - Lead technology strategy',
      minSalary: 200000,
      maxSalary: 350000,
      requirements: [
        'Master\'s degree in Computer Science or related field',
        '15+ years of IT experience',
        'Strong strategic thinking',
        'Leadership experience'
      ],
      responsibilities: [
        'Develop technology strategy',
        'Lead IT department',
        'Oversee technology investments',
        'Ensure technology alignment with business goals'
      ]
    },
    {
      title: 'IT Director',
      level: 'Director',
      description: 'Direct IT operations and strategic planning',
      minSalary: 120000,
      maxSalary: 180000,
      requirements: [
        'Bachelor\'s degree in Computer Science or related field',
        '10+ years of IT experience',
        'Strong leadership skills',
        'Project management experience'
      ],
      responsibilities: [
        'Manage IT infrastructure',
        'Lead IT projects',
        'Oversee IT team',
        'Develop IT policies'
      ]
    },
    {
      title: 'Senior Software Engineer',
      level: 'Senior',
      description: 'Develop and maintain software applications',
      minSalary: 80000,
      maxSalary: 120000,
      requirements: [
        'Bachelor\'s degree in Computer Science or related field',
        '5+ years of software development experience',
        'Proficiency in multiple programming languages',
        'Experience with modern frameworks'
      ],
      responsibilities: [
        'Design and develop software',
        'Code review and mentoring',
        'Technical architecture decisions',
        'Collaborate with cross-functional teams'
      ]
    },
    {
      title: 'Software Developer',
      level: 'Mid',
      description: 'Develop software applications and features',
      minSalary: 50000,
      maxSalary: 80000,
      requirements: [
        'Bachelor\'s degree in Computer Science or related field',
        '2-4 years of development experience',
        'Proficiency in programming languages',
        'Understanding of software development lifecycle'
      ],
      responsibilities: [
        'Write clean, maintainable code',
        'Participate in code reviews',
        'Collaborate with team members',
        'Debug and fix issues'
      ]
    },
    {
      title: 'Junior Developer',
      level: 'Junior',
      description: 'Entry-level software development position',
      minSalary: 35000,
      maxSalary: 50000,
      requirements: [
        'Bachelor\'s degree in Computer Science or related field',
        'Basic programming knowledge',
        'Willingness to learn',
        'Strong problem-solving skills'
      ],
      responsibilities: [
        'Learn and apply programming concepts',
        'Assist with development tasks',
        'Participate in team meetings',
        'Contribute to code reviews'
      ]
    },
    {
      title: 'IT Support Specialist',
      level: 'Entry',
      description: 'Provide technical support to users',
      minSalary: 25000,
      maxSalary: 40000,
      requirements: [
        'Associate\'s degree in IT or related field',
        'Basic computer knowledge',
        'Good communication skills',
        'Customer service experience'
      ],
      responsibilities: [
        'Provide technical support',
        'Troubleshoot hardware/software issues',
        'Maintain IT equipment',
        'Assist with IT projects'
      ]
    }
  ],
  'Finance': [
    {
      title: 'CFO',
      level: 'Executive',
      description: 'Chief Financial Officer - Lead financial strategy',
      minSalary: 180000,
      maxSalary: 300000,
      requirements: [
        'Master\'s degree in Finance, Accounting, or MBA',
        '15+ years of finance experience',
        'CPA or CFA certification',
        'Strong leadership skills'
      ],
      responsibilities: [
        'Develop financial strategy',
        'Oversee financial operations',
        'Manage investor relations',
        'Ensure financial compliance'
      ]
    },
    {
      title: 'Finance Director',
      level: 'Director',
      description: 'Direct financial operations and planning',
      minSalary: 100000,
      maxSalary: 150000,
      requirements: [
        'Bachelor\'s degree in Finance or Accounting',
        '10+ years of finance experience',
        'CPA certification preferred',
        'Strong analytical skills'
      ],
      responsibilities: [
        'Manage financial planning',
        'Oversee accounting operations',
        'Lead financial analysis',
        'Develop financial policies'
      ]
    },
    {
      title: 'Senior Accountant',
      level: 'Senior',
      description: 'Handle complex accounting tasks and analysis',
      minSalary: 60000,
      maxSalary: 90000,
      requirements: [
        'Bachelor\'s degree in Accounting',
        '5+ years of accounting experience',
        'CPA certification preferred',
        'Strong analytical skills'
      ],
      responsibilities: [
        'Prepare financial statements',
        'Conduct financial analysis',
        'Mentor junior accountants',
        'Ensure compliance with regulations'
      ]
    },
    {
      title: 'Accountant',
      level: 'Mid',
      description: 'Handle day-to-day accounting operations',
      minSalary: 40000,
      maxSalary: 60000,
      requirements: [
        'Bachelor\'s degree in Accounting',
        '2-4 years of accounting experience',
        'Knowledge of accounting principles',
        'Proficiency in accounting software'
      ],
      responsibilities: [
        'Process financial transactions',
        'Prepare journal entries',
        'Reconcile accounts',
        'Assist with financial reporting'
      ]
    },
    {
      title: 'Accounts Payable Specialist',
      level: 'Junior',
      description: 'Handle accounts payable operations',
      minSalary: 30000,
      maxSalary: 45000,
      requirements: [
        'Associate\'s degree in Accounting or related field',
        '1-2 years of accounting experience',
        'Attention to detail',
        'Good organizational skills'
      ],
      responsibilities: [
        'Process vendor invoices',
        'Maintain vendor records',
        'Reconcile vendor statements',
        'Assist with month-end closing'
      ]
    },
    {
      title: 'Finance Intern',
      level: 'Entry',
      description: 'Entry-level finance position for learning',
      minSalary: 20000,
      maxSalary: 30000,
      requirements: [
        'Currently pursuing degree in Finance or Accounting',
        'Strong academic record',
        'Willingness to learn',
        'Basic Excel skills'
      ],
      responsibilities: [
        'Assist with data entry',
        'Support financial analysis',
        'Learn accounting processes',
        'Participate in team projects'
      ]
    }
  ],
  'Marketing': [
    {
      title: 'Marketing Director',
      level: 'Director',
      description: 'Lead marketing strategy and operations',
      minSalary: 90000,
      maxSalary: 140000,
      requirements: [
        'Bachelor\'s degree in Marketing or related field',
        '10+ years of marketing experience',
        'Strong leadership skills',
        'Digital marketing expertise'
      ],
      responsibilities: [
        'Develop marketing strategies',
        'Lead marketing campaigns',
        'Manage marketing budget',
        'Oversee brand management'
      ]
    },
    {
      title: 'Senior Marketing Manager',
      level: 'Senior',
      description: 'Manage marketing campaigns and initiatives',
      minSalary: 60000,
      maxSalary: 90000,
      requirements: [
        'Bachelor\'s degree in Marketing or related field',
        '5+ years of marketing experience',
        'Campaign management experience',
        'Analytical skills'
      ],
      responsibilities: [
        'Plan and execute campaigns',
        'Analyze marketing performance',
        'Manage marketing team',
        'Collaborate with sales team'
      ]
    },
    {
      title: 'Marketing Specialist',
      level: 'Mid',
      description: 'Specialized marketing functions and campaigns',
      minSalary: 40000,
      maxSalary: 60000,
      requirements: [
        'Bachelor\'s degree in Marketing or related field',
        '2-4 years of marketing experience',
        'Digital marketing skills',
        'Creative thinking'
      ],
      responsibilities: [
        'Create marketing content',
        'Manage social media',
        'Conduct market research',
        'Support campaign execution'
      ]
    },
    {
      title: 'Content Creator',
      level: 'Junior',
      description: 'Create engaging content for marketing campaigns',
      minSalary: 30000,
      maxSalary: 45000,
      requirements: [
        'Bachelor\'s degree in Marketing, Communications, or related field',
        '1-2 years of content creation experience',
        'Strong writing skills',
        'Creative mindset'
      ],
      responsibilities: [
        'Write marketing copy',
        'Create social media content',
        'Design marketing materials',
        'Collaborate with design team'
      ]
    },
    {
      title: 'Marketing Assistant',
      level: 'Entry',
      description: 'Support marketing operations and campaigns',
      minSalary: 25000,
      maxSalary: 35000,
      requirements: [
        'Bachelor\'s degree in Marketing or related field',
        'Strong communication skills',
        'Basic marketing knowledge',
        'Willingness to learn'
      ],
      responsibilities: [
        'Assist with campaign coordination',
        'Maintain marketing databases',
        'Support event planning',
        'Help with administrative tasks'
      ]
    }
  ],
  'Sales': [
    {
      title: 'Sales Director',
      level: 'Director',
      description: 'Lead sales strategy and operations',
      minSalary: 100000,
      maxSalary: 160000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '10+ years of sales experience',
        'Strong leadership skills',
        'Proven track record'
      ],
      responsibilities: [
        'Develop sales strategies',
        'Lead sales team',
        'Manage key accounts',
        'Oversee sales operations'
      ]
    },
    {
      title: 'Senior Sales Manager',
      level: 'Senior',
      description: 'Manage sales team and key accounts',
      minSalary: 70000,
      maxSalary: 100000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '5+ years of sales experience',
        'Team management experience',
        'Strong negotiation skills'
      ],
      responsibilities: [
        'Manage sales team',
        'Develop sales plans',
        'Handle key accounts',
        'Analyze sales performance'
      ]
    },
    {
      title: 'Sales Representative',
      level: 'Mid',
      description: 'Generate sales and manage customer relationships',
      minSalary: 40000,
      maxSalary: 70000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '2-4 years of sales experience',
        'Strong communication skills',
        'Customer service orientation'
      ],
      responsibilities: [
        'Generate new business',
        'Maintain customer relationships',
        'Present products/services',
        'Meet sales targets'
      ]
    },
    {
      title: 'Junior Sales Representative',
      level: 'Junior',
      description: 'Entry-level sales position with growth potential',
      minSalary: 30000,
      maxSalary: 45000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '1-2 years of sales experience',
        'Strong communication skills',
        'Motivated and goal-oriented'
      ],
      responsibilities: [
        'Learn sales processes',
        'Support senior sales team',
        'Generate leads',
        'Assist with customer service'
      ]
    },
    {
      title: 'Sales Intern',
      level: 'Entry',
      description: 'Learning position in sales operations',
      minSalary: 20000,
      maxSalary: 30000,
      requirements: [
        'Currently pursuing degree in Business or related field',
        'Strong communication skills',
        'Willingness to learn',
        'Customer service experience'
      ],
      responsibilities: [
        'Shadow sales team',
        'Assist with lead generation',
        'Support sales operations',
        'Learn sales techniques'
      ]
    }
  ],
  'Operations': [
    {
      title: 'Operations Director',
      level: 'Director',
      description: 'Lead operations strategy and efficiency',
      minSalary: 90000,
      maxSalary: 140000,
      requirements: [
        'Bachelor\'s degree in Business, Operations, or related field',
        '10+ years of operations experience',
        'Strong leadership skills',
        'Process improvement expertise'
      ],
      responsibilities: [
        'Develop operations strategy',
        'Optimize processes',
        'Manage operations team',
        'Ensure quality standards'
      ]
    },
    {
      title: 'Operations Manager',
      level: 'Manager',
      description: 'Manage day-to-day operations and processes',
      minSalary: 60000,
      maxSalary: 90000,
      requirements: [
        'Bachelor\'s degree in Business, Operations, or related field',
        '5+ years of operations experience',
        'Strong organizational skills',
        'Problem-solving abilities'
      ],
      responsibilities: [
        'Manage daily operations',
        'Optimize workflows',
        'Lead operations team',
        'Monitor performance metrics'
      ]
    },
    {
      title: 'Senior Operations Specialist',
      level: 'Senior',
      description: 'Specialized operations functions and process improvement',
      minSalary: 45000,
      maxSalary: 65000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '3-5 years of operations experience',
        'Process improvement skills',
        'Analytical thinking'
      ],
      responsibilities: [
        'Analyze operations data',
        'Implement process improvements',
        'Train team members',
        'Support operations projects'
      ]
    },
    {
      title: 'Operations Coordinator',
      level: 'Mid',
      description: 'Coordinate operations activities and logistics',
      minSalary: 35000,
      maxSalary: 50000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '2-3 years of operations experience',
        'Strong coordination skills',
        'Attention to detail'
      ],
      responsibilities: [
        'Coordinate daily operations',
        'Manage logistics',
        'Track performance metrics',
        'Support team activities'
      ]
    },
    {
      title: 'Operations Assistant',
      level: 'Entry',
      description: 'Support operations team and administrative tasks',
      minSalary: 25000,
      maxSalary: 35000,
      requirements: [
        'Associate\'s degree in Business or related field',
        'Strong organizational skills',
        'Basic computer skills',
        'Willingness to learn'
      ],
      responsibilities: [
        'Support operations team',
        'Maintain records',
        'Assist with data entry',
        'Help with administrative tasks'
      ]
    }
  ],
  'Procurement': [
    {
      title: 'Procurement Director',
      level: 'Director',
      description: 'Lead procurement strategy and operations',
      minSalary: 90000,
      maxSalary: 140000,
      requirements: [
        'Bachelor\'s degree in Supply Chain, Business, or related field',
        '10+ years of procurement experience',
        'Strong leadership skills',
        'Negotiation expertise'
      ],
      responsibilities: [
        'Develop procurement strategy',
        'Lead procurement team',
        'Manage supplier relationships',
        'Optimize procurement processes'
      ]
    },
    {
      title: 'Procurement Manager',
      level: 'Manager',
      description: 'Manage procurement operations and supplier relationships',
      minSalary: 60000,
      maxSalary: 90000,
      requirements: [
        'Bachelor\'s degree in Supply Chain, Business, or related field',
        '5+ years of procurement experience',
        'Strong negotiation skills',
        'Supplier management experience'
      ],
      responsibilities: [
        'Manage procurement processes',
        'Negotiate contracts',
        'Manage supplier relationships',
        'Monitor procurement performance'
      ]
    },
    {
      title: 'Senior Procurement Specialist',
      level: 'Senior',
      description: 'Specialized procurement functions and strategic sourcing',
      minSalary: 45000,
      maxSalary: 65000,
      requirements: [
        'Bachelor\'s degree in Supply Chain or related field',
        '3-5 years of procurement experience',
        'Strategic sourcing skills',
        'Contract management experience'
      ],
      responsibilities: [
        'Conduct strategic sourcing',
        'Manage contracts',
        'Analyze supplier performance',
        'Support procurement projects'
      ]
    },
    {
      title: 'Procurement Coordinator',
      level: 'Mid',
      description: 'Coordinate procurement activities and processes',
      minSalary: 35000,
      maxSalary: 50000,
      requirements: [
        'Bachelor\'s degree in Supply Chain or related field',
        '2-3 years of procurement experience',
        'Strong organizational skills',
        'Attention to detail'
      ],
      responsibilities: [
        'Coordinate procurement activities',
        'Process purchase orders',
        'Track procurement metrics',
        'Support supplier management'
      ]
    },
    {
      title: 'Procurement Assistant',
      level: 'Entry',
      description: 'Support procurement team and administrative tasks',
      minSalary: 25000,
      maxSalary: 35000,
      requirements: [
        'Associate\'s degree in Supply Chain or related field',
        'Strong organizational skills',
        'Basic computer skills',
        'Willingness to learn'
      ],
      responsibilities: [
        'Support procurement team',
        'Maintain procurement records',
        'Assist with data entry',
        'Help with administrative tasks'
      ]
    }
  ],
  'CRM': [
    {
      title: 'CRM Director',
      level: 'Director',
      description: 'Lead CRM strategy and customer experience',
      minSalary: 90000,
      maxSalary: 140000,
      requirements: [
        'Bachelor\'s degree in Business, Marketing, or related field',
        '10+ years of CRM experience',
        'Strong leadership skills',
        'Customer experience expertise'
      ],
      responsibilities: [
        'Develop CRM strategy',
        'Lead CRM team',
        'Optimize customer experience',
        'Manage CRM systems'
      ]
    },
    {
      title: 'CRM Manager',
      level: 'Manager',
      description: 'Manage CRM operations and customer relationships',
      minSalary: 60000,
      maxSalary: 90000,
      requirements: [
        'Bachelor\'s degree in Business, Marketing, or related field',
        '5+ years of CRM experience',
        'Strong analytical skills',
        'CRM system expertise'
      ],
      responsibilities: [
        'Manage CRM operations',
        'Analyze customer data',
        'Lead CRM team',
        'Optimize customer processes'
      ]
    },
    {
      title: 'Senior CRM Specialist',
      level: 'Senior',
      description: 'Specialized CRM functions and customer analytics',
      minSalary: 45000,
      maxSalary: 65000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '3-5 years of CRM experience',
        'Data analysis skills',
        'CRM system knowledge'
      ],
      responsibilities: [
        'Analyze customer data',
        'Manage CRM campaigns',
        'Support customer initiatives',
        'Train team members'
      ]
    },
    {
      title: 'CRM Coordinator',
      level: 'Mid',
      description: 'Coordinate CRM activities and customer support',
      minSalary: 35000,
      maxSalary: 50000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '2-3 years of CRM experience',
        'Strong communication skills',
        'Customer service orientation'
      ],
      responsibilities: [
        'Coordinate CRM activities',
        'Support customer inquiries',
        'Maintain customer records',
        'Assist with CRM projects'
      ]
    },
    {
      title: 'CRM Assistant',
      level: 'Entry',
      description: 'Support CRM team and customer service tasks',
      minSalary: 25000,
      maxSalary: 35000,
      requirements: [
        'Associate\'s degree in Business or related field',
        'Strong communication skills',
        'Customer service experience',
        'Willingness to learn'
      ],
      responsibilities: [
        'Support CRM team',
        'Handle customer inquiries',
        'Maintain customer data',
        'Help with administrative tasks'
      ]
    }
  ],
  'TxyCo': [
    {
      title: 'General Manager',
      level: 'Manager',
      description: 'General management position for TxyCo department',
      minSalary: 60000,
      maxSalary: 90000,
      requirements: [
        'Bachelor\'s degree in Business or related field',
        '5+ years of management experience',
        'Strong leadership skills',
        'Problem-solving abilities'
      ],
      responsibilities: [
        'Manage department operations',
        'Lead team members',
        'Coordinate with other departments',
        'Ensure department goals are met'
      ]
    },
    {
      title: 'Senior Specialist',
      level: 'Senior',
      description: 'Senior specialist role in TxyCo department',
      minSalary: 45000,
      maxSalary: 65000,
      requirements: [
        'Bachelor\'s degree in related field',
        '3-5 years of experience',
        'Specialized knowledge',
        'Analytical skills'
      ],
      responsibilities: [
        'Provide specialized expertise',
        'Support department projects',
        'Train junior staff',
        'Analyze department data'
      ]
    },
    {
      title: 'Coordinator',
      level: 'Mid',
      description: 'Coordinate activities in TxyCo department',
      minSalary: 35000,
      maxSalary: 50000,
      requirements: [
        'Bachelor\'s degree in related field',
        '2-3 years of experience',
        'Strong organizational skills',
        'Communication abilities'
      ],
      responsibilities: [
        'Coordinate department activities',
        'Maintain records',
        'Support team members',
        'Assist with projects'
      ]
    },
    {
      title: 'Assistant',
      level: 'Entry',
      description: 'Entry-level position in TxyCo department',
      minSalary: 25000,
      maxSalary: 35000,
      requirements: [
        'Associate\'s degree or equivalent',
        'Strong work ethic',
        'Willingness to learn',
        'Basic computer skills'
      ],
      responsibilities: [
        'Support department operations',
        'Assist with administrative tasks',
        'Learn department processes',
        'Help team members as needed'
      ]
    }
  ]
};

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Function to create positions
async function createSamplePositions() {
  try {
    console.log('🚀 Starting to create sample positions...');

    // Get all departments
    const departments = await Department.find({ isActive: true });
    console.log(`📋 Found ${departments.length} departments`);

    let totalPositionsCreated = 0;

    // Create positions for each department
    for (const department of departments) {
      const departmentName = department.name;
      const positions = samplePositions[departmentName];

      if (positions) {
        console.log(`\n🏢 Creating positions for ${departmentName}...`);

        for (const positionData of positions) {
          // Check if position already exists
          const existingPosition = await Position.findOne({
            title: positionData.title,
            department: department._id
          });

          if (existingPosition) {
            console.log(`   ⚠️  Position "${positionData.title}" already exists for ${departmentName}`);
            continue;
          }

          // Create new position
          const position = new Position({
            ...positionData,
            department: department._id
          });

          await position.save();
          console.log(`   ✅ Created: ${positionData.title} (${positionData.level})`);
          totalPositionsCreated++;
        }
      } else {
        console.log(`\n⚠️  No sample positions found for department: ${departmentName}`);
      }
    }

    console.log(`\n🎉 Successfully created ${totalPositionsCreated} new positions!`);
    
    // Display summary
    const allPositions = await Position.find({ isActive: true }).populate('department', 'name');
    console.log('\n📊 Position Summary:');
    
    const summary = {};
    allPositions.forEach(pos => {
      const deptName = pos.department.name;
      if (!summary[deptName]) summary[deptName] = 0;
      summary[deptName]++;
    });

    Object.entries(summary).forEach(([dept, count]) => {
      console.log(`   ${dept}: ${count} positions`);
    });

  } catch (error) {
    console.error('❌ Error creating sample positions:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
createSamplePositions(); 