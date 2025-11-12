const express = require('express');
const router = express.Router();
const AnnualLeaveManagementService = require('../services/annualLeaveManagementService');
const annualLeaveCronService = require('../services/annualLeaveCronService');
const Employee6387TestWorkflow = require('../scripts/testEmployee6387Workflow');

/**
 * Annual Leave Management API Routes
 * 
 * These routes provide API endpoints for testing and managing
 * the annual leave system
 */

// Get employee balance
router.get('/balance/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const balance = await AnnualLeaveManagementService.getEmployeeBalance(employeeId);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get employee transaction history
router.get('/transactions/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year, limit } = req.query;
    
    const transactions = await AnnualLeaveManagementService.getEmployeeTransactionHistory(
      employeeId,
      year ? parseInt(year) : null,
      limit ? parseInt(limit) : 50
    );
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process anniversary allocations for a specific date
router.post('/process-anniversaries', async (req, res) => {
  try {
    const { targetDate } = req.body;
    const date = targetDate ? new Date(targetDate) : new Date();
    
    const result = await AnnualLeaveManagementService.processAnniversaryAllocations(date);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Deduct leaves for an employee
router.post('/deduct-leaves', async (req, res) => {
  try {
    const { employeeId, days, description } = req.body;
    
    if (!employeeId || !days) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID and days are required'
      });
    }
    
    const result = await AnnualLeaveManagementService.deductLeaves(
      employeeId,
      days,
      null,
      description
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get anniversary report
router.get('/anniversary-report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate) : new Date();
    
    const report = await AnnualLeaveManagementService.getAnniversaryReport(start, end);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual adjustment
router.post('/adjust-balance', async (req, res) => {
  try {
    const { employeeId, year, adjustment, reason, userId } = req.body;
    
    if (!employeeId || !year || adjustment === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID, year, and adjustment are required'
      });
    }
    
    const result = await AnnualLeaveManagementService.adjustLeaveBalance(
      employeeId,
      year,
      adjustment,
      reason,
      userId
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cron service management
router.get('/cron/status', async (req, res) => {
  try {
    const status = annualLeaveCronService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/cron/start', async (req, res) => {
  try {
    await annualLeaveCronService.start();
    
    res.json({
      success: true,
      message: 'Cron service started successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/cron/stop', async (req, res) => {
  try {
    await annualLeaveCronService.stop();
    
    res.json({
      success: true,
      message: 'Cron service stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/cron/test/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    
    const result = await annualLeaveCronService.testJob(jobName);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test employee 6387 workflow
router.post('/test/employee6387', async (req, res) => {
  try {
    const test = new Employee6387TestWorkflow();
    
    await test.initialize();
    await test.runCompleteWorkflow();
    
    res.json({
      success: true,
      message: 'Employee 6387 workflow test completed successfully',
      data: test.testResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test employee 6387 workflow (with cleanup)
router.post('/test/employee6387/clean', async (req, res) => {
  try {
    const test = new Employee6387TestWorkflow();
    
    await test.initialize();
    await test.runCompleteWorkflow();
    await test.cleanup();
    
    res.json({
      success: true,
      message: 'Employee 6387 workflow test completed and cleaned up successfully',
      data: test.testResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
