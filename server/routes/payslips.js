const express = require('express');
const PDFDocument = require('pdfkit');
const { authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const Payslip = require('../models/hr/Payslip');
const Employee = require('../models/hr/Employee');
const Attendance = require('../models/hr/Attendance');
const Loan = require('../models/hr/Loan');
const { calculateMonthlyTax } = require('../utils/taxCalculator');

const router = express.Router();

// @route   GET /api/payslips
// @desc    Get all payslips with pagination and filters
// @access  Private (HR and Admin)
router.get('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      month,
      year,
      employeeId,
      department,
      status,
      search
    } = req.query;

    const filter = {};

    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (employeeId) filter.employeeId = employeeId;
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { employeeName: { $regex: search, $options: 'i' } },
        { payslipNumber: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'employee', select: 'employeeId firstName lastName email' },
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'approvedBy', select: 'firstName lastName' }
      ]
    };

    const payslips = await Payslip.paginate(filter, options);

    res.json({
      success: true,
      data: payslips
    });
  })
);

// @route   GET /api/payslips/:id
// @desc    Get payslip by ID
// @access  Private (HR and Admin)
router.get('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const payslip = await Payslip.findById(req.params.id)
      .populate('employee', 'employeeId firstName lastName email phone department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    res.json({
      success: true,
      data: payslip
    });
  })
);

// @route   POST /api/payslips
// @desc    Create new payslip
// @access  Private (HR and Admin)
router.post('/', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const {
      employeeId,
      month,
      year,
      earnings,
      deductions,
      attendance,
      notes
    } = req.body;

    // Get employee details
    const employee = await Employee.findOne({ employeeId })
      .populate('department', 'name')
      .populate('position', 'title');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check if payslip already exists for this employee and period
    const existingPayslip = await Payslip.findOne({
      employeeId,
      month: parseInt(month),
      year: parseInt(year)
    });

    if (existingPayslip) {
      return res.status(400).json({
        success: false,
        message: 'Payslip already exists for this employee and period'
      });
    }

    // Calculate attendance data
    const attendanceData = attendance || {};
    const totalDays = attendanceData.totalDays || 0;
    const presentDays = attendanceData.presentDays || 0;
    const absentDays = attendanceData.absentDays || 0;
    const lateDays = attendanceData.lateDays || 0;
    const overtimeHours = attendanceData.overtimeHours || 0;

    // Calculate overtime pay (assuming 1.5x rate)
    const hourlyRate = employee.salary?.basic / 176; // Assuming 176 working hours per month
    const overtimePay = (overtimeHours * hourlyRate * 1.5) || 0;

    // Calculate tax
    const grossSalary = employee.salary?.gross || 0;
    const taxInfo = calculateMonthlyTax(grossSalary);

    // Generate payslip number
    const payslipNumber = `PS${year}${month.toString().padStart(2, '0')}${employee.employeeId}`;
    
    // Create payslip
    const payslip = new Payslip({
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      department: employee.department?.name || 'Unknown',
      designation: employee.position?.title || 'Unknown',
      month: parseInt(month),
      year: parseInt(year),
      payslipNumber: payslipNumber,
      basicSalary: earnings?.basicSalary || employee.salary?.basic || 0,
      houseRent: earnings?.houseRent || employee.salary?.houseRent || 0,
      medicalAllowance: earnings?.medicalAllowance || employee.salary?.medical || 0,
      conveyanceAllowance: earnings?.conveyanceAllowance || employee.salary?.conveyance || 0,
      specialAllowance: earnings?.specialAllowance || employee.salary?.special || 0,
      otherAllowances: earnings?.otherAllowances || employee.salary?.other || 0,
      earnings: {
        basicSalary: earnings?.basicSalary || employee.salary?.basic || 0,
        houseRent: earnings?.houseRent || employee.salary?.houseRent || 0,
        medicalAllowance: earnings?.medicalAllowance || employee.salary?.medical || 0,
        conveyanceAllowance: earnings?.conveyanceAllowance || employee.salary?.conveyance || 0,
        specialAllowance: earnings?.specialAllowance || employee.salary?.special || 0,
        otherAllowances: earnings?.otherAllowances || employee.salary?.other || 0,
        overtime: earnings?.overtime || 0,
        bonus: earnings?.bonus || 0,
        incentives: earnings?.incentives || 0,
        arrears: earnings?.arrears || 0,
        otherEarnings: earnings?.otherEarnings || 0
      },
      deductions: {
        providentFund: deductions?.providentFund || 0,
        eobi: deductions?.eobi || 0,
        incomeTax: taxInfo.monthlyTax,
        loanDeduction: deductions?.loanDeduction || 0,
        advanceDeduction: deductions?.advanceDeduction || 0,
        lateDeduction: deductions?.lateDeduction || 0,
        absentDeduction: deductions?.absentDeduction || 0,
        otherDeductions: deductions?.otherDeductions || 0
      },
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      overtimeHours,
      grossSalary,
      totalEarnings: 0, // Will be calculated in pre-save hook
      totalDeductions: 0, // Will be calculated in pre-save hook
      netSalary: 0, // Will be calculated in pre-save hook
      status: 'draft',
      notes,
      createdBy: req.user._id
    });

    await payslip.save();

    res.status(201).json({
      success: true,
      message: 'Payslip created successfully',
      data: payslip
    });
  })
);

