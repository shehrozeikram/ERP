const mongoose = require('mongoose');
const JobPosting = require('../models/hr/JobPosting');
const Candidate = require('../models/hr/Candidate');
const Application = require('../models/hr/Application');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const Location = require('../models/hr/Location');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/sgc_erp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const createSampleTalentAcquisition = async () => {
  try {
    console.log('🎯 Creating sample Talent Acquisition data...');

    // Get existing data
    const departments = await Department.find();
    const positions = await Position.find();
    const locations = await Location.find();
    const users = await User.find();

    if (departments.length === 0 || positions.length === 0 || locations.length === 0 || users.length === 0) {
      console.log('❌ Please run createSampleDepartments.js, createSamplePositions.js, createSampleLocations.js, and createSampleUsers.js first');
      return;
    }

    const hrUser = users.find(user => user.role === 'hr_manager') || users[0];

    // Create sample job postings
    const jobPostings = [
      {
        jobCode: 'JOB2024001',
        title: 'Senior Software Engineer',
        department: departments.find(d => d.name === 'IT')?._id || departments[0]._id,
        position: positions.find(p => p.title === 'Software Engineer')?._id || positions[0]._id,
        location: locations.find(l => l.name === 'Karachi')?._id || locations[0]._id,
        description: 'We are looking for a Senior Software Engineer to join our dynamic team. You will be responsible for developing high-quality software solutions and mentoring junior developers.',
        requirements: '• 5+ years of experience in software development\n• Strong knowledge of JavaScript, React, Node.js\n• Experience with MongoDB and SQL databases\n• Excellent problem-solving skills\n• Strong communication and teamwork abilities',
        responsibilities: '• Design and develop scalable software solutions\n• Write clean, maintainable, and efficient code\n• Collaborate with cross-functional teams\n• Mentor junior developers\n• Participate in code reviews and technical discussions',
        qualifications: '• Bachelor\'s degree in Computer Science or related field\n• Experience with cloud platforms (AWS, Azure)\n• Knowledge of microservices architecture\n• Experience with CI/CD pipelines',
        employmentType: 'full_time',
        experienceLevel: 'senior',
        educationLevel: 'bachelors',
        salaryRange: {
          min: 150000,
          max: 250000,
          currency: 'PKR'
        },
        benefits: ['Health Insurance', 'Provident Fund', 'Annual Bonus', 'Professional Development'],
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        positionsAvailable: 2,
        tags: ['Software Development', 'React', 'Node.js', 'MongoDB'],
        keywords: ['javascript', 'react', 'nodejs', 'mongodb', 'software engineer'],
        status: 'published',
        createdBy: hrUser._id,
        approvedBy: hrUser._id,
        approvedAt: new Date(),
        publishedAt: new Date()
      },
      {
        jobCode: 'JOB2024002',
        title: 'HR Manager',
        department: departments.find(d => d.name === 'Human Resources')?._id || departments[0]._id,
        position: positions.find(p => p.title === 'HR Manager')?._id || positions[0]._id,
        location: locations.find(l => l.name === 'Lahore')?._id || locations[0]._id,
        description: 'We are seeking an experienced HR Manager to lead our human resources department and drive organizational success through effective people management.',
        requirements: '• 7+ years of experience in HR management\n• Strong knowledge of labor laws and regulations\n• Experience with HRIS systems\n• Excellent leadership and communication skills\n• Strategic thinking and problem-solving abilities',
        responsibilities: '• Develop and implement HR strategies and initiatives\n• Manage recruitment and selection processes\n• Oversee employee relations and performance management\n• Ensure compliance with labor laws and regulations\n• Lead organizational development initiatives',
        qualifications: '• Master\'s degree in Human Resources or related field\n• Professional HR certification (PHR, SPHR)\n• Experience in change management\n• Strong analytical and decision-making skills',
        employmentType: 'full_time',
        experienceLevel: 'manager',
        educationLevel: 'masters',
        salaryRange: {
          min: 200000,
          max: 350000,
          currency: 'PKR'
        },
        benefits: ['Health Insurance', 'Provident Fund', 'Annual Bonus', 'Professional Development', 'Car Allowance'],
        applicationDeadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        positionsAvailable: 1,
        tags: ['Human Resources', 'Management', 'Recruitment', 'Employee Relations'],
        keywords: ['hr', 'human resources', 'management', 'recruitment', 'employee relations'],
        status: 'published',
        createdBy: hrUser._id,
        approvedBy: hrUser._id,
        approvedAt: new Date(),
        publishedAt: new Date()
      },
      {
        jobCode: 'JOB2024003',
        title: 'Marketing Intern',
        department: departments.find(d => d.name === 'Marketing')?._id || departments[0]._id,
        position: positions.find(p => p.title === 'Marketing Specialist')?._id || positions[0]._id,
        location: locations.find(l => l.name === 'Islamabad')?._id || locations[0]._id,
        description: 'Join our marketing team as an intern and gain hands-on experience in digital marketing, content creation, and brand management.',
        requirements: '• Currently pursuing or completed degree in Marketing, Communications, or related field\n• Basic knowledge of digital marketing tools\n• Creative thinking and strong writing skills\n• Eager to learn and take initiative\n• Good organizational and time management skills',
        responsibilities: '• Assist with social media content creation and management\n• Support email marketing campaigns\n• Help with market research and competitor analysis\n• Assist with event planning and coordination\n• Support the marketing team with various projects',
        qualifications: '• Strong written and verbal communication skills\n• Basic knowledge of social media platforms\n• Proficiency in Microsoft Office suite\n• Creative mindset and attention to detail',
        employmentType: 'internship',
        experienceLevel: 'entry',
        educationLevel: 'bachelors',
        salaryRange: {
          min: 25000,
          max: 35000,
          currency: 'PKR'
        },
        benefits: ['Learning Opportunities', 'Mentorship', 'Flexible Hours', 'Certificate of Completion'],
        applicationDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        positionsAvailable: 3,
        tags: ['Marketing', 'Internship', 'Digital Marketing', 'Content Creation'],
        keywords: ['marketing', 'internship', 'digital marketing', 'content creation', 'social media'],
        status: 'draft',
        createdBy: hrUser._id
      }
    ];

    // Create job postings
    const createdJobPostings = [];
    for (const jobData of jobPostings) {
      const jobPosting = new JobPosting(jobData);
      await jobPosting.save();
      createdJobPostings.push(jobPosting);
      console.log(`✅ Created job posting: ${jobPosting.title}`);
    }

    // Create sample candidates
    const candidates = [
      {
        firstName: 'Ahmed',
        lastName: 'Khan',
        email: 'ahmed.khan@email.com',
        phone: '+92-300-1234567',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'male',
        nationality: 'Pakistani',
        address: {
          street: '123 Main Street',
          city: 'Karachi',
          state: 'Sindh',
          country: 'Pakistan',
          postalCode: '75000'
        },
        currentPosition: 'Software Engineer',
        currentCompany: 'Tech Solutions Ltd',
        yearsOfExperience: 6,
        expectedSalary: 180000,
        noticePeriod: 30,
        education: [
          {
            degree: 'Bachelor of Science',
            institution: 'NED University',
            field: 'Computer Science',
            graduationYear: 2014,
            gpa: 3.8
          }
        ],
        workExperience: [
          {
            company: 'Tech Solutions Ltd',
            position: 'Software Engineer',
            startDate: new Date('2018-01-01'),
            isCurrent: true,
            description: 'Developing web applications using React and Node.js'
          },
          {
            company: 'Digital Innovations',
            position: 'Junior Developer',
            startDate: new Date('2015-06-01'),
            endDate: new Date('2017-12-31'),
            description: 'Worked on various web development projects'
          }
        ],
        skills: [
          { name: 'JavaScript', level: 'expert', yearsOfExperience: 6 },
          { name: 'React', level: 'advanced', yearsOfExperience: 4 },
          { name: 'Node.js', level: 'advanced', yearsOfExperience: 4 },
          { name: 'MongoDB', level: 'intermediate', yearsOfExperience: 3 }
        ],
        languages: [
          { language: 'English', proficiency: 'fluent' },
          { language: 'Urdu', proficiency: 'native' }
        ],
        source: 'job_board',
        sourceDetails: 'LinkedIn',
        availability: '1_month',
        preferredWorkType: 'hybrid'
      },
      {
        firstName: 'Fatima',
        lastName: 'Ali',
        email: 'fatima.ali@email.com',
        phone: '+92-301-2345678',
        dateOfBirth: new Date('1988-12-20'),
        gender: 'female',
        nationality: 'Pakistani',
        address: {
          street: '456 Park Avenue',
          city: 'Lahore',
          state: 'Punjab',
          country: 'Pakistan',
          postalCode: '54000'
        },
        currentPosition: 'HR Specialist',
        currentCompany: 'Global Corp',
        yearsOfExperience: 8,
        expectedSalary: 250000,
        noticePeriod: 45,
        education: [
          {
            degree: 'Master of Business Administration',
            institution: 'LUMS',
            field: 'Human Resource Management',
            graduationYear: 2016,
            gpa: 3.9
          },
          {
            degree: 'Bachelor of Arts',
            institution: 'University of Punjab',
            field: 'Psychology',
            graduationYear: 2014,
            gpa: 3.7
          }
        ],
        workExperience: [
          {
            company: 'Global Corp',
            position: 'HR Specialist',
            startDate: new Date('2019-03-01'),
            isCurrent: true,
            description: 'Managing recruitment, employee relations, and HR policies'
          },
          {
            company: 'Enterprise Solutions',
            position: 'HR Coordinator',
            startDate: new Date('2016-08-01'),
            endDate: new Date('2019-02-28'),
            description: 'Coordinated HR activities and supported recruitment processes'
          }
        ],
        skills: [
          { name: 'Recruitment', level: 'expert', yearsOfExperience: 8 },
          { name: 'Employee Relations', level: 'advanced', yearsOfExperience: 6 },
          { name: 'HRIS Systems', level: 'intermediate', yearsOfExperience: 4 },
          { name: 'Performance Management', level: 'advanced', yearsOfExperience: 5 }
        ],
        languages: [
          { language: 'English', proficiency: 'fluent' },
          { language: 'Urdu', proficiency: 'native' }
        ],
        source: 'referral',
        sourceDetails: 'Employee referral from John Smith',
        availability: '2_months',
        preferredWorkType: 'on_site'
      },
      {
        firstName: 'Usman',
        lastName: 'Hassan',
        email: 'usman.hassan@email.com',
        phone: '+92-302-3456789',
        dateOfBirth: new Date('2000-08-10'),
        gender: 'male',
        nationality: 'Pakistani',
        address: {
          street: '789 University Road',
          city: 'Islamabad',
          state: 'Federal Territory',
          country: 'Pakistan',
          postalCode: '44000'
        },
        currentPosition: 'Student',
        currentCompany: 'FAST University',
        yearsOfExperience: 0,
        expectedSalary: 30000,
        noticePeriod: 0,
        education: [
          {
            degree: 'Bachelor of Science',
            institution: 'FAST University',
            field: 'Marketing',
            graduationYear: 2024,
            gpa: 3.6
          }
        ],
        workExperience: [],
        skills: [
          { name: 'Social Media Marketing', level: 'intermediate', yearsOfExperience: 1 },
          { name: 'Content Creation', level: 'beginner', yearsOfExperience: 1 },
          { name: 'Microsoft Office', level: 'intermediate', yearsOfExperience: 2 }
        ],
        languages: [
          { language: 'English', proficiency: 'conversational' },
          { language: 'Urdu', proficiency: 'native' }
        ],
        source: 'website',
        sourceDetails: 'Company website career page',
        availability: 'immediate',
        preferredWorkType: 'remote'
      }
    ];

    // Create candidates
    const createdCandidates = [];
    for (const candidateData of candidates) {
      const candidate = new Candidate(candidateData);
      await candidate.save();
      createdCandidates.push(candidate);
      console.log(`✅ Created candidate: ${candidate.fullName}`);
    }

    // Create sample applications
    const applications = [
      {
        applicationId: 'APP2024001',
        jobPosting: createdJobPostings[0]._id, // Senior Software Engineer
        candidate: createdCandidates[0]._id, // Ahmed Khan
        coverLetter: 'I am excited to apply for the Senior Software Engineer position. With 6 years of experience in web development and a strong background in React and Node.js, I believe I would be a great fit for your team.',
        expectedSalary: 180000,
        availability: '1_month',
        status: 'shortlisted',
        createdBy: hrUser._id
      },
      {
        applicationId: 'APP2024002',
        jobPosting: createdJobPostings[1]._id, // HR Manager
        candidate: createdCandidates[1]._id, // Fatima Ali
        coverLetter: 'I am applying for the HR Manager position with 8 years of experience in human resources. I have successfully managed recruitment processes and employee relations in my previous roles.',
        expectedSalary: 250000,
        availability: '2_months',
        status: 'interviewed',
        createdBy: hrUser._id
      },
      {
        applicationId: 'APP2024003',
        jobPosting: createdJobPostings[2]._id, // Marketing Intern
        candidate: createdCandidates[2]._id, // Usman Hassan
        coverLetter: 'As a recent marketing graduate, I am eager to start my career in marketing. I am passionate about digital marketing and would love to contribute to your team.',
        expectedSalary: 30000,
        availability: 'immediate',
        status: 'applied',
        createdBy: hrUser._id
      }
    ];

    // Create applications
    for (const applicationData of applications) {
      const application = new Application(applicationData);
      await application.save();
      console.log(`✅ Created application: ${application.applicationId}`);
    }

    console.log('🎉 Sample Talent Acquisition data created successfully!');
    console.log(`📊 Created ${createdJobPostings.length} job postings, ${createdCandidates.length} candidates, and ${applications.length} applications`);

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
  } finally {
    mongoose.connection.close();
  }
};

createSampleTalentAcquisition(); 