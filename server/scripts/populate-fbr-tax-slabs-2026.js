const mongoose = require('mongoose');
const FBRTaxSlab = require('../models/hr/FBRTaxSlab');
require('dotenv').config();
const { connectDB } = require('../config/database');

async function populateFBRTaxSlabs2026() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    console.log('🔄 Starting FBR Tax Slabs 2026-2027 population...');
    
    // Check if 2026-2027 slabs already exist
    const existingSlabs = await FBRTaxSlab.findOne({ fiscalYear: '2026-2027' });
    if (existingSlabs) {
      console.log('⚠️  FBR Tax Slabs for 2026-2027 already exist. Overwriting to ensure correct values...');
      await FBRTaxSlab.deleteOne({ fiscalYear: '2026-2027' });
    }

    // Deactivate all previous tax slabs
    await FBRTaxSlab.updateMany({}, { isActive: false });

    // FBR 2026-2027 Tax Slabs for Salaried Persons (Official Pakistan Tax Slabs from user image)
    const taxSlabs2026 = {
      fiscalYear: '2026-2027',
      description: 'FBR Tax Slabs for Salaried Persons - Fiscal Year 2026-2027',
      isActive: true,
      slabs: [
        {
          minAmount: 0,
          maxAmount: 600000,
          rate: 0,
          fixedTax: 0,
          description: 'Where the taxable salary income does not exceed Rs. 600,000, the rate of income tax is 0%'
        },
        {
          minAmount: 600001,
          maxAmount: 1200000,
          rate: 1,
          fixedTax: 0,
          description: 'Where the taxable salary income exceeds Rs. 600,000 but does not exceed Rs. 1,200,000, the rate of income tax is 1% of the amount exceeding Rs. 600,000'
        },
        {
          minAmount: 1200001,
          maxAmount: 2200000,
          rate: 11,
          fixedTax: 6000,
          description: 'Where the taxable salary income exceeds Rs. 1,200,000 but does not exceed Rs. 2,200,000, the rate of income tax is Rs. 6,000 + 11% of the amount exceeding Rs. 1,200,000'
        },
        {
          minAmount: 2200001,
          maxAmount: 3200000,
          rate: 20,
          fixedTax: 116000,
          description: 'Where the taxable salary income exceeds Rs. 2,200,000 but does not exceed Rs. 3,200,000, the rate of income tax is Rs. 116,000 + 20% of the amount exceeding Rs. 2,200,000'
        },
        {
          minAmount: 3200001,
          maxAmount: 4100000,
          rate: 25,
          fixedTax: 316000,
          description: 'Where the taxable salary income exceeds Rs. 3,200,000 but does not exceed Rs. 4,100,000, the rate of income tax is Rs. 316,000 + 25% of the amount exceeding Rs. 3,200,000'
        },
        {
          minAmount: 4100001,
          maxAmount: 5600000,
          rate: 29,
          fixedTax: 541000,
          description: 'Where the taxable salary income exceeds Rs. 4,100,000 but does not exceed Rs. 5,600,000, the rate of income tax is Rs. 541,000 + 29% of the amount exceeding Rs. 4,100,000'
        },
        {
          minAmount: 5600001,
          maxAmount: 7000000,
          rate: 32,
          fixedTax: 976000,
          description: 'Where the taxable salary income exceeds Rs. 5,600,000 but does not exceed Rs. 7,000,000, the rate of income tax is Rs. 976,000 + 32% of the amount exceeding Rs. 5,600,000'
        },
        {
          minAmount: 7000001,
          maxAmount: 9999999999, // Use a very large number for maxAmount to represent Infinity in DB cleanly
          rate: 35,
          fixedTax: 1424000,
          description: 'Where the taxable salary income exceeds Rs. 7,000,000, the rate of income tax is Rs. 1,424,000 + 35% of the amount exceeding Rs. 7,000,000'
        }
      ]
    };

    // Create the tax slabs
    const newTaxSlabs = new FBRTaxSlab(taxSlabs2026);
    await newTaxSlabs.save();

    console.log('✅ FBR Tax Slabs for 2026-2027 created and set as ACTIVE successfully!');
    console.log('📊 Tax Slabs Summary:');
    console.log('   • 0% tax on income up to Rs 600,000');
    console.log('   • 1% tax on income from Rs 600,001 to Rs 1,200,000');
    console.log('   • 11% tax on income from Rs 1,200,001 to Rs 2,200,000');
    console.log('   • 20% tax on income from Rs 2,200,001 to Rs 3,200,000');
    console.log('   • 25% tax on income from Rs 3,200,001 to Rs 4,100,000');
    console.log('   • 29% tax on income from Rs 4,100,001 to Rs 5,600,000');
    console.log('   • 32% tax on income from Rs 5,600,001 to Rs 7,000,000');
    console.log('   • 35% tax on income above Rs 7,000,000');

    // Test tax calculation
    console.log('\n🧮 Testing Tax Calculations using FBRTaxSlab Model:');
    const testIncomes = [500000, 800000, 1500000, 2500000, 3500000, 5000000, 6500000, 8000000];
    
    for (const annualIncome of testIncomes) {
      const monthlyIncome = annualIncome / 12;
      const tax = await FBRTaxSlab.calculateTax(annualIncome);
      const monthlyTax = Math.round(tax / 12);
      console.log(`   • Annual: Rs ${annualIncome.toLocaleString()} | Monthly: Rs ${monthlyIncome.toLocaleString()} | Monthly Tax: Rs ${monthlyTax.toLocaleString()}`);
    }

  } catch (error) {
    console.error('❌ Error populating FBR tax slabs:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

// Run the script
populateFBRTaxSlabs2026();
