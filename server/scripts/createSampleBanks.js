const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Import models
const Bank = require('../models/hr/Bank');

// Sample banks data
const sampleBanks = [
  {
    name: 'HBL Bank',
    code: 'HBL',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.hbl.com',
    contactInfo: {
      phone: '+92-21-111-425-225',
      email: 'info@hbl.com',
      address: 'HBL Tower, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'Habib Bank Limited - One of the largest banks in Pakistan'
  },
  {
    name: 'UBL Bank',
    code: 'UBL',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.ubl.com.pk',
    contactInfo: {
      phone: '+92-21-111-825-888',
      email: 'info@ubl.com.pk',
      address: 'UBL Building, Jinnah Avenue, Blue Area, Islamabad, Pakistan'
    },
    notes: 'United Bank Limited - Major commercial bank'
  },
  {
    name: 'MCB Bank',
    code: 'MCB',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.mcb.com.pk',
    contactInfo: {
      phone: '+92-21-111-000-322',
      email: 'info@mcb.com.pk',
      address: 'MCB Tower, Main Boulevard, Gulberg III, Lahore, Pakistan'
    },
    notes: 'Muslim Commercial Bank - Leading commercial bank'
  },
  {
    name: 'Allied Bank',
    code: 'ABL',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.abl.com',
    contactInfo: {
      phone: '+92-21-111-225-225',
      email: 'info@abl.com',
      address: 'Allied Bank Plaza, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'Allied Bank Limited - Established commercial bank'
  },
  {
    name: 'Bank Alfalah',
    code: 'BAFL',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.bankalfalah.com',
    contactInfo: {
      phone: '+92-21-111-225-111',
      email: 'info@bankalfalah.com',
      address: 'Bank Alfalah Building, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'Bank Alfalah Limited - Modern banking solutions'
  },
  {
    name: 'Meezan Bank',
    code: 'MEZAN',
    type: 'Islamic',
    country: 'Pakistan',
    website: 'https://www.meezanbank.com',
    contactInfo: {
      phone: '+92-21-111-331-331',
      email: 'info@meezanbank.com',
      address: 'Meezan House, C-25, Estate Avenue, SITE, Karachi, Pakistan'
    },
    notes: 'Meezan Bank - Pakistan\'s first Islamic commercial bank'
  },
  {
    name: 'Dubai Islamic Bank Pakistan',
    code: 'DIBPK',
    type: 'Islamic',
    country: 'Pakistan',
    website: 'https://www.dibpakistan.com',
    contactInfo: {
      phone: '+92-21-111-347-347',
      email: 'info@dibpakistan.com',
      address: 'DIB Building, Main Boulevard, Gulberg III, Lahore, Pakistan'
    },
    notes: 'Dubai Islamic Bank Pakistan - Islamic banking services'
  },
  {
    name: 'Al Baraka Islamic Bank',
    code: 'ALBARAKA',
    type: 'Islamic',
    country: 'Pakistan',
    website: 'https://www.albaraka.com.pk',
    contactInfo: {
      phone: '+92-21-111-225-225',
      email: 'info@albaraka.com.pk',
      address: 'Al Baraka Islamic Bank Building, Karachi, Pakistan'
    },
    notes: 'Al Baraka Islamic Bank - Islamic banking solutions'
  },
  {
    name: 'State Bank of Pakistan',
    code: 'SBP',
    type: 'Central',
    country: 'Pakistan',
    website: 'https://www.sbp.org.pk',
    contactInfo: {
      phone: '+92-21-99221000',
      email: 'info@sbp.org.pk',
      address: 'State Bank of Pakistan, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'Central Bank of Pakistan - Regulates banking sector'
  },
  {
    name: 'National Bank of Pakistan',
    code: 'NBP',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.nbp.com.pk',
    contactInfo: {
      phone: '+92-21-99220100',
      email: 'info@nbp.com.pk',
      address: 'NBP Building, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'National Bank of Pakistan - Government-owned commercial bank'
  },
  {
    name: 'Askari Bank',
    code: 'AKBL',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.askaribank.com.pk',
    contactInfo: {
      phone: '+92-21-111-225-225',
      email: 'info@askaribank.com.pk',
      address: 'Askari Bank Building, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'Askari Bank Limited - Commercial banking services'
  },
  {
    name: 'Bank of Punjab',
    code: 'BOP',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.bop.com.pk',
    contactInfo: {
      phone: '+92-42-111-267-267',
      email: 'info@bop.com.pk',
      address: 'BOP Tower, Main Boulevard, Gulberg III, Lahore, Pakistan'
    },
    notes: 'Bank of Punjab - Provincial commercial bank'
  },
  {
    name: 'Sindh Bank',
    code: 'SINDBANK',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.sindhbank.com.pk',
    contactInfo: {
      phone: '+92-21-111-747-747',
      email: 'info@sindhbank.com.pk',
      address: 'Sindh Bank Building, Karachi, Pakistan'
    },
    notes: 'Sindh Bank - Provincial commercial bank'
  },
  {
    name: 'JS Bank',
    code: 'JSBL',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.jsbl.com',
    contactInfo: {
      phone: '+92-21-111-575-575',
      email: 'info@jsbl.com',
      address: 'JS Bank Building, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'JS Bank Limited - Commercial banking services'
  },
  {
    name: 'Silkbank',
    code: 'SILKBANK',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.silkbank.com.pk',
    contactInfo: {
      phone: '+92-21-111-100-777',
      email: 'info@silkbank.com.pk',
      address: 'Silkbank Building, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'Silkbank Limited - Commercial banking services'
  },
  {
    name: 'Summit Bank',
    code: 'SUMMIT',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.summitbank.com.pk',
    contactInfo: {
      phone: '+92-21-111-786-638',
      email: 'info@summitbank.com.pk',
      address: 'Summit Bank Building, Karachi, Pakistan'
    },
    notes: 'Summit Bank Limited - Commercial banking services'
  },
  {
    name: 'Faysal Bank',
    code: 'FBL',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.faysalbank.com',
    contactInfo: {
      phone: '+92-21-111-000-111',
      email: 'info@faysalbank.com',
      address: 'Faysal Bank Building, I.I. Chundrigar Road, Karachi, Pakistan'
    },
    notes: 'Faysal Bank Limited - Commercial banking services'
  },
  {
    name: 'Standard Chartered Pakistan',
    code: 'SCB',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.sc.com/pk',
    contactInfo: {
      phone: '+92-21-111-002-002',
      email: 'info@sc.com',
      address: 'Standard Chartered Bank Building, Karachi, Pakistan'
    },
    notes: 'Standard Chartered Bank Pakistan - International bank'
  },
  {
    name: 'Citibank Pakistan',
    code: 'CITI',
    type: 'Commercial',
    country: 'Pakistan',
    website: 'https://www.citibank.com.pk',
    contactInfo: {
      phone: '+92-21-111-247-484',
      email: 'info@citibank.com.pk',
      address: 'Citibank Building, Karachi, Pakistan'
    },
    notes: 'Citibank Pakistan - International banking services'
  },
  {
    name: 'Deutsche Bank Pakistan',
    code: 'DB',
    type: 'Investment',
    country: 'Pakistan',
    website: 'https://www.db.com/pakistan',
    contactInfo: {
      phone: '+92-21-3568-0000',
      email: 'info@db.com',
      address: 'Deutsche Bank Building, Karachi, Pakistan'
    },
    notes: 'Deutsche Bank Pakistan - Investment banking services'
  }
];

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Function to create banks
async function createSampleBanks() {
  try {
    console.log('🚀 Starting to create sample banks...');

    let totalBanksCreated = 0;

    // Create banks
    for (const bankData of sampleBanks) {
      // Check if bank already exists
      const existingBank = await Bank.findOne({
        $or: [
          { name: bankData.name },
          { code: bankData.code }
        ]
      });

      if (existingBank) {
        console.log(`   ⚠️  Bank "${bankData.name}" (${bankData.code}) already exists`);
        continue;
      }

      // Create new bank
      const bank = new Bank(bankData);
      await bank.save();
      console.log(`   ✅ Created: ${bankData.name} (${bankData.code}) - ${bankData.type}`);
      totalBanksCreated++;
    }

    console.log(`\n🎉 Successfully created ${totalBanksCreated} new banks!`);
    
    // Display summary
    const allBanks = await Bank.find({ isActive: true });
    console.log('\n📊 Bank Summary:');
    
    const summary = {};
    allBanks.forEach(bank => {
      if (!summary[bank.type]) summary[bank.type] = 0;
      summary[bank.type]++;
    });

    Object.entries(summary).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} banks`);
    });

    console.log(`\n💰 Total Banks: ${allBanks.length}`);

  } catch (error) {
    console.error('❌ Error creating sample banks:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
createSampleBanks(); 