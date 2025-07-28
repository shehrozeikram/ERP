const mongoose = require('mongoose');
const Contact = require('../models/crm/Contact');
const Company = require('../models/crm/Company');
const User = require('../models/User');
require('dotenv').config();

const sampleContacts = [
  {
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@samplecompany.com',
    phone: '+1234567891',
    mobile: '+1234567892',
    jobTitle: 'CEO',
    department: 'Executive',
    type: 'Customer',
    status: 'Active',
    source: 'Website',
    preferredContactMethod: 'Email',
    doNotContact: false,
    marketingOptIn: true,
    notes: 'Primary decision maker for the company',
    address: {
      street: '123 Business St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'United States'
    },
    socialMedia: {
      linkedin: 'https://linkedin.com/in/johnsmith',
      twitter: '@johnsmith',
      facebook: ''
    }
  },
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@techcorp.com',
    phone: '+1234567893',
    mobile: '+1234567894',
    jobTitle: 'Marketing Director',
    department: 'Marketing',
    type: 'Prospect',
    status: 'Active',
    source: 'Website',
    preferredContactMethod: 'Phone',
    doNotContact: false,
    marketingOptIn: true,
    notes: 'Interested in our new product line',
    address: {
      street: '456 Tech Ave',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'United States'
    },
    socialMedia: {
      linkedin: 'https://linkedin.com/in/sarahjohnson',
      twitter: '@sarahjohnson',
      facebook: ''
    }
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    email: 'michael.brown@partnersolutions.com',
    phone: '+1234567895',
    mobile: '+1234567896',
    jobTitle: 'Business Development Manager',
    department: 'Business Development',
    type: 'Partner',
    status: 'Active',
    source: 'Website',
    preferredContactMethod: 'Email',
    doNotContact: false,
    marketingOptIn: false,
    notes: 'Strategic partner for regional expansion',
    address: {
      street: '789 Partner Blvd',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60601',
      country: 'United States'
    },
    socialMedia: {
      linkedin: 'https://linkedin.com/in/michaelbrown',
      twitter: '',
      facebook: ''
    }
  },
  {
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.davis@vendorpro.com',
    phone: '+1234567897',
    mobile: '+1234567898',
    jobTitle: 'Procurement Specialist',
    department: 'Procurement',
    type: 'Vendor',
    status: 'Active',
    source: 'Website',
    preferredContactMethod: 'Email',
    doNotContact: false,
    marketingOptIn: true,
    notes: 'Supplies office equipment and supplies',
    address: {
      street: '321 Vendor St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'United States'
    },
    socialMedia: {
      linkedin: 'https://linkedin.com/in/emilydavis',
      twitter: '@emilydavis',
      facebook: ''
    }
  },
  {
    firstName: 'David',
    lastName: 'Wilson',
    email: 'david.wilson@consulting.com',
    phone: '+1234567899',
    mobile: '+1234567900',
    jobTitle: 'Senior Consultant',
    department: 'Consulting',
    type: 'Customer',
    status: 'Active',
    source: 'Referral',
    preferredContactMethod: 'Email',
    doNotContact: false,
    marketingOptIn: true,
    notes: 'Long-term customer, very satisfied with our services',
    address: {
      street: '654 Consulting Dr',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      country: 'United States'
    },
    socialMedia: {
      linkedin: 'https://linkedin.com/in/davidwilson',
      twitter: '@davidwilson',
      facebook: ''
    }
  },
  {
    firstName: 'Lisa',
    lastName: 'Anderson',
    email: 'lisa.anderson@startup.com',
    phone: '+1234567901',
    mobile: '+1234567902',
    jobTitle: 'Founder & CEO',
    department: 'Executive',
    type: 'Prospect',
    status: 'Lead',
    source: 'Cold Call',
    preferredContactMethod: 'Mobile',
    doNotContact: false,
    marketingOptIn: true,
    notes: 'Startup founder, interested in our enterprise solutions',
    address: {
      street: '987 Startup Way',
      city: 'Austin',
      state: 'TX',
      zipCode: '73301',
      country: 'United States'
    },
    socialMedia: {
      linkedin: 'https://linkedin.com/in/lisaanderson',
      twitter: '@lisaanderson',
      facebook: ''
    }
  }
];

async function createSampleContacts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sgc_erp');
    console.log('✅ Connected to MongoDB');

    // Get admin user for createdBy field
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.log('❌ No admin user found. Please create an admin user first.');
      return;
    }

    // Create sample company if it doesn't exist
    let sampleCompany = await Company.findOne({ name: 'Sample Company Inc.' });
    if (!sampleCompany) {
      sampleCompany = new Company({
        name: 'Sample Company Inc.',
        industry: 'Technology',
        type: 'Customer',
        status: 'Active',
        website: 'https://samplecompany.com',
        email: 'info@samplecompany.com',
        phone: '+1234567890',
        address: {
          street: '123 Business St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'United States'
        },
        createdBy: adminUser._id
      });
      await sampleCompany.save();
      console.log('✅ Created sample company');
    }

    // Clear existing sample contacts
    await Contact.deleteMany({ email: { $in: sampleContacts.map(c => c.email) } });
    console.log('✅ Cleared existing sample contacts');

    // Create sample contacts
    const createdContacts = [];
    for (const contactData of sampleContacts) {
      const contact = new Contact({
        ...contactData,
        company: sampleCompany._id,
        createdBy: adminUser._id
      });
      await contact.save();
      createdContacts.push(contact);
    }

    console.log(`✅ Created ${createdContacts.length} sample contacts:`);
    createdContacts.forEach(contact => {
      console.log(`   - ${contact.firstName} ${contact.lastName} (${contact.email})`);
    });

    console.log('\n🎉 Sample contacts created successfully!');
    console.log('You can now test the Contacts page in the CRM module.');

  } catch (error) {
    console.error('❌ Error creating sample contacts:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

// Run the script
createSampleContacts(); 