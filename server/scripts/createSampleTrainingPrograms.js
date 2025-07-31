const mongoose = require('mongoose');
const TrainingProgram = require('../models/hr/TrainingProgram');
const Course = require('../models/hr/Course');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Use an existing user ID for createdBy
const ADMIN_USER_ID = '6884f7fc1010ce455f3797e0'; // admin@sgc.com

async function createSampleTrainingPrograms() {
  try {
    console.log('🗑️ Clearing existing sample training programs...');
    await TrainingProgram.deleteMany({ title: { $in: ['Web Development Bootcamp', 'Leadership Excellence Program', 'Customer Service Mastery'] } });
    
    // Get existing courses to use in programs
    const courses = await Course.find({ status: 'published' }).limit(4);
    
    if (courses.length === 0) {
      console.log('❌ No published courses found. Please create some courses first.');
      return;
    }
    
    console.log(`📚 Found ${courses.length} courses to use in training programs`);
    
    const samplePrograms = [
      {
        title: 'Web Development Bootcamp',
        description: 'A comprehensive program covering modern web development technologies including HTML, CSS, JavaScript, and React.',
        shortDescription: 'Master modern web development with hands-on projects',
        type: 'skill_path',
        category: 'technical',
        difficulty: 'intermediate',
        objectives: [
          'Build responsive web applications',
          'Master JavaScript and React',
          'Understand modern development workflows',
          'Deploy applications to production'
        ],
        prerequisites: [
          'Basic computer literacy',
          'Familiarity with programming concepts'
        ],
        courses: courses.slice(0, 2).map((course, index) => ({
          course: course._id,
          order: index + 1,
          isRequired: true,
          estimatedDuration: course.duration
        })), // Use first 2 courses
        targetRoles: ['developer', 'designer'],
        targetDepartments: [],
        targetExperienceLevel: 'entry',
        completionCriteria: {
          allCoursesRequired: false,
          minimumScore: 75,
          timeLimit: 90
        },
        maxEnrollments: 50,
        providesCertificate: true,
        certificateTemplate: 'web-development-certificate',
        isActive: true,
        status: 'active',
        createdBy: ADMIN_USER_ID
      },
      {
        title: 'Leadership Excellence Program',
        description: 'Develop essential leadership skills including communication, team management, and strategic thinking.',
        shortDescription: 'Transform into an effective leader',
        type: 'leadership',
        category: 'leadership',
        difficulty: 'intermediate',
        objectives: [
          'Develop strong communication skills',
          'Master team management techniques',
          'Learn strategic decision making',
          'Build organizational leadership'
        ],
        prerequisites: [
          'Minimum 2 years work experience',
          'Team management experience preferred'
        ],
        courses: courses.slice(0, 1).map((course, index) => ({
          course: course._id,
          order: index + 1,
          isRequired: true,
          estimatedDuration: course.duration
        })), // Use first course
        targetRoles: ['manager', 'supervisor', 'team_lead'],
        targetDepartments: [],
        targetExperienceLevel: 'mid',
        completionCriteria: {
          allCoursesRequired: true,
          minimumScore: 80,
          timeLimit: 60
        },
        maxEnrollments: 30,
        providesCertificate: true,
        certificateTemplate: 'leadership-certificate',
        isActive: true,
        status: 'active',
        createdBy: ADMIN_USER_ID
      },
      {
        title: 'Customer Service Mastery',
        description: 'Learn the art of exceptional customer service and problem resolution.',
        shortDescription: 'Excel in customer service excellence',
        type: 'skill_path',
        category: 'customer_service',
        difficulty: 'beginner',
        objectives: [
          'Understand customer needs and expectations',
          'Master active listening techniques',
          'Learn effective problem resolution',
          'Handle difficult customer situations'
        ],
        prerequisites: [
          'Good communication skills',
          'Patience and empathy'
        ],
        courses: courses.slice(0, 1).map((course, index) => ({
          course: course._id,
          order: index + 1,
          isRequired: true,
          estimatedDuration: course.duration
        })), // Use first course
        targetRoles: ['customer_service', 'sales', 'support'],
        targetDepartments: [],
        targetExperienceLevel: 'entry',
        completionCriteria: {
          allCoursesRequired: true,
          minimumScore: 70,
          timeLimit: 45
        },
        maxEnrollments: 100,
        providesCertificate: true,
        certificateTemplate: 'customer-service-certificate',
        isActive: true,
        status: 'active',
        createdBy: ADMIN_USER_ID
      }
    ];

    console.log('📚 Creating sample training programs...');
    const createdPrograms = [];
    
    for (const programData of samplePrograms) {
      const program = new TrainingProgram(programData);
      await program.save();
      createdPrograms.push(program);
      console.log(`   ✅ Created: ${program.title} (${program.status}) - ${program.programId}`);
    }
    
    console.log(`\n✅ Successfully created ${createdPrograms.length} sample training programs!`);
    console.log('You can now test the training program functionality.');
    
  } catch (error) {
    console.error('❌ Error creating sample training programs:', error);
  } finally {
    mongoose.connection.close();
  }
}

createSampleTrainingPrograms(); 