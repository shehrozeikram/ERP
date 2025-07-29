const mongoose = require('mongoose');
const { calculateMonthlyTax } = require('../utils/taxCalculator');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

async function testNewTaxCalculation() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 Testing New FBR Tax Calculation (FY 2025-26)\n');

    // Test cases based on different salary levels
    const testCases = [
      {
        name: 'Low Income (Tax Exempt)',
        monthlyIncome: 40000,
        expectedSlab: 'Rs 0 - Rs 600,000'
      },
      {
        name: 'Medium Income (5% slab)',
        monthlyIncome: 80000,
        expectedSlab: 'Rs 600,001 - Rs 1,200,000'
      },
      {
        name: 'High Income (15% slab)',
        monthlyIncome: 150000,
        expectedSlab: 'Rs 1,200,001 - Rs 2,200,000'
      },
      {
        name: 'Very High Income (25% slab)',
        monthlyIncome: 250000,
        expectedSlab: 'Rs 2,200,001 - Rs 3,200,000'
      },
      {
        name: 'Extreme High Income (30% slab)',
        monthlyIncome: 350000,
        expectedSlab: 'Rs 3,200,001 - Rs 4,100,000'
      },
      {
        name: 'Maximum Income (35% slab)',
        monthlyIncome: 500000,
        expectedSlab: 'Rs 4,100,001 - Above'
      }
    ];

    for (const testCase of testCases) {
      console.log(`📊 Test Case: ${testCase.name}`);
      console.log('─'.repeat(50));
      
      const monthlyTax = await calculateMonthlyTax(testCase.monthlyIncome);
      const annualTaxableIncome = testCase.monthlyIncome * 12;
      
      console.log(`💰 Monthly Taxable Income: Rs ${testCase.monthlyIncome.toLocaleString()}`);
      console.log(`📈 Annual Taxable Income: Rs ${annualTaxableIncome.toLocaleString()}`);
      console.log(`💸 Monthly Tax: Rs ${monthlyTax.toLocaleString()}`);
      console.log(`💸 Annual Tax: Rs ${(monthlyTax * 12).toLocaleString()}`);
      console.log(`🏷️ Expected Slab: ${testCase.expectedSlab}`);
      console.log('');
    }

    console.log('✅ New FBR Tax Calculation test completed!');
    
  } catch (error) {
    console.error('❌ Error testing tax calculation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testNewTaxCalculation(); 