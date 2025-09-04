const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');
const { calculateMonthlyTax, calculateTaxableIncome, calculateTaxableIncomeCorrected } = require('../utils/taxCalculator');
const FBRTaxSlab = require('../models/hr/FBRTaxSlab');
const Attendance = require('../models/hr/Attendance');
const AttendanceIntegrationService = require('../services/attendanceIntegrationService');

const router = express.Router();

/**
 * Calculate working days in a month (excluding Sundays)
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {number} Number of working days
 */
const calculateWorkingDaysInMonth = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek !== 0) { // 0 = Sunday
      workingDays++;
    }
  }
  
  return workingDays;
};

// @route   GET /api/payroll
// @desc    Get all payrolls with filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      status,
      employeeId,
      startDate,
      endDate,
      payPeriodType
    } = req.query;

    const matchStage = {};
    
    if (status) matchStage.status = status;
    if (employeeId) matchStage.employee = employeeId;
    
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Match by month and year instead of payPeriod
      matchStage.$or = [
        {
          year: { $gte: startDateObj.getFullYear(), $lte: endDateObj.getFullYear() },
          month: { $gte: startDateObj.getMonth() + 1, $lte: endDateObj.getMonth() + 1 }
        }
      ];
    }

    let query = Payroll.find(matchStage)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    // Handle limit=0 case (get all records)
    if (limit > 0) {
      query = query.limit(limit * 1).skip((page - 1) * limit);
    }
    
    const payrolls = await query.exec();

    const total = await Payroll.countDocuments(matchStage);

    res.json({
      success: true,
      data: payrolls,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  })
);

// @route   GET /api/payroll/stats
// @desc    Get payroll statistics
// @access  Private (HR and Admin)
router.get('/stats',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, status } = req.query;
    
    const stats = await Payroll.getPayrollStats({
      startDate,
      endDate,
      status
    });

    res.json({
      success: true,
      data: stats
    });
  })
);

// @route   GET /api/payroll/current-overview
// @desc    Get current payroll overview for all active employees
// @access  Private (HR and Admin)
router.get('/current-overview',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      // Get all active employees with salary information
      const activeEmployees = await Employee.find({
        employmentStatus: 'Active',
        'salary.gross': { $exists: true, $gt: 0 }
      }).select('firstName lastName employeeId salary allowances department position');

      if (activeEmployees.length === 0) {
        return res.json({
          success: true,
          data: {
            totalEmployees: 0,
            totalBasicSalary: 0,
            totalGrossSalary: 0,
            totalNetSalary: 0,
            totalMedicalAllowance: 0,
            totalTaxableIncome: 0,
            totalTax: 0,
            employees: []
          }
        });
      }

      let totalBasicSalary = 0;
      let totalGrossSalary = 0;
      let totalMedicalAllowance = 0;
      let totalTaxableIncome = 0;
      let totalTax = 0;
      let totalNetSalary = 0;

      const employeeDetails = [];

      for (const employee of activeEmployees) {
        const gross = employee.salary.gross;
        
        // Calculate salary breakdown (66.66% basic, 10% medical, 23.34% house rent)
        const basic = gross * 0.6666;
        const medical = gross * 0.1;
        const houseRent = gross * 0.2334;
        
        // Calculate additional allowances beyond basic salary breakdown
        const additionalAllowances = (employee.allowances?.conveyance?.amount || 0) +
                                   (employee.allowances?.food?.amount || 0) +
                                   (employee.allowances?.vehicleFuel?.amount || 0) +
                                   (employee.allowances?.special?.amount || 0) +
                                   (employee.allowances?.other?.amount || 0);
        
        // Total earnings = Gross salary + additional allowances
        const totalEarnings = gross + additionalAllowances;
        
        // Taxable income = Total earnings - Medical allowance (10% of total earnings)
        const taxableIncome = totalEarnings - (totalEarnings * 0.1);
        
        // Calculate monthly tax using FBR 2025-2026 tax slabs
        // Tax is calculated on taxable income (90% of total earnings)
        const monthlyTax = calculateMonthlyTax(taxableIncome);
        
        // Net salary = Total earnings - tax
        const netSalary = totalEarnings - monthlyTax;
        
        // Accumulate totals
        totalBasicSalary += basic;
        totalGrossSalary += totalEarnings;
        totalMedicalAllowance += medical;
        totalTaxableIncome += taxableIncome;
        totalTax += monthlyTax;
        totalNetSalary += netSalary;
        
        // Add employee details
        employeeDetails.push({
          _id: employee._id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId,
          basicSalary: Math.round(basic),
          grossSalary: Math.round(gross),
          additionalAllowances: Math.round(additionalAllowances),
          totalEarnings: Math.round(totalEarnings),
          medicalAllowance: Math.round(medical),
          taxableIncome: Math.round(taxableIncome),
          monthlyTax: Math.round(monthlyTax),
          netSalary: Math.round(netSalary),
          department: employee.department,
          position: employee.position
        });
      }

      // Sort employees by Employee ID
      employeeDetails.sort((a, b) => {
        const idA = parseInt(a.employeeId) || 0;
        const idB = parseInt(b.employeeId) || 0;
        return idA - idB;
      });

      res.json({
        success: true,
        data: {
          totalEmployees: activeEmployees.length,
          totalBasicSalary: Math.round(totalBasicSalary),
          totalGrossSalary: Math.round(totalGrossSalary),
          totalMedicalAllowance: Math.round(totalMedicalAllowance),
          totalTaxableIncome: Math.round(totalTaxableIncome),
          totalTax: Math.round(totalTax),
          totalNetSalary: Math.round(totalNetSalary),
          employees: employeeDetails
        }
      });
    } catch (error) {
      console.error('Error in current-overview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch current payroll overview',
        error: error.message
      });
    }
  })
);

// @route   GET /api/payroll/employee/:employeeId
// @desc    Get payroll details for a specific employee
// @access  Private (HR and Admin)
router.get('/employee/:employeeId',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid employee ID format'
        });
      }

      // Get employee details
      const employee = await Employee.findById(req.params.employeeId)
        .select('firstName lastName employeeId department position salary allowances');

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Calculate current payroll details for this employee
      const gross = employee.salary?.gross || 0;
      
      // Calculate salary breakdown (66.66% basic, 10% medical, 23.34% house rent)
      const basic = gross * 0.6666;
      const medical = gross * 0.1;
      const houseRent = gross * 0.2334;
      
      // Calculate additional allowances beyond basic salary breakdown
      const additionalAllowances = (employee.allowances?.conveyance?.amount || 0) +
                                 (employee.allowances?.food?.amount || 0) +
                                 (employee.allowances?.vehicleFuel?.amount || 0) +
                                 (employee.allowances?.special?.amount || 0) +
                                 (employee.allowances?.other?.amount || 0);
      
      // Total earnings = Gross salary + additional allowances
      const totalEarnings = gross + additionalAllowances;
      
      // Taxable income = Total earnings - Medical allowance (10% of total earnings)
      const taxableIncome = totalEarnings - (totalEarnings * 0.1);
      
      // Calculate monthly tax using FBR 2025-2026 tax slabs
      const monthlyTax = calculateMonthlyTax(taxableIncome);
      
      // Net salary = Total earnings - tax
      const netSalary = totalEarnings - monthlyTax;

      // Get existing payrolls for this employee
      const existingPayrolls = await Payroll.find({ employee: req.params.employeeId })
        .sort({ year: -1, month: -1 })
        .limit(12); // Last 12 months

      res.json({
        success: true,
        data: {
          employee: {
            _id: employee._id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeId: employee.employeeId,
            department: employee.department,
            position: employee.position
          },
          currentPayroll: {
            basicSalary: Math.round(basic),
            grossSalary: Math.round(gross),
            additionalAllowances: Math.round(additionalAllowances),
            totalEarnings: Math.round(totalEarnings),
            medicalAllowance: Math.round(medical),
            houseRentAllowance: Math.round(houseRent),
            taxableIncome: Math.round(taxableIncome),
            monthlyTax: Math.round(monthlyTax),
            netSalary: Math.round(netSalary)
          },
          existingPayrolls: existingPayrolls
        }
      });
    } catch (error) {
      console.error('Error in employee payroll details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee payroll details',
        error: error.message
      });
    }
  })
);

