# Leave Management Integration with Employees and Payroll

## Implementation Summary

This document outlines the complete integration of the Leave Management module with the Employee and Payroll modules.

---

## ✅ Completed Backend Implementation

### 1. Database Models

#### Updated Employee Model (`server/models/hr/Employee.js`)
- ✅ Added `leaveConfig` field:
  - `annualLimit`: Default 20 days (configurable per employee)
  - `sickLimit`: Default 10 days (configurable per employee)
  - `casualLimit`: Default 10 days (configurable per employee)
  - `useGlobalDefaults`: Boolean flag
- ✅ Added `advance` field to each leave type in `leaveBalance`:
  - `annual.advance`
  - `casual.advance`
  - `sick.advance`
  - `medical.advance`

#### New Leave Balance Model (`server/models/hr/LeaveBalance.js`)
- ✅ Created standalone model for tracking leave balances by year
- ✅ Fields: annual, sick, casual with allocated, used, remaining, carriedForward, advance
- ✅ Auto-calculates advance leaves when remaining goes negative
- ✅ Static method `getOrCreateBalance(employeeId, year)`
- ✅ Static method `updateBalanceForLeave(employeeId, leaveType, days, year)`
- ✅ Instance method `calculateAdvanceDeduction(dailyRate)`

#### Updated Payroll Model (`server/models/hr/Payroll.js`)
- ✅ Added `advanceLeaveDetails` field with:
  - `totalAdvanceLeaves`
  - `annualAdvance`
  - `sickAdvance`
  - `casualAdvance`
  - `advanceDeduction`
  - `unpaidDeduction`
  - `dailyRate`

### 2. Services

#### Leave Integration Service (`server/services/leaveIntegrationService.js`)
- ✅ `getEmployeeLeaveSummary(employeeId, year)` - Complete leave overview
- ✅ `updateEmployeeLeaveConfig(employeeId, config)` - Update custom limits
- ✅ `calculateAdvanceLeaveDeduction(employeeId, year, month, dailyRate)` - Calculate deductions
- ✅ `updateBalanceOnApproval(leaveRequestId)` - Auto-update when leave approved
- ✅ `syncLeaveBalance(employeeId, year)` - Reconcile from leave requests
- ✅ `initializeEmployeeLeaveBalance(employeeId)` - Setup for new employees
- ✅ `getMonthlyLeaveStats(employeeId, year, month)` - Monthly statistics

#### Updated Payroll Service (`server/services/payrollService.js`)
- ✅ Updated `calculateLeaveDeductions()` to include:
  - Unpaid leave deduction calculation
  - **Advance leave deduction** using `LeaveIntegrationService`
  - Daily rate calculation (basic salary / 26)
  - Detailed breakdown returned
- ✅ Updated `updatePayrollWithLeaveDeductions()` to save:
  - Total leave deduction (unpaid + advance)
  - Advance leave details in payroll document
- ✅ Updated `generatePayrollWithLeaveIntegration()` with same logic

#### Updated Leave Management Service (`server/services/leaveManagementService.js`)
- ✅ Added integration call in `approveLeaveRequest()`:
  - Calls `LeaveIntegrationService.updateBalanceOnApproval()` after approval
  - Keeps backward compatibility with existing balance update

### 3. API Routes (`server/routes/leaves.js`)

#### New Employee Leave Integration Endpoints
- ✅ `GET /api/leaves/employee/:employeeId/summary?year=YYYY`
  - Returns complete leave summary with balance and history
  - Permissions: super_admin, admin, hr_manager

- ✅ `GET /api/leaves/employee/:employeeId/balance?year=YYYY`
  - Returns leave balance for specific year
  - Permissions: super_admin, admin, hr_manager

- ✅ `PUT /api/leaves/employee/:employeeId/config`
  - Update employee-specific leave limits
  - Body: `{ annualLimit, sickLimit, casualLimit, useGlobalDefaults }`
  - Permissions: super_admin, admin, hr_manager

- ✅ `POST /api/leaves/employee/:employeeId/initialize`
  - Initialize leave balance for new employee
  - Permissions: super_admin, admin, hr_manager

- ✅ `POST /api/leaves/employee/:employeeId/sync`
  - Sync balance from approved leave requests
  - Body: `{ year }`
  - Permissions: super_admin, admin, hr_manager

- ✅ `GET /api/leaves/employee/:employeeId/advance-deduction`
  - Calculate advance leave deduction for payroll
  - Params: year, month, dailyRate
  - Permissions: super_admin, admin, hr_manager

