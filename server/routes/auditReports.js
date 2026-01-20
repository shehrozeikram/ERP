const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const Audit = require('../models/audit/Audit');
const AuditFinding = require('../models/audit/AuditFinding');
const CorrectiveAction = require('../models/audit/CorrectiveAction');
const AuditTrail = require('../models/audit/AuditTrail');

const router = express.Router();

// @route   GET /api/audit/reports
// @desc    Generate audit reports
// @access  Private (Super Admin, Audit Manager, Auditor)
router.get('/', authorize('super_admin', 'audit_manager', 'auditor', 'audit_director'), asyncHandler(async (req, res) => {
  const { reportType, startDate, endDate } = req.query;

  let reportData = {};

  try {
    switch (reportType) {
      case 'summary':
        reportData = await generateSummaryReport(startDate, endDate);
        break;
      case 'findings':
        reportData = await generateFindingsReport(startDate, endDate);
        break;
      case 'compliance':
        reportData = await generateComplianceReport(startDate, endDate);
        break;
      case 'trends':
        reportData = await generateTrendsReport(startDate, endDate);
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    res.json({ success: true, data: reportData });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ success: false, message: 'Error generating report' });
  }
}));

// Helper function to generate summary report
async function generateSummaryReport(startDate, endDate) {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const auditFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  const [
    totalAudits,
    completedAudits,
    inProgressAudits,
    plannedAudits,
    totalFindings
  ] = await Promise.all([
    Audit.countDocuments(auditFilter),
    Audit.countDocuments({ ...auditFilter, status: 'Closed' }),
    Audit.countDocuments({ ...auditFilter, status: 'In Progress' }),
    Audit.countDocuments({ ...auditFilter, status: 'Planned' }),
    AuditFinding.countDocuments()
  ]);

  const completionRate = totalAudits > 0 ? (completedAudits / totalAudits) * 100 : 0;

  // Calculate average duration (simplified)
  const audits = await Audit.find(auditFilter, { startDate: 1, endDate: 1 });
  const durations = audits.map(audit => {
    if (audit.startDate && audit.endDate) {
      return Math.ceil((new Date(audit.endDate) - new Date(audit.startDate)) / (1000 * 60 * 60 * 24));
    }
    return 0;
  });
  const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  return {
    totalAudits,
    completedAudits,
    inProgressAudits,
    plannedAudits,
    completionRate: Math.round(completionRate * 100) / 100,
    averageDuration: Math.round(averageDuration),
    totalFindings
  };
}

// Helper function to generate findings report
async function generateFindingsReport(startDate, endDate) {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const findingFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  const [
    criticalFindings,
    highFindings,
    mediumFindings,
    lowFindings
  ] = await Promise.all([
    AuditFinding.countDocuments({ ...findingFilter, severity: 'Critical' }),
    AuditFinding.countDocuments({ ...findingFilter, severity: 'High' }),
    AuditFinding.countDocuments({ ...findingFilter, severity: 'Medium' }),
    AuditFinding.countDocuments({ ...findingFilter, severity: 'Low' })
  ]);

  // Generate trends data (simplified - last 6 months)
  const trends = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date();
    month.setMonth(month.getMonth() - i);
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const [critical, high, medium, low] = await Promise.all([
      AuditFinding.countDocuments({ 
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }, 
        severity: 'Critical' 
      }),
      AuditFinding.countDocuments({ 
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }, 
        severity: 'High' 
      }),
      AuditFinding.countDocuments({ 
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }, 
        severity: 'Medium' 
      }),
      AuditFinding.countDocuments({ 
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }, 
        severity: 'Low' 
      })
    ]);

    trends.push({
      month: month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      critical,
      high,
      medium,
      low
    });
  }

  return {
    criticalFindings,
    highFindings,
    mediumFindings,
    lowFindings,
    findingsTrend: trends
  };
}

// Helper function to generate compliance report
async function generateComplianceReport(startDate, endDate) {
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const auditFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

  // Get all audits and their findings
  const audits = await Audit.find(auditFilter).populate('department');
  const auditIds = audits.map(audit => audit._id);

  const findings = await AuditFinding.find({ audit: { $in: auditIds } });
  const correctiveActions = await CorrectiveAction.find({ auditFinding: { $in: findings.map(f => f._id) } });

  // Calculate compliance by module/department
  const complianceByModule = {};
  
  audits.forEach(audit => {
    const moduleName = audit.department?.name || 'General';
    if (!complianceByModule[moduleName]) {
      complianceByModule[moduleName] = { total: 0, compliant: 0, nonCompliant: 0, underReview: 0 };
    }
    
    complianceByModule[moduleName].total++;
    
    const auditFindings = findings.filter(f => f.audit.toString() === audit._id.toString());
    const auditActions = correctiveActions.filter(a => 
      auditFindings.some(f => f._id.toString() === a.auditFinding.toString())
    );

    if (auditFindings.length === 0) {
      complianceByModule[moduleName].compliant++;
    } else if (auditActions.every(a => a.status === 'Verified')) {
      complianceByModule[moduleName].compliant++;
    } else if (auditActions.some(a => a.status === 'Completed' || a.status === 'In Progress')) {
      complianceByModule[moduleName].underReview++;
    } else {
      complianceByModule[moduleName].nonCompliant++;
    }
  });

  // Convert to array format for charts
  const complianceArray = Object.keys(complianceByModule).map(module => ({
    module,
    compliant: complianceByModule[module].compliant,
    nonCompliant: complianceByModule[module].nonCompliant,
    underReview: complianceByModule[module].underReview
  }));

  // Calculate overall compliance score
  const totalItems = complianceArray.reduce((sum, item) => sum + item.compliant + item.nonCompliant + item.underReview, 0);
  const compliantItems = complianceArray.reduce((sum, item) => sum + item.compliant, 0);
  const complianceScore = totalItems > 0 ? (compliantItems / totalItems) * 100 : 0;

  return {
    complianceByModule: complianceArray,
    complianceScore: Math.round(complianceScore * 100) / 100,
    compliantItems,
    nonCompliantItems: complianceArray.reduce((sum, item) => sum + item.nonCompliant, 0),
    underReviewItems: complianceArray.reduce((sum, item) => sum + item.underReview, 0)
  };
}

// Helper function to generate trends report
async function generateTrendsReport(startDate, endDate) {
  // This is a placeholder for trends analysis
  // In a real implementation, you would analyze historical data
  return {
    message: 'Trends analysis will be available in the next update',
    auditTrends: [],
    findingTrends: [],
    complianceTrends: []
  };
}

module.exports = router;
