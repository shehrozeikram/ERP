const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');
const Attendance = require('../models/hr/Attendance');
const Loan = require('../models/hr/Loan');
const FinalSettlement = require('../models/hr/FinalSettlement');
const Department = require('../models/hr/Department');
const Position = require('../models/hr/Position');
const mongoose = require('mongoose');

const router = express.Router();

// ==================== HR REPORTS ROUTES ====================

// @route   GET /api/hr/reports
// @desc    Generate comprehensive HR reports
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const {
      reportType,
      startDate,
      endDate,
      month,
      year,
      department,
      designation,
      status,
      salaryRange,
      employmentType,
      format = 'json'
    } = req.query;

    // Build base filter
    const baseFilter = {};
    
    if (department) baseFilter.department = department;
    if (designation) baseFilter.position = designation;
    if (status) baseFilter.isActive = status === 'active';
    if (employmentType) baseFilter.employmentType = employmentType;

    // Date filters
    if (startDate || endDate) {
      baseFilter.createdAt = {};
      if (startDate) baseFilter.createdAt.$gte = new Date(startDate);
      if (endDate) baseFilter.createdAt.$lte = new Date(endDate);
    }

    let reportData = {};

    switch (reportType) {
      case 'employee_summary':
        reportData = await generateEmployeeSummaryReport(baseFilter);
        break;
      
      case 'salary_analysis':
        reportData = await generateSalaryAnalysisReport(baseFilter, salaryRange);
        break;
      
      case 'attendance_report':
        reportData = await generateAttendanceReport(baseFilter, startDate, endDate);
        break;
      
      case 'payroll_report':
        reportData = await generatePayrollReport(baseFilter, month, year);
        break;
      
      case 'loan_report':
        reportData = await generateLoanReport(baseFilter);
        break;
      
      case 'provident_fund_report':
        reportData = await generateProvidentFundReport(baseFilter);
        break;
      
      case 'eobi_report':
        reportData = await generateEOBIReport(baseFilter);
        break;
      
      case 'leave_report':
        reportData = await generateLeaveReport(baseFilter);
        break;
      
      case 'recruitment_report':
        reportData = await generateRecruitmentReport(baseFilter, startDate, endDate);
        break;
      
      case 'turnover_report':
        reportData = await generateTurnoverReport(baseFilter, startDate, endDate);
        break;
      
      case 'performance_report':
        reportData = await generatePerformanceReport(baseFilter);
        break;
      
      case 'settlement_report':
        reportData = await generateSettlementReport(baseFilter, startDate, endDate);
        break;
      
      case 'compliance_report':
        reportData = await generateComplianceReport(baseFilter);
        break;
      
      case 'cost_analysis':
        reportData = await generateCostAnalysisReport(baseFilter, month, year);
        break;
      
      case 'demographics_report':
        reportData = await generateDemographicsReport(baseFilter);
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }

    // Handle different formats
    if (format === 'csv') {
      const csvData = convertToCSV(reportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}-${startDate || 'all'}-${endDate || 'data'}.csv`);
      return res.send(csvData);
    }



    res.json({
      success: true,
      data: reportData
    });
  })
);

// ==================== REPORT GENERATION FUNCTIONS ====================

// Employee Summary Report
async function generateEmployeeSummaryReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .populate('position', 'title')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter(emp => emp.isActive).length,
    inactiveEmployees: employees.filter(emp => !emp.isActive).length,
    totalGrossSalary: employees.reduce((sum, emp) => sum + (emp.salary?.gross || 0), 0),
    averageGrossSalary: employees.length > 0 ? 
      employees.reduce((sum, emp) => sum + (emp.salary?.gross || 0), 0) / employees.length : 0,
    totalBasicSalary: employees.reduce((sum, emp) => sum + (emp.salary?.basic || 0), 0),
    averageBasicSalary: employees.length > 0 ? 
      employees.reduce((sum, emp) => sum + (emp.salary?.basic || 0), 0) / employees.length : 0
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    email: emp.email,
    department: emp.department?.name || 'N/A',
    designation: emp.position?.title || 'N/A',
    status: emp.isActive ? 'Active' : 'Inactive',
    basicSalary: emp.salary?.basic || 0,
    grossSalary: emp.salary?.gross || 0,
    hireDate: emp.hireDate,
    joiningDate: emp.appointmentDate
  }));

  return { summary, data };
}

// Salary Analysis Report
async function generateSalaryAnalysisReport(filter, salaryRange) {
  let salaryFilter = {};
  
  if (salaryRange) {
    const [min, max] = salaryRange.split('-').map(Number);
    salaryFilter['salary.gross'] = {};
    if (min) salaryFilter['salary.gross'].$gte = min;
    if (max) salaryFilter['salary.gross'].$lte = max;
  }

  const employees = await Employee.find({ ...filter, ...salaryFilter })
    .populate('department', 'name')
    .populate('position', 'title')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    totalSalaryBudget: employees.reduce((sum, emp) => sum + (emp.salary?.gross || 0), 0),
    averageSalary: employees.length > 0 ? 
      employees.reduce((sum, emp) => sum + (emp.salary?.gross || 0), 0) / employees.length : 0,
    highestSalary: Math.max(...employees.map(emp => emp.salary?.gross || 0)),
    lowestSalary: Math.min(...employees.map(emp => emp.salary?.gross || 0))
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name || 'N/A',
    designation: emp.position?.title || 'N/A',
    basicSalary: emp.salary?.basic || 0,
    houseRent: emp.salary?.houseRent || 0,
    medicalAllowance: emp.salary?.medical || 0,
    grossSalary: emp.salary?.gross || 0,
    providentFund: emp.providentFund?.amount || 0,
    eobi: emp.eobi?.amount || 0
  }));

  return { summary, data };
}

// Attendance Report
async function generateAttendanceReport(filter, startDate, endDate) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const attendanceData = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: employees.map(emp => emp._id) },
        date: {
          $gte: new Date(startDate || new Date().setMonth(new Date().getMonth() - 1)),
          $lte: new Date(endDate || new Date())
        }
      }
    },
    {
      $group: {
        _id: '$employee',
        totalDays: { $sum: 1 },
        presentDays: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        absentDays: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        lateDays: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        totalHours: { $sum: '$totalHours' }
      }
    }
  ]);

  const summary = {
    totalEmployees: employees.length,
    totalDays: attendanceData.reduce((sum, att) => sum + att.totalDays, 0),
    totalPresentDays: attendanceData.reduce((sum, att) => sum + att.presentDays, 0),
    totalAbsentDays: attendanceData.reduce((sum, att) => sum + att.absentDays, 0),
    averageAttendanceRate: attendanceData.length > 0 ? 
      (attendanceData.reduce((sum, att) => sum + att.presentDays, 0) / 
       attendanceData.reduce((sum, att) => sum + att.totalDays, 0)) * 100 : 0
  };

  const data = employees.map(emp => {
    const attendance = attendanceData.find(att => att._id.toString() === emp._id.toString());
    return {
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name || 'N/A',
      totalDays: attendance?.totalDays || 0,
      presentDays: attendance?.presentDays || 0,
      absentDays: attendance?.absentDays || 0,
      lateDays: attendance?.lateDays || 0,
      attendanceRate: attendance ? (attendance.presentDays / attendance.totalDays) * 100 : 0,
      totalHours: attendance?.totalHours || 0
    };
  });

  return { summary, data };
}

// Payroll Report
async function generatePayrollReport(filter, month, year) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const payrollData = await Payroll.aggregate([
    {
      $match: {
        employee: { $in: employees.map(emp => emp._id) },
        month: parseInt(month || new Date().getMonth() + 1),
        year: parseInt(year || new Date().getFullYear())
      }
    },
    {
      $group: {
        _id: '$employee',
        basicSalary: { $first: '$basicSalary' },
        grossSalary: { $first: '$grossSalary' },
        netSalary: { $first: '$netSalary' },
        totalEarnings: { $first: '$totalEarnings' },
        totalDeductions: { $first: '$totalDeductions' },
        providentFund: { $first: '$deductions.providentFund' },
        eobi: { $first: '$deductions.eobi' },
        incomeTax: { $first: '$deductions.incomeTax' }
      }
    }
  ]);

  const summary = {
    totalEmployees: payrollData.length,
    totalGrossSalary: payrollData.reduce((sum, payroll) => sum + (payroll.grossSalary || 0), 0),
    totalNetSalary: payrollData.reduce((sum, payroll) => sum + (payroll.netSalary || 0), 0),
    totalDeductions: payrollData.reduce((sum, payroll) => sum + (payroll.totalDeductions || 0), 0),
    totalProvidentFund: payrollData.reduce((sum, payroll) => sum + (payroll.providentFund || 0), 0),
    totalEOBI: payrollData.reduce((sum, payroll) => sum + (payroll.eobi || 0), 0),
    totalIncomeTax: payrollData.reduce((sum, payroll) => sum + (payroll.incomeTax || 0), 0)
  };

  const data = employees.map(emp => {
    const payroll = payrollData.find(p => p._id.toString() === emp._id.toString());
    return {
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name || 'N/A',
      basicSalary: payroll?.basicSalary || 0,
      grossSalary: payroll?.grossSalary || 0,
      netSalary: payroll?.netSalary || 0,
      totalEarnings: payroll?.totalEarnings || 0,
      totalDeductions: payroll?.totalDeductions || 0,
      providentFund: payroll?.providentFund || 0,
      eobi: payroll?.eobi || 0,
      incomeTax: payroll?.incomeTax || 0
    };
  });

  return { summary, data };
}

// Loan Report
async function generateLoanReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const loanData = await Loan.aggregate([
    {
      $match: {
        employee: { $in: employees.map(emp => emp._id) }
      }
    },
    {
      $group: {
        _id: '$employee',
        totalLoans: { $sum: 1 },
        totalLoanAmount: { $sum: '$loanAmount' },
        totalOutstanding: { $sum: '$outstandingBalance' },
        totalPaid: { $sum: '$totalPaid' },
        activeLoans: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
        completedLoans: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }
      }
    }
  ]);

  const summary = {
    totalEmployees: employees.length,
    employeesWithLoans: loanData.length,
    totalLoans: loanData.reduce((sum, loan) => sum + loan.totalLoans, 0),
    totalLoanAmount: loanData.reduce((sum, loan) => sum + loan.totalLoanAmount, 0),
    totalOutstanding: loanData.reduce((sum, loan) => sum + loan.totalOutstanding, 0),
    totalPaid: loanData.reduce((sum, loan) => sum + loan.totalPaid, 0),
    activeLoans: loanData.reduce((sum, loan) => sum + loan.activeLoans, 0),
    completedLoans: loanData.reduce((sum, loan) => sum + loan.completedLoans, 0)
  };

  const data = employees.map(emp => {
    const loan = loanData.find(l => l._id.toString() === emp._id.toString());
    return {
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name || 'N/A',
      totalLoans: loan?.totalLoans || 0,
      totalLoanAmount: loan?.totalLoanAmount || 0,
      totalOutstanding: loan?.totalOutstanding || 0,
      totalPaid: loan?.totalPaid || 0,
      activeLoans: loan?.activeLoans || 0,
      completedLoans: loan?.completedLoans || 0,
      hasActiveLoans: (loan?.activeLoans || 0) > 0
    };
  });

  return { summary, data };
}

// Provident Fund Report
async function generateProvidentFundReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    employeesWithPF: employees.filter(emp => emp.providentFund?.isActive).length,
    totalPFContribution: employees.reduce((sum, emp) => sum + (emp.providentFund?.amount || 0), 0),
    averagePFContribution: employees.filter(emp => emp.providentFund?.isActive).length > 0 ?
      employees.reduce((sum, emp) => sum + (emp.providentFund?.amount || 0), 0) / 
      employees.filter(emp => emp.providentFund?.isActive).length : 0
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name || 'N/A',
    basicSalary: emp.salary?.basic || 0,
    pfActive: emp.providentFund?.isActive || false,
    pfPercentage: emp.providentFund?.percentage || 0,
    pfAmount: emp.providentFund?.amount || 0,
    pfBalance: emp.providentFund?.balance || 0
  }));

  return { summary, data };
}

// EOBI Report
async function generateEOBIReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    employeesWithEOBI: employees.filter(emp => emp.eobi?.isActive).length,
    totalEOBIContribution: employees.reduce((sum, emp) => sum + (emp.eobi?.amount || 0), 0),
    averageEOBIContribution: employees.filter(emp => emp.eobi?.isActive).length > 0 ?
      employees.reduce((sum, emp) => sum + (emp.eobi?.amount || 0), 0) / 
      employees.filter(emp => emp.eobi?.isActive).length : 0
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name || 'N/A',
    eobiActive: emp.eobi?.isActive || false,
    eobiPercentage: emp.eobi?.percentage || 0,
    eobiAmount: emp.eobi?.amount || 0,
    eobiBalance: emp.eobi?.balance || 0
  }));

  return { summary, data };
}

// Leave Report
async function generateLeaveReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    totalAnnualLeave: employees.reduce((sum, emp) => sum + (emp.leaveBalance?.annual || 0), 0),
    totalSickLeave: employees.reduce((sum, emp) => sum + (emp.leaveBalance?.sick || 0), 0),
    totalCasualLeave: employees.reduce((sum, emp) => sum + (emp.leaveBalance?.casual || 0), 0),
    averageAnnualLeave: employees.length > 0 ? 
      employees.reduce((sum, emp) => sum + (emp.leaveBalance?.annual || 0), 0) / employees.length : 0
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name || 'N/A',
    annualLeave: emp.leaveBalance?.annual || 0,
    sickLeave: emp.leaveBalance?.sick || 0,
    casualLeave: emp.leaveBalance?.casual || 0,
    otherLeave: emp.leaveBalance?.other || 0,
    totalLeave: (emp.leaveBalance?.annual || 0) + (emp.leaveBalance?.sick || 0) + 
                (emp.leaveBalance?.casual || 0) + (emp.leaveBalance?.other || 0)
  }));

  return { summary, data };
}

// Recruitment Report
async function generateRecruitmentReport(filter, startDate, endDate) {
  const employees = await Employee.find({
    ...filter,
    createdAt: {
      $gte: new Date(startDate || new Date().setMonth(new Date().getMonth() - 12)),
      $lte: new Date(endDate || new Date())
    }
  })
  .populate('department', 'name')
  .lean();

  const summary = {
    totalHires: employees.length,
    hiresThisMonth: employees.filter(emp => 
      emp.createdAt.getMonth() === new Date().getMonth() &&
      emp.createdAt.getFullYear() === new Date().getFullYear()
    ).length,
    hiresThisYear: employees.filter(emp => 
      emp.createdAt.getFullYear() === new Date().getFullYear()
    ).length,
    averageHiringRate: employees.length / 12 // per month over the period
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name || 'N/A',
    designation: emp.position?.title || 'N/A',
    hireDate: emp.hireDate,
    joiningDate: emp.appointmentDate,
    probationPeriod: emp.probationPeriodMonths,
    status: emp.isActive ? 'Active' : 'Inactive'
  }));

  return { summary, data };
}

// Turnover Report
async function generateTurnoverReport(filter, startDate, endDate) {
  const settlements = await FinalSettlement.find({
    settlementDate: {
      $gte: new Date(startDate || new Date().setMonth(new Date().getMonth() - 12)),
      $lte: new Date(endDate || new Date())
    }
  })
  .populate('employee', 'firstName lastName department position')
  .lean();

  const summary = {
    totalSeparations: settlements.length,
    separationsThisMonth: settlements.filter(settlement => 
      settlement.settlementDate.getMonth() === new Date().getMonth() &&
      settlement.settlementDate.getFullYear() === new Date().getFullYear()
    ).length,
    separationsThisYear: settlements.filter(settlement => 
      settlement.settlementDate.getFullYear() === new Date().getFullYear()
    ).length,
    averageTurnoverRate: settlements.length / 12 // per month over the period
  };

  const data = settlements.map(settlement => ({
    employeeId: settlement.employeeId,
    name: settlement.employeeName,
    department: settlement.department,
    designation: settlement.designation,
    settlementType: settlement.settlementType,
    settlementDate: settlement.settlementDate,
    settlementAmount: settlement.netSettlementAmount,
    reason: settlement.reason
  }));

  return { summary, data };
}

// Performance Report
async function generatePerformanceReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter(emp => emp.isActive).length,
    probationEmployees: employees.filter(emp => 
      emp.endOfProbationDate && emp.endOfProbationDate > new Date()
    ).length,
    confirmedEmployees: employees.filter(emp => emp.confirmationDate).length
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name || 'N/A',
    designation: emp.position?.title || 'N/A',
    hireDate: emp.hireDate,
    probationEndDate: emp.endOfProbationDate,
    confirmationDate: emp.confirmationDate,
    status: emp.isActive ? 'Active' : 'Inactive',
    employmentStatus: emp.confirmationDate ? 'Confirmed' : 
                     (emp.endOfProbationDate && emp.endOfProbationDate > new Date()) ? 'Probation' : 'Unknown'
  }));

  return { summary, data };
}

// Settlement Report
async function generateSettlementReport(filter, startDate, endDate) {
  const settlements = await FinalSettlement.find({
    settlementDate: {
      $gte: new Date(startDate || new Date().setMonth(new Date().getMonth() - 12)),
      $lte: new Date(endDate || new Date())
    }
  })
  .populate('employee', 'firstName lastName')
  .lean();

  const summary = {
    totalSettlements: settlements.length,
    totalSettlementAmount: settlements.reduce((sum, settlement) => sum + (settlement.netSettlementAmount || 0), 0),
    averageSettlementAmount: settlements.length > 0 ? 
      settlements.reduce((sum, settlement) => sum + (settlement.netSettlementAmount || 0), 0) / settlements.length : 0,
    pendingSettlements: settlements.filter(settlement => settlement.status === 'pending').length,
    approvedSettlements: settlements.filter(settlement => settlement.status === 'approved').length,
    processedSettlements: settlements.filter(settlement => settlement.status === 'processed').length
  };

  const data = settlements.map(settlement => ({
    employeeId: settlement.employeeId,
    name: settlement.employeeName,
    department: settlement.department,
    designation: settlement.designation,
    settlementType: settlement.settlementType,
    settlementDate: settlement.settlementDate,
    grossAmount: settlement.grossSettlementAmount,
    netAmount: settlement.netSettlementAmount,
    status: settlement.status,
    reason: settlement.reason
  }));

  return { summary, data };
}

// Compliance Report
async function generateComplianceReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    employeesWithPF: employees.filter(emp => emp.providentFund?.isActive).length,
    employeesWithEOBI: employees.filter(emp => emp.eobi?.isActive).length,
    complianceRate: employees.length > 0 ? 
      ((employees.filter(emp => emp.providentFund?.isActive).length + 
        employees.filter(emp => emp.eobi?.isActive).length) / (employees.length * 2)) * 100 : 0
  };

  const data = employees.map(emp => ({
    employeeId: emp.employeeId,
    name: `${emp.firstName} ${emp.lastName}`,
    department: emp.department?.name || 'N/A',
    pfCompliant: emp.providentFund?.isActive || false,
    eobiCompliant: emp.eobi?.isActive || false,
    taxExempt: emp.taxExemption || false,
    idCard: emp.idCard,
    nationality: emp.nationality
  }));

  return { summary, data };
}

// Cost Analysis Report
async function generateCostAnalysisReport(filter, month, year) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const payrollData = await Payroll.aggregate([
    {
      $match: {
        employee: { $in: employees.map(emp => emp._id) },
        month: parseInt(month || new Date().getMonth() + 1),
        year: parseInt(year || new Date().getFullYear())
      }
    }
  ]);

  const summary = {
    totalEmployees: employees.length,
    totalSalaryCost: payrollData.reduce((sum, payroll) => sum + (payroll.grossSalary || 0), 0),
    totalBenefitsCost: payrollData.reduce((sum, payroll) => 
      sum + (payroll.deductions?.providentFund || 0) + (payroll.deductions?.eobi || 0), 0),
    totalTaxCost: payrollData.reduce((sum, payroll) => sum + (payroll.deductions?.incomeTax || 0), 0),
    averageCostPerEmployee: employees.length > 0 ? 
      payrollData.reduce((sum, payroll) => sum + (payroll.grossSalary || 0), 0) / employees.length : 0
  };

  const data = employees.map(emp => {
    const payroll = payrollData.find(p => p.employee.toString() === emp._id.toString());
    return {
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name || 'N/A',
      salaryCost: payroll?.grossSalary || 0,
      benefitsCost: (payroll?.deductions?.providentFund || 0) + (payroll?.deductions?.eobi || 0),
      taxCost: payroll?.deductions?.incomeTax || 0,
      totalCost: (payroll?.grossSalary || 0) + 
                 (payroll?.deductions?.providentFund || 0) + 
                 (payroll?.deductions?.eobi || 0) + 
                 (payroll?.deductions?.incomeTax || 0)
    };
  });

  return { summary, data };
}

// Demographics Report
async function generateDemographicsReport(filter) {
  const employees = await Employee.find(filter)
    .populate('department', 'name')
    .lean();

  const summary = {
    totalEmployees: employees.length,
    maleEmployees: employees.filter(emp => emp.gender === 'male').length,
    femaleEmployees: employees.filter(emp => emp.gender === 'female').length,
    averageAge: employees.length > 0 ? 
      employees.reduce((sum, emp) => {
        const age = new Date().getFullYear() - new Date(emp.dateOfBirth).getFullYear();
        return sum + age;
      }, 0) / employees.length : 0
  };

  const data = employees.map(emp => {
    const age = new Date().getFullYear() - new Date(emp.dateOfBirth).getFullYear();
    return {
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name || 'N/A',
      gender: emp.gender,
      age: age,
      nationality: emp.nationality,
      religion: emp.religion,
      maritalStatus: emp.maritalStatus,
      dateOfBirth: emp.dateOfBirth
    };
  });

  return { summary, data };
}

// Helper function to convert data to CSV
function convertToCSV(data) {
  if (!data.data || data.data.length === 0) {
    return 'No data available';
  }

  const headers = Object.keys(data.data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data.data) {
    const values = headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}





module.exports = router; 