// @route   GET /api/payroll/view/employee/:employeeId
// @desc    Get payroll details for viewing (same as employee/:employeeId but for view route)
// @access  Private (HR and Admin)
router.get('/view/employee/:employeeId',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.employeeId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid employee ID format'
        });
      }

      // Get employee details
      const employee = await Employee.findById(req.params.employeeId)
        .select('firstName lastName employeeId department position salary allowances');

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Calculate current payroll details for this employee
      const gross = employee.salary?.gross || 0;
      
      // Calculate salary breakdown (66.66% basic, 10% medical, 23.34% house rent)
      const basic = gross * 0.6666;
      const medical = gross * 0.1;
      const houseRent = gross * 0.2334;
      
      // Calculate additional allowances beyond basic salary breakdown
      const additionalAllowances = (employee.allowances?.conveyance?.amount || 0) +
                                 (employee.allowances?.food?.amount || 0) +
                                 (employee.allowances?.vehicleFuel?.amount || 0) +
                                 (employee.allowances?.special?.amount || 0) +
                                 (employee.allowances?.other?.amount || 0);
      
      // Total earnings = Gross salary + additional allowances
      const totalEarnings = gross + additionalAllowances;
      
      // Taxable income = Total earnings - Medical allowance (10% of total earnings)
      const taxableIncome = totalEarnings - (totalEarnings * 0.1);
      
      // Calculate monthly tax using FBR 2025-2026 tax slabs
      const monthlyTax = calculateMonthlyTax(taxableIncome);
      
      // Net salary = Total earnings - tax
      const netSalary = totalEarnings - monthlyTax;

      // Get existing payrolls for this employee
      const existingPayrolls = await Payroll.find({ employee: req.params.employeeId })
        .sort({ year: -1, month: -1 })
        .limit(12); // Last 12 months

      res.json({
        success: true,
        data: {
          employee: {
            _id: employee._id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            employeeId: employee.employeeId,
            department: employee.department,
            position: employee.position
          },
          currentPayroll: {
            basicSalary: Math.round(basic),
            grossSalary: Math.round(gross),
            additionalAllowances: Math.round(additionalAllowances),
            totalEarnings: Math.round(totalEarnings),
            medicalAllowance: Math.round(medical),
            houseRentAllowance: Math.round(houseRent),
            taxableIncome: Math.round(taxableIncome),
            monthlyTax: Math.round(monthlyTax),
            netSalary: Math.round(netSalary)
          },
          existingPayrolls: existingPayrolls
        }
      });
    } catch (error) {
      console.error('Error in employee payroll details:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee payroll details',
        error: error.message
      });
    }
  })
);

// @route   GET /api/payroll/:id
// @desc    Get payroll by ID
// @access  Private (HR and Admin)
router.get('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID format'
      });
    }

    const payroll = await Payroll.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId department position salary')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    // 🔧 CALCULATE ATTENDANCE DEDUCTION FOR DISPLAY
    // This ensures the attendance deduction is always calculated correctly when viewing
    payroll.calculateAttendanceDeduction();
    
    console.log(`📊 Payroll ${payroll._id} fetched with calculated attendance deduction: Rs. ${payroll.attendanceDeduction?.toFixed(2) || 0}`);

    res.json({
      success: true,
      data: payroll
    });
  })
);