- ✅ `GET /api/leaves/employee/:employeeId/monthly-stats`
  - Get leave statistics for specific month
  - Params: year, month
  - Permissions: super_admin, admin, hr_manager

- ✅ `GET /api/leaves/global-config`
  - Get global default leave limits
  - Returns: `{ annualLimit: 20, sickLimit: 10, casualLimit: 10 }`
  - Permissions: super_admin, admin, hr_manager

#### Updated Existing Endpoints
- ✅ All leave approval routes now include `super_admin` permission
  - `/api/leaves/requests` (GET, POST)
  - `/api/leaves/requests/:id/approve` (PUT)
  - `/api/leaves/requests/:id/reject` (PUT)
  - `/api/leaves/requests/:id/cancel` (PUT)
  - And all other leave management routes

---

## 🔄 Pending Frontend Implementation

### 1. Frontend Service (`client/src/services/leaveService.js`)
- ✅ **CREATED** - Complete service with all API methods
- Ready to use in components

### 2. Employee Detail Page Updates
**File**: `client/src/pages/HR/EmployeeView.js`

#### Required Changes:
1. **Import leave service**
   ```javascript
   import leaveService from '../../services/leaveService';
   ```

2. **Add state for leave data**
   ```javascript
   const [leaveSummary, setLeaveSummary] = useState(null);
   const [leaveLoading, setLeaveLoading] = useState(false);
   const [leaveConfigDialog, setLeaveConfigDialog] = useState(false);
   const [leaveConfig, setLeaveConfig] = useState({
     annualLimit: 20,
     sickLimit: 10,
     casualLimit: 10,
     useGlobalDefaults: true
   });
   ```

3. **Fetch leave data in useEffect**
   ```javascript
   const fetchLeaveData = async () => {
     if (!id) return;
     setLeaveLoading(true);
     try {
       const response = await leaveService.getEmployeeLeaveSummary(id);
       setLeaveSummary(response.data);
       if (response.data.leaveConfig) {
         setLeaveConfig(response.data.leaveConfig);
       }
     } catch (error) {
       console.error('Error fetching leave data:', error);
     } finally {
       setLeaveLoading(false);
     }
   };
   
   useEffect(() => {
     if (employee) {
       fetchLeaveData();
     }
   }, [employee]);
   ```

4. **Add Leaves Card Section** (after Salary Information, around line 600)
   ```jsx
   {/* Leave Information */}
   <Grid item xs={12} md={6}>
     <Card>
       <CardContent>
         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
           <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
             <EventNoteIcon />
             Leave Balance ({new Date().getFullYear()})
           </Typography>
           <Button
             size="small"
             startIcon={<EditIcon />}
             onClick={() => setLeaveConfigDialog(true)}
           >
             Configure
           </Button>
         </Box>
         
         {leaveLoading ? (
           <CircularProgress />
         ) : leaveSummary ? (
           <Grid container spacing={2}>
             {/* Annual Leave */}
             <Grid item xs={12}>
               <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                 <Typography variant="body2" color="primary.contrastText">Annual Leave</Typography>
                 <Typography variant="h6" color="primary.contrastText">
                   {leaveSummary.balance.annual.remaining} / {leaveSummary.balance.annual.allocated}
                 </Typography>
                 <Typography variant="caption" color="primary.contrastText">
                   Used: {leaveSummary.balance.annual.used} 
                   {leaveSummary.balance.annual.advance > 0 && (
                     <Chip 
                       label={`Advance: ${leaveSummary.balance.annual.advance}`} 
                       size="small" 
                       color="error" 
                       sx={{ ml: 1 }}
                     />
                   )}
                 </Typography>
               </Box>
             </Grid>
             
             {/* Sick Leave */}
             <Grid item xs={6}>
               <Typography variant="body2" color="textSecondary">Sick Leave</Typography>
               <Typography variant="h6">
                 {leaveSummary.balance.sick.remaining} / {leaveSummary.balance.sick.allocated}
               </Typography>
               <Typography variant="caption">
                 Used: {leaveSummary.balance.sick.used}
                 {leaveSummary.balance.sick.advance > 0 && (
                   <Chip label={`Adv: ${leaveSummary.balance.sick.advance}`} size="small" color="error" sx={{ ml: 0.5 }} />
                 )}
               </Typography>
             </Grid>
             
             {/* Casual Leave */}
             <Grid item xs={6}>
               <Typography variant="body2" color="textSecondary">Casual Leave</Typography>
               <Typography variant="h6">
                 {leaveSummary.balance.casual.remaining} / {leaveSummary.balance.casual.allocated}
               </Typography>
               <Typography variant="caption">
                 Used: {leaveSummary.balance.casual.used}
                 {leaveSummary.balance.casual.advance > 0 && (
                   <Chip label={`Adv: ${leaveSummary.balance.casual.advance}`} size="small" color="error" sx={{ ml: 0.5 }} />
                 )}
               </Typography>
             </Grid>
             
             {/* Statistics */}
             <Grid item xs={12}>
               <Divider sx={{ my: 1 }} />
               <Typography variant="caption" color="textSecondary">
                 Total Requests: {leaveSummary.statistics.totalRequests} | 
                 Approved: {leaveSummary.statistics.approved} | 
                 Pending: {leaveSummary.statistics.pending}
               </Typography>
             </Grid>
           </Grid>
         ) : (
           <Typography variant="body2" color="textSecondary">No leave data available</Typography>
         )}
         
         <Button 
           fullWidth 
           variant="outlined" 
           sx={{ mt: 2 }}
           onClick={() => navigate(`/hr/leaves/employee/${id}`)}
         >
           View Leave History
         </Button>
       </CardContent>
     </Card>
   </Grid>
   ```

