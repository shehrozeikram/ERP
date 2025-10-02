const express = require('express');
const router = express.Router();
const Loan = require('../models/hr/Loan');
const Employee = require('../models/hr/Employee');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

// Get all loans with pagination and filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      loanType,
      employeeId,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};

    // Apply filters
    if (status) query.status = status;
    if (loanType) query.loanType = loanType;
    if (employeeId) query.employee = employeeId;

    // Date range filter
    if (startDate || endDate) {
      query.applicationDate = {};
      if (startDate) query.applicationDate.$gte = new Date(startDate);
      if (endDate) query.applicationDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      query.$or = [
        { purpose: { $regex: search, $options: 'i' } },
        { 'guarantor.name': { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'employee', select: 'employeeId firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName' },
        { path: 'disbursedBy', select: 'firstName lastName' }
      ],
      sort: { applicationDate: -1 }
    };

    const loans = await Loan.paginate(query, options);
    
    // Ensure virtual fields are included
    const loansWithVirtuals = loans.docs.map(loan => {
      const loanObj = loan.toObject();
      loanObj.progressPercentage = loan.progressPercentage;
      loanObj.remainingInstallments = loan.remainingInstallments;
      loanObj.nextDueDate = loan.nextDueDate;
      return loanObj;
    });
    
    res.json({
      ...loans,
      docs: loansWithVirtuals
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ message: 'Error fetching loans', error: error.message });
  }
});

// Get loan statistics - MUST BE BEFORE /:id route
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const stats = await Loan.getLoanStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching loan statistics:', error);
    res.status(500).json({ message: 'Error fetching loan statistics', error: error.message });
  }
});

// Get employee loans - MUST BE BEFORE /:id route
router.get('/employee/:employeeId', authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // First try to find employee by employeeId (string like "06386")
    let employee = await Employee.findOne({ employeeId: employeeId });
    
    if (!employee) {
      // If not found by employeeId, try by MongoDB ObjectId
      employee = await Employee.findById(employeeId);
    }
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Now find loans using the employee's MongoDB ObjectId
    const loans = await Loan.find({ employee: employee._id })
      .populate('employee', 'employeeId firstName lastName email')
      .sort({ applicationDate: -1 });

    res.json(loans);
  } catch (error) {
    console.error('Error fetching employee loans:', error);
    res.status(500).json({ message: 'Error fetching employee loans', error: error.message });
  }
});

// Get loan by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('employee', 'employeeId firstName lastName email phone')
      .populate('approvedBy', 'firstName lastName')
      .populate('disbursedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Include virtual fields
    const loanWithVirtuals = loan.toObject();
    loanWithVirtuals.progressPercentage = loan.progressPercentage;
    loanWithVirtuals.remainingInstallments = loan.remainingInstallments;
    loanWithVirtuals.nextDueDate = loan.nextDueDate;

    res.json(loanWithVirtuals);
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({ message: 'Error fetching loan', error: error.message });
  }
});

// Create new loan application
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      employee,
      loanType,
      loanAmount,
      interestRate,
      loanTerm,
      purpose,
      collateral,
      collateralValue,
      guarantor,
      salaryDeduction,
      documents
    } = req.body;

    // Validate employee exists
    const employeeExists = await Employee.findById(employee);
    if (!employeeExists) {
      return res.status(400).json({ message: 'Employee not found' });
    }

    // Check if employee has any active loans
    const activeLoans = await Loan.find({
      employee,
      status: { $in: ['Active', 'Disbursed'] }
    });

    if (activeLoans.length > 0) {
      return res.status(400).json({ 
        message: 'Employee has active loans. Cannot apply for new loan until existing loans are completed.' 
      });
    }

    // Calculate required fields before creating loan
    const principal = parseFloat(loanAmount);
    const rate = parseFloat(interestRate) / 100 / 12; // Monthly interest rate
    const time = parseInt(loanTerm);
    
    let monthlyInstallment;
    if (rate === 0) {
      monthlyInstallment = principal / time;
    } else {
      monthlyInstallment = principal * (rate * Math.pow(1 + rate, time)) / (Math.pow(1 + rate, time) - 1);
    }
    
    const totalPayable = monthlyInstallment * time;
    const outstandingBalance = totalPayable;

    // Create loan object with calculated fields
    const loanData = {
      employee,
      loanType,
      loanAmount,
      interestRate,
      loanTerm,
      monthlyInstallment,
      totalPayable,
      outstandingBalance,
      purpose,
      collateral,
      collateralValue,
      guarantor,
      salaryDeduction,
      documents,
      createdBy: req.user.id
    };

    const loan = new Loan(loanData);
    
    // Generate loan schedule
    loan.generateLoanSchedule();
    
    await loan.save();

    // Populate employee details for response
    await loan.populate('employee', 'employeeId firstName lastName email');

    res.status(201).json({
      message: 'Loan application submitted successfully',
      loan
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({ message: 'Error creating loan', error: error.message });
  }
});

