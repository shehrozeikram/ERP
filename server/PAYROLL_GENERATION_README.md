# Payroll Generation API Documentation

## Overview
The Payroll Generation API automatically creates payroll records for all active employees for a specified month and year. It implements the exact salary calculation formula as requested:

- **Gross Salary** = Basic Salary (66.66%) + Medical Allowance (10%) + House Rent (23.34%)
- **Total Earnings** = Gross Salary + All Allowances + Overtime + Bonuses
- **Income Tax** = Calculated on 90% of Total Earnings (Medical Allowance is tax-exempt)
- **Net Salary** = Total Earnings - Total Deductions

## API Endpoint

### POST `/api/payroll`

Generates payrolls for all active employees for a specified month and year.

#### Request Body
```json
{
  "month": 12,           // Required: Month (1-12)
  "year": 2024,          // Required: Year (2020+)
  "forceRegenerate": false // Optional: Force regenerate existing payrolls
}
```

#### Response
```json
{
  "success": true,
  "message": "Successfully generated 25 payrolls for 12/2024",
  "data": {
    "summary": {
      "totalEmployees": 25,
      "month": 12,
      "year": 2024,
      "totalGrossSalary": 2500000,
      "totalNetSalary": 2100000,
      "totalTax": 400000,
      "averageGrossSalary": 100000,
      "averageNetSalary": 84000,
      "averageTax": 16000
    },
    "payrolls": [...],
    "errors": null
  }
}
```

## Salary Calculation Formula

### 1. Basic Salary Breakdown
- **Basic Salary**: 66.66% of Gross Salary
- **Medical Allowance**: 10% of Gross Salary  
- **House Rent Allowance**: 23.34% of Gross Salary

### 2. Total Earnings Calculation
```
Total Earnings = Gross Salary + Additional Allowances + Overtime + Bonuses
```

Where Additional Allowances include:
- Conveyance Allowance
- Food Allowance
- Vehicle & Fuel Allowance
- Special Allowance
- Other Allowance

### 3. Income Tax Calculation
```
Medical Allowance (Tax Exempt) = 10% of Total Earnings
Taxable Income = Total Earnings - Medical Allowance (90% of Total Earnings)
Monthly Tax = FBR 2025-2026 Tax Slabs applied to Taxable Income
```

### 4. Deductions
- **Provident Fund**: 8.34% of Basic Salary
- **Income Tax**: Calculated monthly tax
- **EOBI**: Fixed 370 PKR (Pakistan EOBI)
- **Attendance Deduction**: Based on 26-day system
- **Other Deductions**: Health insurance, loans, etc.

### 5. Net Salary
```
Net Salary = Total Earnings - Total Deductions
```

## FBR 2025-2026 Tax Slabs

| Annual Taxable Income | Tax Rate | Tax Amount |
|----------------------|----------|------------|
| Up to 600,000        | 0%       | 0          |
| 600,001 - 1,200,000 | 1%       | 1% of excess over 600,000 |
| 1,200,001 - 2,200,000 | 11%     | 6,000 + 11% of excess over 1,200,000 |
| 2,200,001 - 3,200,000 | 23%     | 116,000 + 23% of excess over 2,200,000 |
| 3,200,001 - 4,100,000 | 30%     | 346,000 + 30% of excess over 3,200,000 |
| Above 4,100,000      | 35%      | 616,000 + 35% of excess over 4,100,000 |

**Surcharge**: 9% additional tax if annual taxable income exceeds Rs. 10,000,000

## Attendance System

- **Working Days**: 26 days per month
- **Daily Rate**: Gross Salary ÷ 26
- **Attendance Deduction**: Daily Rate × Absent Days
- **Full Attendance**: Assumed for monthly payroll generation

## Usage Examples

### Generate December 2024 Payrolls
```bash
curl -X POST http://localhost:5000/api/payroll \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "month": 12,
    "year": 2024
  }'
```

### Force Regenerate Existing Payrolls
```bash
curl -X POST http://localhost:5000/api/payroll \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "month": 12,
    "year": 2024,
    "forceRegenerate": true
  }'
```

## Error Handling

### Validation Errors
- Month must be between 1-12
- Year must be 2020 or later
- Force regenerate must be boolean

### Business Logic Errors
- Payrolls already exist (unless forceRegenerate=true)
- No active employees found
- Employee salary information missing

## Testing

Use the provided test script:
```bash
node test-payroll-generation.js
```

Make sure to:
1. Update the `AUTH_TOKEN` in the test script
2. Have the server running on port 5000
3. Have active employees with salary information in the database

## Database Requirements

### Employee Model
- `employmentStatus`: Must be 'Active'
- `salary.gross`: Must exist and be > 0
- `allowances`: Optional additional allowances

### Payroll Model
- Automatically creates all required fields
- Sets status to 'Draft'
- Includes audit fields (createdBy, timestamps)

## Security

- **Authentication**: Required (Bearer token)
- **Authorization**: Admin or HR Manager only
- **Validation**: Input validation and sanitization
- **Audit**: All actions logged with user information

## Performance Considerations

- Processes employees sequentially to avoid memory issues
- Includes error handling for individual employee failures
- Provides detailed logging for debugging
- Returns comprehensive summary statistics

## Troubleshooting

### Common Issues

1. **"Payrolls already exist"**
   - Use `forceRegenerate: true` to overwrite existing payrolls

2. **"No active employees found"**
   - Check employee employment status and salary information

3. **Tax calculation errors**
   - Verify employee salary data is numeric and positive

4. **Database connection issues**
   - Check MongoDB connection and authentication

### Debug Logging

The API provides extensive console logging:
- Employee processing status
- Salary calculations
- Tax calculations
- Summary statistics

Check server console for detailed information during execution.