5. **Add Leave Configuration Dialog** (before closing component)
   ```jsx
   {/* Leave Configuration Dialog */}
   <Dialog open={leaveConfigDialog} onClose={() => setLeaveConfigDialog(false)} maxWidth="sm" fullWidth>
     <DialogTitle>Configure Leave Limits</DialogTitle>
     <DialogContent>
       <Grid container spacing={2} sx={{ mt: 1 }}>
         <Grid item xs={12}>
           <FormControlLabel
             control={
               <Switch
                 checked={leaveConfig.useGlobalDefaults}
                 onChange={(e) => setLeaveConfig({ ...leaveConfig, useGlobalDefaults: e.target.checked })}
               />
             }
             label="Use Global Defaults (20, 10, 10)"
           />
         </Grid>
         
         {!leaveConfig.useGlobalDefaults && (
           <>
             <Grid item xs={12}>
               <TextField
                 fullWidth
                 label="Annual Leave Limit"
                 type="number"
                 value={leaveConfig.annualLimit}
                 onChange={(e) => setLeaveConfig({ ...leaveConfig, annualLimit: parseInt(e.target.value) })}
                 inputProps={{ min: 0, max: 365 }}
               />
             </Grid>
             <Grid item xs={12}>
               <TextField
                 fullWidth
                 label="Sick Leave Limit"
                 type="number"
                 value={leaveConfig.sickLimit}
                 onChange={(e) => setLeaveConfig({ ...leaveConfig, sickLimit: parseInt(e.target.value) })}
                 inputProps={{ min: 0, max: 365 }}
               />
             </Grid>
             <Grid item xs={12}>
               <TextField
                 fullWidth
                 label="Casual Leave Limit"
                 type="number"
                 value={leaveConfig.casualLimit}
                 onChange={(e) => setLeaveConfig({ ...leaveConfig, casualLimit: parseInt(e.target.value) })}
                 inputProps={{ min: 0, max: 365 }}
               />
             </Grid>
           </>
         )}
       </Grid>
     </DialogContent>
     <DialogActions>
       <Button onClick={() => setLeaveConfigDialog(false)}>Cancel</Button>
       <Button 
         variant="contained" 
         onClick={async () => {
           try {
             await leaveService.updateEmployeeLeaveConfig(id, leaveConfig);
             setSnackbar({ open: true, message: 'Leave configuration updated successfully', severity: 'success' });
             setLeaveConfigDialog(false);
             fetchLeaveData();
           } catch (error) {
             setSnackbar({ open: true, message: 'Failed to update leave configuration', severity: 'error' });
           }
         }}
       >
         Save
       </Button>
     </DialogActions>
   </Dialog>
   ```

### 3. Payroll Detail Page Updates
**File**: `client/src/pages/HR/PayrollDetail.js`

#### Required Changes:
1. **Find the Deductions section** (around line 800-900)

