const express = require('express');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Employee = require('../models/hr/Employee');
const Payroll = require('../models/hr/Payroll');
const Department = require('../models/hr/Department');
const mongoose = require('mongoose');

const router = express.Router();

console.log('🔧 PayrollReports routes loaded successfully');

// Months array for display
const months = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

// ==================== PAYROLL REPORTS ROUTES ====================

// @route   GET /api/hr/reports/payroll/monthly
// @desc    Generate monthly payroll report
// @access  Private (HR and Admin)
router.get('/monthly', 
  authorize('admin', 'hr_manager', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { month, year, department, format = 'json' } = req.query;
    
    try {
      // Build base filter
      const baseFilter = {};
      if (department) {
        // Filter by employee's department
        const employeesInDepartment = await Employee.find({ department: new mongoose.Types.ObjectId(department) }).select('_id');
        const employeeIds = employeesInDepartment.map(emp => emp._id);
        baseFilter.employee = { $in: employeeIds };
      }

      // Get payroll data for the specified month/year using aggregation for proper sorting
      const payrollData = await Payroll.aggregate([
        {
          $match: {
            ...baseFilter,
            month: parseInt(month),
            year: parseInt(year)
          }
        },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'employeeData.department',
            foreignField: '_id',
            as: 'departmentData'
          }
        },
        {
          $unwind: {
            path: '$employeeData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$departmentData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            'employee': {
              firstName: '$employeeData.firstName',
              lastName: '$employeeData.lastName',
              employeeId: '$employeeData.employeeId'
            },
            'department': {
              name: '$departmentData.name'
            },
            'employeeIdNumeric': {
              $toInt: { $ifNull: ['$employeeData.employeeId', '0'] }
            }
          }
        },
        {
          $sort: { 'employeeIdNumeric': 1 }
        },
        {
          $project: {
            employee: 1,
            department: 1,
            grossSalary: 1,
            totalDeductions: 1,
            netSalary: 1,
            basicSalary: 1,
            totalAllowances: 1,
            overtime: 1,
            tax: 1,
            providentFund: 1,
            eobi: 1,
            otherDeductions: 1
          }
        }
      ]);

      // Check if data exists
      if (payrollData.length === 0) {
        return res.json({
          success: false,
          message: `No payroll data found for ${months[parseInt(month) - 1]?.label || month}/${year}`,
          data: null
        });
      }

      // Calculate summary
      const summary = {
        totalEmployees: payrollData.length,
        totalGrossSalary: payrollData.reduce((sum, payroll) => sum + (payroll.grossSalary || 0), 0),
        totalDeductions: payrollData.reduce((sum, payroll) => sum + (payroll.totalDeductions || 0), 0),
        netPay: payrollData.reduce((sum, payroll) => sum + (payroll.netSalary || 0), 0)
      };

      // Transform data for frontend
      const transformedData = payrollData.map(payroll => ({
        employeeName: `${payroll.employee?.firstName || ''} ${payroll.employee?.lastName || ''}`.trim(),
        employeeId: payroll.employee?.employeeId || 'N/A',
        department: payroll.department?.name || 'N/A',
        grossSalary: payroll.grossSalary || 0,
        deductions: payroll.totalDeductions || 0,
        netPay: payroll.netSalary || 0,
        basicSalary: payroll.basicSalary || 0,
        allowances: payroll.totalAllowances || 0,
        overtime: payroll.overtime || 0,
        tax: payroll.tax || 0,
        providentFund: payroll.providentFund || 0,
        eobi: payroll.eobi || 0,
        otherDeductions: payroll.otherDeductions || 0
      }));

      const reportData = {
        summary,
        data: transformedData,
        filters: {
          month: parseInt(month),
          year: parseInt(year),
          department: department || 'All'
        },
        generatedAt: new Date(),
        reportType: 'monthly_payroll'
      };

      // Handle different formats
      if (format === 'csv') {
        const csvData = convertToCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=monthly-payroll-${month}-${year}.csv`);
        return res.send(csvData);
      }

      res.json({
        success: true,
        data: reportData
      });

    } catch (error) {
      console.error('Error generating monthly payroll report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating monthly payroll report',
        error: error.message
      });
    }
  })
);

// @route   GET /api/hr/reports/payroll/department
// @desc    Generate department-wise payroll report
// @access  Private (HR and Admin)
router.get('/department', 
  authorize('admin', 'hr_manager', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { month, year, format = 'json' } = req.query;
    
    try {
      // Get payroll data grouped by department
      const payrollData = await Payroll.aggregate([
        {
          $match: {
            month: parseInt(month),
            year: parseInt(year)
          }
        },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'employeeData.department',
            foreignField: '_id',
            as: 'departmentData'
          }
        },
        {
          $unwind: {
            path: '$employeeData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$departmentData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $group: {
            _id: '$departmentData._id',
            departmentName: { $first: '$departmentData.name' },
            totalEmployees: { $sum: 1 },
            totalGrossSalary: { $sum: '$grossSalary' },
            totalDeductions: { $sum: '$totalDeductions' },
            totalNetPay: { $sum: '$netSalary' },
            averageSalary: { $avg: '$grossSalary' }
          }
        },
        {
          $sort: { totalGrossSalary: -1 }
        }
      ]);

      // Check if data exists
      if (payrollData.length === 0) {
        return res.json({
          success: false,
          message: `No payroll data found for ${months[parseInt(month) - 1]?.label || month}/${year}`,
          data: null
        });
      }

      // Calculate overall summary
      const summary = {
        totalDepartments: payrollData.length,
        totalEmployees: payrollData.reduce((sum, dept) => sum + dept.totalEmployees, 0),
        totalGrossSalary: payrollData.reduce((sum, dept) => sum + dept.totalGrossSalary, 0),
        totalDeductions: payrollData.reduce((sum, dept) => sum + dept.totalDeductions, 0),
        totalNetPay: payrollData.reduce((sum, dept) => sum + dept.totalNetPay, 0)
      };

      // Transform data for frontend
      const transformedData = payrollData.map(dept => ({
        departmentName: dept.departmentName || 'N/A',
        totalEmployees: dept.totalEmployees,
        totalGrossSalary: dept.totalGrossSalary,
        totalDeductions: dept.totalDeductions,
        totalNetPay: dept.totalNetPay,
        averageSalary: Math.round(dept.averageSalary || 0)
      }));

      const reportData = {
        summary,
        data: transformedData,
        filters: {
          month: parseInt(month),
          year: parseInt(year)
        },
        generatedAt: new Date(),
        reportType: 'department_payroll'
      };

      // Handle different formats
      if (format === 'csv') {
        const csvData = convertToCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=department-payroll-${month}-${year}.csv`);
        return res.send(csvData);
      }

      res.json({
        success: true,
        data: reportData
      });

    } catch (error) {
      console.error('Error generating department payroll report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating department payroll report',
        error: error.message
      });
    }
  })
);

