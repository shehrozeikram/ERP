const mongoose = require('mongoose');
const FBRTaxSlab = require('../models/hr/FBRTaxSlab');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Latest Pakistan FBR Tax Slabs for FY 2025-26
const FBR_TAX_SLABS_2025_26 = {
  fiscalYear: '2025-26',
  description: 'Pakistan FBR Tax Slabs for Fiscal Year 2025-26 (Latest Budget)',
  isActive: true,
  slabs: [
    {
      minAmount: 0,
      maxAmount: 600000,
      rate: 0,
      fixedTax: 0,
      description: 'Tax exempt up to Rs 600,000'
    },
    {
      minAmount: 600001,
      maxAmount: 1200000,
      rate: 5,
      fixedTax: 0,
      description: '5% of amount exceeding Rs 600,000'
    },
    {
      minAmount: 1200001,
      maxAmount: 2200000,
      rate: 15,
      fixedTax: 30000,
      description: 'Rs 30,000 + 15% of amount exceeding Rs 1,200,000'
    },
    {
      minAmount: 2200001,
      maxAmount: 3200000,
      rate: 25,
      fixedTax: 180000,
      description: 'Rs 180,000 + 25% of amount exceeding Rs 2,200,000'
    },
    {
      minAmount: 3200001,
      maxAmount: 4100000,
      rate: 30,
      fixedTax: 430000,
      description: 'Rs 430,000 + 30% of amount exceeding Rs 3,200,000'
    },
    {
      minAmount: 4100001,
      maxAmount: Infinity,
      rate: 35,
      fixedTax: 700000,
      description: 'Rs 700,000 + 35% of amount exceeding Rs 4,100,000'
    }
  ]
};

async function initializeFBRTaxSlabs() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if FY 2025-26 already exists
    const existingSlabs = await FBRTaxSlab.findOne({ fiscalYear: '2025-26' });
    
    if (existingSlabs) {
      console.log('⚠️ Tax slabs for FY 2025-26 already exist');
      console.log('Updating existing slabs...');
      
      // Deactivate all other slabs
      await FBRTaxSlab.updateMany({}, { isActive: false });
      
      // Update the existing slabs
      await FBRTaxSlab.findByIdAndUpdate(existingSlabs._id, {
        ...FBR_TAX_SLABS_2025_26,
        updatedAt: new Date()
      });
      
      console.log('✅ Updated existing tax slabs for FY 2025-26');
    } else {
      console.log('📝 Creating new tax slabs for FY 2025-26...');
      
      // Deactivate all existing slabs
      await FBRTaxSlab.updateMany({}, { isActive: false });
      
      // Create new slabs
      const newSlabs = new FBRTaxSlab({
        ...FBR_TAX_SLABS_2025_26
        // createdBy will be set by the system
      });
      
      await newSlabs.save();
      console.log('✅ Created new tax slabs for FY 2025-26');
    }

    // Display the created/updated slabs
    const activeSlabs = await FBRTaxSlab.findOne({ isActive: true });
    console.log('\n📊 Active Tax Slabs:');
    console.log(`Fiscal Year: ${activeSlabs.fiscalYear}`);
    console.log(`Description: ${activeSlabs.description}`);
    console.log('\nTax Slabs:');
    
    activeSlabs.slabs.forEach((slab, index) => {
      console.log(`${index + 1}. Rs ${slab.minAmount.toLocaleString()} - ${slab.maxAmount === Infinity ? 'Above' : 'Rs ' + slab.maxAmount.toLocaleString()}`);
      console.log(`   Rate: ${slab.rate}% | Fixed Tax: Rs ${slab.fixedTax.toLocaleString()}`);
      console.log(`   Description: ${slab.description}`);
      console.log('');
    });

    console.log('🎉 FBR Tax Slabs initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing FBR tax slabs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the initialization
initializeFBRTaxSlabs(); 