2. **Add Advance Leave Deduction Display** (after Leave Deduction)
   ```jsx
   {/* After existing Leave Deduction row */}
   {payroll.advanceLeaveDetails && payroll.advanceLeaveDetails.totalAdvanceLeaves > 0 && (
     <>
       <TableRow>
         <TableCell colSpan={2}>
           <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
             Advance Leave Breakdown:
           </Typography>
         </TableCell>
       </TableRow>
       
       {payroll.advanceLeaveDetails.annualAdvance > 0 && (
         <TableRow>
           <TableCell sx={{ pl: 4 }}>
             <Typography variant="body2">Annual Advance ({payroll.advanceLeaveDetails.annualAdvance} days)</Typography>
           </TableCell>
           <TableCell align="right">
             <Typography variant="body2" color="error">
               {formatPKR(payroll.advanceLeaveDetails.annualAdvance * payroll.advanceLeaveDetails.dailyRate)}
             </Typography>
           </TableCell>
         </TableRow>
       )}
       
       {payroll.advanceLeaveDetails.sickAdvance > 0 && (
         <TableRow>
           <TableCell sx={{ pl: 4 }}>
             <Typography variant="body2">Sick Advance ({payroll.advanceLeaveDetails.sickAdvance} days)</Typography>
           </TableCell>
           <TableCell align="right">
             <Typography variant="body2" color="error">
               {formatPKR(payroll.advanceLeaveDetails.sickAdvance * payroll.advanceLeaveDetails.dailyRate)}
             </Typography>
           </TableCell>
         </TableRow>
       )}
       
       {payroll.advanceLeaveDetails.casualAdvance > 0 && (
         <TableRow>
           <TableCell sx={{ pl: 4 }}>
             <Typography variant="body2">Casual Advance ({payroll.advanceLeaveDetails.casualAdvance} days)</Typography>
           </TableCell>
           <TableCell align="right">
             <Typography variant="body2" color="error">
               {formatPKR(payroll.advanceLeaveDetails.casualAdvance * payroll.advanceLeaveDetails.dailyRate)}
             </Typography>
           </TableCell>
         </TableRow>
       )}
       
       <TableRow>
         <TableCell sx={{ pl: 4 }}>
           <Typography variant="body2" fontWeight="bold">
             Total Advance Deduction ({payroll.advanceLeaveDetails.totalAdvanceLeaves} days)
           </Typography>
         </TableCell>
         <TableCell align="right">
           <Typography variant="body2" fontWeight="bold" color="error">
             {formatPKR(payroll.advanceLeaveDetails.advanceDeduction)}
           </Typography>
         </TableCell>
       </TableRow>
       
       <TableRow>
         <TableCell colSpan={2}>
           <Alert severity="info" sx={{ mt: 1 }}>
             Daily Rate: {formatPKR(payroll.advanceLeaveDetails.dailyRate)} | 
             Unpaid Leave Deduction: {formatPKR(payroll.advanceLeaveDetails.unpaidDeduction)}
           </Alert>
         </TableCell>
       </TableRow>
     </>
   )}
   ```

### 4. Leave Management Module - Global Configuration
**File**: `client/src/pages/HR/Leaves/LeaveManagement.js`

#### Add Global Configuration Section:
```jsx
{/* Global Configuration Card */}
<Card sx={{ mb: 3 }}>
  <CardContent>
    <Typography variant="h6" gutterBottom>
      Global Leave Configuration
    </Typography>
    <Typography variant="body2" color="textSecondary" paragraph>
      These are the default leave limits applied to new employees. 
      Individual employees can have custom limits configured on their profile.
    </Typography>
    
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Annual Leave Default"
          type="number"
          value={globalConfig.annualLimit}
          onChange={(e) => setGlobalConfig({ ...globalConfig, annualLimit: parseInt(e.target.value) })}
          inputProps={{ min: 0, max: 365 }}
          helperText="Currently: 20 days per year"
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Sick Leave Default"
          type="number"
          value={globalConfig.sickLimit}
          onChange={(e) => setGlobalConfig({ ...globalConfig, sickLimit: parseInt(e.target.value) })}
          inputProps={{ min: 0, max: 365 }}
          helperText="Currently: 10 days per year"
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth
          label="Casual Leave Default"
          type="number"
          value={globalConfig.casualLimit}
          onChange={(e) => setGlobalConfig({ ...globalConfig, casualLimit: parseInt(e.target.value) })}
          inputProps={{ min: 0, max: 365 }}
          helperText="Currently: 10 days per year"
        />
      </Grid>
      <Grid item xs={12}>
        <Button variant="contained" onClick={handleUpdateGlobalConfig}>
          Update Global Defaults
        </Button>
      </Grid>
    </Grid>
  </CardContent>
</Card>
```

---

## 🎯 Integration Flow

