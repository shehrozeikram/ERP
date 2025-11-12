const mongoose = require('mongoose');
const FBRTaxSlab = require('../models/hr/FBRTaxSlab');
require('../config/database');

async function populateFBRTaxSlabs2025() {
  try {
    console.log('🔄 Starting FBR Tax Slabs 2025-2026 population...');
    
    // Check if 2025-2026 slabs already exist
    const existingSlabs = await FBRTaxSlab.findOne({ fiscalYear: '2025-2026' });
    if (existingSlabs) {
      console.log('⚠️  FBR Tax Slabs for 2025-2026 already exist. Skipping...');
      return;
    }

    // FBR 2025-2026 Tax Slabs for Salaried Persons (Official Pakistan Tax Slabs)
    const taxSlabs2025 = {
      fiscalYear: '2025-2026',
      description: 'FBR Tax Slabs for Salaried Persons - Fiscal Year 2025-2026',
      isActive: true,
      slabs: [
        {
          minAmount: 0,
          maxAmount: 600000,
          rate: 0,
          fixedTax: 0,
          description: 'No tax for income up to Rs 600,000'
        },
        {
          minAmount: 600001,
          maxAmount: 1200000,
          rate: 1,
          fixedTax: 0,
          description: '1% on income from Rs 600,001 to Rs 1,200,000'
        },
        {
          minAmount: 1200001,
          maxAmount: 2200000,
          rate: 11,
          fixedTax: 6000,
          description: 'Rs 6,000 + 11% on income from Rs 1,200,001 to Rs 2,200,000'
        },
        {
          minAmount: 2200001,
          maxAmount: 3200000,
          rate: 23,
          fixedTax: 116000,
          description: 'Rs 116,000 + 23% on income from Rs 2,200,001 to Rs 3,200,000'
        },
        {
          minAmount: 3200001,
          maxAmount: 4100000,
          rate: 30,
          fixedTax: 346000,
          description: 'Rs 346,000 + 30% on income from Rs 3,200,001 to Rs 4,100,000'
        },
        {
          minAmount: 4100001,
          maxAmount: 10000000,
          rate: 35,
          fixedTax: 616000,
          description: 'Rs 616,000 + 35% on income from Rs 4,100,001 to Rs 10,000,000'
        },
        {
          minAmount: 10000001,
          maxAmount: Infinity,
          rate: 35,
          fixedTax: 616000,
          description: 'Rs 616,000 + 35% on income above Rs 10,000,000 (with 9% surcharge)'
        }
      ]
    };

    // Create the tax slabs
    const newTaxSlabs = new FBRTaxSlab(taxSlabs2025);
    await newTaxSlabs.save();

    console.log('✅ FBR Tax Slabs for 2025-2026 created successfully!');
    console.log('📊 Tax Slabs Summary:');
    console.log('   • 0% tax on income up to Rs 600,000');
    console.log('   • 1% tax on income from Rs 600,001 to Rs 1,200,000');
    console.log('   • 11% tax on income from Rs 1,200,001 to Rs 2,200,000');
    console.log('   • 23% tax on income from Rs 2,200,001 to Rs 3,200,000');
    console.log('   • 30% tax on income from Rs 3,200,001 to Rs 4,100,000');
    console.log('   • 35% tax on income above Rs 4,100,000');
    console.log('   • 9% surcharge on income above Rs 10,000,000');

    // Test tax calculation
    console.log('\n🧮 Testing Tax Calculations:');
    const testIncomes = [500000, 800000, 1500000, 2500000, 3500000, 5000000, 12000000];
    
    for (const annualIncome of testIncomes) {
      const monthlyIncome = annualIncome / 12;
      const tax = await FBRTaxSlab.calculateTax(annualIncome);
      const monthlyTax = Math.round(tax / 12);
      console.log(`   • Annual: Rs ${annualIncome.toLocaleString()} | Monthly: Rs ${monthlyIncome.toLocaleString()} | Monthly Tax: Rs ${monthlyTax.toLocaleString()}`);
    }

  } catch (error) {
    console.error('❌ Error populating FBR tax slabs:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

// Run the script
populateFBRTaxSlabs2025();
