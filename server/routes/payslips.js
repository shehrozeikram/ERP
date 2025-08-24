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

    // Create PDF document - A4 size with minimal margins for single page
    const doc = new PDFDocument({
      size: 'A4',
      margin: 30
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

      if (num === 0) return 'Zero';
      if (num < 10) return ones[num];
      if (num < 20) return teens[num - 10];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');
      if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
      if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
      return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
    };

    // Start building the PDF content - EXACTLY like your image
    const pageWidth = doc.page.width - 60;
    const pageHeight = doc.page.height - 60;

    // Header with company logo and title - MOVED TO LEFT SIDE
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('SARDAR GROUP OF COMPANIES', 50, 30);

    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('PAY SLIP', 50, 65);

    doc.fontSize(12)
       .font('Helvetica')
       .text(`For the month of ${formatDate(new Date(payslip.year, payslip.month - 1))}`, 50, 95);

    // Right side - Confidential and Payslip details
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Confidential', pageWidth - 50, 30, { align: 'right' });

    doc.fontSize(10)
       .font('Helvetica')
       .text(`Payslip No: ${payslip.payslipNumber}`, pageWidth - 50, 50, { align: 'right' })
       .text(`Paid By Bank: ${payslip.employee?.bankName || 'ALLIED BANK LTD'}`, pageWidth - 50, 80, { align: 'right' });

    // Employee and Bank details section - OPTIMIZED FOR SINGLE PAGE
    const employeeY = 130;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Employee Code:', 50, employeeY)
       .text('Employee Name:', 50, employeeY + 22)
       .text('Department:', 50, employeeY + 44)
       .text('Project:', 50, employeeY + 66)
       .text('Designation:', 50, employeeY + 88)
       .text('Joining Date:', 50, employeeY + 110)
       .text('Address:', 50, employeeY + 132)
       .text('Mobile Number:', 50, employeeY + 154)
       .text('Grade:', 50, employeeY + 176)
       .text('Lwp Days:', 50, employeeY + 198)
       .text('Days Worked:', 50, employeeY + 220)
       .text('Bank Branch:', 50, employeeY + 242)
       .text('Emp. Type:', 50, employeeY + 264)
       .text('Bank Account:', 50, employeeY + 286);

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(payslip.employeeId, 200, employeeY)
       .text(payslip.employeeName, 200, employeeY + 22)
       .text(payslip.department, 200, employeeY + 44)
       .text('P. Personal', 200, employeeY + 66)
       .text(payslip.designation, 200, employeeY + 88)
       .text('01/11/2023', 200, employeeY + 110)
       .text('Borjoin PO Khas, Chamyati Sharqi Tehsil Dhir Kot, District Bagh Pakistan', 200, employeeY + 132)
       .text('0341-5460284', 200, employeeY + 154)
       .text('5-C', 200, employeeY + 176)
       .text('', 200, employeeY + 198) // Lwp Days (empty)
       .text(payslip.totalDays || 31, 200, employeeY + 220)
       .text('ALLIED BANK LTD', 200, employeeY + 242)
       .text('Chak Shahzad', 200, employeeY + 264)
       .text('0010092902370014', 200, employeeY + 286);

    // Pay & Allowances and Deductions Table - OPTIMIZED FOR SINGLE PAGE
    const tableY = employeeY + 320;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Pay & Allowances and Deductions', 50, tableY)
       .moveDown(0.5);

    // Table headers - FIXED POSITIONING
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Pay & Allowances', 50, tableY + 25)
       .text('Amount', 200, tableY + 25)
       .text('Deductions', 350, tableY + 25)
       .text('Amount', 500, tableY + 25);

    // Draw table lines - FIXED POSITIONING
    doc.moveTo(50, tableY + 20)
       .lineTo(550, tableY + 20)
       .stroke();

    doc.moveTo(50, tableY + 45)
       .lineTo(550, tableY + 45)
       .stroke();

    // Pay & Allowances rows - OPTIMIZED FOR SINGLE PAGE
    let currentTableY = tableY + 55;
    doc.fontSize(10)
       .font('Helvetica')
       .text('Basic', 50, currentTableY)
       .text(formatCurrency(payslip.earnings.basicSalary), 200, currentTableY);

    // Deductions rows - OPTIMIZED FOR SINGLE PAGE
    doc.text('Income Tax', 350, currentTableY)
       .text(formatCurrency(payslip.deductions.incomeTax), 500, currentTableY);

    currentTableY += 22;
    doc.text('Company Loan - Deduction', 350, currentTableY)
       .text(formatCurrency(payslip.deductions.loanDeduction), 500, currentTableY);

    currentTableY += 22;
    doc.text('EOBI', 350, currentTableY)
       .text(formatCurrency(payslip.deductions.eobi), 500, currentTableY);

    // Summary rows - OPTIMIZED FOR SINGLE PAGE
    currentTableY += 25;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Gross Pay & Allowances (Total)', 50, currentTableY)
       .text(formatCurrency(payslip.totalEarnings), 200, currentTableY);

    currentTableY += 22;
    doc.text('Total Deductions', 350, currentTableY)
       .text(formatCurrency(payslip.totalDeductions), 500, currentTableY);

    currentTableY += 22;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Net Pay [Rs:]', 50, currentTableY)
       .text(formatCurrency(payslip.netSalary), 200, currentTableY);

    // Amount in words - OPTIMIZED FOR SINGLE PAGE
    currentTableY += 25;
    doc.fontSize(10)
       .font('Helvetica')
       .text(`[${numberToWords(payslip.netSalary)} Only]`, 50, currentTableY);

    // Loan Summary Section - OPTIMIZED FOR SINGLE PAGE
    currentTableY += 35;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Loan Summary', 50, currentTableY);

    // Loan table headers - OPTIMIZED FOR SINGLE PAGE
    currentTableY += 22;
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .text('Sanctioned Amt.', 50, currentTableY)
       .text('Current month Ded.', 130, currentTableY)
       .text('Acc Int.', 220, currentTableY)
       .text('Remaining Install.', 280, currentTableY)
       .text('Balance', 360, currentTableY);

    // Draw loan table lines - OPTIMIZED POSITIONING
    doc.moveTo(50, currentTableY - 5)
       .lineTo(450, currentTableY - 5)
       .stroke();

    doc.moveTo(50, currentTableY + 18)
       .lineTo(450, currentTableY + 18)
       .stroke();

    // Loan Against PF row - OPTIMIZED FOR SINGLE PAGE
    currentTableY += 25;
    doc.fontSize(9)
       .font('Helvetica')
       .text('Loan Against PF:', 50, currentTableY)
       .text('56,159', 130, currentTableY)
       .text('0', 220, currentTableY)
       .text('9', 280, currentTableY)
       .text('28,079', 360, currentTableY);

    // Company Loan row - OPTIMIZED FOR SINGLE PAGE
    currentTableY += 22;
    doc.text('Company Loan:', 50, currentTableY)
       .text('200,000', 130, currentTableY)
       .text('0', 220, currentTableY)
       .text('18', 280, currentTableY)
       .text('180,000', 360, currentTableY);

    // Loan Balance (Net) - OPTIMIZED FOR SINGLE PAGE
    currentTableY += 22;
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Loan Balance (Net):', 50, currentTableY)
       .text('208,079', 360, currentTableY);



    // Finalize PDF
    doc.end();
  })
);

module.exports = router; 