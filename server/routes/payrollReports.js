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
    const { month, year, department, project, format = 'json' } = req.query;
    
    try {
      // Build base filter
      const baseFilter = {};
      if (department) {
        // Filter by employee's department
        const employeesInDepartment = await Employee.find({ department: new mongoose.Types.ObjectId(department) }).select('_id');
        const employeeIds = employeesInDepartment.map(emp => emp._id);
        baseFilter.employee = { $in: employeeIds };
      }
      
      if (project) {
        // Filter by employee's project
        const employeesInProject = await Employee.find({ placementProject: new mongoose.Types.ObjectId(project) }).select('_id');
        const employeeIds = employeesInProject.map(emp => emp._id);
        if (baseFilter.employee) {
          // If department filter is also applied, intersect the results
          const departmentEmployeeIds = baseFilter.employee.$in;
          const projectEmployeeIds = employeeIds;
          const intersectionIds = departmentEmployeeIds.filter(id => projectEmployeeIds.some(pid => pid.toString() === id.toString()));
          baseFilter.employee = { $in: intersectionIds };
        } else {
          baseFilter.employee = { $in: employeeIds };
        }
      }

      // Get payroll data directly from payrolls collection for the specified month/year
      // Build payroll filter
      let payrollFilter = { 
        month: parseInt(month), 
        year: parseInt(year) 
      };
      
      // Apply department and project filters by finding employees first
      if (department || project) {
        let employeeFilter = { isDeleted: false };
        if (department) {
          employeeFilter.department = new mongoose.Types.ObjectId(department);
        }
        if (project) {
          employeeFilter.placementProject = new mongoose.Types.ObjectId(project);
        }
        
        const employeesInFilter = await Employee.find(employeeFilter).select('_id');
        const employeeIds = employeesInFilter.map(emp => emp._id);
        payrollFilter.employee = { $in: employeeIds };
      }

      const payrollData = await Payroll.aggregate([
        {
          $match: payrollFilter
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
          $unwind: {
            path: '$employeeData',
            preserveNullAndEmptyArrays: true
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
          $lookup: {
            from: 'banks',
            localField: 'employeeData.bankName',
            foreignField: '_id',
            as: 'bankData'
          }
        },
        {
          $lookup: {
            from: 'sections',
            localField: 'employeeData.placementSection',
            foreignField: '_id',
            as: 'sectionData'
          }
        },
        {
          $lookup: {
            from: 'designations',
            localField: 'employeeData.placementDesignation',
            foreignField: '_id',
            as: 'designationData'
          }
        },
        {
          $lookup: {
            from: 'locations',
            localField: 'employeeData.placementLocation',
            foreignField: '_id',
            as: 'locationData'
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'employeeData.placementProject',
            foreignField: '_id',
            as: 'projectData'
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
          $unwind: {
            path: '$projectData',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $addFields: {
            'employeeIdNumeric': {
              $toInt: { $ifNull: ['$employeeData.employeeId', '0'] }
            },
            'project': '$projectData.name',
            'section': '$sectionData.name',
            'designation': '$designationData.title',
            'location': '$locationData.name'
          }
        },
        {
          $sort: { 'employeeIdNumeric': 1 }
        },
        {
          $project: {
            // Employee fields
            'employeeData.employeeId': 1,
            'employeeData.firstName': 1,
            'employeeData.lastName': 1,
            'employeeData.guardianName': 1,
            'employeeData.idCard': 1,
            'employeeData.branchCode': 1,
            'employeeData.accountNumber': 1,
            'employeeData.hireDate': 1,
            'employeeData.dateOfBirth': 1,
            'employeeData.address': 1,
            'employeeData.qualification': 1,
            'employeeData.phone': 1,
            'employeeData.probationPeriod': 1,
            'employeeData.joiningDate': 1,
            'employeeData.appointmentDate': 1,
            'employeeData.confirmationDate': 1,
            // Payroll fields (direct from payroll collection)
            grossSalary: 1,
            totalEarnings: 1,
            totalDeductions: 1,
            netSalary: 1,
            basicSalary: 1,
            // Direct allowance fields from payroll
            conveyanceAllowance: 1,
            houseRentAllowance: 1,
            foodAllowance: 1,
            vehicleFuelAllowance: 1,
            medicalAllowance: 1,
            // Other payroll fields
            incomeTax: 1,
            eobi: 1,
            healthInsurance: 1,
            vehicleLoanDeduction: 1,
            companyLoanDeduction: 1,
            attendanceDeduction: 1,
            otherDeductions: 1,
            // Allowances object
            allowances: 1,
            // Populated fields
            'departmentData.name': 1,
            'bankData.name': 1,
            'sectionData.name': 1,
            'designationData.title': 1,
            'locationData.name': 1,
            'projectData.name': 1,
            // Calculated fields
            project: 1,
            section: 1,
            designation: 1,
            location: 1,
            employeeIdNumeric: 1
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
        totalGrossSalary: payrollData.reduce((sum, emp) => sum + (emp.grossSalary || 0), 0),
        totalDeductions: payrollData.reduce((sum, emp) => sum + (emp.totalDeductions || 0), 0),
        netPay: payrollData.reduce((sum, emp) => sum + (emp.netSalary || 0), 0)
      };

      // Transform data for frontend (using payroll data directly)
      const transformedData = payrollData.map(employee => ({
        // Basic employee info
        employeeId: employee.employeeData?.employeeId || 'N/A',
        employeeName: `${employee.employeeData?.firstName || ''} ${employee.employeeData?.lastName || ''}`.trim(),
        guardianName: employee.employeeData?.guardianName || 'N/A',
        idCard: employee.employeeData?.idCard || 'N/A',
        bankName: employee.bankData?.name || 'N/A',
        branchCode: employee.employeeData?.branchCode || 'N/A',
        accountNumber: employee.employeeData?.accountNumber || 'N/A',
        hireDate: employee.employeeData?.hireDate || null,
        project: employee.project || 'N/A',
        department: employee.departmentData?.name || 'N/A',
        section: employee.section || 'N/A',
        designation: employee.designation || 'N/A',
        location: employee.location || 'N/A',
        dateOfBirth: employee.employeeData?.dateOfBirth || null,
        address: employee.employeeData?.address?.street || 'N/A',
        qualification: employee.employeeData?.qualification || 'N/A',
        phone: employee.employeeData?.phone || 'N/A',
        probationPeriod: employee.employeeData?.probationPeriod || null,
        joiningDate: employee.employeeData?.joiningDate || null,
        appointmentDate: employee.employeeData?.appointmentDate || null,
        confirmationDate: employee.employeeData?.confirmationDate || null,
        // Salary fields from payroll data (direct from payroll collection)
        grossSalary: employee.grossSalary || 0,
        basicSalary: employee.basicSalary || 0,
        houseRent: employee.houseRentAllowance || 0,
        medical: employee.medicalAllowance || 0,
        arrears: employee.arrears || 0,
        conveyanceAllowance: employee.allowances?.conveyance?.amount || 0,
        houseAllowance: employee.allowances?.houseRent?.amount || 0,
        foodAllowance: employee.allowances?.food?.amount || 0,
        vehicleFuelAllowance: employee.allowances?.vehicleFuel?.amount || 0,
        medicalAllowance: employee.allowances?.medical?.amount || 0,
        totalEarnings: employee.totalEarnings || 0,
        incomeTax: employee.incomeTax || 0,
        companyLoan: employee.companyLoanDeduction || 0,
        vehicleLoan: employee.vehicleLoanDeduction || 0,
        eobiDeduction: employee.eobi || 0,
        netPayable: employee.netSalary || 0,
        netPay: employee.netSalary || 0, // For CSV export compatibility
        // Deductions from payroll data
        deductions: employee.totalDeductions || 0,
        tax: employee.incomeTax || 0,
        eobi: employee.eobi || 0,
        healthInsurance: employee.healthInsurance || 0,
        vehicleLoanDeduction: employee.vehicleLoanDeduction || 0,
        companyLoanDeduction: employee.companyLoanDeduction || 0,
        attendanceDeduction: employee.attendanceDeduction || 0,
        otherDeductions: employee.otherDeductions || 0
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

  // Function to convert JavaScript date to Excel serial date
  function dateToExcelSerial(date) {
    if (!date) return 'N/A';
    
    let jsDate;
    
    // Handle different date formats
    if (typeof date === 'string') {
      // If it's in DD/MM/YYYY format, parse it correctly
      if (date.includes('/')) {
        const parts = date.split('/');
        if (parts.length === 3) {
          // Assume DD/MM/YYYY format
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
          const year = parseInt(parts[2]);
          jsDate = new Date(year, month, day);
        } else {
          jsDate = new Date(date);
        }
      } else {
        jsDate = new Date(date);
      }
    } else {
      jsDate = new Date(date);
    }
    
    if (isNaN(jsDate.getTime())) return 'N/A';
    
    // Excel serial date calculation: days since December 30, 1899
    // Excel's epoch is December 30, 1899 (serial date 1)
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const timeDiff = jsDate.getTime() - excelEpoch.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    // Add 1 to match Excel's serial date system
    return daysDiff + 1;
  }

  // Excel structure headers (updated to use actual system data)
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
    'Date of Appointment',
    'Confirmation Date',
    'Gross Salary',
    'Basic Salary',
    'House Rent',
    'Medical',
    'Conveyance Allowance',
    'House Allowance',
    'Food Allowance',
    'Vehicle & Fuel Allowance',
    'Medical Allowance',
    'Total Earnings',
    'Total Deductions',
    'Income Tax',
    'EOBI Ded',
    'Health Insurance',
    'Vehicle Loan Deduction',
    'Company Loan Deduction',
    'Attendance Deduction',
    'Other Deductions',
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
      row.hireDate ? new Date(row.hireDate).toLocaleDateString('en-GB') : 'N/A', // DOJ - DD/MM/YYYY format
      row.project || 'N/A', // Project
      row.department || 'N/A', // Department
      row.section || 'N/A', // Section
      row.designation || 'N/A', // Designation
      row.location || 'N/A', // Location
      row.dateOfBirth ? new Date(row.dateOfBirth).toLocaleDateString('en-GB') : 'N/A', // DOB - DD/MM/YYYY format
      row.address || 'N/A', // Address
      row.qualification || 'N/A', // Qualification
      row.phone || 'N/A', // Contact No
      row.probationPeriod ? `${row.probationPeriod} months` : 'N/A', // Probation Period
      row.appointmentDate ? new Date(row.appointmentDate).toLocaleDateString('en-GB') : 'N/A', // Date of Appointment
      row.confirmationDate ? new Date(row.confirmationDate).toLocaleDateString('en-GB') : 'N/A', // Confirmation Date
      row.grossSalary || 0, // Gross Salary (from actual payroll)
      row.basicSalary || 0, // Basic Salary
      row.houseRent || 0, // House Rent
      row.medical || 0, // Medical
      row.conveyanceAllowance || 0, // Conveyance Allowance
      row.houseAllowance || 0, // House Allowance
      row.foodAllowance || 0, // Food Allowance
      row.vehicleFuelAllowance || 0, // Vehicle & Fuel Allowance
      row.medicalAllowance || 0, // Medical Allowance
      row.totalEarnings || 0, // Total Earnings (from actual payroll)
      row.deductions || 0, // Total Deductions (from actual payroll)
      row.tax || 0, // Income Tax (from actual payroll)
      row.eobi || 0, // EOBI Ded (from actual payroll)
      row.healthInsurance || 0, // Health Insurance (from actual payroll)
      row.vehicleLoanDeduction || 0, // Vehicle Loan Deduction (from actual payroll)
      row.companyLoanDeduction || 0, // Company Loan Deduction (from actual payroll)
      row.attendanceDeduction || 0, // Attendance Deduction (from actual payroll)
      row.otherDeductions || 0, // Other Deductions (from actual payroll)
      row.netPay || 0 // Net Payable (from actual payroll)
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
