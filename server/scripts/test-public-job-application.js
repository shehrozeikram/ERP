const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB } = require('../config/database');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');

async function testPublicJobApplication() {
  try {
    console.log('1. Connecting to database...');
    await connectDB();

    console.log('2. Finding active published JobPosting...');
    const jobPosting = await JobPosting.findOne({ status: 'published', isActive: true });
    if (!jobPosting) {
      console.error('❌ No published job posting found!');
      process.exit(1);
    }
    console.log(`Found job posting: "${jobPosting.title || 'Untitled'}" (ID: ${jobPosting._id}, affiliateCode: ${jobPosting.affiliateCode})`);

    const testEmail = `test.applicant.${Date.now()}@example.com`;
    const payload = {
      affiliateCode: jobPosting.affiliateCode,
      jobPostingId: jobPosting._id,
      candidateName: 'Test Applicant',
      email: testEmail,
      phone: '03001234567',
      applicationType: 'standard',
      personalInfo: {
        firstName: 'Test',
        lastName: 'Applicant',
        email: testEmail,
        phone: '03001234567',
        city: 'Islamabad',
        country: 'Pakistan'
      },
      professionalInfo: {
        currentPosition: 'Software Engineer',
        yearsOfExperience: '3'
      },
      education: {
        highestEducation: 'Bachelors'
      },
      skills: {
        technicalSkills: 'JavaScript, React, Node.js'
      }
    };

    console.log('3. Submitting application directly via backend application handler logic...');
    
    // Create application directly (storing applicant info inside application document)
    const application = new Application({
      jobPosting: jobPosting._id,
      affiliateCode: jobPosting.affiliateCode,
      applicationType: 'standard',
      personalInfo: payload.personalInfo,
      professionalInfo: payload.professionalInfo,
      education: payload.education,
      skills: payload.skills,
      status: 'applied',
      submittedAt: new Date(),
      source: 'Public'
    });

    await application.save();

    console.log('✅ TEST PASSED! Successfully created Application ID:', application._id);
    
    // Clean up test application record
    await Application.deleteOne({ _id: application._id });
    console.log('Cleaned up test application record.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err.message || err);
    process.exit(1);
  }
}

testPublicJobApplication();
