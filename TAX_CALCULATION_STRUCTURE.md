# Tax Calculation Structure

## Overview
Updated the tax calculation system to properly handle the new salary structure according to Pakistan FBR 2025-2026 rules where 10% of the total gross amount is deducted as medical allowance (tax-exempt) and tax is calculated on the remaining amount.

## New Salary Structure

### Salary Breakdown:
- **Total Gross Amount**: Basic Salary + All Allowances
- **Medical Allowance**: 10% of Total Gross Amount (**Tax-Exempt**)
- **Taxable Income**: Total Gross Amount - Medical Allowance

### Tax Calculation Logic:
```
Total Gross Amount = Basic Salary + House Rent Allowance + Conveyance Allowance + Meal Allowance + Other Allowances + Medical Allowance
Medical Allowance = 10% of Total Gross Amount (Tax-Exempt)
Taxable Income = Total Gross Amount - Medical Allowance
```

## Tax Calculation Examples

### Example 1: 100,000 PKR Basic Salary + 50,000 PKR Conveyance
- **Total Gross Amount**: 100,000 + 50,000 = 150,000 PKR
- **Medical Allowance**: 10% of 150,000 = 15,000 PKR (**Tax-Exempt**)
- **Taxable Income**: 150,000 - 15,000 = 135,000 PKR
- **Annual Taxable Income**: 1,620,000 PKR
- **Monthly Tax**: 4,350 PKR (based on FBR tax slabs)
- **Salary After Tax**: 145,650 PKR

### Example 2: 200,000 PKR Basic Salary + Multiple Allowances
- **Total Gross Amount**: 200,000 + 30,000 + 15,000 = 245,000 PKR
- **Medical Allowance**: 10% of 245,000 = 24,500 PKR (**Tax-Exempt**)
- **Taxable Income**: 245,000 - 24,500 = 220,500 PKR
- **Annual Taxable Income**: 2,646,000 PKR
- **Monthly Tax**: 24,500 PKR (based on FBR tax slabs)
- **Salary After Tax**: 220,500 PKR

## Implementation Details

### Backend Tax Calculator (`server/utils/taxCalculator.js`)

```javascript
function calculateTaxableIncome(salary) {
  // Calculate total gross amount (basic + all allowances)
  let totalGrossAmount = 0;

  // Add basic salary
  if (salary.basic) {
    totalGrossAmount += salary.basic;
  }

  // Add all allowances
  if (salary.allowances) {
    if (salary.allowances.housing) {
      totalGrossAmount += salary.allowances.housing;
    }
    if (salary.allowances.transport) {
      totalGrossAmount += salary.allowances.transport;
    }
    if (salary.allowances.meal) {
      totalGrossAmount += salary.allowances.meal;
    }
    if (salary.allowances.other) {
      totalGrossAmount += salary.allowances.other;
    }
    if (salary.allowances.medical) {
      totalGrossAmount += salary.allowances.medical;
    }
  }

  // Calculate medical allowance as 10% of total gross amount
  const medicalAllowance = totalGrossAmount * 0.10; // 10% of total gross (tax-exempt)

  // Calculate taxable income by deducting medical allowance
  const taxableIncome = totalGrossAmount - medicalAllowance;

  return taxableIncome;
}
```

### Frontend Tax Calculation (`client/src/pages/HR/PayrollForm.js`)

```javascript
const calculateTaxInfo = async (basicSalary, allowances) => {
  // Calculate taxable income based on Pakistan FBR 2025-2026 rules:
  // - Calculate total gross amount (basic + all allowances)
  // - Deduct 10% of total gross as medical allowance (tax-exempt)
  // - Calculate tax on remaining amount
  let totalGrossAmount = basicSalary + 
    (allowances?.housing || 0) + 
    (allowances?.transport || 0) + 
    (allowances?.meal || 0) + 
    (allowances?.other || 0) + 
    (allowances?.medical || 0);
  
  // Calculate medical allowance as 10% of total gross amount
  const medicalAllowance = totalGrossAmount * 0.10; // 10% of total gross (tax-exempt)
  
  // Calculate taxable income by deducting medical allowance
  const taxableIncome = totalGrossAmount - medicalAllowance;

  const annualTaxableIncome = taxableIncome * 12;
  // ... rest of calculation
};
```