// @route   POST /api/payroll
// @desc    Generate payrolls for all active employees for a full month
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2020 }).withMessage('Year must be 2020 or later'),
  body('forceRegenerate').optional().isBoolean().withMessage('Force regenerate must be a boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { month, year, forceRegenerate = false } = req.body;

  try {
    console.log(`🚀 Starting payroll generation for ${month}/${year}...`);

    // Check if payrolls already exist for this month/year
    if (!forceRegenerate) {
      const existingPayrolls = await Payroll.countDocuments({ month, year });
      if (existingPayrolls > 0) {
        return res.status(400).json({
          success: false,
          message: `Payrolls already exist for ${month}/${year}. Use forceRegenerate: true to regenerate.`,
          existingCount: existingPayrolls,
          suggestion: 'Use forceRegenerate: true to overwrite existing payrolls'
        });
      }
    }

    // Get all active employees with salary information
    const activeEmployees = await Employee.find({
      employmentStatus: 'Active',
      'salary.gross': { $exists: true, $gt: 0 }
    }).select('firstName lastName employeeId salary allowances department position');

    if (activeEmployees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active employees found with salary information'
      });
    }

    console.log(`📊 Found ${activeEmployees.length} active employees for payroll generation`);

    const createdPayrolls = [];
    const errors = [];
    const skippedEmployees = [];
    let totalGrossSalary = 0;
    let totalNetSalary = 0;
    let totalTax = 0;

    // Generate payroll for each employee
    for (const employee of activeEmployees) {
      try {
        const grossSalary = employee.salary.gross;
        
        // 🔧 SALARY BREAKDOWN CALCULATION (66.66% basic, 10% medical, 23.34% house rent)
        const basicSalary = Math.round(grossSalary * 0.6666);
        const medicalAllowance = Math.round(grossSalary * 0.10);
        const houseRentAllowance = Math.round(grossSalary * 0.2334);
        
        // Calculate additional allowances from employee master data
        const additionalAllowances = 
          (employee.allowances?.conveyance?.isActive ? employee.allowances.conveyance.amount : 0) +
          (employee.allowances?.food?.isActive ? employee.allowances.food.amount : 0) +
          (employee.allowances?.vehicleFuel?.isActive ? employee.allowances.vehicleFuel.amount : 0) +
          (employee.allowances?.special?.isActive ? employee.allowances.special.amount : 0) +
          (employee.allowances?.other?.isActive ? employee.allowances.other.amount : 0);
        
        // 🔧 TOTAL EARNINGS = Gross Salary + All Allowances + Overtime + Bonuses
        // For monthly payroll, we'll set overtime and bonuses to 0 initially
        const totalEarnings = grossSalary + additionalAllowances;
        
        // 🔧 INCOME TAX CALCULATION (User's Formula)
        // 1. Medical allowance is 10% of total earnings (tax exempt)
        // 2. Taxable income = Total earnings - Medical allowance (90% of total earnings)
        // 3. Calculate tax on taxable income using FBR 2025-2026 slabs
        const medicalAllowanceForTax = Math.round(totalEarnings * 0.10);
        const taxableIncome = totalEarnings - medicalAllowanceForTax;
        
        // Calculate monthly tax using FBR 2025-2026 rules
        const annualTaxableIncome = taxableIncome * 12;
        let annualTax = 0;
        
        if (annualTaxableIncome <= 600000) {
          annualTax = 0;
        } else if (annualTaxableIncome <= 1200000) {
          annualTax = (annualTaxableIncome - 600000) * 0.01;
        } else if (annualTaxableIncome <= 2200000) {
          annualTax = 6000 + (annualTaxableIncome - 1200000) * 0.11;
        } else if (annualTaxableIncome <= 3200000) {
          annualTax = 116000 + (annualTaxableIncome - 2200000) * 0.23;
        } else if (annualTaxableIncome <= 4100000) {
          annualTax = 346000 + (annualTaxableIncome - 3200000) * 0.30;
        } else {
          annualTax = 616000 + (annualTaxableIncome - 4100000) * 0.35;
        }
        
        // Apply 9% surcharge if annual taxable income exceeds Rs. 10,000,000
        if (annualTaxableIncome > 10000000) {
          const surcharge = annualTax * 0.09;
          annualTax += surcharge;
        }
        
        // Convert to monthly tax
        const monthlyTax = Math.round(annualTax / 12);
        
        // 🔧 AUTO-CALCULATE OTHER DEDUCTIONS
        // Provident Fund (8.34% of basic salary)
        const providentFund = Math.round((basicSalary * 8.34) / 100);
        
        // EOBI is always 370 PKR for all employees (Pakistan EOBI fixed amount)
        const eobi = 370;
        
        // 🔧 INTEGRATE ACTUAL ATTENDANCE RECORDS USING SERVICE
        const attendanceIntegration = await AttendanceIntegrationService.getAttendanceIntegration(
          employee.employeeId, // Use employeeId field instead of _id
          month,
          year,
          grossSalary
        );
        
        const {
          presentDays,
          absentDays,
          leaveDays,
          totalWorkingDays,
          dailyRate,
          attendanceDeduction
        } = attendanceIntegration;
        
        // 🔧 TOTAL DEDUCTIONS (Provident Fund excluded as requested)
        const totalDeductions = monthlyTax + eobi + attendanceDeduction;
        
        // 🔧 NET SALARY = Total Earnings - Total Deductions
        const netSalary = totalEarnings - totalDeductions;
        
        // Create payroll data
        const payrollData = {
          employee: employee._id,
          month,
          year,
          basicSalary,
          houseRentAllowance,
          medicalAllowance,
          allowances: {
            conveyance: {
              isActive: employee.allowances?.conveyance?.isActive || false,
              amount: employee.allowances?.conveyance?.isActive ? employee.allowances.conveyance.amount : 0
            },
            food: {
              isActive: employee.allowances?.food?.isActive || false,
              amount: employee.allowances?.food?.isActive ? employee.allowances.food.amount : 0
            },
            vehicleFuel: {
              isActive: employee.allowances?.vehicleFuel?.isActive || false,
              amount: employee.allowances?.vehicleFuel?.isActive ? employee.allowances.vehicleFuel.amount : 0
            },
            medical: {
              isActive: employee.allowances?.medical?.isActive || false,
              amount: employee.allowances?.medical?.isActive ? employee.allowances.medical.amount : 0
            },
            special: {
              isActive: employee.allowances?.special?.isActive || false,
              amount: employee.allowances?.special?.isActive ? employee.allowances.special.amount : 0
            },
            other: {
              isActive: employee.allowances?.other?.isActive || false,
              amount: employee.allowances?.other?.isActive ? employee.allowances.other.amount : 0
            }
          },
          overtimeHours: 0,
          overtimeRate: 0,
          overtimeAmount: 0,
          performanceBonus: 0,
          otherBonus: 0,
          arrears: 0,
          providentFund,
          incomeTax: monthlyTax,
          healthInsurance: 0,
          vehicleLoanDeduction: 0,
          companyLoanDeduction: 0,
          otherDeductions: 0,
          eobi,
          totalWorkingDays,
          presentDays,
          absentDays,
          leaveDays,
          dailyRate,
          attendanceDeduction,
          grossSalary,
          totalEarnings,
          totalDeductions,
          netSalary,
          currency: 'PKR',
          remarks: `Monthly payroll generated for ${month}/${year}`,
          createdBy: req.user.id,
          status: 'Draft'
        };

        // Check for existing payroll and handle duplicates
        const existingPayroll = await Payroll.findOne({
          employee: employee._id,
          month,
          year
        });

        if (existingPayroll) {
          if (forceRegenerate) {
            // Delete existing payroll if forceRegenerate is true
            await Payroll.findByIdAndDelete(existingPayroll._id);
            console.log(`🔄 Regenerated payroll for ${employee.firstName} ${employee.lastName} (${employee.employeeId})`);
          } else {
            // Skip this employee if payroll already exists
            console.log(`⏭️  Skipping ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - payroll already exists for ${month}/${year}`);
            skippedEmployees.push({
              employeeId: employee.employeeId,
              name: `${employee.firstName} ${employee.lastName}`,
              reason: `Payroll already exists for ${month}/${year}`
            });
            continue;
          }
        }

        // Create and save payroll
        const payroll = new Payroll(payrollData);
        await payroll.save();
        
        // Populate employee details for response
        const populatedPayroll = await Payroll.findById(payroll._id)
          .populate('employee', 'firstName lastName employeeId department position');
        
        createdPayrolls.push(populatedPayroll);
        
        // Accumulate totals
        totalGrossSalary += totalEarnings;
        totalNetSalary += netSalary;
        totalTax += monthlyTax;
        
        console.log(`✅ Generated payroll for ${employee.firstName} ${employee.lastName} (${employee.employeeId}):`);
        console.log(`   Gross Salary: Rs. ${grossSalary.toLocaleString()}`);
        console.log(`   Total Earnings: Rs. ${totalEarnings.toLocaleString()}`);
        console.log(`   Taxable Income: Rs. ${taxableIncome.toLocaleString()}`);
        console.log(`   Monthly Tax: Rs. ${monthlyTax.toLocaleString()}`);
        console.log(`   Net Salary: Rs. ${netSalary.toLocaleString()}`);
        
      } catch (error) {
        console.error(`❌ Error generating payroll for employee ${employee.employeeId}:`, error);
        
        // Handle specific error types
        if (error.code === 11000) {
          // Duplicate key error
          const errorMsg = `Duplicate payroll for ${employee.firstName} ${employee.lastName} (${employee.employeeId}) - ${month}/${year}`;
          console.log(`⚠️  ${errorMsg}`);
          errors.push(errorMsg);
        } else {
          // Other errors
          errors.push(`Error for ${employee.firstName} ${employee.lastName}: ${error.message}`);
        }
      }
    }

    // Calculate summary statistics
    const summary = {
      totalEmployees: createdPayrolls.length,
      month,
      year,
      totalGrossSalary: Math.round(totalGrossSalary),
      totalNetSalary: Math.round(totalNetSalary),
      totalTax: Math.round(totalTax),
      averageGrossSalary: Math.round(totalGrossSalary / createdPayrolls.length),
      averageNetSalary: Math.round(totalNetSalary / createdPayrolls.length),
      averageTax: Math.round(totalTax / createdPayrolls.length)
    };

    console.log(`🎉 Payroll generation completed for ${month}/${year}:`);
    console.log(`   Total Employees: ${summary.totalEmployees}`);
    console.log(`   Total Gross Salary: Rs. ${summary.totalGrossSalary.toLocaleString()}`);
    console.log(`   Total Net Salary: Rs. ${summary.totalNetSalary.toLocaleString()}`);
    console.log(`   Total Tax: Rs. ${summary.totalTax.toLocaleString()}`);
    
    if (skippedEmployees.length > 0) {
      console.log(`   Skipped Employees: ${skippedEmployees.length} (already have payrolls)`);
    }
    
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.length} (see details below)`);
    }

    res.status(201).json({
      success: true,
      message: `Successfully generated ${createdPayrolls.length} payrolls for ${month}/${year}`,
      data: {
        summary,
        payrolls: createdPayrolls,
        skippedEmployees: skippedEmployees.length > 0 ? skippedEmployees : undefined,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('❌ Error in payroll generation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate payrolls',
      error: error.message
    });
  }
}));

// @route   PUT /api/payroll/:id
// @desc    Update payroll with proper calculation logic including attendance deductions
// @access  Private (HR and Admin)
// @fixes  Attendance deduction calculation and inclusion in total deductions
// @formula Total Deductions = Income Tax + EOBI + Health Insurance + Attendance Deduction + Other Deductions
router.put('/:id', [
  authorize('admin', 'hr_manager'),
  body('payPeriod.startDate').optional().notEmpty().withMessage('Start date is required'),
  body('payPeriod.endDate').optional().notEmpty().withMessage('End date is required'),
  body('payPeriod.type').optional().isIn(['weekly', 'bi-weekly', 'monthly']).withMessage('Valid pay period type is required'),
  body('basicSalary').optional().isNumeric().withMessage('Valid basic salary is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payroll ID format'
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Payroll not found'
    });
  }

  // Don't allow updates if payroll is already paid
  if (payroll.status === 'paid') {
    return res.status(400).json({
      success: false,
      message: 'Cannot update a paid payroll'
    });
  }

  const updateData = { ...req.body };
  
  // Convert dates if provided - extract month and year from payPeriod if provided
  if (req.body.payPeriod && req.body.payPeriod.startDate) {
    const startDate = new Date(req.body.payPeriod.startDate);
    updateData.month = startDate.getMonth() + 1;
    updateData.year = startDate.getFullYear();
  }

  // Convert numeric fields
  if (req.body.basicSalary) {
    updateData.basicSalary = parseFloat(req.body.basicSalary);
  }

  // Map allowance fields if provided
  if (req.body.allowances) {
    updateData.houseRentAllowance = parseFloat(req.body.allowances.housing) || 0;
    updateData.medicalAllowance = parseFloat(req.body.allowances.medical) || 0;
    updateData.conveyanceAllowance = parseFloat(req.body.allowances.transport) || 0;
    updateData.specialAllowance = parseFloat(req.body.allowances.meal) || 0;
    updateData.otherAllowance = parseFloat(req.body.allowances.other) || 0;
    
    // Update the new allowances structure with frontend allowances
    updateData.allowances = {
      conveyance: {
        isActive: req.body.allowances.conveyance?.isActive ?? false,
        amount: parseFloat(req.body.allowances.conveyance?.amount) || 0
      },
      food: {
        isActive: req.body.allowances.food?.isActive ?? false,
        amount: parseFloat(req.body.allowances.food?.amount) || 0
      },
      vehicleFuel: {
        isActive: req.body.allowances.vehicleFuel?.isActive ?? false,
        amount: parseFloat(req.body.allowances.vehicleFuel?.amount) || 0
      },
      medical: {
        isActive: req.body.allowances.medical?.isActive ?? false,
        amount: parseFloat(req.body.allowances.medical?.amount) || 0
      },
      special: {
        isActive: req.body.allowances.special?.isActive ?? false,
        amount: parseFloat(req.body.allowances.special?.amount) || 0
      },
      other: {
        isActive: req.body.allowances.other?.isActive ?? false,
        amount: parseFloat(req.body.allowances.other?.amount) || 0
      }
    };
  }

  // Map overtime fields if provided
  if (req.body.overtime) {
    updateData.overtimeHours = parseFloat(req.body.overtime.hours) || 0;
    updateData.overtimeRate = parseFloat(req.body.overtime.rate) || 0;
    updateData.overtimeAmount = parseFloat(req.body.overtime.amount) || 0;
  }

  // Map bonus fields if provided
  if (req.body.bonuses) {
    updateData.performanceBonus = parseFloat(req.body.bonuses.performance) || 0;
    updateData.otherBonus = parseFloat(req.body.bonuses.other) || 0;
  }

  // Map deduction fields if provided
  if (req.body.deductions) {
    updateData.providentFund = parseFloat(req.body.deductions.providentFund) || 0;
    updateData.incomeTax = parseFloat(req.body.deductions.tax) || 0;
    updateData.healthInsurance = parseFloat(req.body.deductions.insurance) || 0;
    updateData.eobi = parseFloat(req.body.deductions.eobi) || 0;
    updateData.otherDeductions = parseFloat(req.body.deductions.other) || 0;
  }

  // Map attendance fields if provided
  if (req.body.attendance) {
    updateData.totalWorkingDays = parseInt(req.body.attendance.totalDays) || payroll.totalWorkingDays;
    updateData.presentDays = parseInt(req.body.attendance.presentDays) || payroll.presentDays;
    
    // 🔧 AUTOMATIC ABSENT DAYS CALCULATION
    // If present days are provided, automatically calculate absent days
    if (req.body.attendance.presentDays !== undefined) {
      const totalWorkingDays = updateData.totalWorkingDays;
      const presentDays = updateData.presentDays;
      const leaveDays = parseInt(req.body.attendance.leaveDays) || payroll.leaveDays || 0;
      
      // Calculate absent days automatically: Total Working Days - Present Days - Leave Days
      updateData.absentDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);
      
      console.log(`🧮 Automatic Absent Days Calculation:`);
      console.log(`   Total Working Days: ${totalWorkingDays}`);
      console.log(`   Present Days: ${presentDays}`);
      console.log(`   Leave Days: ${leaveDays}`);
      console.log(`   Calculated Absent Days: ${updateData.absentDays}`);
    } else {
      // If present days not provided, use the value from request or existing
      updateData.absentDays = parseInt(req.body.attendance.absentDays) || payroll.absentDays;
    }
    
    updateData.leaveDays = parseInt(req.body.attendance.leaveDays) || payroll.leaveDays;
    
    // Force recalculation of daily rate and attendance deduction
    updateData.dailyRate = undefined;
    updateData.attendanceDeduction = undefined;
    
    console.log(`📊 Final Attendance Update: ${updateData.presentDays} present, ${updateData.absentDays} absent, ${updateData.totalWorkingDays} total working days`);
    
    // Log attendance deduction calculation for debugging
    if (updateData.absentDays > 0 || updateData.leaveDays > 0) {
      const dailyRate = updateData.grossSalary / updateData.totalWorkingDays;
      const attendanceDeduction = (updateData.absentDays + updateData.leaveDays) * dailyRate;
      console.log(`💰 Attendance Deduction Preview: ${Math.round(attendanceDeduction)} (Daily Rate: ${dailyRate.toFixed(2)} × (${updateData.absentDays} + ${updateData.leaveDays}))`);
    }
  }

  // EOBI is always 370 PKR for all employees (Pakistan EOBI fixed amount)
  updateData.eobi = 370;

  // Auto-calculate Provident Fund (8.34% of basic salary) if not provided
  if (!updateData.providentFund && (updateData.basicSalary || payroll.basicSalary) > 0) {
    const basicSalary = updateData.basicSalary || payroll.basicSalary;
    updateData.providentFund = Math.round((basicSalary * 8.34) / 100);
  }

  // Recalculate totals
  updateData.grossSalary = (updateData.basicSalary || payroll.basicSalary) + 
    (updateData.houseRentAllowance || payroll.houseRentAllowance) + 
    (updateData.medicalAllowance || payroll.medicalAllowance);
  
  // Note: Overtime, bonuses, and additional allowances are NOT part of gross salary (base)
  // They are added to calculate Total Earnings

  // Calculate Total Earnings (Gross Salary Base + Additional Allowances + Overtime + Bonuses)
  const additionalAllowances = 
    ((updateData.allowances?.conveyance?.isActive ? updateData.allowances.conveyance.amount : 0) || 
     (payroll.allowances?.conveyance?.isActive ? payroll.allowances.conveyance.amount : 0)) +
    ((updateData.allowances?.food?.isActive ? updateData.allowances.food.amount : 0) || 
     (payroll.allowances?.food?.isActive ? payroll.allowances.food.amount : 0)) +
    ((updateData.allowances?.vehicleFuel?.isActive ? updateData.allowances.vehicleFuel.amount : 0) || 
     (payroll.allowances?.vehicleFuel?.isActive ? payroll.allowances.vehicleFuel.amount : 0)) +
    ((updateData.allowances?.special?.isActive ? updateData.allowances.special.amount : 0) || 
     (payroll.allowances?.special?.isActive ? payroll.allowances.special.amount : 0)) +
    ((updateData.allowances?.other?.isActive ? updateData.allowances.other.amount : 0) || 
     (payroll.allowances?.other?.isActive ? payroll.allowances.other.amount : 0));
  
  // Total Earnings = Gross Salary (Base) + Additional Allowances + Overtime + Bonuses
  const totalEarnings = updateData.grossSalary + additionalAllowances + 
    (updateData.overtimeAmount || payroll.overtimeAmount) + 
    (updateData.performanceBonus || payroll.performanceBonus) + 
    (updateData.otherBonus || payroll.otherBonus);
  
  // Store total earnings for reference
  updateData.totalEarnings = totalEarnings;
  
  // Medical allowance is 10% of total earnings (tax-exempt)
  const medicalAllowanceForTax = Math.round(totalEarnings * 0.10);
  
  // Taxable Income = Total Earnings - Medical Allowance
  const taxableIncome = totalEarnings - medicalAllowanceForTax;
  
  // Auto-calculate tax if not provided (same as September 688 employees)
  if (!updateData.incomeTax) {
    try {
      // Calculate tax using FBR 2025-2026 rules
      const annualTaxableIncome = taxableIncome * 12;
      
      // FBR 2025-2026 Tax Slabs for Salaried Persons (Official Pakistan Tax Slabs)
      let annualTax = 0;
      
      if (annualTaxableIncome <= 600000) {
        // No tax for income up to 600,000
        annualTax = 0;
      } else if (annualTaxableIncome <= 1200000) {
        // 1% on income from 600,001 to 1,200,000
        annualTax = (annualTaxableIncome - 600000) * 0.01;
      } else if (annualTaxableIncome <= 2200000) {
        // Rs. 6,000 + 11% on income from 1,200,001 to 2,200,000
        annualTax = 6000 + (annualTaxableIncome - 1200000) * 0.11;
      } else if (annualTaxableIncome <= 3200000) {
        // Rs. 116,000 + 23% on income from 2,200,001 to 3,200,000
        annualTax = 116000 + (annualTaxableIncome - 2200000) * 0.23;
      } else if (annualTaxableIncome <= 4100000) {
        // Rs. 346,000 + 30% on income from 3,200,001 to 4,100,000
        annualTax = 346000 + (annualTaxableIncome - 3200000) * 0.30;
      } else {
        // Rs. 616,000 + 35% on income above 4,100,000
        annualTax = 616000 + (annualTaxableIncome - 4100000) * 0.35;
      }
      
      // Apply 9% surcharge if annual taxable income exceeds Rs. 10,000,000
      if (annualTaxableIncome > 10000000) {
        const surcharge = annualTax * 0.09;
        annualTax += surcharge;
      }
      
      // Convert to monthly tax
      updateData.incomeTax = Math.round(annualTax / 12);
      
      console.log(`💰 Tax Calculation for Employee Update: Total Earnings: ${totalEarnings}, Medical (10%): ${medicalAllowanceForTax}, Taxable: ${taxableIncome}, Tax: ${updateData.incomeTax}`);
      
    } catch (error) {
      console.error('Error calculating tax:', error);
      // Fallback to old calculation
      updateData.incomeTax = calculateMonthlyTax(taxableIncome);
    }
  }

  // Calculate attendance deduction for updateData as well
  let attendanceDeduction = 0;
  if (updateData.absentDays > 0 || updateData.leaveDays > 0) {
    const dailyRate = updateData.grossSalary / (updateData.totalWorkingDays || payroll.totalWorkingDays);
    attendanceDeduction = (updateData.absentDays + updateData.leaveDays) * dailyRate;
  }

  // 🔧 UPDATE TOTAL DEDUCTIONS WITH CORRECT FORMULA
  // Total Deductions = Income Tax + EOBI + Health Insurance + Attendance Deduction + Other Deductions
  // Note: Provident Fund is NOT included in total deductions (as per business requirement)
  updateData.totalDeductions = (updateData.incomeTax || payroll.incomeTax || 0) + 
    (updateData.eobi || payroll.eobi || 370) + 
    (updateData.healthInsurance || payroll.healthInsurance || 0) + 
    Math.round(attendanceDeduction) + 
    (updateData.otherDeductions || payroll.otherDeductions || 0);

  updateData.netSalary = updateData.grossSalary - updateData.totalDeductions;

  // Store the original total earnings to preserve it during updates
  const originalTotalEarnings = payroll.totalEarnings;
  console.log(`🔒 Preserving Total Earnings: ${originalTotalEarnings?.toLocaleString() || 0}`);

  // Update fields directly on the payroll object (this will trigger pre-save middleware)
  if (req.body.basicSalary !== undefined) {
    payroll.basicSalary = parseFloat(req.body.basicSalary);
  }
  
  if (req.body.medicalAllowance !== undefined) {
    payroll.medicalAllowance = parseFloat(req.body.medicalAllowance);
  }
  
  if (req.body.houseRentAllowance !== undefined) {
    payroll.houseRentAllowance = parseFloat(req.body.houseRentAllowance);
  }
  
  if (req.body.grossSalary !== undefined) {
    payroll.grossSalary = parseFloat(req.body.grossSalary);
  }
  
  if (req.body.overtimeHours !== undefined) {
    payroll.overtimeHours = parseFloat(req.body.overtimeHours);
  }
  
  if (req.body.overtimeRate !== undefined) {
    payroll.overtimeRate = parseFloat(req.body.overtimeRate);
  }
  
  if (req.body.performanceBonus !== undefined) {
    payroll.performanceBonus = parseFloat(req.body.performanceBonus);
  }
  
  if (req.body.otherBonus !== undefined) {
    payroll.otherBonus = parseFloat(req.body.otherBonus);
  }
  
  if (req.body.arrears !== undefined) {
    payroll.arrears = parseFloat(req.body.arrears);
  }
  
  if (req.body.providentFund !== undefined) {
    payroll.providentFund = parseFloat(req.body.providentFund);
  }
  
  if (req.body.healthInsurance !== undefined) {
    payroll.healthInsurance = parseFloat(req.body.healthInsurance);
  }
  
  if (req.body.vehicleLoanDeduction !== undefined) {
    payroll.vehicleLoanDeduction = parseFloat(req.body.vehicleLoanDeduction);
  }
  
  if (req.body.companyLoanDeduction !== undefined) {
    payroll.companyLoanDeduction = parseFloat(req.body.companyLoanDeduction);
  }
  
  if (req.body.otherDeductions !== undefined) {
    payroll.otherDeductions = parseFloat(req.body.otherDeductions);
  }
  
  // Handle attendance fields (support both direct and nested structures)
  if (req.body.totalWorkingDays !== undefined) {
    payroll.totalWorkingDays = parseInt(req.body.totalWorkingDays);
  }
  
  if (req.body.presentDays !== undefined) {
    payroll.presentDays = parseInt(req.body.presentDays);
    // Auto-calculate absent days
    payroll.absentDays = Math.max(0, payroll.totalWorkingDays - payroll.presentDays - payroll.leaveDays);
  }
  
  if (req.body.leaveDays !== undefined) {
    payroll.leaveDays = parseInt(req.body.leaveDays);
    // Recalculate absent days if present days are set
    if (req.body.presentDays !== undefined) {
      payroll.absentDays = Math.max(0, payroll.totalWorkingDays - payroll.presentDays - payroll.leaveDays);
    }
  }
  
  // Also handle nested attendance structure (req.body.attendance.*)
  if (req.body.attendance) {
    if (req.body.attendance.totalDays !== undefined) {
      payroll.totalWorkingDays = parseInt(req.body.attendance.totalDays);
    }
    
    if (req.body.attendance.presentDays !== undefined) {
      payroll.presentDays = parseInt(req.body.attendance.presentDays);
      // Auto-calculate absent days
      payroll.absentDays = Math.max(0, payroll.totalWorkingDays - payroll.presentDays - payroll.leaveDays);
    }
    
    if (req.body.attendance.leaveDays !== undefined) {
      payroll.leaveDays = parseInt(req.body.attendance.leaveDays);
      // Recalculate absent days if present days are set
      if (req.body.attendance.presentDays !== undefined) {
        payroll.absentDays = Math.max(0, payroll.totalWorkingDays - payroll.presentDays - payroll.leaveDays);
      }
    }
    
    console.log(`📊 Attendance Update Applied: ${payroll.presentDays} present, ${payroll.absentDays} absent, ${payroll.totalWorkingDays} total working days`);
    
    // Log attendance deduction preview for direct updates
    if (payroll.absentDays > 0 || payroll.leaveDays > 0) {
      const dailyRate = payroll.grossSalary / payroll.totalWorkingDays;
      const attendanceDeduction = (payroll.absentDays + payroll.leaveDays) * dailyRate;
      console.log(`💰 Direct Update Attendance Deduction Preview: ${Math.round(attendanceDeduction)} (Daily Rate: ${dailyRate.toFixed(2)} × (${payroll.absentDays} + ${payroll.leaveDays}))`);
    }
  }
  
  if (req.body.remarks !== undefined) {
    payroll.remarks = req.body.remarks;
  }

  // 🔧 HANDLE LEAVE DEDUCTIONS - Same pattern as attendance updates
  if (req.body.leaveDeductions) {
    console.log(`📊 Leave Deductions Update:`, req.body.leaveDeductions);
    
    // Map leave deduction fields directly to payroll object
    payroll.leaveDeductions = {
      unpaidLeave: parseInt(req.body.leaveDeductions.unpaidLeave) || 0,
      sickLeave: parseInt(req.body.leaveDeductions.sickLeave) || 0,
      casualLeave: parseInt(req.body.leaveDeductions.casualLeave) || 0,
      annualLeave: parseInt(req.body.leaveDeductions.annualLeave) || 0,
      otherLeave: parseInt(req.body.leaveDeductions.otherLeave) || 0,
      totalLeaveDays: 0, // Will be calculated
      leaveDeductionAmount: 0 // Will be calculated
    };
    
    // Calculate total leave days
    payroll.leaveDeductions.totalLeaveDays = 
      payroll.leaveDeductions.unpaidLeave + 
      payroll.leaveDeductions.sickLeave + 
      payroll.leaveDeductions.casualLeave + 
      payroll.leaveDeductions.annualLeave + 
      payroll.leaveDeductions.otherLeave;
    
    // 🔧 UPDATE LEAVE DAYS FIELD - This will trigger present days recalculation
    payroll.leaveDays = payroll.leaveDeductions.totalLeaveDays;
    
    // 🔧 AUTO-RECALCULATE PRESENT DAYS when leave days change
    if (payroll.totalWorkingDays && payroll.leaveDays !== undefined) {
      const newPresentDays = Math.max(0, payroll.totalWorkingDays - (payroll.absentDays || 0) - payroll.leaveDays);
      console.log(`🧮 Auto-recalculating present days: ${payroll.totalWorkingDays} - ${payroll.absentDays || 0} - ${payroll.leaveDays} = ${newPresentDays}`);
      payroll.presentDays = newPresentDays;
    }
    
    console.log(`📊 Leave Deductions Summary:`);
    console.log(`   Unpaid Leave: ${payroll.leaveDeductions.unpaidLeave}`);
    console.log(`   Sick Leave: ${payroll.leaveDeductions.sickLeave}`);
    console.log(`   Casual Leave: ${payroll.leaveDeductions.casualLeave}`);
    console.log(`   Annual Leave: ${payroll.leaveDeductions.annualLeave}`);
    console.log(`   Other Leave: ${payroll.leaveDeductions.otherLeave}`);
    console.log(`   Total Leave Days: ${payroll.leaveDeductions.totalLeaveDays}`);
    console.log(`   Updated Leave Days Field: ${payroll.leaveDays}`);
    console.log(`   Updated Present Days: ${payroll.presentDays}`);
  }

  // Force recalculation by clearing calculated fields
  payroll.dailyRate = undefined;
  payroll.attendanceDeduction = undefined;
  payroll.leaveDeductionAmount = undefined;

  // 🔧 CALCULATE ATTENDANCE DEDUCTION BEFORE SAVE
  // This ensures attendance deduction is included in total deductions
  // Formula: (Absent Days + Leave Days) × Daily Rate
  // Daily Rate = Gross Salary ÷ Total Working Days
  if (payroll.absentDays > 0 || payroll.leaveDays > 0) {
    // Calculate daily rate based on gross salary and total working days
    const dailyRate = payroll.grossSalary / payroll.totalWorkingDays;
    payroll.dailyRate = dailyRate;
    
    // Calculate attendance deduction: (absent days + leave days) * daily rate
    const attendanceDeduction = (payroll.absentDays + payroll.leaveDays) * dailyRate;
    payroll.attendanceDeduction = Math.round(attendanceDeduction);
    
    console.log(`💰 Attendance Deduction Calculation:`);
    console.log(`   Daily Rate: Rs. ${dailyRate.toFixed(2)}`);
    console.log(`   Absent Days: ${payroll.absentDays}`);
    console.log(`   Leave Days: ${payroll.leaveDays}`);
    console.log(`   Attendance Deduction: Rs. ${payroll.attendanceDeduction}`);
  } else {
    payroll.attendanceDeduction = 0;
    payroll.dailyRate = payroll.grossSalary / payroll.totalWorkingDays;
  }

  // 🔧 UPDATE TOTAL DEDUCTIONS WITH CORRECT FORMULA
  // Total Deductions = Income Tax + EOBI + Health Insurance + Attendance Deduction + Other Deductions
  // Note: Provident Fund is NOT included in total deductions (as per business requirement)
  payroll.totalDeductions = (payroll.incomeTax || 0) + 
    (payroll.eobi || 370) + 
    (payroll.healthInsurance || 0) + 
    (payroll.attendanceDeduction || 0) + 
    (payroll.otherDeductions || 0);

  // 🔧 RECALCULATE NET SALARY WITH UPDATED TOTAL DEDUCTIONS
  payroll.netSalary = payroll.totalEarnings - payroll.totalDeductions;

  console.log(`📊 Final Calculations:`);
  console.log(`   Total Earnings: Rs. ${payroll.totalEarnings?.toLocaleString() || 0}`);
  console.log(`   Total Deductions Breakdown:`);
  console.log(`     Income Tax: Rs. ${(payroll.incomeTax || 0).toLocaleString()}`);
  console.log(`     EOBI: Rs. ${(payroll.eobi || 370).toLocaleString()}`);
  console.log(`     Health Insurance: Rs. ${(payroll.healthInsurance || 0).toLocaleString()}`);
  console.log(`     Attendance Deduction: Rs. ${(payroll.attendanceDeduction || 0).toLocaleString()}`);
  console.log(`     Other Deductions: Rs. ${(payroll.otherDeductions || 0).toLocaleString()}`);
  console.log(`     Total Deductions: Rs. ${payroll.totalDeductions?.toLocaleString() || 0}`);
  console.log(`   Net Salary: Rs. ${payroll.netSalary?.toLocaleString() || 0}`);

  // Save to trigger pre-save middleware for any additional recalculations
  await payroll.save();

  // 🔒 CRITICAL: Restore the original total earnings after save
  // This prevents the pre-save middleware from changing it
  if (Math.abs(payroll.totalEarnings - originalTotalEarnings) > 1) {
    console.log(`🔒 Restoring Total Earnings: ${payroll.totalEarnings?.toLocaleString()} → ${originalTotalEarnings?.toLocaleString()}`);
    payroll.totalEarnings = originalTotalEarnings;
    await payroll.save(); // Save again to persist the restored total earnings
  }

  const updatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'firstName lastName employeeId department position')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Payroll updated successfully',
    data: updatedPayroll
  });
}));

// @route   PATCH /api/payroll/:id/attendance
// @desc    Update payroll attendance fields - REMOVED - Use custom update logic instead
// @access  Private (HR and Admin)
// This route has been removed to prevent calculation issues
// Please implement your own update logic to prevent total earnings calculation problems
router.patch('/:id/attendance', asyncHandler(async (req, res) => {
  res.status(400).json({
    success: false,
    message: 'This attendance update route has been removed. Please implement your own update logic to prevent total earnings calculation issues.'
  });
}));

// @route   PATCH /api/payroll/:id/approve
// @desc    Approve payroll
// @access  Private (HR and Admin)
router.patch('/:id/approve',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID format'
      });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.status !== 'Draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft payrolls can be approved'
      });
    }

    await payroll.approve(req.user.id);

    const updatedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Payroll approved successfully',
      data: updatedPayroll
    });
  })
);

// @route   PATCH /api/payroll/:id/mark-paid
// @desc    Mark payroll as paid
// @access  Private (HR and Admin)
router.patch('/:id/mark-paid', [
  authorize('admin', 'hr_manager'),
  body('paymentMethod').optional().isIn(['bank_transfer', 'check', 'cash']).withMessage('Valid payment method is required')
], asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payroll ID format'
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Payroll not found'
    });
  }

  if (payroll.status !== 'Approved') {
    return res.status(400).json({
      success: false,
      message: 'Only approved payrolls can be marked as paid'
    });
  }

  await payroll.markAsPaid(req.body.paymentMethod);

  const updatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'firstName lastName employeeId department position')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Payroll marked as paid successfully',
    data: updatedPayroll
  });
}));

// @route   PATCH /api/payroll/:id/mark-unpaid
// @desc    Mark payroll as unpaid (revert to draft)
// @access  Private (HR and Admin)
router.patch('/:id/mark-unpaid',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID format'
      });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.status !== 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Only paid payrolls can be marked as unpaid'
      });
    }

    await payroll.markAsUnpaid();

    const updatedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    res.json({
      success: true,
      message: 'Payroll marked as unpaid successfully',
      data: updatedPayroll
    });
  })
);

// @route   DELETE /api/payroll/:id
// @desc    Delete payroll
// @access  Private (HR and Admin)
router.delete('/:id',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID format'
      });
    }

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    if (payroll.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a paid payroll'
      });
    }

    await Payroll.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Payroll deleted successfully'
    });
  })
);

// @route   GET /api/payroll/demo-attendance-integration
// @desc    Demonstrate attendance integration with payroll calculations
// @access  Private (HR and Admin)
router.get('/demo-attendance-integration',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      const { demonstrateAttendanceIntegration } = require('../utils/attendanceIntegrationDemo');
      
      // Run the demonstration
      const demo = demonstrateAttendanceIntegration();
      
      res.json({
        success: true,
        message: 'Attendance integration demonstration',
        data: demo
      });
      
    } catch (error) {
      console.error('❌ Error in attendance integration demo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run attendance integration demo',
        error: error.message
      });
    }
  })
);

// @route   GET /api/payroll/:id/download
// @desc    Download payroll as PDF
// @access  Private (HR and Admin)
router.get('/:id/download', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employee', 'employeeId firstName lastName email phone department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: 'Payroll not found'
      });
    }

    // Create PDF document
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${payroll.employee?.employeeId}-${payroll.month}-${payroll.year}.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Helper function to format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 0
      }).format(amount || 0);
    };

    // Helper function to format date
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    // Helper function to convert number to words
    const numberToWords = (num) => {
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      
      if (num === 0) return 'Zero';
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + numberToWords(num % 100) : '');
      if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + numberToWords(num % 1000) : '');
      if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + numberToWords(num % 100000) : '');
      return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + numberToWords(num % 10000000) : '');
    };

    // Header
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('PAYROLL STATEMENT', { align: 'center' })
       .moveDown(0.5);

    doc.fontSize(12)
       .font('Helvetica')
       .text(`Period: ${payroll.month}/${payroll.year}`, { align: 'center' })
       .moveDown(2);

    // Employee Information
    const employeeY = doc.y;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Employee Information:', 50, employeeY)
       .moveDown(0.5);

    doc.fontSize(10)
       .font('Helvetica')
       .text('Employee ID:', 50, employeeY + 30)
       .text('Name:', 50, employeeY + 50)
       .text('Department:', 50, employeeY + 70)
       .text('Position:', 50, employeeY + 90)
       .text('Pay Period:', 50, employeeY + 110)
       .text('Generated Date:', 50, employeeY + 130);

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(payroll.employee?.employeeId || 'N/A', 200, employeeY + 30)
       .text(`${payroll.employee?.firstName || ''} ${payroll.employee?.lastName || ''}`, 200, employeeY + 50)
       .text(payroll.employee?.department || 'N/A', 200, employeeY + 70)
       .text(payroll.employee?.position || 'N/A', 200, employeeY + 90)
       .text(`${payroll.month}/${payroll.year}`, 200, employeeY + 110)
       .text(formatDate(payroll.createdAt), 200, employeeY + 130);

    doc.moveDown(3);

    // Earnings and Deductions Table
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Earnings and Deductions', { align: 'center' })
       .moveDown(0.5);

    // Table headers
    const tableY = doc.y;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Earnings', 50, tableY)
       .text('Amount', 200, tableY)
       .text('Deductions', 350, tableY)
       .text('Amount', 500, tableY);

    // Draw table lines
    doc.moveTo(50, tableY - 5)
       .lineTo(550, tableY - 5)
       .stroke();

    doc.moveTo(50, tableY + 15)
       .lineTo(550, tableY + 15)
       .stroke();

    // Earnings rows
    let currentTableY = tableY + 25;
    doc.fontSize(10)
       .font('Helvetica')
       .text('Basic Salary', 50, currentTableY)
       .text(formatCurrency(payroll.basicSalary), 200, currentTableY);

    currentTableY += 25;
    doc.text('House Rent Allowance', 50, currentTableY)
       .text(formatCurrency(payroll.houseRentAllowance), 200, currentTableY);

    currentTableY += 25;
    doc.text('Medical Allowance', 50, currentTableY)
       .text(formatCurrency(payroll.medicalAllowance), 200, currentTableY);

    currentTableY += 25;
    doc.text('Conveyance Allowance', 50, currentTableY)
       .text(formatCurrency(payroll.conveyanceAllowance), 200, currentTableY);

    currentTableY += 25;
    doc.text('Special Allowance', 50, currentTableY)
       .text(formatCurrency(payroll.specialAllowance), 200, currentTableY);

    currentTableY += 25;
    doc.text('Other Allowance', 50, currentTableY)
       .text(formatCurrency(payroll.otherAllowance), 200, currentTableY);

    currentTableY += 25;
    doc.text('Overtime Amount', 50, currentTableY)
       .text(formatCurrency(payroll.overtimeAmount), 200, currentTableY);

    currentTableY += 25;
    doc.text('Performance Bonus', 50, currentTableY)
       .text(formatCurrency(payroll.performanceBonus), 200, currentTableY);

    currentTableY += 25;
    doc.text('Other Bonus', 50, currentTableY)
       .text(formatCurrency(payroll.otherBonus), 200, currentTableY);

    // Deductions rows
    currentTableY = tableY + 25;
    doc.text('Provident Fund', 350, currentTableY)
       .text(formatCurrency(payroll.providentFund), 500, currentTableY);

    currentTableY += 25;
    doc.text('Income Tax', 350, currentTableY)
       .text(formatCurrency(payroll.incomeTax), 500, currentTableY);

    currentTableY += 25;
    doc.text('Health Insurance', 350, currentTableY)
       .text(formatCurrency(payroll.healthInsurance), 500, currentTableY);

    currentTableY += 25;
    doc.text('EOBI', 350, currentTableY)
       .text(formatCurrency(payroll.eobi), 500, currentTableY);

    currentTableY += 25;
    doc.text('Other Deductions', 350, currentTableY)
       .text(formatCurrency(payroll.otherDeductions), 500, currentTableY);

    // Summary rows
    currentTableY += 30;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Gross Salary', 50, currentTableY)
       .text(formatCurrency(payroll.grossSalary), 200, currentTableY);

    currentTableY += 25;
    doc.text('Total Deductions', 350, currentTableY)
       .text(formatCurrency(payroll.totalDeductions), 500, currentTableY);

    currentTableY += 25;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Net Salary', 50, currentTableY)
       .text(formatCurrency(payroll.netSalary), 200, currentTableY);

    // Amount in words
    currentTableY += 30;
    doc.fontSize(10)
       .font('Helvetica')
       .text(`[${numberToWords(Math.round(payroll.netSalary))} Only]`, 50, currentTableY);

    doc.moveDown(3);

    // Notes
    if (payroll.remarks) {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#000')
         .text('Notes:', { underline: true })
         .moveDown(0.5)
         .text(payroll.remarks);
    }

    // Footer with signatures and system info
    const footerY = doc.page.height - 100;
    
    // Signature labels
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Prepared By', 50, footerY)
       .text('Received By', 200, footerY)
       .text('Approved By', 350, footerY);

    // System information
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#666')
       .text('Human Capital Management System', 50, footerY + 30)
       .text(`Generated by: ${payroll.createdBy?.firstName || 'SYSTEM'}`, 50, footerY + 45)
       .text(formatDate(new Date()), 50, footerY + 60);

    // Finalize PDF
    doc.end();
  })
);

// @route   DELETE /api/payroll/delete-all
// @desc    Delete all payroll records
// @access  Private (Admin only)
router.delete('/delete-all',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    // Get count before deletion
    const totalPayrolls = await Payroll.countDocuments({});
    
    if (totalPayrolls === 0) {
      return res.status(404).json({
        success: false,
        message: 'No payroll records found to delete'
      });
    }

    // Delete all payrolls
    const result = await Payroll.deleteMany({});
    
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} payroll records`,
      data: {
        deletedCount: result.deletedCount,
        totalPayrolls: totalPayrolls
      }
    });
  })
);

