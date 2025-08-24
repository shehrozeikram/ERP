const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Payroll = require('../models/hr/Payroll');
const Employee = require('../models/hr/Employee');
const { calculateMonthlyTax, calculateTaxableIncome, calculateTaxableIncomeCorrected } = require('../utils/taxCalculator');
const FBRTaxSlab = require('../models/hr/FBRTaxSlab');

const router = express.Router();

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

    const payrolls = await Payroll.find(matchStage)
      .populate('employee', 'firstName lastName employeeId department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

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
// @desc    Create new payroll
// @access  Private (HR and Admin)
router.post('/', [
  authorize('admin', 'hr_manager'),
  body('employee').isMongoId().withMessage('Valid employee ID is required'),
  body('payPeriod.startDate').notEmpty().withMessage('Start date is required'),
  body('payPeriod.endDate').notEmpty().withMessage('End date is required'),
  body('payPeriod.type').isIn(['weekly', 'bi-weekly', 'monthly']).withMessage('Valid pay period type is required'),
  body('basicSalary').isNumeric().withMessage('Valid basic salary is required'),
  body('overtime.hours').optional().isNumeric().withMessage('Overtime hours must be numeric'),
  body('overtime.rate').optional().isNumeric().withMessage('Overtime rate must be numeric')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  // Check if employee exists
  const employee = await Employee.findById(req.body.employee);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  // Check for duplicate payroll for the same employee and month/year (matches database unique index)
  const payrollMonth = new Date(req.body.payPeriod.startDate).getMonth() + 1;
  const payrollYear = new Date(req.body.payPeriod.startDate).getFullYear();
  
  const existingPayroll = await Payroll.findOne({
    employee: req.body.employee,
    month: payrollMonth,
    year: payrollYear
  });

  if (existingPayroll) {
    // Check if user wants to update existing payroll
    if (req.query.updateExisting === 'true') {
      // Update existing payroll instead of creating new one
      const updatedPayroll = await Payroll.findByIdAndUpdate(
        existingPayroll._id,
        { $set: payrollData },
        { new: true, runValidators: true }
      );
      
      return res.json({
        success: true,
        message: `Payroll updated successfully for ${payrollMonth}/${payrollYear}`,
        data: updatedPayroll
      });
    }
    
    return res.status(400).json({
      success: false,
      message: `Payroll already exists for this employee for ${payrollMonth}/${payrollYear}. Add ?updateExisting=true to update the existing payroll, or delete it first.`
    });
  }

  // Get employee allowances to copy to payroll
  const employeeAllowances = employee.allowances || {};
  
  const payrollData = {
    employee: req.body.employee,
    month: new Date(req.body.payPeriod.startDate).getMonth() + 1, // Extract month from start date
    year: new Date(req.body.payPeriod.startDate).getFullYear(), // Extract year from start date
    basicSalary: parseFloat(req.body.basicSalary) || 0,
    houseRentAllowance: 0, // Frontend doesn't send housing allowance separately
    medicalAllowance: parseFloat(req.body.allowances?.medical?.amount) || 0,
    conveyanceAllowance: parseFloat(req.body.allowances?.conveyance?.amount) || 0, // Keep exact value, no rounding
    specialAllowance: parseFloat(req.body.allowances?.special?.amount) || 0,
    otherAllowance: parseFloat(req.body.allowances?.other?.amount) || 0,
    // Copy employee allowances to payroll allowances structure
    // Use frontend allowances when provided, otherwise fall back to employee master allowances
    allowances: {
      conveyance: {
        isActive: req.body.allowances?.conveyance?.isActive ?? employeeAllowances.conveyance?.isActive ?? false,
        amount: parseFloat(req.body.allowances?.conveyance?.amount) || (employeeAllowances.conveyance?.isActive ? employeeAllowances.conveyance.amount : 0)
      },
      food: {
        isActive: req.body.allowances?.food?.isActive ?? employeeAllowances.food?.isActive ?? false,
        amount: parseFloat(req.body.allowances?.food?.amount) || (employeeAllowances.food?.isActive ? employeeAllowances.food.amount : 0)
      },
      vehicleFuel: {
        isActive: req.body.allowances?.vehicleFuel?.isActive ?? employeeAllowances.vehicleFuel?.isActive ?? false,
        amount: parseFloat(req.body.allowances?.vehicleFuel?.amount) || (employeeAllowances.vehicleFuel?.isActive ? employeeAllowances.vehicleFuel.amount : 0)
      },
      medical: {
        isActive: req.body.allowances?.medical?.isActive ?? employeeAllowances.medical?.isActive ?? false,
        amount: parseFloat(req.body.allowances?.medical?.amount) || (employeeAllowances.medical?.isActive ? employeeAllowances.medical.amount : 0)
      },
      special: {
        isActive: req.body.allowances?.special?.isActive ?? employeeAllowances.special?.isActive ?? false,
        amount: parseFloat(req.body.allowances?.special?.amount) || (employeeAllowances.special?.isActive ? employeeAllowances.special.amount : 0)
      },
      other: {
        isActive: req.body.allowances?.other?.isActive ?? employeeAllowances.other?.isActive ?? false,
        amount: parseFloat(req.body.allowances?.other?.amount) || (employeeAllowances.other?.isActive ? employeeAllowances.other.amount : 0)
      }
    },
    overtimeHours: parseFloat(req.body.overtime?.hours) || 0,
    overtimeRate: parseFloat(req.body.overtime?.rate) || 0,
    overtimeAmount: parseFloat(req.body.overtime?.amount) || 0,
    performanceBonus: parseFloat(req.body.bonuses?.performance) || 0,
    otherBonus: parseFloat(req.body.bonuses?.other) || 0,
    providentFund: parseFloat(req.body.deductions?.pension) || 0,
    incomeTax: parseFloat(req.body.deductions?.tax) || 0,
    healthInsurance: parseFloat(req.body.deductions?.insurance) || 0,
    otherDeductions: parseFloat(req.body.deductions?.other) || 0,
    eobi: parseFloat(req.body.deductions?.eobi) || 0,
    totalWorkingDays: parseInt(req.body.attendance?.totalDays) || 22,
    presentDays: parseInt(req.body.attendance?.presentDays) || 22,
    absentDays: parseInt(req.body.attendance?.absentDays) || 0,
    leaveDays: parseInt(req.body.leaveDeductions?.totalLeaveDays) || 0,
    currency: req.body.currency || 'PKR',
    remarks: req.body.notes || '',
    createdBy: req.user.id
  };

  // Calculate gross salary (Base only - Basic + Medical + House Rent)
  payrollData.grossSalary = payrollData.basicSalary + 
    payrollData.houseRentAllowance + 
    payrollData.medicalAllowance;
  
  // Note: Overtime, bonuses, and additional allowances are NOT part of gross salary (base)
  // They are added to calculate Total Earnings

  // Auto-calculate Provident Fund (8.34% of basic salary) if not provided
  if (!payrollData.providentFund && payrollData.basicSalary > 0) {
    payrollData.providentFund = Math.round((payrollData.basicSalary * 8.34) / 100);
  }

  // Calculate Total Earnings (Gross Salary Base + Additional Allowances + Overtime + Bonuses)
  const additionalAllowances = 
    (payrollData.allowances?.conveyance?.isActive ? payrollData.allowances.conveyance.amount : 0) +
    (payrollData.allowances?.food?.isActive ? payrollData.allowances.food.amount : 0) +
    (payrollData.allowances?.vehicleFuel?.isActive ? payrollData.allowances.vehicleFuel.amount : 0) +
    (payrollData.allowances?.special?.isActive ? payrollData.allowances.special.amount : 0) +
    (payrollData.allowances?.other?.isActive ? payrollData.allowances.other.amount : 0);
  
  // Total Earnings = Gross Salary (Base) + Additional Allowances + Overtime + Bonuses
  const totalEarnings = payrollData.grossSalary + additionalAllowances + 
    payrollData.overtimeAmount + 
    payrollData.performanceBonus + 
    payrollData.otherBonus;
  
  // Store total earnings for reference
  payrollData.totalEarnings = totalEarnings;
  
  // Medical allowance for tax calculation is 10% of total earnings (tax-exempt)
  const medicalAllowanceForTax = Math.round(totalEarnings * 0.10);
  
  // Taxable Income = Total Earnings - Medical Allowance
  const taxableIncome = totalEarnings - medicalAllowanceForTax;
  
  // Auto-calculate tax if not provided (same as September 688 employees)
  if (!payrollData.incomeTax) {
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
      payrollData.incomeTax = Math.round(annualTax / 12);
      
      console.log(`💰 Tax Calculation for Employee: Total Earnings: ${totalEarnings}, Medical (10%): ${medicalAllowanceForTax}, Taxable: ${taxableIncome}, Tax: ${payrollData.incomeTax}`);
      
    } catch (error) {
      console.error('Error calculating tax:', error);
      // Fallback to old calculation
      payrollData.incomeTax = calculateMonthlyTax(taxableIncome);
    }
  }

  // Calculate total deductions
  payrollData.totalDeductions = (payrollData.providentFund || 0) + 
    (payrollData.incomeTax || 0) + 
    (payrollData.healthInsurance || 0) + 
    (payrollData.eobi || 0) + 
    (payrollData.otherDeductions || 0);

  // Calculate net salary
  payrollData.netSalary = (payrollData.grossSalary || 0) - (payrollData.totalDeductions || 0);

  // Ensure all numeric fields are properly converted
  payrollData.basicSalary = parseFloat(payrollData.basicSalary) || 0;
  payrollData.houseRentAllowance = parseFloat(payrollData.houseRentAllowance) || 0;
  payrollData.medicalAllowance = parseFloat(payrollData.medicalAllowance) || 0;
  payrollData.conveyanceAllowance = parseFloat(payrollData.conveyanceAllowance) || 0; // Keep exact value, no rounding
  payrollData.specialAllowance = parseFloat(payrollData.specialAllowance) || 0;
  payrollData.otherAllowance = parseFloat(payrollData.otherAllowance) || 0;
  payrollData.overtimeHours = parseFloat(payrollData.overtimeHours) || 0;
  payrollData.overtimeRate = parseFloat(payrollData.overtimeRate) || 0;
  payrollData.overtimeAmount = parseFloat(payrollData.overtimeAmount) || 0;
  payrollData.performanceBonus = parseFloat(payrollData.performanceBonus) || 0;
  payrollData.otherBonus = parseFloat(payrollData.otherBonus) || 0;
  payrollData.providentFund = parseFloat(payrollData.providentFund) || 0;
  payrollData.incomeTax = parseFloat(payrollData.incomeTax) || 0;
  payrollData.healthInsurance = parseFloat(payrollData.healthInsurance) || 0;
  payrollData.otherDeductions = parseFloat(payrollData.otherDeductions) || 0;
  // EOBI is always 370 PKR for all employees (Pakistan EOBI fixed amount)
  payrollData.eobi = 370;
  payrollData.totalWorkingDays = parseInt(payrollData.totalWorkingDays) || 22;
  payrollData.presentDays = parseInt(payrollData.presentDays) || 22;
  payrollData.absentDays = parseInt(payrollData.absentDays) || 0;
  payrollData.leaveDays = parseInt(payrollData.leaveDays) || 0;
  payrollData.grossSalary = parseFloat(payrollData.grossSalary) || 0;
  payrollData.totalDeductions = parseFloat(payrollData.totalDeductions) || 0;
  payrollData.netSalary = parseFloat(payrollData.netSalary) || 0;

  const payroll = new Payroll(payrollData);
  await payroll.save();

  const populatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'firstName lastName employeeId department position')
    .populate('createdBy', 'firstName lastName');

  res.status(201).json({
    success: true,
    message: 'Payroll created successfully',
    data: populatedPayroll
  });
}));

