# Annual Leave Carry Forward Fix

## Issue Identified

The carry forward system was not working correctly because the `remaining` field was being explicitly set during balance creation, which prevented the pre-save middleware from calculating it correctly with carry forward.

## What Was Wrong

In `server/services/annualLeaveManagementService.js`, line 150:
```javascript
remaining: newAllocation,  // ❌ Wrong - Doesn't include carry forward
```

This explicitly set `remaining` to only the new allocation (20), ignoring the carry forward amount from the previous year.

## Fix Applied

Removed the explicit `remaining` field and let the pre-save middleware calculate it:
```javascript
// Pre-save middleware automatically calculates:
this.remaining = Math.max(0, this.allocated + this.carryForward - this.used);
```

## How Carry Forward Works Now

### Year-by-Year Example (Employee 06387, Joined Oct 20, 2021)

#### Year 0 (2021)
- Anniversary Date: Oct 20, 2021
- Allocated: 0 (hasn't completed 1 year yet)
- Used: 0
- Remaining: 0
- Carry Forward: 0
- Total: 0

#### Year 1 (2022) - First Anniversary
- Anniversary Date: Oct 20, 2022
- Allocated: 20 (new allocation)
- Used: 10 (example)
- Remaining: 10 (allocated - used)
- Carry Forward: 0 (no previous year)
- Total: 20

#### Year 2 (2023) - Second Anniversary
- Anniversary Date: Oct 20, 2023
- Allocated: 20 (new allocation)
- Carry Forward: 10 (from 2022 remaining)
- Used: 0 (so far)
- Remaining: 30 (allocated + carryForward - used = 20 + 10 - 0)
- Total: 30

#### Year 3 (2024) - Third Anniversary
- Anniversary Date: Oct 20, 2024
- If employee used 5 days in 2023:
  - Allocated: 20 (new allocation)
  - Carry Forward: 25 (from 2023 remaining: 30 - 5)
  - Used: 0 (so far)
  - Remaining: 45 (allocated + carryForward - used = 20 + 25 - 0)
  - Total: 45
  
**Cap Enforcement:** Since total exceeds 40, oldest buckets are reduced until total = 40

## Calculation Flow

1. **On Anniversary:**
   - Previous year's `remaining` becomes this year's `carryForward`
   - New `allocated` = 20
   - `total` = `allocated` + `carryForward`
   - Pre-save middleware calculates: `remaining` = `allocated` + `carryForward` - `used`

2. **On Leave Usage:**
   - Deduct from `carryForward` first (oldest-first rule)
   - Then deduct from `allocated`
   - Increment `used`
   - Pre-save middleware recalculates `remaining`

3. **40-Day Cap:**
   - Applied after anniversary processing
   - Removes from oldest buckets first

## Testing

To test the fix:

1. Check employee balance via API:
   ```bash
   GET /api/annual-leave/balance/:employeeId
   ```

2. Verify carry forward amounts match previous year's remaining

3. Ensure remaining = allocated + carryForward - used

## Notes

- The system uses oldest-first deduction rule
- Carry forward max is enforced by 40-day cap
- Pre-save middleware ensures calculations are always correct
- All changes are logged in LeaveTransaction model

