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

    console.log('3. Sending POST request to public application submission endpoint...');
    const baseUrl = process.env.TEST_API_URL || 'http://127.0.0.1:5001';
    const res = await axios.post(`${baseUrl}/api/applications/public/submit`, payload);

    console.log('Response Status:', res.status);
    console.log('Response Data:', res.data);

    if (res.data.success && res.data.data?.applicationId) {
      console.log('✅ TEST PASSED! Created Application ID:', res.data.data.applicationId);
      // Clean up test application
      await Application.deleteOne({ _id: res.data.data.applicationId });
      console.log('Cleaned up test application record.');
    } else {
      console.error('❌ TEST FAILED!', res.data);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testPublicJobApplication();