// @route   PUT /api/payroll/:id
// @desc    Update payroll
// @access  Private (HR and Admin)
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

  updateData.totalDeductions = (updateData.providentFund || payroll.providentFund) + 
    (updateData.incomeTax || payroll.incomeTax) + 
    (updateData.healthInsurance || payroll.healthInsurance) + 
    (updateData.eobi || payroll.eobi) + 
    (updateData.otherDeductions || payroll.otherDeductions);

  updateData.netSalary = updateData.grossSalary - updateData.totalDeductions;

  const updatedPayroll = await Payroll.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('employee', 'firstName lastName employeeId department position')
   .populate('createdBy', 'firstName lastName')
   .populate('approvedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Payroll updated successfully',
    data: updatedPayroll
  });
}));

// @route   PATCH /api/payroll/:id/attendance
// @desc    Update payroll attendance fields
// @access  Private (HR and Admin)
router.patch('/:id/attendance', [
  authorize('admin', 'hr_manager'),
  body('attendance.totalDays').optional().isInt({ min: 1, max: 31 }).withMessage('Total days must be between 1 and 31'),
  body('attendance.presentDays').optional().isInt({ min: 0, max: 31 }).withMessage('Present days must be between 0 and 31'),
  body('attendance.leaveDays').optional().isInt({ min: 0, max: 31 }).withMessage('Leave days must be between 0 and 31')
  // Note: absentDays is calculated automatically based on presentDays, totalDays, and leaveDays
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
  if (payroll.status === 'Paid') {
    return res.status(400).json({
      success: false,
      message: 'Cannot update a paid payroll'
    });
  }

  // Update attendance fields
  if (req.body.attendance) {
    const attendance = req.body.attendance;
    
    // Validate that present + leave doesn't exceed total working days
    // Note: absentDays is calculated automatically, so we don't need to validate it here
    const totalCalculated = (attendance.presentDays || payroll.presentDays) + 
                           (attendance.leaveDays || payroll.leaveDays);
    const totalWorkingDays = attendance.totalDays || payroll.totalWorkingDays;
    
    if (totalCalculated > totalWorkingDays) {
      return res.status(400).json({
        success: false,
        message: `Present days (${attendance.presentDays || payroll.presentDays}) + Leave days (${attendance.leaveDays || payroll.leaveDays}) cannot exceed total working days (${totalWorkingDays})`
      });
    }

    // Update the fields
    payroll.totalWorkingDays = attendance.totalDays || payroll.totalWorkingDays;
    payroll.presentDays = attendance.presentDays || payroll.presentDays;
    
    // 🔧 AUTOMATIC ABSENT DAYS CALCULATION
    // If present days are provided, automatically calculate absent days
    if (attendance.presentDays !== undefined) {
      const totalWorkingDays = payroll.totalWorkingDays;
      const presentDays = payroll.presentDays;
      const leaveDays = attendance.leaveDays || payroll.leaveDays || 0;
      
      // Calculate absent days automatically: Total Working Days - Present Days - Leave Days
      payroll.absentDays = Math.max(0, totalWorkingDays - presentDays - leaveDays);
      
      console.log(`🧮 Automatic Absent Days Calculation:`);
      console.log(`   Total Working Days: ${totalWorkingDays}`);
      console.log(`   Present Days: ${presentDays}`);
      console.log(`   Leave Days: ${leaveDays}`);
      console.log(`   Calculated Absent Days: ${payroll.absentDays}`);
    } else {
      // If present days not provided, use the value from request or existing
      payroll.absentDays = attendance.absentDays || payroll.absentDays;
    }
    
    payroll.leaveDays = attendance.leaveDays || payroll.leaveDays;
    
    // Force recalculation of daily rate and attendance deduction
    payroll.dailyRate = undefined;
    payroll.attendanceDeduction = undefined;
    
    console.log(`📊 Attendance Update for Payroll ${payroll._id}:`);
    console.log(`   Total Working Days: ${payroll.totalWorkingDays}`);
    console.log(`   Present Days: ${payroll.presentDays}`);
    console.log(`   Absent Days: ${payroll.absentDays}`);
    console.log(`   Leave Days: ${payroll.leaveDays}`);
    
    // Save to trigger pre-save middleware for recalculations
    await payroll.save();
    
    console.log(`✅ Attendance updated successfully`);
    console.log(`   New Daily Rate: ${payroll.dailyRate?.toFixed(2)}`);
    console.log(`   New Attendance Deduction: ${payroll.attendanceDeduction?.toFixed(2)}`);
    console.log(`   New Net Salary: ${payroll.netSalary?.toFixed(2)}`);
  }

  const updatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'firstName lastName employeeId department position')
    .populate('createdBy', 'firstName lastName')
    .populate('approvedBy', 'firstName lastName');

  res.json({
    success: true,
    message: 'Payroll attendance updated successfully',
    data: updatedPayroll
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

// @route   POST /api/payroll/bulk-generate
// @desc    Generate payrolls for multiple employees
// @access  Private (HR and Admin)
router.post('/bulk-generate', [
  authorize('admin', 'hr_manager'),
  body('employeeIds').isArray().withMessage('Employee IDs array is required'),
  body('payPeriod.startDate').notEmpty().withMessage('Start date is required'),
  body('payPeriod.endDate').notEmpty().withMessage('End date is required'),
  body('payPeriod.type').isIn(['weekly', 'bi-weekly', 'monthly']).withMessage('Valid pay period type is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { employeeIds, payPeriod } = req.body;
  const createdPayrolls = [];
  const bulkErrors = [];

  for (const employeeId of employeeIds) {
    try {
      // Check if employee exists
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        bulkErrors.push(`Employee ${employeeId} not found`);
        continue;
      }

      // Check for existing payroll
      const existingPayroll = await Payroll.findOne({
        employee: employeeId,
        'payPeriod.startDate': new Date(payPeriod.startDate),
        'payPeriod.endDate': new Date(payPeriod.endDate)
      });

      if (existingPayroll) {
        bulkErrors.push(`Payroll already exists for employee ${employee.firstName} ${employee.lastName}`);
        continue;
      }

      // Get employee allowances to copy to payroll
      const employeeAllowances = employee.allowances || {};
      
      // Create payroll
      const payrollData = {
        employee: employeeId,
        payPeriod: {
          startDate: new Date(payPeriod.startDate),
          endDate: new Date(payPeriod.endDate),
          type: payPeriod.type
        },
        month: new Date(payPeriod.startDate).getMonth() + 1,
        year: new Date(payPeriod.startDate).getFullYear(),
        basicSalary: employee.salary?.gross || employee.salary || 0,
        // Copy employee allowances to payroll allowances structure
        allowances: {
          conveyance: {
            isActive: employeeAllowances.conveyance?.isActive || false,
            amount: employeeAllowances.conveyance?.isActive ? employeeAllowances.conveyance.amount : 0
          },
          food: {
            isActive: employeeAllowances.food?.isActive || false,
            amount: employeeAllowances.food?.isActive ? employeeAllowances.food.amount : 0
          },
          vehicleFuel: {
            isActive: employeeAllowances.vehicleFuel?.isActive || false,
            amount: employeeAllowances.vehicleFuel?.isActive ? employeeAllowances.vehicleFuel.amount : 0
          },
          medical: {
            isActive: employeeAllowances.medical?.isActive || false,
            amount: employeeAllowances.medical?.isActive ? employeeAllowances.medical.amount : 0
          },
          special: {
            isActive: employeeAllowances.special?.isActive || false,
            amount: employeeAllowances.special?.isActive ? employeeAllowances.special.amount : 0
          },
          other: {
            isActive: employeeAllowances.other?.isActive || false,
            amount: employeeAllowances.other?.isActive ? employeeAllowances.other.amount : 0
          }
        },
        createdBy: req.user.id
      };

      const payroll = new Payroll(payrollData);
      await payroll.save();
      
      const populatedPayroll = await Payroll.findById(payroll._id)
        .populate('employee', 'firstName lastName employeeId department position');
      
      createdPayrolls.push(populatedPayroll);
    } catch (error) {
      bulkErrors.push(`Error creating payroll for employee ${employeeId}: ${error.message}`);
    }
  }

  res.status(201).json({
    success: true,
    message: `Generated ${createdPayrolls.length} payrolls successfully`,
    data: {
      created: createdPayrolls,
      errors: bulkErrors
    }
  });
}));

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

module.exports = router; 