// Update loan application
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    // Only allow updates if loan is pending
    if (loan.status !== 'Pending') {
      return res.status(400).json({ 
        message: 'Cannot update loan application after it has been processed' 
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: req.user.id
    };

    // Remove fields that shouldn't be updated
    delete updateData.status;
    delete updateData.approvalDate;
    delete updateData.disbursementDate;
    delete updateData.approvedBy;
    delete updateData.disbursedBy;

    const updatedLoan = await Loan.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('employee', 'employeeId firstName lastName email');

    res.json({
      message: 'Loan application updated successfully',
      loan: updatedLoan
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({ message: 'Error updating loan', error: error.message });
  }
});

// Approve loan
router.patch('/:id/approve', authMiddleware, checkPermission('loan_approval'), async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'Pending') {
      return res.status(400).json({ 
        message: 'Loan can only be approved if it is in pending status' 
      });
    }

    loan.status = 'Approved';
    loan.approvalDate = new Date();
    loan.approvedBy = req.user.id;
    loan.updatedBy = req.user.id;

    if (rejectionReason) {
      loan.rejectionReason = rejectionReason;
    }

    await loan.save();

    await loan.populate([
      { path: 'employee', select: 'employeeId firstName lastName email' },
      { path: 'approvedBy', select: 'firstName lastName' }
    ]);

    res.json({
      message: 'Loan approved successfully',
      loan
    });
  } catch (error) {
    console.error('Error approving loan:', error);
    res.status(500).json({ message: 'Error approving loan', error: error.message });
  }
});

// Reject loan
router.patch('/:id/reject', authMiddleware, checkPermission('loan_approval'), async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'Pending') {
      return res.status(400).json({ 
        message: 'Loan can only be rejected if it is in pending status' 
      });
    }

    loan.status = 'Rejected';
    loan.rejectionReason = rejectionReason;
    loan.updatedBy = req.user.id;

    await loan.save();

    await loan.populate([
      { path: 'employee', select: 'employeeId firstName lastName email' },
      { path: 'approvedBy', select: 'firstName lastName' }
    ]);

    res.json({
      message: 'Loan rejected successfully',
      loan
    });
  } catch (error) {
    console.error('Error rejecting loan:', error);
    res.status(500).json({ message: 'Error rejecting loan', error: error.message });
  }
});

// Disburse loan
router.patch('/:id/disburse', authMiddleware, checkPermission('loan_disbursement'), async (req, res) => {
  try {
    const { disbursementMethod, bankAccount } = req.body;
    
    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'Approved') {
      return res.status(400).json({ 
        message: 'Loan can only be disbursed if it is approved' 
      });
    }

    loan.status = 'Disbursed';
    loan.disbursementDate = new Date();
    loan.disbursedBy = req.user.id;
    loan.disbursementMethod = disbursementMethod;
    loan.bankAccount = bankAccount;
    loan.updatedBy = req.user.id;

    await loan.save();

    await loan.populate([
      { path: 'employee', select: 'employeeId firstName lastName email' },
      { path: 'disbursedBy', select: 'firstName lastName' }
    ]);

    res.json({
      message: 'Loan disbursed successfully',
      loan
    });
  } catch (error) {
    console.error('Error disbursing loan:', error);
    res.status(500).json({ message: 'Error disbursing loan', error: error.message });
  }
});

// Process loan payment
router.patch('/:id/payment', authMiddleware, async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid payment amount is required' });
    }

    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (!['Active', 'Disbursed'].includes(loan.status)) {
      return res.status(400).json({ 
        message: 'Payment can only be processed for active or disbursed loans' 
      });
    }

    const paymentResult = loan.processPayment(amount, paymentMethod);
    loan.updatedBy = req.user.id;

    await loan.save();

    await loan.populate('employee', 'employeeId firstName lastName email');

    res.json({
      message: 'Payment processed successfully',
      paymentResult,
      loan
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Error processing payment', error: error.message });
  }
});

// Add note to loan
router.post('/:id/notes', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Note content is required' });
    }

    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    loan.notes.push({
      content: content.trim(),
      addedBy: req.user.id
    });

    loan.updatedBy = req.user.id;
    await loan.save();

    await loan.populate([
      { path: 'employee', select: 'employeeId firstName lastName email' },
      { path: 'notes.addedBy', select: 'firstName lastName' }
    ]);

    res.json({
      message: 'Note added successfully',
      loan
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ message: 'Error adding note', error: error.message });
  }
});

// Get loan schedule
router.get('/:id/schedule', authMiddleware, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('employee', 'employeeId firstName lastName email');

    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    res.json({
      loan: {
        _id: loan._id,
        employee: loan.employee,
        loanAmount: loan.loanAmount,
        monthlyInstallment: loan.monthlyInstallment,
        totalPayable: loan.totalPayable,
        totalPaid: loan.totalPaid,
        outstandingBalance: loan.outstandingBalance,
        progressPercentage: loan.progressPercentage
      },
      schedule: loan.loanSchedule
    });
  } catch (error) {
    console.error('Error fetching loan schedule:', error);
    res.status(500).json({ message: 'Error fetching loan schedule', error: error.message });
  }
});

// Delete loan (only if pending)
router.delete('/:id', authMiddleware, checkPermission('loan_management'), async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    if (loan.status !== 'Pending') {
      return res.status(400).json({ 
        message: 'Only pending loans can be deleted' 
      });
    }

    await Loan.findByIdAndDelete(req.params.id);

    res.json({ message: 'Loan deleted successfully' });
  } catch (error) {
    console.error('Error deleting loan:', error);
    res.status(500).json({ message: 'Error deleting loan', error: error.message });
  }
});

module.exports = router; 