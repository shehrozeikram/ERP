# Tax Calculation Structure

## Overview
Updated the tax calculation system to properly handle the new salary structure according to FBR 2025-2026 rules where only medical allowance is tax-exempt and all other allowances are taxable.

## New Salary Structure

### Salary Breakdown:
- **Basic Salary**: 66.66% of gross salary (**Taxable**)
- **Medical Allowance**: 10% of gross salary (**Tax-Exempt**)
- **House Rent Allowance**: 23.34% of gross salary (**Taxable**)

### Tax Calculation Logic:
```
Taxable Income = Basic Salary + House Rent Allowance + Conveyance Allowance + Meal Allowance + Other Allowances
Tax-Exempt Income = Medical Allowance (Only)
```

## Tax Calculation Examples

### Example 1: 100,000 PKR Gross Salary + 50,000 PKR Conveyance
- **Basic Salary**: 66,660 PKR (66.66%) - **Taxable**
- **Medical Allowance**: 10,000 PKR (10%) - **Tax-Exempt**
- **House Rent Allowance**: 23,340 PKR (23.34%) - **Taxable**
- **Conveyance Allowance**: 50,000 PKR - **Taxable**
- **Total**: 150,000 PKR
- **Taxable Income**: 140,000 PKR (66,660 + 23,340 + 50,000)
- **Annual Taxable Income**: 1,680,000 PKR
- **Monthly Tax**: 8,500 PKR (based on FBR tax slabs)
- **Tax on Conveyance**: 3,036 PKR (35.7% of total tax)

### Example 2: 200,000 PKR Gross Salary + Multiple Allowances
- **Basic Salary**: 133,320 PKR (66.66%) - **Taxable**
- **Medical Allowance**: 20,000 PKR (10%) - **Tax-Exempt**
- **House Rent Allowance**: 46,680 PKR (23.34%) - **Taxable**
- **Conveyance Allowance**: 30,000 PKR - **Taxable**
- **Meal Allowance**: 15,000 PKR - **Taxable**
- **Total**: 245,000 PKR
- **Taxable Income**: 225,000 PKR (133,320 + 46,680 + 30,000 + 15,000)
- **Annual Taxable Income**: 2,700,000 PKR
- **Monthly Tax**: 25,417 PKR (based on FBR tax slabs)

## Implementation Details

### Backend Tax Calculator (`server/utils/taxCalculator.js`)

```javascript
function calculateTaxableIncome(salary) {
  let taxableIncome = 0;

  // Add basic salary (66.66% of gross - taxable)
  if (salary.basic) {
    taxableIncome += salary.basic;
  }

  // Add house rent allowance (23.34% of gross - taxable)
  if (salary.allowances && salary.allowances.housing) {
    taxableIncome += salary.allowances.housing;
  }

  // Add other allowances (all taxable except medical)
  if (salary.allowances) {
    if (salary.allowances.transport) {
      taxableIncome += salary.allowances.transport;
    }
    if (salary.allowances.meal) {
      taxableIncome += salary.allowances.meal;
    }
    if (salary.allowances.other) {
      taxableIncome += salary.allowances.other;
    }
  }

  // Medical allowance (10% of gross) is tax-exempt, so we don't add it
  // According to FBR 2025-2026: Only medical allowance is tax-exempt
  // All other allowances (conveyance, meal, transport, etc.) are taxable

  return taxableIncome;
}
```

### Frontend Tax Calculation (`client/src/pages/HR/PayrollForm.js`)

```javascript
const calculateTaxInfo = async (basicSalary, allowances) => {
  // Calculate taxable income based on new salary structure:
  // - 66.66% Basic Salary (taxable)
  // - 10% Medical Allowance (tax-exempt)
  // - 23.34% House Rent Allowance (taxable)
  // - Other Allowances (conveyance, meal, transport, etc.) are taxable
  const taxableIncome = basicSalary + 
    (allowances?.housing || 0) + 
    (allowances?.transport || 0) + 
    (allowances?.meal || 0) + 
    (allowances?.other || 0);
  // Only medical allowance is tax-exempt according to FBR 2025-2026
  // All other allowances are taxable

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
Taxable Income = Basic Salary + House Rent Allowance + Conveyance Allowance + Meal Allowance + Other Allowances
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

1. **Tax Compliance**: Properly excludes medical allowance from taxation
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

All calculations correctly include conveyance and other allowances in taxable income while excluding only medical allowance.

## Important Notes

1. **Medical Allowance**: Always tax-exempt regardless of amount (FBR 2025-2026)
2. **Basic Salary**: Always taxable (66.66% of gross)
3. **House Rent Allowance**: Always taxable (23.34% of gross)
4. **Conveyance Allowance**: Always taxable (FBR 2025-2026)
5. **Meal Allowance**: Always taxable (FBR 2025-2026)
6. **Other Allowances**: Always taxable (FBR 2025-2026)
7. **FBR Compliance**: Uses official FBR tax slabs
8. **Annual Calculation**: Tax calculated on annual basis then divided by 12 