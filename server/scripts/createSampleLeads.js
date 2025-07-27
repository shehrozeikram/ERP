const mongoose = require('mongoose');
const Lead = require('../models/crm/Lead');
const User = require('../models/User');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Sample leads data for SGC Group businesses
const sampleLeads = [
  // ==================== TAJ RESIDENCIA LEADS ====================
  {
    firstName: 'Ahmed',
    lastName: 'Khan',
    email: 'ahmed.khan@gmail.com',
    phone: '+923001234567',
    company: 'Khan Family',
    jobTitle: 'Business Owner',
    website: '',
    business: 'Taj Residencia',
    source: 'Walk-in',
    status: 'New',
    priority: 'High',
    score: 90,
    industry: 'Real Estate',
    companySize: '1-10',
    annualRevenue: '$1M - $10M',
    // Taj Residencia specific fields
    propertyType: 'Plot',
    plotSize: '10 Marla',
    budget: '1 Crore - 2 Crore',
    paymentPlan: 'Installments',
    preferredLocation: 'Phase 1, Block A',
    timeline: 'Within 3 months',
    // Property Sales specific fields
    propertyPhase: 'Phase 1',
    propertyBlock: 'Block A',
    propertyNumber: 'A-123',
    propertyPrice: 15000000, // 1.5 Crore
    propertyStatus: 'Available',
    salesStage: 'Initial Contact',
    nextFollowUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    followUpNotes: 'Customer interested in 10 Marla plot. Showed Phase 1 layout. Follow up for site visit.',
    customerType: 'End User',
    urgency: 'High',
    decisionMaker: 'Ahmed Khan',
    address: {
      street: 'House 123, Street 5',
      city: 'Islamabad',
      state: 'Islamabad',
      zipCode: '44000',
      country: 'Pakistan'
    }
  },
  {
    firstName: 'Fatima',
    lastName: 'Ali',
    email: 'fatima.ali@yahoo.com',
    phone: '+923001234568',
    company: 'Ali Enterprises',
    jobTitle: 'CEO',
    website: 'https://alienterprises.com',
    business: 'Taj Residencia',
    source: 'Website',
    status: 'Qualified',
    priority: 'Urgent',
    score: 95,
    industry: 'Manufacturing',
    companySize: '51-200',
    annualRevenue: '$10M - $50M',
    // Taj Residencia specific fields
    propertyType: 'Commercial',
    plotSize: '1 Kanal',
    budget: '2 Crore - 5 Crore',
    paymentPlan: 'Cash',
    preferredLocation: 'Commercial Area, Phase 2',
    timeline: 'Immediate',
    // Property Sales specific fields
    propertyPhase: 'Phase 2',
    propertyBlock: 'Commercial Block',
    propertyNumber: 'C-45',
    propertyPrice: 35000000, // 3.5 Crore
    propertyStatus: 'Reserved',
    salesStage: 'Price Negotiation',
    nextFollowUp: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
    followUpNotes: 'High-value commercial property. Customer ready to pay 3.2 Crore. Negotiating final price.',
    customerType: 'Business Owner',
    urgency: 'Very High',
    decisionMaker: 'Fatima Ali',
    address: {
      street: 'Office 45, Blue Area',
      city: 'Islamabad',
      state: 'Islamabad',
      zipCode: '44000',
      country: 'Pakistan'
    }
  },
  {
    firstName: 'Muhammad',
    lastName: 'Hassan',
    email: 'm.hassan@hotmail.com',
    phone: '+923001234569',
    company: 'Hassan Family',
    jobTitle: 'Government Officer',
    website: '',
    business: 'Taj Residencia',
    source: 'Referral',
    status: 'Contacted',
    priority: 'Medium',
    score: 75,
    industry: 'Government',
    companySize: '1-10',
    annualRevenue: 'Less than $1M',
    // Taj Residencia specific fields
    propertyType: 'House',
    plotSize: '7 Marla',
    budget: '50 Lakh - 1 Crore',
    paymentPlan: 'Bank Financing',
    preferredLocation: 'Phase 3, Residential Area',
    timeline: 'Within 6 months',
    // Property Sales specific fields
    propertyPhase: 'Phase 3',
    propertyBlock: 'Block C',
    propertyNumber: 'C-78',
    propertyPrice: 8500000, // 85 Lakh
    propertyStatus: 'Under Construction',
    salesStage: 'Property Shown',
    nextFollowUp: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    followUpNotes: 'Showed under-construction house. Customer liked the location. Waiting for bank approval.',
    customerType: 'End User',
    urgency: 'Medium',
    decisionMaker: 'Muhammad Hassan',
    address: {
      street: 'House 67, Street 12',
      city: 'Rawalpindi',
      state: 'Punjab',
      zipCode: '46000',
      country: 'Pakistan'
    }
  },
  {
    firstName: 'Zara',
    lastName: 'Ahmed',
    email: 'zara.ahmed@investor.com',
    phone: '+923001234572',
    company: 'Zara Investments',
    jobTitle: 'Property Investor',
    website: 'https://zarainvestments.com',
    business: 'Taj Residencia',
    source: 'Referral',
    status: 'Won',
    priority: 'High',
    score: 100,
    industry: 'Investment',
    companySize: '1-10',
    annualRevenue: '$10M - $50M',
    // Taj Residencia specific fields
    propertyType: 'Plot',
    plotSize: '2 Kanal',
    budget: '2 Crore - 5 Crore',
    paymentPlan: 'Cash',
    preferredLocation: 'Phase 1, Block B',
    timeline: 'Immediate',
    // Property Sales specific fields
    propertyPhase: 'Phase 1',
    propertyBlock: 'Block B',
    propertyNumber: 'B-156',
    propertyPrice: 28000000, // 2.8 Crore
    propertyStatus: 'Sold',
    salesStage: 'Deal Closed',
    nextFollowUp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    followUpNotes: 'Deal closed successfully. Full payment received. Property transferred. Follow up for future investments.',
    customerType: 'Investor',
    urgency: 'Very High',
    decisionMaker: 'Zara Ahmed',
    address: {
      street: 'Office 12, Financial District',
      city: 'Karachi',
      state: 'Sindh',
      zipCode: '74000',
      country: 'Pakistan'
    }
  },

  // ==================== BOLY.PK LEADS ====================
  {
    firstName: 'Sara',
    lastName: 'Ahmed',
    email: 'sara.ahmed@restaurant.com',
    phone: '+923001234570',
    company: 'Sara\'s Kitchen',
    jobTitle: 'Owner',
    website: 'https://saraskitchen.com',
    business: 'Boly.pk',
    source: 'Social Media',
    status: 'New',
    priority: 'High',
    score: 88,
    industry: 'Food & Beverage',
    companySize: '1-10',
    annualRevenue: '$1M - $10M',
    // Boly.pk specific fields
    appService: 'Food Delivery',
    userType: 'Restaurant',
    platform: 'All Platforms',
    integrationType: 'Existing Business',
    address: {
      street: 'Shop 23, Food Street',
      city: 'Lahore',
      state: 'Punjab',
      zipCode: '54000',
      country: 'Pakistan'
    }
  },
  {
    firstName: 'Usman',
    lastName: 'Malik',
    email: 'usman.malik@pharmacy.com',
    phone: '+923001234571',
    company: 'Malik Pharmacy',
    jobTitle: 'Pharmacist',
    website: '',
    business: 'Boly.pk',
    source: 'Phone Call',
    status: 'Qualified',
    priority: 'Medium',
    score: 82,
    industry: 'Healthcare',
    companySize: '1-10',
    annualRevenue: '$1M - $10M',
    // Boly.pk specific fields
    appService: 'Pharmacy',
    userType: 'Store Owner',
    platform: 'Android',
    integrationType: 'New User',
    address: {
      street: 'Shop 15, Medical Center',
      city: 'Karachi',
      state: 'Sindh',
      zipCode: '74000',
      country: 'Pakistan'
    }
  },
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@innovateinc.com',
    phone: '+1987654321',
    company: 'Innovate Inc',
    jobTitle: 'VP of Sales',
    website: 'https://innovateinc.com',
    source: 'Referral',
    status: 'Qualified',
    priority: 'Medium',
    score: 72,
    industry: 'Software',
    companySize: '11-50',
    annualRevenue: '$1M - $10M',
    address: {
      street: '456 Innovation Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '73301',
      country: 'United States'
    }
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael.brown@startupxyz.com',
    phone: '+1555123456',
    company: 'StartupXYZ',
    jobTitle: 'Founder',
    website: 'https://startupxyz.com',
    source: 'Social Media',
    status: 'Contacted',
    priority: 'Urgent',
    score: 95,
    industry: 'Fintech',
    companySize: '1-10',
    annualRevenue: 'Less than $1M',
    address: {
      street: '789 Startup Blvd',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'United States'
    }
  },
  {
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@enterprise.com',
    phone: '+1444567890',
    company: 'Enterprise Solutions',
    jobTitle: 'IT Director',
    website: 'https://enterprise.com',
    source: 'Trade Show',
    status: 'Proposal Sent',
    priority: 'High',
    score: 68,
    industry: 'Manufacturing',
    companySize: '501-1000',
    annualRevenue: '$50M - $100M',
    address: {
      street: '321 Enterprise Way',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'United States'
    }
  },
  {
    firstName: 'David',
    lastName: 'Wilson',
    email: 'david.wilson@consulting.com',
    phone: '+1333567890',
    company: 'Global Consulting',
    jobTitle: 'Managing Partner',
    website: 'https://globalconsulting.com',
    source: 'Cold Call',
    status: 'Negotiation',
    priority: 'Medium',
    score: 78,
    industry: 'Consulting',
    companySize: '51-200',
    annualRevenue: '$10M - $50M',
    address: {
      street: '654 Consulting Circle',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      country: 'United States'
    }
  }
];

async function createSampleLeads() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get the first admin user to assign as createdBy
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }

    // Clear existing leads (optional)
    await Lead.deleteMany({});
    console.log('🗑️  Cleared existing leads');

    // Create sample leads
    const leadsWithCreator = sampleLeads.map(lead => ({
      ...lead,
      createdBy: adminUser._id,
      assignedTo: adminUser._id
    }));

    const createdLeads = await Lead.insertMany(leadsWithCreator);
    console.log(`✅ Created ${createdLeads.length} sample leads`);

    // Display created leads
    createdLeads.forEach((lead, index) => {
      console.log(`${index + 1}. ${lead.firstName} ${lead.lastName} - ${lead.company} (${lead.status})`);
    });

    console.log('\n🎉 Sample leads created successfully!');
    console.log('You can now test the CRM module with this data.');

  } catch (error) {
    console.error('❌ Error creating sample leads:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createSampleLeads(); 