// @route   POST /api/payslips/bulk-generate
// @desc    Generate payslips for all employees for a specific month
// @access  Private (HR and Admin)
router.post('/bulk-generate', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { month, year, department } = req.body;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Month and year are required'
      });
    }

    // Build employee filter
    const employeeFilter = { isActive: true };
    if (department) {
      employeeFilter['department'] = department;
    }

    // Get all active employees
    const employees = await Employee.find(employeeFilter)
      .populate('department', 'name')
      .populate('position', 'title');

    const generatedPayslips = [];
    const errors = [];

    for (const employee of employees) {
      try {
        // Check if payslip already exists
        const existingPayslip = await Payslip.findOne({
          employeeId: employee.employeeId,
          month: parseInt(month),
          year: parseInt(year)
        });

        if (existingPayslip) {
          errors.push(`Payslip already exists for ${employee.employeeId}`);
          continue;
        }

        // Get attendance data for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const attendanceRecords = await Attendance.find({
          employee: employee._id,
          date: { $gte: startDate, $lte: endDate }
        });

        const totalDays = endDate.getDate();
        const presentDays = attendanceRecords.filter(record => record.status === 'present').length;
        const absentDays = attendanceRecords.filter(record => record.status === 'absent').length;
        const lateDays = attendanceRecords.filter(record => record.status === 'late').length;
        const overtimeHours = attendanceRecords.reduce((sum, record) => sum + (record.overtimeHours || 0), 0);

        // Set overtime pay to 0 (like bonus and incentives)
        const overtimePay = 0;

        // Calculate tax
        const grossSalary = employee.salary?.gross || 0;
        const taxInfo = calculateMonthlyTax(grossSalary);

        // Create payslip
        const payslip = new Payslip({
          employee: employee._id,
          employeeId: employee.employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department?.name || 'Unknown',
          designation: employee.position?.title || 'Unknown',
          month: parseInt(month),
          year: parseInt(year),
          basicSalary: employee.salary?.basic || 0,
          houseRent: employee.salary?.houseRent || 0,
          medicalAllowance: employee.salary?.medical || 0,
          conveyanceAllowance: employee.salary?.conveyance || 0,
          specialAllowance: employee.salary?.special || 0,
          otherAllowances: employee.salary?.other || 0,
          earnings: {
            basicSalary: employee.salary?.basic || 0,
            houseRent: employee.salary?.houseRent || 0,
            medicalAllowance: employee.salary?.medical || 0,
            conveyanceAllowance: employee.salary?.conveyance || 0,
            specialAllowance: employee.salary?.special || 0,
            otherAllowances: employee.salary?.other || 0,
            overtime: overtimePay,
            bonus: 0,
            incentives: 0,
            arrears: 0,
            otherEarnings: 0
          },
          deductions: {
            providentFund: 0,
            eobi: 0,
            incomeTax: taxInfo.monthlyTax,
            loanDeduction: 0,
            advanceDeduction: 0,
            lateDeduction: 0,
            absentDeduction: 0,
            otherDeductions: 0
          },
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          overtimeHours,
          grossSalary,
          createdBy: req.user._id
        });

        await payslip.save();
        generatedPayslips.push(payslip);

      } catch (error) {
        errors.push(`Error generating payslip for ${employee.employeeId}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Generated ${generatedPayslips.length} payslips successfully`,
      data: {
        generated: generatedPayslips.length,
        errors: errors.length,
        errorDetails: errors
      }
    });
  })
);

// @route   PUT /api/payslips/:id
// @desc    Update payslip
// @access  Private (HR and Admin)
router.put('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const payslip = await Payslip.findById(req.params.id);

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    // Only allow updates if payslip is in draft status
    if (payslip.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update payslip that is not in draft status'
      });
    }

    const updatedPayslip = await Payslip.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Payslip updated successfully',
      data: updatedPayslip
    });
  })
);

// @route   PUT /api/payslips/:id/generate
// @desc    Generate payslip (change status from draft to generated)
// @access  Private (HR and Admin)
router.put('/:id/generate', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const payslip = await Payslip.findById(req.params.id);

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    if (payslip.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft payslips can be generated'
      });
    }

    payslip.status = 'generated';
    payslip.generatedAt = new Date();
    await payslip.save();

    res.json({
      success: true,
      message: 'Payslip generated successfully',
      data: payslip
    });
  })
);

