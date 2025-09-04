# Attendance Integration with Payroll System

## Overview

This document explains how attendance records are now integrated with payroll calculations in the SGC ERP system. The integration ensures that actual attendance data from biometric devices (ZKTeco) is used to calculate salary deductions based on absent and leave days.

## Key Features

### 1. **26-Day System**
- Uses 26 working days per month as standard
- Excludes Sundays from working days calculation
- Daily rate = Gross Salary ÷ 26

### 2. **Attendance Deduction Formula**
```
Attendance Deduction = (Absent Days + Leave Days) × Daily Rate
Daily Rate = Gross Salary ÷ Total Working Days
```

### 3. **Integration Points**
- **Bulk Payroll Generation**: Automatically fetches attendance records for each employee
- **Individual Payroll Updates**: Recalculates when attendance changes
- **Real-time Updates**: Payroll updates when attendance records are modified

## Implementation Details

### Files Modified/Created

1. **`server/services/attendanceIntegrationService.js`**
   - New service to handle attendance integration
   - Methods for calculating working days and attendance summaries
   - Handles attendance deduction calculations

2. **`server/routes/payroll.js`**
   - Updated bulk payroll generation to use actual attendance
   - Added demo route for testing integration
   - Integrated with AttendanceIntegrationService

3. **`server/utils/attendanceIntegrationDemo.js`**
   - Demonstration utility showing how integration works
   - Example calculations for Mansoor Zareen

### API Endpoints

#### New Demo Endpoint
```
GET /api/payroll/demo-attendance-integration
```
- Demonstrates attendance integration with example calculations
- Shows how deductions are calculated based on actual attendance

#### Updated Bulk Payroll Generation
```
POST /api/payroll/generate-bulk
```
- Now integrates actual attendance records
- Calculates real attendance deductions
- Falls back to full attendance if no records found

## Example: Mansoor Zareen

### Employee Details
- **Name**: Mansoor Zareen
- **Employee ID**: 1001
- **Gross Salary**: Rs. 50,000
- **Basic Salary**: Rs. 33,330 (66.66%)
- **Medical Allowance**: Rs. 5,000 (10%)
- **House Rent**: Rs. 11,670 (23.34%)

### Monthly Attendance (January 2025)
- **Total Working Days**: 26
- **Present Days**: 22
- **Absent Days**: 3
- **Leave Days**: 1

### Calculations
1. **Daily Rate**: Rs. 50,000 ÷ 26 = Rs. 1,923.08
2. **Attendance Deduction**: (3 absent + 1 leave) × Rs. 1,923.08 = Rs. 7,692.32
3. **Total Earnings**: Rs. 50,000
4. **Total Deductions**: 
   - Income Tax: Rs. 2,500
   - EOBI: Rs. 370
   - Attendance Deduction: Rs. 7,692.32
   - **Total**: Rs. 10,562.32
5. **Net Salary**: Rs. 50,000 - Rs. 10,562.32 = **Rs. 39,437.68**

## How It Works

### 1. **Attendance Record Fetching**
When generating payroll for a month:
- System queries attendance records for each employee
- Filters by month and year
- Only considers active records

### 2. **Attendance Classification**
Records are classified as:
- **Present**: 'Present', 'Late', 'Half Day'
- **Absent**: 'Absent'
- **Leave**: 'Leave', 'Sick Leave', 'Personal Leave', 'Maternity Leave', 'Paternity Leave'
- **Excluded**: 'Holiday', 'Weekend'

### 3. **Working Days Calculation**
- Calculates actual working days in the month
- Excludes Sundays automatically
- Uses actual calendar days for the specific month

### 4. **Deduction Application**
- Calculates daily rate based on gross salary and working days
- Applies deduction for absent and leave days
- Includes deduction in total deductions calculation

## Benefits

1. **Accuracy**: Payroll reflects actual attendance rather than assumptions
2. **Automation**: No manual attendance entry required
3. **Consistency**: Same calculation logic across all payrolls
4. **Transparency**: Clear breakdown of attendance deductions
5. **Compliance**: Follows 26-day system requirements

## Testing

### Demo Route
Use the demo endpoint to see how the integration works:
```bash
GET /api/payroll/demo-attendance-integration
```

### Bulk Payroll Generation
Generate payroll with actual attendance:
```bash
POST /api/payroll/generate-bulk
{
  "month": 1,
  "year": 2025,
  "forceRegenerate": false
}
```

## Future Enhancements

1. **Leave Balance Integration**: Consider leave balance when calculating deductions
2. **Overtime Integration**: Include overtime hours in earnings calculation
3. **Holiday Calendar**: Integrate with holiday calendar for accurate working days
4. **Attendance Reports**: Generate detailed attendance reports for payroll verification

## Notes

- If no attendance records are found for an employee, the system assumes full attendance (26 present days)
- The integration preserves existing payroll functionality while adding attendance-based deductions
- All calculations are logged for audit purposes
- The system maintains backward compatibility with existing payroll records