// @route   GET /api/hr/reports/payroll/salary
// @desc    Generate salary analysis report
// @access  Private (HR and Admin)
router.get('/salary', 
  authorize('admin', 'hr_manager', 'finance_manager'), 
  asyncHandler(async (req, res) => {
    const { month, year, format = 'json' } = req.query;
    
    try {
      // Get salary distribution data
      const salaryData = await Payroll.aggregate([
        {
          $match: {
            month: parseInt(month),
            year: parseInt(year)
          }
        },
        {
          $lookup: {
            from: 'employees',
            localField: 'employee',
            foreignField: '_id',
            as: 'employeeData'
          }
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'employeeData.department',
            foreignField: '_id',
            as: 'departmentData'
          }
        },
        {
          $unwind: {
            path: '$employeeData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$departmentData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            employeeName: { $concat: ['$employeeData.firstName', ' ', '$employeeData.lastName'] },
            department: '$departmentData.name',
            grossSalary: 1,
            basicSalary: 1,
            allowances: 1,
            overtime: 1,
            deductions: 1,
            netSalary: 1
          }
        },
        {
          $sort: { 'employeeData.employeeId': 1 }
        }
      ]);

      // Check if data exists
      if (salaryData.length === 0) {
        return res.json({
          success: false,
          message: `No payroll data found for ${months[parseInt(month) - 1]?.label || month}/${year}`,
          data: null
        });
      }

      // Calculate salary statistics
      const salaries = salaryData.map(emp => emp.grossSalary).filter(salary => salary > 0);
      const summary = {
        totalEmployees: salaryData.length,
        averageSalary: salaries.length > 0 ? Math.round(salaries.reduce((sum, salary) => sum + salary, 0) / salaries.length) : 0,
        medianSalary: salaries.length > 0 ? Math.round(salaries.sort((a, b) => a - b)[Math.floor(salaries.length / 2)]) : 0,
        minSalary: salaries.length > 0 ? Math.min(...salaries) : 0,
        maxSalary: salaries.length > 0 ? Math.max(...salaries) : 0,
        totalGrossSalary: salaries.reduce((sum, salary) => sum + salary, 0)
      };

      // Create salary ranges
      const salaryRanges = [
        { range: '0-50,000', min: 0, max: 50000, count: 0 },
        { range: '50,001-100,000', min: 50001, max: 100000, count: 0 },
        { range: '100,001-150,000', min: 100001, max: 150000, count: 0 },
        { range: '150,001-200,000', min: 150001, max: 200000, count: 0 },
        { range: '200,001+', min: 200001, max: Infinity, count: 0 }
      ];

      salaries.forEach(salary => {
        const range = salaryRanges.find(r => salary >= r.min && salary <= r.max);
        if (range) range.count++;
      });

      const reportData = {
        summary,
        salaryRanges,
        data: salaryData,
        filters: {
          month: parseInt(month),
          year: parseInt(year)
        },
        generatedAt: new Date(),
        reportType: 'salary_analysis'
      };

      // Handle different formats
      if (format === 'csv') {
        const csvData = convertToCSV(reportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=salary-analysis-${month}-${year}.csv`);
        return res.send(csvData);
      }

      res.json({
        success: true,
        data: reportData
      });

    } catch (error) {
      console.error('Error generating salary analysis report:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating salary analysis report',
        error: error.message
      });
    }
  })
);

// ==================== UTILITY FUNCTIONS ====================

// Convert data to CSV format
function convertToCSV(reportData) {
  if (!reportData.data || !Array.isArray(reportData.data)) {
    return 'No data available';
  }

  const headers = Object.keys(reportData.data[0] || {});
  const csvRows = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  reportData.data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value || '';
    });
    csvRows.push(values.join(','));
  });

  return csvRows.join('\n');
}

module.exports = router;