// @route   PUT /api/payslips/:id/approve
// @desc    Approve payslip
// @access  Private (HR and Admin)
router.put('/:id/approve', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const payslip = await Payslip.findById(req.params.id);

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    if (payslip.status !== 'generated') {
      return res.status(400).json({
        success: false,
        message: 'Only generated payslips can be approved'
      });
    }

    payslip.status = 'approved';
    payslip.approvedBy = req.user._id;
    payslip.approvedAt = new Date();
    await payslip.save();

    res.json({
      success: true,
      message: 'Payslip approved successfully',
      data: payslip
    });
  })
);

// @route   PUT /api/payslips/:id/mark-paid
// @desc    Mark payslip as paid
// @access  Private (HR and Admin)
router.put('/:id/mark-paid', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { paymentMethod, paymentDate } = req.body;

    const payslip = await Payslip.findById(req.params.id);

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    if (payslip.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved payslips can be marked as paid'
      });
    }

    payslip.status = 'paid';
    payslip.paymentMethod = paymentMethod || 'bank_transfer';
    payslip.paymentDate = paymentDate || new Date();
    await payslip.save();

    res.json({
      success: true,
      message: 'Payslip marked as paid successfully',
      data: payslip
    });
  })
);

// @route   DELETE /api/payslips/:id
// @desc    Delete payslip
// @access  Private (HR and Admin)
router.delete('/:id', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const payslip = await Payslip.findById(req.params.id);

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    // Only allow deletion if payslip is in draft status
    if (payslip.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete payslip that is not in draft status'
      });
    }

    await Payslip.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Payslip deleted successfully'
    });
  })
);

// @route   GET /api/payslips/stats/overview
// @desc    Get payslip statistics
// @access  Private (HR and Admin)
router.get('/stats/overview', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { month, year } = req.query;

    const filter = {};
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    const stats = await Payslip.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPayslips: { $sum: 1 },
          totalGrossSalary: { $sum: '$grossSalary' },
          totalNetSalary: { $sum: '$netSalary' },
          totalDeductions: { $sum: '$totalDeductions' },
          averageSalary: { $avg: '$netSalary' },
          draftCount: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          generatedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'generated'] }, 1, 0] }
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalPayslips: 0,
      totalGrossSalary: 0,
      totalNetSalary: 0,
      totalDeductions: 0,
      averageSalary: 0,
      draftCount: 0,
      generatedCount: 0,
      approvedCount: 0,
      paidCount: 0
    };

    res.json({
      success: true,
      data: result
    });
  })
);

// @route   GET /api/payslips/employee/:employeeId
// @desc    Get payslips for specific employee
// @access  Private (HR and Admin)
router.get('/employee/:employeeId', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'approvedBy', select: 'firstName lastName' }
      ]
    };

    const payslips = await Payslip.paginate(
      { employeeId: req.params.employeeId },
      options
    );

    res.json({
      success: true,
      data: payslips
    });
  })
);

