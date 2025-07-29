const { calculateMonthlyTax, calculateTaxableIncome, getTaxSlabInfo } = require('../utils/taxCalculator');

console.log('🧪 Testing Pakistan FBR Tax Calculation (FY 2025-26)\n');

// Test cases based on different salary levels
const testCases = [
  {
    name: 'Low Income (Tax Exempt)',
    basicSalary: 40000,
    allowances: { housing: 12000, transport: 5000, meal: 3000, other: 0, medical: 5000 }
  },
  {
    name: 'Medium Income (2.5% slab)',
    basicSalary: 80000,
    allowances: { housing: 24000, transport: 8000, meal: 5000, other: 2000, medical: 8000 }
  },
  {
    name: 'High Income (12.5% slab)',
    basicSalary: 150000,
    allowances: { housing: 45000, transport: 15000, meal: 10000, other: 5000, medical: 15000 }
  },
  {
    name: 'Very High Income (20% slab)',
    basicSalary: 250000,
    allowances: { housing: 75000, transport: 25000, meal: 15000, other: 10000, medical: 25000 }
  }
];

testCases.forEach((testCase, index) => {
  console.log(`📊 Test Case ${index + 1}: ${testCase.name}`);
  console.log('─'.repeat(50));
  
  const taxableIncome = calculateTaxableIncome({
    basic: testCase.basicSalary,
    allowances: testCase.allowances
  });
  
  const monthlyTax = calculateMonthlyTax(taxableIncome);
  const annualTaxableIncome = taxableIncome * 12;
  const taxInfo = getTaxSlabInfo(annualTaxableIncome);
  
  console.log(`💰 Basic Salary: Rs ${testCase.basicSalary.toLocaleString()}`);
  console.log(`🏠 House Rent: Rs ${testCase.allowances.housing.toLocaleString()}`);
  console.log(`🚗 Transport: Rs ${testCase.allowances.transport.toLocaleString()}`);
  console.log(`🍽️ Meal: Rs ${testCase.allowances.meal.toLocaleString()}`);
  console.log(`📦 Other: Rs ${testCase.allowances.other.toLocaleString()}`);
  console.log(`🏥 Medical: Rs ${testCase.allowances.medical.toLocaleString()} (Tax Exempt)`);
  console.log(`📈 Monthly Taxable Income: Rs ${taxableIncome.toLocaleString()}`);
  console.log(`📈 Annual Taxable Income: Rs ${annualTaxableIncome.toLocaleString()}`);
  console.log(`🏷️ Tax Slab: ${taxInfo.slab}`);
  console.log(`📊 Tax Rate: ${taxInfo.rate}`);
  console.log(`💸 Monthly Tax: Rs ${monthlyTax.toLocaleString()}`);
  console.log(`💸 Annual Tax: Rs ${(monthlyTax * 12).toLocaleString()}`);
  console.log(`📝 Description: ${taxInfo.description}`);
  console.log('');
});

console.log('✅ Tax calculation test completed!'); 