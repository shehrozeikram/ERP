# Annual Leave Management System

A comprehensive MERN-based annual leave management system that implements a sophisticated leave policy with anniversary-based allocations, carry-forward mechanisms, and automatic cap enforcement.

## 🎯 System Overview

This system implements the following annual leave policy:

- **20 annual leaves per completed year** allocated on employment anniversary date
- **First allocation occurs exactly one year after hire date**
- **Total annual leaves cannot exceed 40** (including carry forward)
- **Oldest-first deduction rule** when leaves are used
- **Automatic cap enforcement** by removing oldest carry-forward buckets
- **Complete transaction logging** for audit trails

## 📁 File Structure

```
server/
├── models/hr/
│   ├── AnnualLeaveBalance.js      # Annual leave balance model
│   └── LeaveTransaction.js        # Transaction logging model
├── services/
│   ├── annualLeaveManagementService.js  # Core business logic
│   └── annualLeaveCronService.js        # Scheduled tasks
├── routes/
│   └── annualLeave.js             # API endpoints
└── scripts/
    └── testEmployee6387Workflow.js # Comprehensive test suite
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install node-cron mongoose
```

### 2. Import Models

Add the new models to your main application:

```javascript
// In your main server file
require('./models/hr/AnnualLeaveBalance');
require('./models/hr/LeaveTransaction');
```

### 3. Add API Routes

```javascript
// In your main server file
const annualLeaveRoutes = require('./routes/annualLeave');
app.use('/api/annual-leave', annualLeaveRoutes);
```

### 4. Start Cron Service

```javascript
// In your main server file
const annualLeaveCronService = require('./services/annualLeaveCronService');

// Start the cron service
await annualLeaveCronService.start();
```

## 📊 Database Models

### AnnualLeaveBalance

Stores annual leave balances for each employee and year:

```javascript
{
  employeeId: ObjectId,     // Reference to Employee
  year: Number,            // Year (2020-2100)
  allocated: Number,       // Leaves allocated this year (0-20)
  used: Number,           // Leaves used this year
  remaining: Number,       // Leaves remaining (calculated)
  carryForward: Number,   // Leaves carried from previous year
  total: Number,          // Total leaves (allocated + carryForward)
  anniversaryDate: Date,  // Anniversary date for this year
  isActive: Boolean       // Whether this record is active
}
```

### LeaveTransaction

Logs all leave-related activities:

```javascript
{
  employeeId: ObjectId,           // Reference to Employee
  transactionType: String,        // ALLOCATION, USAGE, CARRY_FORWARD, etc.
  year: Number,                  // Year of transaction
  amount: Number,                // Number of days
  operation: String,             // ADD, SUBTRACT, SET
  balanceBefore: Object,         // Balance before transaction
  balanceAfter: Object,          // Balance after transaction
  description: String,           // Human-readable description
  processedAt: Date              // When transaction was processed
}
```

## 🔧 Core Services

### AnnualLeaveManagementService

Main service class with the following key methods:

#### `processAnniversaryAllocations(targetDate)`
Processes annual leave allocations for all employees whose anniversary is on the target date.

```javascript
const result = await AnnualLeaveManagementService.processAnniversaryAllocations(new Date());
console.log(`Processed ${result.processed} allocations`);
```

#### `deductLeaves(employeeId, days, leaveRequestId, description)`
Deducts leaves using the oldest-first rule.

```javascript
const result = await AnnualLeaveManagementService.deductLeaves(
  employeeId,
  5,
  leaveRequestId,
  'Annual leave request'
);
```

#### `getEmployeeBalance(employeeId)`
Gets comprehensive balance summary for an employee.

```javascript
const balance = await AnnualLeaveManagementService.getEmployeeBalance(employeeId);
console.log(`Total leaves: ${balance.summary.totalLeaves}`);
```

#### `applyFortyLeaveCap(employeeId)`
Applies the 40-leave cap by removing oldest buckets.

```javascript
const result = await AnnualLeaveManagementService.applyFortyLeaveCap(employeeId);
console.log(`Removed ${result.totalRemoved} days`);
```

### AnnualLeaveCronService

Handles scheduled tasks:

#### `start()`
Starts all cron jobs (daily anniversary processing, monthly reports, etc.)

```javascript
await annualLeaveCronService.start();
```

#### `stop()`
Stops all cron jobs.

```javascript
await annualLeaveCronService.stop();
```

#### `triggerAnniversaryProcessing(targetDate)`
Manually triggers anniversary processing for a specific date.