// @route   GET /api/payslips/:id/download
// @desc    Download payslip as PDF
// @access  Private (HR and Admin)
router.get('/:id/download', 
  authorize('admin', 'hr_manager'), 
  asyncHandler(async (req, res) => {
    const payslip = await Payslip.findById(req.params.id)
      .populate('employee', 'employeeId firstName lastName email phone department position')
      .populate('createdBy', 'firstName lastName')
      .populate('approvedBy', 'firstName lastName');

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslip.payslipNumber}.pdf"`);

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

      const convertLessThanOneThousand = (num) => {
        if (num === 0) return '';

        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
        if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + convertLessThanOneThousand(num % 100) : '');
      };

      const convert = (num) => {
        if (num === 0) return 'Zero';
        if (num < 1000) return convertLessThanOneThousand(num);
        if (num < 100000) return convertLessThanOneThousand(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + convertLessThanOneThousand(num % 1000) : '');
        if (num < 10000000) return convertLessThanOneThousand(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + convert(Math.floor(num / 1000) % 100) + ' Thousand' + (num % 1000 !== 0 ? ' ' + convertLessThanOneThousand(num % 1000) : '') : '');
        return convertLessThanOneThousand(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + convert(num % 10000000) : '');
      };

      return convert(Math.floor(num));
    };

    // Header with Company Logo and Name
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('Sardar Group of Companies', { align: 'center' })
       .moveDown(0.5);

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor('#000')
       .text('PAY SLIP', { align: 'center' })
       .moveDown(0.3);

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#000')
       .text(`For the month of ${payslip.period}`, { align: 'center' })
       .moveDown(1);

    // Confidential label and payslip details
    const currentY = doc.y;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Confidential', 450, currentY - 60);

    // Payslip details in header
    doc.fontSize(10)
       .font('Helvetica')
       .text('Lwp Days:', 50, currentY)
       .text('Payslip No:', 50, currentY + 20)
       .text('Days Worked:', 50, currentY + 40)
       .text('Paid By Bank:', 50, currentY + 60)
       .text('Bank Branch:', 50, currentY + 80)
       .text('Emp. Type:', 50, currentY + 100)
       .text('Bank Account:', 50, currentY + 120);

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('', 150, currentY) // Lwp Days value
       .text(payslip.payslipNumber, 150, currentY + 20)
       .text(payslip.presentDays.toString(), 150, currentY + 40)
       .text('ALLIED BANK LTD', 150, currentY + 60)
       .text('', 150, currentY + 80) // Bank Branch value
       .text('HEAD OFFICE', 150, currentY + 100)
       .text('0010131076200014', 150, currentY + 120);

    doc.moveDown(8);

    // Employee Information
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Employee Details')
       .moveDown(0.5);

    const employeeY = doc.y;
    doc.fontSize(10)
       .font('Helvetica')
       .text('Employee Code:', 50, employeeY)
       .text('Employee Name:', 50, employeeY + 20)
       .text('Department:', 50, employeeY + 40)
       .text('Project:', 50, employeeY + 60)
       .text('Designation:', 50, employeeY + 80)
       .text('Joining Date:', 50, employeeY + 100)
       .text('Address:', 50, employeeY + 120)
       .text('Mobile Number:', 50, employeeY + 140)
       .text('Grade:', 50, employeeY + 160);

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(payslip.employeeId, 200, employeeY)
       .text(payslip.employeeName, 200, employeeY + 20)
       .text(payslip.department, 200, employeeY + 40)
       .text('Tay Co', 200, employeeY + 60)
       .text(payslip.designation, 200, employeeY + 80)
       .text('24/06/2024', 200, employeeY + 100)
       .text('Bani Pashri, PO Bagh, Tehsil & Dist Bagh.', 200, employeeY + 120)
       .text('0321-455-4035', 200, employeeY + 140)
       .text('', 200, employeeY + 160);

    doc.moveDown(10);

    // Pay & Allowances and Deductions Table
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Pay & Allowances and Deductions')
       .moveDown(0.5);

    // Table headers
    const tableY = doc.y;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Pay & Allowances', 50, tableY)
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

    // Pay & Allowances rows
    let currentTableY = tableY + 25;
    doc.fontSize(10)
       .font('Helvetica')
       .text('Basic', 50, currentTableY)
       .text(formatCurrency(payslip.earnings.basicSalary), 200, currentTableY);

    currentTableY += 20;
    doc.text('Food Allowance', 50, currentTableY)
       .text(formatCurrency(payslip.earnings.medicalAllowance), 200, currentTableY);

    // Deductions rows
    currentTableY = tableY + 25;
    doc.text('Income Tax', 350, currentTableY)
       .text(formatCurrency(payslip.deductions.incomeTax), 500, currentTableY);

    currentTableY += 20;
    doc.text('EOBI', 350, currentTableY)
       .text(formatCurrency(payslip.deductions.eobi), 500, currentTableY);

    // Summary rows
    currentTableY += 30;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Gross Pay & Allowances', 50, currentTableY)
       .text(formatCurrency(payslip.totalEarnings), 200, currentTableY);

    currentTableY += 20;
    doc.text('Total Deductions', 350, currentTableY)
       .text(formatCurrency(payslip.totalDeductions), 500, currentTableY);

    currentTableY += 20;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Net Pay [Rs:]', 50, currentTableY)
       .text(formatCurrency(payslip.netSalary), 200, currentTableY);

    // Amount in words
    currentTableY += 25;
    doc.fontSize(10)
       .font('Helvetica')
       .text(`[${numberToWords(payslip.netSalary)} Only]`, 50, currentTableY);

    doc.moveDown(3);

    // Notes
    if (payslip.notes) {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#000')
         .text('Notes:', { underline: true })
         .moveDown(0.5)
         .text(payslip.notes);
    }

    // Footer with signatures and system info
    const footerY = doc.page.height - 100;
    
    // Signature labels
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Prepared By', 50, footerY)
       .text('Received By', 200, footerY)
       .text('Checked By', 350, footerY);

    // System information
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor('#666')
       .text('Human Capital Management Version 12.07.10072024 Build 0001', 50, footerY + 30)
       .text(`USER ID: ${payslip.createdBy?.firstName || 'SYSTEM'}`, 50, footerY + 45)
       .text(formatDate(new Date()), 50, footerY + 60);

    // Finalize PDF
    doc.end();
  })
);

module.exports = router; 