# Anniversary-Based Leave Management System

## 🎯 Overview

The Anniversary-Based Leave Management System implements individual employee leave allocation based on their work anniversary date rather than calendar year. This ensures fair and accurate leave distribution according to each employee's individual joining date.

## 📋 Leave Rules

### **Annual Leaves**
- **Allocation**: 20 days per year
- **Timing**: Given **AFTER** completing 1 year of service
- **Carry Forward**: Yes, for up to 2 years
- **Expiration**: Automatically expire after 2 years

### **Sick Leaves**
- **Allocation**: 10 days per year
- **Timing**: Given from **first year** of service
- **Carry Forward**: No, renew annually
- **Expiration**: Reset to 10 on anniversary

### **Casual Leaves**
- **Allocation**: 10 days per year
- **Timing**: Given from **first year** of service
- **Carry Forward**: No, renew annually
- **Expiration**: Reset to 10 on anniversary

## 🏗️ System Architecture

### **Database Schema Changes**

#### LeaveBalance Model
```javascript
{
  employee: ObjectId,
  year: Number,           // Calendar year
  workYear: Number,       // Work year (1, 2, 3...)
  expirationDate: Date,  // For annual leave expiration
  isCarriedForward: Boolean,
  annual: { allocated, used, remaining, carriedForward, advance },
  sick: { allocated, used, remaining, carriedForward, advance },
  casual: { allocated, used, remaining, carriedForward, advance }
}
```

#### LeaveRequest Model
```javascript
{
  // ... existing fields ...
  leaveYear: Number,     // Calendar year
  workYear: Number,      // Work year when leave was taken
}
```

### **Core Services**

#### LeaveIntegrationService
- `calculateWorkYear(hireDate, currentDate)` - Calculate work year
- `processAnniversaryAllocation(employeeId, workYear)` - Allocate leaves for work year
- `processAnniversaryRenewals()` - Process renewals for all employees
- `expireOldAnnualLeaves()` - Expire annual leaves older than 2 years
- `getEmployeeAnniversaryInfo(employeeId)` - Get anniversary details
- `getWorkYearBalance(employeeId, workYear)` - Get balance for specific work year

#### AnniversaryLeaveScheduler
- **Monthly Processing**: Runs on 1st of every month at 2:00 AM
- **Tasks**:
  1. Check for work anniversaries
  2. Renew Sick/Casual leaves
  3. Allocate Annual leaves (after 1 year)
  4. Process carry forward
  5. Expire old annual leaves

## 🔄 Workflow

### **New Employee Onboarding**
1. Employee joins on `hireDate`
2. System calculates `workYear = 1`
3. Allocates: Sick (10), Casual (10), Annual (0)
4. Creates LeaveBalance record for work year 1

### **First Anniversary**
1. Employee completes 1 year
2. System calculates `workYear = 2`
3. Allocates: Sick (10), Casual (10), Annual (20)
4. Creates new LeaveBalance record for work year 2

### **Subsequent Anniversaries**
1. Employee completes another year
2. System calculates new `workYear`
3. Renews: Sick (10), Casual (10), Annual (20)
4. Carries forward unused annual leaves (max 2 years)

### **Annual Leave Expiration**
1. Monthly scheduler checks `expirationDate`
2. Expires annual leaves older than 2 years
3. Updates balance records

## 🚀 API Endpoints

### **Anniversary Information**
```
GET /api/leaves/anniversary/info/:employeeId
GET /api/leaves/anniversary/balance/:employeeId/:workYear
```

### **Management Operations**
```
POST /api/leaves/anniversary/process-renewals
POST /api/leaves/anniversary/expire-old-leaves
GET /api/leaves/anniversary/upcoming
```

### **Scheduler Control**
```
GET /api/leaves/anniversary/scheduler/status
POST /api/leaves/anniversary/scheduler/start
POST /api/leaves/anniversary/scheduler/stop
POST /api/leaves/anniversary/scheduler/run-manual
```

## 📊 Examples

### **Employee Timeline**

**Employee hired: January 15, 2023**

| Date | Work Year | Annual | Sick | Casual | Notes |
|------|-----------|--------|------|--------|-------|
| Jan 15, 2023 | 1 | 0 | 10 | 10 | First year - no annual leaves |
| Jan 15, 2024 | 2 | 20 | 10 | 10 | First anniversary - gets annual leaves |
| Jan 15, 2025 | 3 | 20 | 10 | 10 | Second anniversary - renewal |
| Jan 15, 2026 | 4 | 20 | 10 | 10 | Third anniversary - renewal |

### **Carry Forward Example**

**Employee with unused annual leaves:**

| Work Year | Allocated | Used | Remaining | Carried Forward |
|-----------|-----------|-------|-----------|-----------------|
| Year 2 | 20 | 5 | 15 | 15 |
| Year 3 | 20 | 8 | 27 | 15 (from Year 2) |
| Year 4 | 20 | 10 | 30 | 15 (from Year 2) |
| Year 5 | 20 | 5 | 35 | 15 (from Year 2) |

**After 2 years (Year 5):**
- Year 2 leaves expire
- Carried forward: 0
- Total available: 20 (current year only)

## 🔧 Configuration

### **Scheduler Settings**
- **Frequency**: Monthly (1st of every month)
- **Time**: 2:00 AM Pakistan Time
- **Timezone**: Asia/Karachi

### **Leave Limits**
- **Annual**: 20 days (configurable per employee)
- **Sick**: 10 days (configurable per employee)
- **Casual**: 10 days (configurable per employee)

### **Expiration Rules**
- **Annual**: 2 years from allocation
- **Sick/Casual**: Reset annually (no carry forward)

## 🧪 Testing

Run the test script to verify implementation:
```bash
node server/scripts/test-anniversary-leave-system.js
```

## 📈 Benefits

1. **Fair Allocation**: Each employee gets leaves based on their individual anniversary
2. **Automatic Processing**: Monthly scheduler handles renewals and expiration
3. **Flexible Configuration**: Per-employee leave limits supported
4. **Accurate Tracking**: Work year-based balance tracking
5. **Compliance**: Follows standard HR practices for leave management

## 🔒 Security

- All endpoints require authentication
- Super Admin access for scheduler control
- Admin/HR Manager access for employee data
- Input validation and error handling

## 📝 Migration Notes

- Existing leave records remain unchanged
- New fields added to models (backward compatible)
- Scheduler starts automatically on server startup
- No data migration required for existing employees

---

**Implementation Status**: ✅ **COMPLETE**
**Last Updated**: January 2025
**Version**: 1.0.0
