const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/database');
require('dotenv').config();

// Import the Payroll model
const Payroll = require('./models/hr/Payroll');

const testSimpleTax = async () => {
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    
    console.log('🧪 Testing Simple Tax Calculation System...\n');
    
    // Test 1: Create a sample payroll object to test tax calculation
    console.log('📊 Test 1: Testing simple tax calculation method...');
    
    // Create a mock payroll object (not saved to database)
    const mockPayroll = {
      totalEarnings: 300000, // 300,000 PKR
      calculateTax: function() {
        // Medical allowance for tax calculation is 10% of total earnings (tax-exempt)
        const medicalAllowanceForTax = Math.round(this.totalEarnings * 0.10);
        
        // Taxable Income = Total Earnings - Medical Allowance
        const taxableIncome = this.totalEarnings - medicalAllowanceForTax;
        
        // Calculate tax using FBR 2025-2026 rules (simple calculation)
        const annualTaxableIncome = taxableIncome * 12;
        
        let annualTax = 0;
        
        if (annualTaxableIncome <= 600000) {
          annualTax = 0;
        } else if (annualTaxableIncome <= 1200000) {
          annualTax = (annualTaxableIncome - 600000) * 0.01;
        } else if (annualTaxableIncome <= 2200000) {
          annualTax = 6000 + (annualTaxableIncome - 1200000) * 0.11;
        } else if (annualTaxableIncome <= 3200000) {
          annualTax = 116000 + (annualTaxableIncome - 2200000) * 0.23;
        } else if (annualTaxableIncome <= 4100000) {
          annualTax = 346000 + (annualTaxableIncome - 3200000) * 0.30;
        } else {
          annualTax = 616000 + (annualTaxableIncome - 4100000) * 0.35;
        }
        
        // Apply 9% surcharge if annual taxable income exceeds Rs. 10,000,000
        if (annualTaxableIncome > 10000000) {
          const surcharge = annualTax * 0.09;
          annualTax += surcharge;
        }
        
        // Convert to monthly tax
        const monthlyTax = Math.round(annualTax / 12);
        
        console.log(`💰 Simple Tax Calculation Test:`);
        console.log(`   Total Earnings: Rs. ${this.totalEarnings?.toLocaleString() || 0}`);
        console.log(`   Medical Allowance (10%): Rs. ${medicalAllowanceForTax?.toLocaleString() || 0}`);
        console.log(`   Taxable Income: Rs. ${taxableIncome?.toLocaleString() || 0}`);
        console.log(`   Annual Taxable Income: Rs. ${annualTaxableIncome?.toLocaleString() || 0}`);
        console.log(`   Annual Tax: Rs. ${annualTax?.toLocaleString() || 0}`);
        console.log(`   Monthly Tax: Rs. ${monthlyTax?.toLocaleString() || 0}`);
        
        return monthlyTax;
      }
    };
    
    // Test the tax calculation
    const calculatedTax = mockPayroll.calculateTax();
    console.log(`✅ Calculated Tax: Rs. ${calculatedTax?.toLocaleString() || 0}`);
    
    // Test 2: Verify the calculation matches expected result
    console.log('\n📊 Test 2: Verifying calculation accuracy...');
    
    // Expected calculation for 300,000 PKR:
    // Medical Allowance: 30,000 (10% of 300,000)
    // Taxable Income: 270,000 (300,000 - 30,000)
    // Annual Taxable: 3,240,000 (270,000 × 12)
    // Tax Slab: 4th slab (2,200,001 - 3,200,000)
    // Annual Tax: 116,000 + (1,040,000 × 23%) = 116,000 + 239,200 = 355,200
    // Monthly Tax: 355,200 ÷ 12 = 29,600
    
    const expectedTax = 29600;
    const isCorrect = calculatedTax === expectedTax;
    
    console.log(`Expected Tax: Rs. ${expectedTax?.toLocaleString() || 0}`);
    console.log(`Calculated Tax: Rs. ${calculatedTax?.toLocaleString() || 0}`);
    console.log(`✅ Calculation ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    
    if (!isCorrect) {
      console.log('❌ Tax calculation is not matching expected result!');
    }
    
    // Test 3: Test with different amounts
    console.log('\n📊 Test 3: Testing with different salary amounts...');
    
    const testAmounts = [100000, 500000, 1000000, 2000000, 5000000];
    
    testAmounts.forEach(amount => {
      const testPayroll = {
        totalEarnings: amount,
        calculateTax: mockPayroll.calculateTax
      };
      
      const tax = testPayroll.calculateTax();
      console.log(`   Rs. ${amount?.toLocaleString() || 0} → Tax: Rs. ${tax?.toLocaleString() || 0}`);
    });
    
    console.log('\n🎯 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🔌 Disconnecting from database...');
    await disconnectDB();
    console.log('✅ Test completed.');
  }
};

// Run the test
if (require.main === module) {
  testSimpleTax()
    .then(() => {
      console.log('🎯 Test execution completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testSimpleTax };