// @route   POST /api/payroll/:id/calculate-tax
// @desc    Calculate and update tax for a specific payroll
// @access  Private (HR and Admin)
router.post('/:id/calculate-tax',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payroll ID'
      });
    }

    try {
      const tax = await Payroll.calculateTaxForPayroll(req.params.id);
      
      res.json({
        success: true,
        message: 'Tax calculated and updated successfully',
        data: { tax }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  })
);

// @route   POST /api/payroll/calculate-tax-month
// @desc    Calculate and update tax for all payrolls in a specific month/year
// @access  Private (HR and Admin)
router.post('/calculate-tax-month',
  authorize('admin', 'hr_manager'),
  [
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').isInt({ min: 2020 }).withMessage('Year must be 2020 or later')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    try {
      const { month, year } = req.body;
      const results = await Payroll.calculateTaxForMonth(month, year);
      
      res.json({
        success: true,
        message: `Tax calculated for ${results.length} payrolls in ${month}/${year}`,
        data: { results }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  })
);

// @route   POST /api/payroll/monthly-tax-update
// @desc    Update taxes for all payrolls in a specific month/year
// @access  Private (HR and Admin)
router.post('/monthly-tax-update',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { month, year, forceUpdate = false } = req.body;
    
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }
    
    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'Month must be between 1 and 12'
      });
    }
    
    if (year < 2020 || year > 2030) {
      return res.status(400).json({
        success: false,
        message: 'Year must be between 2020 and 2030'
      });
    }
    
    try {
      const MonthlyTaxUpdateService = require('../services/monthlyTaxUpdateService');
      const result = await MonthlyTaxUpdateService.updateMonthlyTaxes(month, year, forceUpdate);
      
      res.json({
        success: true,
        message: `Monthly tax update completed for ${month}/${year}`,
        data: result
      });
      
    } catch (error) {
      console.error('Error in monthly tax update route:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update monthly taxes',
        error: error.message
      });
    }
  })
);

