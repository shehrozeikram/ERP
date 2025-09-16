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

      // Get employee data directly (since payroll records are outdated)
      // Build employee filter based on department
      let employeeFilter = {};
      if (department) {
        employeeFilter.department = new mongoose.Types.ObjectId(department);
      }

      const payrollData = await Employee.aggregate([
        {
          $match: employeeFilter
        },
        {
          $lookup: {
            from: 'departments',
            localField: 'department',
            foreignField: '_id',
            as: 'departmentData'
          }
        },
        {
          $lookup: {
            from: 'banks',
            localField: 'bankName',
            foreignField: '_id',
            as: 'bankData'
          }
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'placementSection',
            foreignField: '_id',
            as: 'sectionData'
          }
        },
        {
          $lookup: {
            from: 'designations',
            localField: 'placementDesignation',
            foreignField: '_id',
            as: 'designationData'
          }
        },
        {
          $lookup: {
            from: 'locations',
            localField: 'placementLocation',
            foreignField: '_id',
            as: 'locationData'
          }
        },
        {
          $unwind: {
            path: '$departmentData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$bankData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$sectionData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$designationData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$locationData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            'employeeIdNumeric': {
              $toInt: { $ifNull: ['$employeeId', '0'] }
            }
          }
        },
        {
          $sort: { 'employeeIdNumeric': 1 }
        },
        {
          $project: {
            // Employee fields
            employeeId: 1,
            firstName: 1,
            lastName: 1,
            guardianName: 1,
            idCard: 1,
            branchCode: 1,
            accountNumber: 1,
            hireDate: 1,
            project: 1,
            section: 1,
            designation: 1,
            location: 1,
            dateOfBirth: 1,
            address: 1,
            qualification: 1,
            phone: 1,
            probationPeriod: 1,
            joiningDate: 1,
            appointmentDate: 1,
            confirmationDate: 1,
            // Excel salary fields
            excelGrossSalary: 1,
            arrears: 1,
            excelConveyanceAllowance: 1,
            excelHouseAllowance: 1,
            excelFoodAllowance: 1,
            excelVehicleFuelAllowance: 1,
            excelMedicalAllowance: 1,
            totalEarnings: 1,
            incomeTax: 1,
            companyLoan: 1,
            vehicleLoan: 1,
            eobiDeduction: 1,
            netPayable: 1,
            // Populated fields
            'departmentData.name': 1,
            'bankData.name': 1,
            'sectionData.name': 1,
            'designationData.title': 1,
            'locationData.name': 1
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

      // Calculate summary from employee data
      const summary = {
        totalEmployees: payrollData.length,
        totalGrossSalary: payrollData.reduce((sum, emp) => sum + (emp.excelGrossSalary || 0), 0),
        totalDeductions: payrollData.reduce((sum, emp) => sum + ((emp.incomeTax || 0) + (emp.companyLoan || 0) + (emp.vehicleLoan || 0) + (emp.eobiDeduction || 0)), 0),
        netPay: payrollData.reduce((sum, emp) => sum + (emp.netPayable || 0), 0)
      };

      // Transform data for frontend (using employee data directly)
      const transformedData = payrollData.map(employee => ({
        // Basic employee info
        employeeId: employee.employeeId || 'N/A',
        employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        guardianName: employee.guardianName || 'N/A',
        idCard: employee.idCard || 'N/A',
        bankName: employee.bankData?.name || 'N/A',
        branchCode: employee.branchCode || 'N/A',
        accountNumber: employee.accountNumber || 'N/A',
        hireDate: employee.hireDate || null,
        project: employee.project || 'N/A',
        department: employee.departmentData?.name || 'N/A',
        section: employee.sectionData?.name || 'N/A',
        designation: employee.designationData?.title || 'N/A',
        location: employee.locationData?.name || 'N/A',
        dateOfBirth: employee.dateOfBirth || null,
        address: employee.address?.street || 'N/A',
        qualification: employee.qualification || 'N/A',
        phone: employee.phone || 'N/A',
        probationPeriod: employee.probationPeriod || null,
        joiningDate: employee.joiningDate || null,
        appointmentDate: employee.appointmentDate || null,
        confirmationDate: employee.confirmationDate || null,
        // Salary fields from Excel data
        grossSalary: employee.excelGrossSalary || 0,
        // Calculated salary components (66.66% basic, 10% medical, 23.34% house rent)
        basicSalary: Math.round((employee.excelGrossSalary || 0) * 0.6666),
        houseRent: Math.round((employee.excelGrossSalary || 0) * 0.2334),
        medical: Math.round((employee.excelGrossSalary || 0) * 0.10),
        arrears: employee.arrears || 0,
        conveyanceAllowance: employee.excelConveyanceAllowance || 0,
        houseAllowance: employee.excelHouseAllowance || 0,
        foodAllowance: employee.excelFoodAllowance || 0,
        vehicleFuelAllowance: employee.excelVehicleFuelAllowance || 0,
        medicalAllowance: employee.excelMedicalAllowance || 0,
        totalEarnings: employee.totalEarnings || 0,
        incomeTax: employee.incomeTax || 0,
        companyLoan: employee.companyLoan || 0,
        vehicleLoan: employee.vehicleLoan || 0,
        eobiDeduction: employee.eobiDeduction || 0,
        netPayable: employee.netPayable || 0,
        // Additional fields for display
        deductions: (employee.incomeTax || 0) + (employee.companyLoan || 0) + (employee.vehicleLoan || 0) + (employee.eobiDeduction || 0),
        netPay: employee.netPayable || 0,
        allowances: (employee.excelConveyanceAllowance || 0) + (employee.excelHouseAllowance || 0) + (employee.excelFoodAllowance || 0) + (employee.excelVehicleFuelAllowance || 0) + (employee.excelMedicalAllowance || 0),
        overtime: 0,
        tax: employee.incomeTax || 0,
        providentFund: 0,
        eobi: employee.eobiDeduction || 0,
        otherDeductions: 0
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

// Convert data to CSV format matching Excel structure
function convertToCSV(reportData) {
  if (!reportData.data || !Array.isArray(reportData.data)) {
    return 'No data available';
  }

  // Excel structure headers (exact match with Master_File_Aug_2025.xlsx)
  const excelHeaders = [
    'Sr No',
    'ID',
    'Name',
    'Guardian Name',
    'CNIC',
    'Bank',
    'Branch Code',
    'Account No',
    'DOJ',
    'Project',
    'Department',
    'Section',
    'Designation',
    'Location',
    'DOB',
    'Address',
    'Qualification',
    'Contact No',
    'Probation Period',
    'Date Of joining',
    'Date of Appointment',
    'Confirmation Date',
    'Gross Salary',
    'Basic Salary',
    'House Rent',
    'Medical',
    'Arrears',
    'Conveyance Allowance',
    'House Allowance',
    'Food Allowance',
    'Vehicle & Fuel Allowance',
    'Medical Allowance',
    'Total Earnings',
    'Income Tax',
    'Company Loan',
    'Vehicle Loan',
    'EOBI Ded',
    'Net Payable'
  ];

  const csvRows = [];

  // Add headers
  csvRows.push(excelHeaders.join(','));

  // Add data rows
  reportData.data.forEach((row, index) => {
    const values = [
      index + 1, // Sr No
      row.employeeId || 'N/A', // ID
      row.employeeName || 'N/A', // Name
      row.guardianName || 'N/A', // Guardian Name
      row.idCard || 'N/A', // CNIC
      row.bankName || 'N/A', // Bank
      row.branchCode || 'N/A', // Branch Code
      row.accountNumber || 'N/A', // Account No
      row.hireDate ? new Date(row.hireDate).toLocaleDateString() : 'N/A', // DOJ
      row.project || 'N/A', // Project
      row.department || 'N/A', // Department
      row.section || 'N/A', // Section
      row.designation || 'N/A', // Designation
      row.location || 'N/A', // Location
      row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString() : 'N/A', // DOB
      row.address || 'N/A', // Address
      row.qualification || 'N/A', // Qualification
      row.phone || 'N/A', // Contact No
      row.probationPeriod ? `${row.probationPeriod} months` : 'N/A', // Probation Period
      row.joiningDate ? new Date(row.joiningDate).toLocaleDateString() : 'N/A', // Date Of joining
      row.appointmentDate ? new Date(row.appointmentDate).toLocaleDateString() : 'N/A', // Date of Appointment
      row.confirmationDate ? new Date(row.confirmationDate).toLocaleDateString() : 'N/A', // Confirmation Date
      row.grossSalary || 0, // Gross Salary
      row.basicSalary || 0, // Basic Salary
      row.houseRent || 0, // House Rent
      row.medical || 0, // Medical
      row.arrears || 0, // Arrears
      row.conveyanceAllowance || 0, // Conveyance Allowance
      row.houseAllowance || 0, // House Allowance
      row.foodAllowance || 0, // Food Allowance
      row.vehicleFuelAllowance || 0, // Vehicle & Fuel Allowance
      row.medicalAllowance || 0, // Medical Allowance
      row.totalEarnings || 0, // Total Earnings
      row.incomeTax || 0, // Income Tax
      row.companyLoan || 0, // Company Loan
      row.vehicleLoan || 0, // Vehicle Loan
      row.eobiDeduction || 0, // EOBI Ded
      row.netPayable || 0 // Net Payable
    ];

    // Escape commas and quotes in CSV
    const escapedValues = values.map(value => {
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });

    csvRows.push(escapedValues.join(','));
  });

  return csvRows.join('\n');
}

module.exports = router;
