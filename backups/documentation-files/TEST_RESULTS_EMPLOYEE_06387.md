# Leave History Test Results for Employee 06387

## Current Data Status

### LeaveBalance Records Found
- **Year 2021** (Work Year 0): Allocated 0, Used 0, Remaining 0, Carry Forward 0
- **Year 2022** (Work Year 1): Allocated 20, Used 0, Remaining 20, Carry Forward 0 ✅
- **Year 2023** (Work Year 2): Allocated 20, Used 0, Remaining 40, Carry Forward 20 ✅
- **Year 2024** (Work Year 3): Allocated 20, Used 0, Remaining 31, Carry Forward 11 ⚠️
- **Year 2025** (Work Year 4): Allocated 20, Used 0, Remaining 40, Carry Forward 20 ⚠️

### AnnualLeaveBalance Records (New System)
Created through our test script:
- **Year 2022**: Allocated 20, Used 10, Remaining 10, Carry Forward 0
- **Year 2023**: Allocated 20, Used 0, Remaining 30, Carry Forward 10 ✅

## Issues Identified

### Issue 1: Carry Forward Mismatch in LeaveBalance
The `carriedForward` field doesn't match the previous year's `remaining`:
- 2023: Has carry forward 20, but 2022 remaining is 20 ✅
- 2024: Has carry forward 11, but 2023 remaining is 40 ❌ (should be 40)
- 2025: Has carry forward 20, but 2024 remaining is 31 ❌ (should be 31)

### Issue 2: Two Separate Systems
1. **LeaveBalance System** - Used by frontend Leave History page
2. **AnnualLeaveBalance System** - New system we just fixed for carry forward

The frontend currently reads from LeaveBalance, not AnnualLeaveBalance.

## What the Frontend Will Show

Based on the LeaveBalance records for 2023 (most recent with data):
- **Annual Leave**: 40 / 40 (showing remaining / total available)
- **Carry Forward**: 20 days
- **Used**: 0 days

## Recommendations

### Option 1: Fix LeaveBalance Carry Forward Logic
The same issue exists in LeaveBalance - the carry forward calculation is incorrect.

### Option 2: Migrate Frontend to Use AnnualLeaveBalance
Update the Leave History page to read from AnnualLeaveBalance instead of LeaveBalance.

### Option 3: Sync Both Systems
Ensure both systems stay in sync when leaves are processed.

## Testing Steps

To verify the frontend shows correct data:

1. Navigate to: `/hr/leaves/employee/06387`
2. Select year 2023
3. Check if it shows:
   - Annual Leave balance: 40 / 40
   - Carry Forward: 20 days
   - Leave history table

4. The display should be consistent with LeaveBalance data structure

## Expected Frontend Display (2023)

```
Annual Leave
40 / 40
Used: 0  CF: 20

Carry Forward Details
Annual Leave Carry Forward: 20 days
```