// @route   POST /api/payroll/current-month-tax-update
// @desc    Update taxes for all payrolls in the current month
// @access  Private (HR and Admin)
router.post('/current-month-tax-update',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      const MonthlyTaxUpdateService = require('../services/monthlyTaxUpdateService');
      const result = await MonthlyTaxUpdateService.updateCurrentMonthTaxes();
      
      res.json({
        success: true,
        message: 'Current month tax update completed',
        data: result
      });
      
    } catch (error) {
      console.error('Error in current month tax update route:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update current month taxes',
        error: error.message
      });
    }
  })
);

// @route   POST /api/payroll/previous-month-tax-update
// @desc    Update taxes for all payrolls in the previous month
// @access  Private (HR and Admin)
router.post('/previous-month-tax-update',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      const MonthlyTaxUpdateService = require('../services/monthlyTaxUpdateService');
      const result = await MonthlyTaxUpdateService.updatePreviousMonthTaxes();
      
      res.json({
        success: true,
        message: 'Previous month tax update completed',
        data: result
      });
      
    } catch (error) {
      console.error('Error in previous month tax update route:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update previous month taxes',
        error: error.message
      });
    }
  })
);

// @route   GET /api/payroll/monthly-tax-summary/:month/:year
// @desc    Get tax summary for a specific month/year
// @access  Private (HR and Admin)
router.get('/monthly-tax-summary/:month/:year',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    const { month, year } = req.params;
    
    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'Month must be between 1 and 12'
      });
    }
    
    if (year < 2020 || year > 2030) {
      return res.status(400).json({
        success: false,
        message: 'Year must be between 2020 and 2030'
      });
    }
    
    try {
      const MonthlyTaxUpdateService = require('../services/monthlyTaxUpdateService');
      const summary = await MonthlyTaxUpdateService.getMonthlyTaxSummary(parseInt(month), parseInt(year));
      
      res.json({
        success: true,
        message: `Tax summary for ${month}/${year}`,
        data: summary
      });
      
    } catch (error) {
      console.error('Error getting monthly tax summary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get monthly tax summary',
        error: error.message
      });
    }
  })
);

// @route   GET /api/payroll/demo-attendance-integration
// @desc    Demonstrate attendance integration with payroll calculations
// @access  Private (HR and Admin)
router.get('/demo-attendance-integration',
  authorize('admin', 'hr_manager'),
  asyncHandler(async (req, res) => {
    try {
      const { demonstrateAttendanceIntegration } = require('../utils/attendanceIntegrationDemo');
      
      // Run the demonstration
      const demo = demonstrateAttendanceIntegration();
      
      res.json({
        success: true,
        message: 'Attendance integration demonstration',
        data: demo
      });
      
    } catch (error) {
      console.error('❌ Error in attendance integration demo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run attendance integration demo',
        error: error.message
      });
    }
  })
);

module.exports = router; 