const mongoose = require('mongoose');
const Course = require('../models/hr/Course');

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Use an existing user ID for createdBy
const ADMIN_USER_ID = '6884f7fc1010ce455f3797e0'; // admin@sgc.com

const sampleCourses = [
  {
    title: 'JavaScript Fundamentals',
    description: 'Learn the basics of JavaScript programming language',
    category: 'technical',
    difficulty: 'beginner',
    duration: 120, // 2 hours in minutes
    status: 'published',
    content: {
      overview: 'This course covers the fundamentals of JavaScript programming',
      objectives: [
        'Understand JavaScript syntax and structure',
        'Learn variables, data types, and operators',
        'Master functions and scope',
        'Work with arrays and objects'
      ],
      materials: [
        {
          title: 'Introduction to JavaScript',
          type: 'video',
          duration: 15,
          url: 'https://example.com/js-intro'
        },
        {
          title: 'Variables and Data Types',
          type: 'video',
          duration: 20,
          url: 'https://example.com/js-variables'
        }
      ]
    },
    assessment: {
      passingScore: 70,
      questions: [
        {
          question: 'What is JavaScript?',
          type: 'multiple_choice',
          options: ['A programming language', 'A markup language', 'A styling language'],
          correctAnswer: 0
        }
      ]
    },
    createdBy: ADMIN_USER_ID
  },
  {
    title: 'Leadership Skills',
    description: 'Develop essential leadership and management skills',
    category: 'leadership',
    difficulty: 'intermediate',
    duration: 180, // 3 hours in minutes
    status: 'published',
    content: {
      overview: 'This course helps you develop leadership skills for the workplace',
      objectives: [
        'Understand leadership principles',
        'Learn effective communication',
        'Master team management',
        'Develop decision-making skills'
      ],
      materials: [
        {
          title: 'Leadership Fundamentals',
          type: 'video',
          duration: 25,
          url: 'https://example.com/leadership-intro'
        },
        {
          title: 'Communication Skills',
          type: 'video',
          duration: 30,
          url: 'https://example.com/communication'
        }
      ]
    },
    assessment: {
      passingScore: 75,
      questions: [
        {
          question: 'What is the most important leadership skill?',
          type: 'multiple_choice',
          options: ['Communication', 'Technical skills', 'Time management'],
          correctAnswer: 0
        }
      ]
    },
    createdBy: ADMIN_USER_ID
  },
  {
    title: 'Customer Service Excellence',
    description: 'Master the art of exceptional customer service',
    category: 'customer_service',
    difficulty: 'beginner',
    duration: 90, // 1.5 hours in minutes
    status: 'published',
    content: {
      overview: 'Learn how to provide outstanding customer service',
      objectives: [
        'Understand customer needs',
        'Learn active listening',
        'Master problem-solving',
        'Handle difficult customers'
      ],
      materials: [
        {
          title: 'Customer Service Basics',
          type: 'video',
          duration: 20,
          url: 'https://example.com/cs-basics'
        },
        {
          title: 'Handling Complaints',
          type: 'video',
          duration: 25,
          url: 'https://example.com/complaints'
        }
      ]
    },
    assessment: {
      passingScore: 80,
      questions: [
        {
          question: 'What should you do first when a customer has a complaint?',
          type: 'multiple_choice',
          options: ['Listen actively', 'Offer a solution', 'Apologize immediately'],
          correctAnswer: 0
        }
      ]
    },
    createdBy: ADMIN_USER_ID
  },
  {
    title: 'Project Management Fundamentals',
    description: 'Learn the basics of project management',
    category: 'leadership',
    difficulty: 'intermediate',
    duration: 240, // 4 hours in minutes
    status: 'published',
    content: {
      overview: 'This course covers essential project management concepts',
      objectives: [
        'Understand project lifecycle',
        'Learn planning and scheduling',
        'Master resource management',
        'Track project progress'
      ],
      materials: [
        {
          title: 'Project Management Overview',
          type: 'video',
          duration: 30,
          url: 'https://example.com/pm-overview'
        },
        {
          title: 'Project Planning',
          type: 'video',
          duration: 35,
          url: 'https://example.com/planning'
        }
      ]
    },
    assessment: {
      passingScore: 70,
      questions: [
        {
          question: 'What is the first phase of project management?',
          type: 'multiple_choice',
          options: ['Planning', 'Initiation', 'Execution'],
          correctAnswer: 1
        }
      ]
    },
    createdBy: ADMIN_USER_ID
  }
];

async function createSampleCourses() {
  try {
    console.log('🗑️ Clearing all existing courses...');
    await Course.deleteMany({});
    
    console.log('📚 Creating sample courses...');
    const createdCourses = [];
    
    for (const courseData of sampleCourses) {
      const course = new Course(courseData);
      await course.save();
      createdCourses.push(course);
      console.log(`   ✅ Created: ${course.title} (${course.status}) - ${course.courseId}`);
    }
    
    console.log(`\n✅ Successfully created ${createdCourses.length} sample courses!`);
    
    console.log('\n🎉 Sample courses created successfully!');
    console.log('You can now test the enrollment functionality.');
    
  } catch (error) {
    console.error('❌ Error creating sample courses:', error);
  } finally {
    mongoose.connection.close();
  }
}

createSampleCourses(); 