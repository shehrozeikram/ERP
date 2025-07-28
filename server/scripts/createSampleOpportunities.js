const mongoose = require('mongoose');
const Opportunity = require('../models/crm/Opportunity');
const Company = require('../models/crm/Company');
const Contact = require('../models/crm/Contact');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const createSampleOpportunities = async () => {
  try {
    console.log('Creating sample opportunities...');

    // Get users, companies, and contacts to assign opportunities to
    const users = await User.find().limit(3);
    const companies = await Company.find().limit(5);
    const contacts = await Contact.find().limit(5);

    if (users.length === 0) {
      console.log('No users found. Please create users first.');
      return;
    }

    if (companies.length === 0) {
      console.log('No companies found. Please create companies first.');
      return;
    }

    if (contacts.length === 0) {
      console.log('No contacts found. Please create contacts first.');
      return;
    }

    const sampleOpportunities = [
      {
        title: 'Enterprise Software License Renewal',
        description: 'Annual software license renewal for enterprise client with potential for additional modules',
        stage: 'Negotiation',
        probability: 85,
        amount: 125000,
        currency: 'USD',
        expectedCloseDate: new Date('2024-12-15'),
        source: 'Existing Business',
        priority: 'High',
        type: 'Renewal',
        company: companies[0]._id,
        contact: contacts[0]._id,
        assignedTo: users[0]._id,
        createdBy: users[0]._id,
        competitors: [
          {
            name: 'Competitor A',
            strength: 'Medium',
            notes: 'Strong technical features but higher pricing'
          }
        ],
        products: [
          {
            name: 'Enterprise License',
            quantity: 1,
            unitPrice: 100000,
            discount: 0,
            totalPrice: 100000
          },
          {
            name: 'Advanced Analytics Module',
            quantity: 1,
            unitPrice: 25000,
            discount: 0,
            totalPrice: 25000
          }
        ],
        activities: [
          {
            type: 'Meeting',
            subject: 'Contract Review Meeting',
            description: 'Discussed renewal terms and additional modules',
            date: new Date('2024-11-20'),
            duration: 60,
            outcome: 'Positive discussion, client interested in analytics module',
            createdBy: users[0]._id
          }
        ],
        notes: [
          {
            content: 'Client is very satisfied with current solution and likely to renew',
            createdBy: users[0]._id
          }
        ],
        tags: ['enterprise', 'renewal', 'high-value']
      },
      {
        title: 'New Client Implementation Project',
        description: 'Complete implementation of our solution for a new mid-market client',
        stage: 'Proposal',
        probability: 60,
        amount: 75000,
        currency: 'USD',
        expectedCloseDate: new Date('2025-01-31'),
        source: 'Website',
        priority: 'Medium',
        type: 'New Business',
        company: companies[1]._id,
        contact: contacts[1]._id,
        assignedTo: users[1]._id,
        createdBy: users[1]._id,
        competitors: [
          {
            name: 'Competitor B',
            strength: 'Strong',
            notes: 'Lower pricing but less comprehensive solution'
          }
        ],
        products: [
          {
            name: 'Standard License',
            quantity: 1,
            unitPrice: 50000,
            discount: 10,
            totalPrice: 45000
          },
          {
            name: 'Implementation Services',
            quantity: 1,
            unitPrice: 30000,
            discount: 0,
            totalPrice: 30000
          }
        ],
        activities: [
          {
            type: 'Demo',
            subject: 'Product Demonstration',
            description: 'Comprehensive demo of all features and capabilities',
            date: new Date('2024-11-15'),
            duration: 90,
            outcome: 'Client impressed with features, requested proposal',
            createdBy: users[1]._id
          }
        ],
        notes: [
          {
            content: 'Client has budget approved and timeline is flexible',
            createdBy: users[1]._id
          }
        ],
        tags: ['new-business', 'implementation', 'mid-market']
      },
      {
        title: 'Upsell Additional Modules',
        description: 'Upselling additional modules to existing satisfied customer',
        stage: 'Qualification',
        probability: 75,
        amount: 45000,
        currency: 'USD',
        expectedCloseDate: new Date('2025-02-28'),
        source: 'Existing Business',
        priority: 'Medium',
        type: 'Upsell',
        company: companies[2]._id,
        contact: contacts[2]._id,
        assignedTo: users[2]._id,
        createdBy: users[2]._id,
        products: [
          {
            name: 'Reporting Module',
            quantity: 1,
            unitPrice: 25000,
            discount: 20,
            totalPrice: 20000
          },
          {
            name: 'Integration Module',
            quantity: 1,
            unitPrice: 25000,
            discount: 0,
            totalPrice: 25000
          }
        ],
        activities: [
          {
            type: 'Call',
            subject: 'Follow-up on Module Interest',
            description: 'Discussed additional modules and pricing options',
            date: new Date('2024-11-25'),
            duration: 30,
            outcome: 'Client interested in reporting and integration modules',
            createdBy: users[2]._id
          }
        ],
        notes: [
          {
            content: 'Client has been using our solution for 2 years and is very satisfied',
            createdBy: users[2]._id
          }
        ],
        tags: ['upsell', 'existing-customer', 'modules']
      },
      {
        title: 'Government Contract Bid',
        description: 'Bidding on government contract for software solution',
        stage: 'Prospecting',
        probability: 25,
        amount: 500000,
        currency: 'USD',
        expectedCloseDate: new Date('2025-06-30'),
        source: 'Advertisement',
        priority: 'Urgent',
        type: 'New Business',
        company: companies[3]._id,
        contact: contacts[3]._id,
        assignedTo: users[0]._id,
        createdBy: users[0]._id,
        competitors: [
          {
            name: 'Large Enterprise Vendor',
            strength: 'Strong',
            notes: 'Has existing government contracts and relationships'
          },
          {
            name: 'Startup Competitor',
            strength: 'Weak',
            notes: 'Innovative solution but lacks experience'
          }
        ],
        products: [
          {
            name: 'Government Edition License',
            quantity: 1,
            unitPrice: 300000,
            discount: 0,
            totalPrice: 300000
          },
          {
            name: 'Custom Development',
            quantity: 1,
            unitPrice: 200000,
            discount: 0,
            totalPrice: 200000
          }
        ],
        activities: [
          {
            type: 'Meeting',
            subject: 'Initial Government Meeting',
            description: 'Initial meeting to understand requirements and timeline',
            date: new Date('2024-12-01'),
            duration: 120,
            outcome: 'Requirements clarified, RFP expected in January',
            createdBy: users[0]._id
          }
        ],
        notes: [
          {
            content: 'This is a high-value opportunity but with long sales cycle and strong competition',
            createdBy: users[0]._id
          }
        ],
        tags: ['government', 'high-value', 'long-cycle']
      },
      {
        title: 'SaaS Subscription Expansion',
        description: 'Expanding SaaS subscription for growing startup client',
        stage: 'Closed Won',
        probability: 100,
        amount: 35000,
        currency: 'USD',
        expectedCloseDate: new Date('2024-11-30'),
        actualCloseDate: new Date('2024-11-28'),
        closeReason: 'Client expanding operations and needs additional licenses',
        source: 'Existing Business',
        priority: 'Medium',
        type: 'Upsell',
        company: companies[4]._id,
        contact: contacts[4]._id,
        assignedTo: users[1]._id,
        createdBy: users[1]._id,
        products: [
          {
            name: 'Additional User Licenses',
            quantity: 50,
            unitPrice: 500,
            discount: 15,
            totalPrice: 21250
          },
          {
            name: 'Premium Support',
            quantity: 1,
            unitPrice: 13750,
            discount: 0,
            totalPrice: 13750
          }
        ],
        activities: [
          {
            type: 'Meeting',
            subject: 'Contract Signing',
            description: 'Final contract review and signing',
            date: new Date('2024-11-28'),
            duration: 45,
            outcome: 'Contract signed, deal closed successfully',
            createdBy: users[1]._id
          }
        ],
        notes: [
          {
            content: 'Client is growing rapidly and will likely need more licenses in 6 months',
            createdBy: users[1]._id
          }
        ],
        tags: ['closed-won', 'saas', 'expansion']
      },
      {
        title: 'Partnership Integration Project',
        description: 'Integration project with strategic partner to combine solutions',
        stage: 'Closed Lost',
        probability: 0,
        amount: 200000,
        currency: 'USD',
        expectedCloseDate: new Date('2024-12-15'),
        actualCloseDate: new Date('2024-11-20'),
        lossReason: 'Partner decided to develop solution in-house',
        source: 'Partner',
        priority: 'High',
        type: 'New Business',
        company: companies[0]._id,
        contact: contacts[0]._id,
        assignedTo: users[2]._id,
        createdBy: users[2]._id,
        products: [
          {
            name: 'Integration Development',
            quantity: 1,
            unitPrice: 150000,
            discount: 0,
            totalPrice: 150000
          },
          {
            name: 'Consulting Services',
            quantity: 1,
            unitPrice: 50000,
            discount: 0,
            totalPrice: 50000
          }
        ],
        activities: [
          {
            type: 'Meeting',
            subject: 'Partnership Discussion',
            description: 'Discussed integration possibilities and technical requirements',
            date: new Date('2024-11-15'),
            duration: 90,
            outcome: 'Partner interested but needs to evaluate internal capabilities',
            createdBy: users[2]._id
          }
        ],
        notes: [
          {
            content: 'Partner decided to develop solution internally instead of partnering',
            createdBy: users[2]._id
          }
        ],
        tags: ['closed-lost', 'partnership', 'integration']
      }
    ];

    // Clear existing opportunities
    await Opportunity.deleteMany({});
    console.log('Cleared existing opportunities');

    // Create new opportunities
    const createdOpportunities = await Opportunity.insertMany(sampleOpportunities);
    console.log(`Created ${createdOpportunities.length} sample opportunities`);

    // Display created opportunities
    createdOpportunities.forEach(opportunity => {
      console.log(`- ${opportunity.title} (${opportunity.stage}) - ${opportunity.amount}`);
    });

    console.log('Sample opportunities created successfully!');
  } catch (error) {
    console.error('Error creating sample opportunities:', error);
  } finally {
    mongoose.connection.close();
  }
};

createSampleOpportunities(); 