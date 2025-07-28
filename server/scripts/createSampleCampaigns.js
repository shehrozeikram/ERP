const mongoose = require('mongoose');
const Campaign = require('../models/crm/Campaign');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createSampleCampaigns = async () => {
  try {
    console.log('Creating sample campaigns...');

    // Get a user to assign campaigns to
    const users = await User.find().limit(3);
    if (users.length === 0) {
      console.log('No users found. Please create users first.');
      return;
    }

    const sampleCampaigns = [
      {
        name: 'Q4 Email Marketing Campaign',
        description: 'Targeted email campaign for existing customers to promote new products and services',
        type: 'Email',
        status: 'Active',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-12-31'),
        budget: 15000,
        currency: 'USD',
        targetAudience: 'Existing customers, decision makers, IT professionals',
        goals: 'Increase customer engagement, generate 500 qualified leads, achieve 15% conversion rate',
        expectedRevenue: 75000,
        actualRevenue: 45000,
        costPerLead: 30,
        conversionRate: 12.5,
        totalLeads: 500,
        qualifiedLeads: 62,
        assignedTo: users[0]._id,
        createdBy: users[0]._id,
        tags: ['email', 'q4', 'existing-customers'],
        channels: ['Email', 'Website'],
        metrics: {
          impressions: 25000,
          clicks: 1250,
          opens: 5000,
          responses: 250,
          meetings: 45,
          opportunities: 25,
          deals: 8
        }
      },
      {
        name: 'Social Media Brand Awareness',
        description: 'Social media campaign to increase brand visibility and reach new audiences',
        type: 'Social Media',
        status: 'Active',
        startDate: new Date('2024-11-01'),
        endDate: new Date('2025-01-31'),
        budget: 8000,
        currency: 'USD',
        targetAudience: 'Young professionals, tech enthusiasts, small business owners',
        goals: 'Increase brand awareness by 40%, gain 2000 new followers, generate 200 website visits',
        expectedRevenue: 25000,
        actualRevenue: 12000,
        costPerLead: 40,
        conversionRate: 8.2,
        totalLeads: 300,
        qualifiedLeads: 25,
        assignedTo: users[1]._id,
        createdBy: users[1]._id,
        tags: ['social-media', 'brand-awareness', 'b2b'],
        channels: ['Social Media', 'Website'],
        metrics: {
          impressions: 50000,
          clicks: 800,
          opens: 0,
          responses: 120,
          meetings: 20,
          opportunities: 12,
          deals: 3
        }
      },
      {
        name: 'Trade Show Exhibition 2024',
        description: 'Participation in major industry trade show to showcase products and generate leads',
        type: 'Event',
        status: 'Completed',
        startDate: new Date('2024-09-15'),
        endDate: new Date('2024-09-17'),
        budget: 25000,
        currency: 'USD',
        targetAudience: 'Industry professionals, potential partners, enterprise customers',
        goals: 'Generate 100 qualified leads, establish 10 new partnerships, achieve 25% conversion rate',
        expectedRevenue: 150000,
        actualRevenue: 180000,
        costPerLead: 250,
        conversionRate: 28.5,
        totalLeads: 100,
        qualifiedLeads: 28,
        assignedTo: users[2]._id,
        createdBy: users[2]._id,
        tags: ['trade-show', 'b2b', 'partnerships'],
        channels: ['Events', 'Direct Mail'],
        metrics: {
          impressions: 5000,
          clicks: 0,
          opens: 0,
          responses: 100,
          meetings: 45,
          opportunities: 35,
          deals: 10
        }
      },
      {
        name: 'Content Marketing Series',
        description: 'Educational content series to establish thought leadership and attract prospects',
        type: 'Content Marketing',
        status: 'Active',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2025-02-28'),
        budget: 12000,
        currency: 'USD',
        targetAudience: 'IT managers, CTOs, technology decision makers',
        goals: 'Publish 20 high-quality articles, generate 300 organic leads, improve SEO ranking',
        expectedRevenue: 60000,
        actualRevenue: 35000,
        costPerLead: 40,
        conversionRate: 15.8,
        totalLeads: 300,
        qualifiedLeads: 47,
        assignedTo: users[0]._id,
        createdBy: users[0]._id,
        tags: ['content-marketing', 'seo', 'thought-leadership'],
        channels: ['Content', 'Social Media', 'Website'],
        metrics: {
          impressions: 15000,
          clicks: 2000,
          opens: 0,
          responses: 300,
          meetings: 60,
          opportunities: 40,
          deals: 15
        }
      },
      {
        name: 'Referral Program Launch',
        description: 'Customer referral program to leverage existing relationships for new business',
        type: 'Referral Program',
        status: 'Draft',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-06-30'),
        budget: 5000,
        currency: 'USD',
        targetAudience: 'Existing satisfied customers, brand advocates',
        goals: 'Generate 50 referrals, achieve 30% conversion rate, increase customer loyalty',
        expectedRevenue: 75000,
        actualRevenue: 0,
        costPerLead: 100,
        conversionRate: 0,
        totalLeads: 0,
        qualifiedLeads: 0,
        assignedTo: users[1]._id,
        createdBy: users[1]._id,
        tags: ['referral', 'customer-loyalty', 'word-of-mouth'],
        channels: ['Email', 'Phone'],
        metrics: {
          impressions: 0,
          clicks: 0,
          opens: 0,
          responses: 0,
          meetings: 0,
          opportunities: 0,
          deals: 0
        }
      },
      {
        name: 'Paid Advertising Campaign',
        description: 'Google Ads and LinkedIn advertising to target specific keywords and audiences',
        type: 'Paid Advertising',
        status: 'Paused',
        startDate: new Date('2024-10-15'),
        endDate: new Date('2024-12-15'),
        budget: 20000,
        currency: 'USD',
        targetAudience: 'B2B decision makers, IT professionals, small to medium businesses',
        goals: 'Generate 400 qualified leads, achieve 10% conversion rate, maintain $50 cost per lead',
        expectedRevenue: 100000,
        actualRevenue: 65000,
        costPerLead: 50,
        conversionRate: 11.2,
        totalLeads: 400,
        qualifiedLeads: 45,
        assignedTo: users[2]._id,
        createdBy: users[2]._id,
        tags: ['paid-advertising', 'google-ads', 'linkedin'],
        channels: ['Advertising', 'Website'],
        metrics: {
          impressions: 100000,
          clicks: 2000,
          opens: 0,
          responses: 400,
          meetings: 80,
          opportunities: 50,
          deals: 18
        }
      }
    ];

    // Clear existing campaigns
    await Campaign.deleteMany({});
    console.log('Cleared existing campaigns');

    // Create new campaigns
    const createdCampaigns = await Campaign.insertMany(sampleCampaigns);
    console.log(`Created ${createdCampaigns.length} sample campaigns`);

    // Display created campaigns
    createdCampaigns.forEach(campaign => {
      console.log(`- ${campaign.name} (${campaign.status})`);
    });

    console.log('Sample campaigns created successfully!');
  } catch (error) {
    console.error('Error creating sample campaigns:', error);
  } finally {
    mongoose.connection.close();
  }
};

createSampleCampaigns(); 