```javascript
const result = await annualLeaveCronService.triggerAnniversaryProcessing(new Date());
```

## 📅 Scheduled Tasks

The system includes the following automated tasks:

- **Daily Anniversary Processing** (2:00 AM): Processes leave allocations for employees with anniversaries
- **Monthly Reports** (1st of month, 3:00 AM): Generates anniversary processing reports
- **Yearly Cleanup** (January 1st, 4:00 AM): Archives old transactions and cleans up expired balances
- **Health Check** (Every hour): Monitors system health

## 🧪 Testing

### Employee 6387 Test Workflow

The system includes a comprehensive test suite that demonstrates the complete workflow for employee 6387 (hire date: 2021-10-21) over 8 years:

```bash
# Run the complete test workflow
node server/scripts/testEmployee6387Workflow.js
```

### API Testing

Use the provided API endpoints to test the system:

```bash
# Test employee 6387 workflow via API
curl -X POST http://localhost:3000/api/annual-leave/test/employee6387/clean

# Get employee balance
curl http://localhost:3000/api/annual-leave/balance/EMPLOYEE_ID

# Process anniversaries for today
curl -X POST http://localhost:3000/api/annual-leave/process-anniversaries

# Get anniversary report
curl http://localhost:3000/api/annual-leave/anniversary-report
```

## 📈 Example Workflow: Employee 6387

Here's how the system handles employee 6387 (hire date: 2021-10-21) over 8 years:

### Year 1 (2021-2022)
- **Status**: No leaves yet (employee must complete 1 full year)

### Year 2 (2022-2023)
- **Anniversary**: 2022-10-21
- **Allocation**: +20 leaves
- **Usage**: 5 days
- **Remaining**: 15 days

### Year 3 (2023-2024)
- **Anniversary**: 2023-10-21
- **Carry Forward**: 15 days
- **New Allocation**: +20 days
- **Total**: 35 days (below 40 cap)

### Year 4 (2024-2025)
- **Usage**: 5 days → remaining 30
- **New Allocation**: +20 days → total 50
- **Cap Enforcement**: Drop oldest 15 days → final 35

### Year 5 (2025-2026)
- **Usage**: 15 days → remaining 20
- **New Allocation**: +20 days → total 40 (within cap)

### Year 6 (2026-2027)
- **Usage**: 10 days → remaining 30
- **New Allocation**: +20 days → total 50
- **Cap Enforcement**: Drop oldest 15 days → final 35

### Year 7 (2027-2028)
- **Usage**: 5 days → remaining 30
- **New Allocation**: +20 days → total 50
- **Cap Enforcement**: Drop oldest 10 days → final 40

### Year 8 (2028-2029)
- **New Allocation**: +20 days → total 60
- **Cap Enforcement**: Drop oldest 20 days → final 40

## 🔒 Security & Validation

- **Database Transactions**: All operations use MongoDB transactions for data consistency
- **Input Validation**: All inputs are validated with proper error handling
- **Audit Trail**: Complete transaction logging for compliance
- **Error Handling**: Comprehensive error handling with detailed logging

## 🚀 Production Deployment

### Environment Variables

```bash
MONGODB_URI=mongodb://localhost:27017/sgc_erp
NODE_ENV=production
```

### Cron Service Management

```javascript
// Start cron service in production
const annualLeaveCronService = require('./services/annualLeaveCronService');

// Start with error handling
annualLeaveCronService.start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await annualLeaveCronService.stop();
  process.exit(0);
});
```

### Monitoring

Monitor the system using the health check endpoint:

```bash
curl http://localhost:3000/api/annual-leave/cron/status
```

## 📝 API Documentation

### GET `/api/annual-leave/balance/:employeeId`
Get employee's leave balance summary.

### GET `/api/annual-leave/transactions/:employeeId`
Get employee's transaction history.

### POST `/api/annual-leave/process-anniversaries`
Process anniversary allocations for a specific date.

### POST `/api/annual-leave/deduct-leaves`
Deduct leaves from employee's balance.

### POST `/api/annual-leave/test/employee6387/clean`
Run complete test workflow for employee 6387.

## 🤝 Contributing

1. Follow the existing code structure and patterns
2. Add comprehensive tests for new features
3. Update documentation for any API changes
4. Ensure all database operations use transactions

## 📄 License

This project is part of the SGC ERP system and follows the same licensing terms.

---

**Note**: This system is designed to work alongside the existing leave management system. It provides a specialized implementation for annual leaves with the specific policy requirements outlined above.