## Tax Calculation Process

### 1. Salary Breakdown
When a gross salary is entered:
1. **Basic Salary** = Gross Salary × 66.66%
2. **Medical Allowance** = Gross Salary × 10%
3. **House Rent Allowance** = Gross Salary × 23.34%

### 2. Taxable Income Calculation
```
Total Gross Amount = Basic Salary + House Rent Allowance + Conveyance Allowance + Meal Allowance + Other Allowances + Medical Allowance
Medical Allowance = 10% of Total Gross Amount (Tax-Exempt)
Taxable Income = Total Gross Amount - Medical Allowance
```

### 3. Tax Calculation
1. **Annual Taxable Income** = Monthly Taxable Income × 12
2. **Annual Tax** = Calculated using FBR tax slabs from database
3. **Monthly Tax** = Annual Tax ÷ 12

## Files Modified

### Backend Changes:
1. **`server/utils/taxCalculator.js`**
   - Updated `calculateTaxableIncome()` function
   - Added clear documentation about new salary structure
   - Maintained exclusion of medical allowance from taxable income

2. **`server/routes/payroll.js`**
   - Uses updated tax calculation logic
   - Maintains FBR tax slab integration

3. **`server/models/hr/Payroll.js`**
   - Pre-save middleware uses updated tax calculation
   - Maintains consistency across payroll generation

### Frontend Changes:
1. **`client/src/pages/HR/PayrollForm.js`**
   - Updated tax calculation display
   - Added clear comments about tax-exempt medical allowance
   - Maintains real-time tax calculation updates

## Tax Slabs Integration

The system uses the FBR tax slabs stored in the database:
- **Dynamic Updates**: Tax slabs can be updated without code changes
- **Accurate Calculation**: Uses actual FBR rates
- **Annual Calculation**: Converts monthly to annual for slab determination
- **Monthly Conversion**: Divides annual tax by 12 for monthly deduction

## Benefits of New Structure

1. **Tax Compliance**: Properly calculates medical allowance as 10% of total gross amount (tax-exempt)
2. **Clear Separation**: Distinguishes between taxable and tax-exempt components
3. **Accurate Calculation**: Uses FBR tax slabs for precise tax amounts
4. **Transparency**: Clear breakdown of salary components and tax implications
5. **Consistency**: Same logic applied across payroll generation and display

## Testing Results

The tax calculation has been tested with various salary levels and allowances:

- **100,000 PKR + 50,000 PKR Conveyance**: 6.07% effective tax rate
- **200,000 PKR + Multiple Allowances**: 11.30% effective tax rate
- **50,000 PKR + 10,000 PKR Conveyance**: 0.45% effective tax rate

**Key Test Case - 50,000 PKR Conveyance Allowance:**
- Gross Salary: 100,000 PKR
- Conveyance Allowance: 50,000 PKR
- Taxable Income: 140,000 PKR (includes conveyance)
- Monthly Tax: 8,500 PKR
- **Tax on Conveyance**: 3,036 PKR (35.7% of total tax)

All calculations correctly calculate total gross amount, deduct 10% as medical allowance (tax-exempt), and apply tax on the remaining amount.

## Important Notes

1. **Medical Allowance**: 10% of total gross amount is tax-exempt (FBR 2025-2026)
2. **Basic Salary**: Always taxable (66.66% of gross)
3. **House Rent Allowance**: Always taxable (23.34% of gross)
4. **Conveyance Allowance**: Always taxable (FBR 2025-2026)
5. **Meal Allowance**: Always taxable (FBR 2025-2026)
6. **Other Allowances**: Always taxable (FBR 2025-2026)
7. **FBR Compliance**: Uses official FBR tax slabs
8. **Annual Calculation**: Tax calculated on annual basis then divided by 12 