### 1. New Employee Creation
```
1. Employee created with default leave config (20, 10, 10)
2. LeaveBalance automatically created on first access
3. Employee model has leaveConfig with useGlobalDefaults = true
```

### 2. Leave Request Approval
```
1. HR approves leave request
2. LeaveManagementService.approveLeaveRequest() called
3. Triggers LeaveIntegrationService.updateBalanceOnApproval()
4. Updates both Employee.leaveBalance and LeaveBalance model
5. If leaves go negative, advance leaves calculated automatically
```

### 3. Payroll Generation
```
1. Payroll generated for month
2. PayrollService.calculateLeaveDeductions() called
3. Fetches unpaid leave days from approved requests
4. Calls LeaveIntegrationService.calculateAdvanceLeaveDeduction()
5. Combines unpaid + advance deductions
6. Saves detailed breakdown in payroll.advanceLeaveDetails
7. Total deduction = (unpaid days * daily rate) + (advance days * daily rate)
```

### 4. Viewing Employee Leave Info
```
1. Navigate to Employee Detail page
2. Fetches leave summary via leaveService.getEmployeeLeaveSummary()
3. Displays balance for all leave types
4. Shows advance leaves with warning chips
5. Click "Configure" to modify limits
6. Changes saved to employee.leaveConfig
```

---

## 📊 Database Schema

### Employee Leave Fields
```javascript
{
  leaveConfig: {
    annualLimit: 20,
    sickLimit: 10,
    casualLimit: 10,
    useGlobalDefaults: true
  },
  leaveBalance: {
    annual: { allocated: 20, used: 5, remaining: 15, carriedForward: 0, advance: 0 },
    sick: { allocated: 10, used: 2, remaining: 8, carriedForward: 0, advance: 0 },
    casual: { allocated: 10, used: 12, remaining: 0, carriedForward: 0, advance: 2 } // 2 days advance
  }
}
```

### LeaveBalance Collection
```javascript
{
  employee: ObjectId,
  year: 2025,
  annual: { allocated: 20, used: 5, remaining: 15, carriedForward: 0, advance: 0 },
  sick: { allocated: 10, used: 2, remaining: 8, carriedForward: 0, advance: 0 },
  casual: { allocated: 10, used: 12, remaining: 0, carriedForward: 0, advance: 2 },
  totalAdvanceLeaves: 2
}
```

### Payroll Advance Leave Details
```javascript
{
  advanceLeaveDetails: {
    totalAdvanceLeaves: 2,
    annualAdvance: 0,
    sickAdvance: 0,
    casualAdvance: 2,
    advanceDeduction: 6153.85, // 2 days * daily rate
    unpaidDeduction: 0,
    dailyRate: 3076.92 // basic / 26
  },
  leaveDeduction: 6153.85 // Total
}
```

---

## 🔐 Permissions

All leave integration endpoints require one of:
- `super_admin`
- `admin`
- `hr_manager`

---

## ✨ Key Features

1. ✅ **Configurable Leave Limits** - Per employee or global defaults
2. ✅ **Automatic Advance Tracking** - When leaves exceed allocated
3. ✅ **Automatic Deductions** - Advance leaves deducted from payroll
4. ✅ **Complete Integration** - Employee → Leave → Payroll connected
5. ✅ **Backward Compatible** - Works with existing leave system
6. ✅ **Year-Based Tracking** - Separate balances per year
7. ✅ **Real-time Sync** - Balance updates on leave approval

---

## 📝 Testing Checklist

### Backend
- ✅ Employee model updated with leave config
- ✅ LeaveBalance model created
- ✅ LeaveIntegrationService methods working
- ✅ Payroll service calculates advance deductions
- ✅ API endpoints responding correctly
- ✅ Permissions enforced

### Frontend (Pending)
- ⏳ Employee Detail shows leave balance
- ⏳ Leave configuration dialog works
- ⏳ Payroll Detail shows advance deduction breakdown
- ⏳ Leave Management has global config section

---

## 🚀 Deployment Notes

1. Run database migration (models updated)
2. Existing employees will get default config on first access
3. Existing payrolls won't have advanceLeaveDetails (will be null)
4. New payrolls will calculate and store advance details
5. Frontend changes are non-breaking additions

---

## 📞 Support

For questions or issues with this integration:
1. Check API endpoints with Postman/Thunder Client
2. Verify permissions in middleware
3. Check console logs for service errors
4. Ensure LeaveBalance collection exists in MongoDB

---

**Implementation Date**: January 2025  
**Status**: Backend Complete ✅ | Frontend Pending ⏳  
**Version**: 1.0

