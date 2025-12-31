const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const permissions = require('../middleware/permissions');
const { getWorkflowStatusForUserAndRole } = require('../utils/paymentSettlementWorkflow');
const { getWorkflowModules, getModuleConfig, supportsWorkflow } = require('../utils/adminWorkflowConfig');
const asyncHandler = require('../middleware/errorHandler').asyncHandler;

// @route   GET /api/admin/dashboard/tasks
// @desc    Get all tasks from admin submodules with workflow status
// @access  Private (Admin)
router.get('/tasks',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'payment_settlement', 'read'),
  asyncHandler(async (req, res) => {
    try {
      const userRole = req.user.role;
      const userEmail = req.user.email;
      // Get workflow status based on user email (priority) or role (fallback)
      const userWorkflowStatus = getWorkflowStatusForUserAndRole(userEmail, userRole);
      
      const tasks = [];
      const workflowModules = getWorkflowModules();
      
      // Fetch tasks from each workflow-enabled submodule
      for (const submodule of workflowModules) {
        const config = getModuleConfig(submodule);
        if (!config) continue;
        
        try {
          // Dynamic model loading using configured path
          const Model = require(config.modelPath);
          
          // Build query based on user assignment (email-based) or role
          const query = {};
          if (userWorkflowStatus) {
            // User is assigned to a specific status - show:
            // 1. Documents currently in their assigned status
            // 2. Documents approved/rejected from their assigned status (for record keeping)
            query.$or = [
              { [config.workflowStatusField]: userWorkflowStatus },
              { [config.workflowStatusField]: { $regex: `^(Approved|Rejected) \\(from ${userWorkflowStatus}\\)$` } }
            ];
          } else if (['super_admin', 'admin', 'higher_management', 'hr_manager'].includes(userRole)) {
            // Admins and hr_manager can see all tasks
            // Optionally filter by workflowStatus if provided
            if (req.query.workflowStatus) {
              query[config.workflowStatusField] = req.query.workflowStatus;
            }
          } else {
            // For other roles, also show documents they created that were returned from audit
            // This allows initiators to see their returned documents
            const userId = req.user.id;
            if (userWorkflowStatus) {
              query.$or = [
                { [config.workflowStatusField]: userWorkflowStatus },
                { 
                  [config.workflowStatusField]: 'Returned from Audit',
                  createdBy: userId
                }
              ];
            } else {
              // Show documents returned from audit that the user created
              query[config.workflowStatusField] = 'Returned from Audit';
              query.createdBy = userId;
            }
          }
          
          // Fetch documents
          const documents = await Model.find(query)
            .populate('createdBy', 'firstName lastName email')
            .populate('updatedBy', 'firstName lastName email')
            .populate('workflowHistory.changedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
          
          // Transform to task format
          documents.forEach(doc => {
            const currentStatus = doc[config.workflowStatusField] || 'Draft';
            const workflowHistory = doc.workflowHistory || [];
            
            // Check if current user has already processed this document from their assigned status
            let userHasProcessed = false;
            const userEmail = req.user.email?.toLowerCase();
            
            // Extract base status if it's in format "Approved (from ...)" or "Rejected (from ...)"
            let baseStatus = currentStatus;
            let sourceStatus = null;
            if (currentStatus.includes('(from ')) {
              const match = currentStatus.match(/^(Approved|Rejected) \(from (.+)\)$/);
              if (match) {
                baseStatus = match[1]; // "Approved" or "Rejected"
                sourceStatus = match[2]; // "Send to AM Admin" etc.
              }
            }
            
            if (userWorkflowStatus) {
              // Check if document is currently in user's assigned status (not yet processed)
              if (currentStatus === userWorkflowStatus) {
                // Check if user has any history entry where they changed from this status
                userHasProcessed = workflowHistory.some(entry => {
                  const changedByEmail = entry.changedBy?.email || entry.changedBy?.toString();
                  return changedByEmail?.toLowerCase() === userEmail && 
                         entry.fromStatus === userWorkflowStatus;
                });
              }
              // Check if document was approved/rejected from user's assigned status
              else if (sourceStatus === userWorkflowStatus && (baseStatus === 'Approved' || baseStatus === 'Rejected')) {
                // Check if current user was the one who approved/rejected
                const lastAction = workflowHistory[workflowHistory.length - 1];
                if (lastAction) {
                  const changedByEmail = lastAction.changedBy?.email || lastAction.changedBy?.toString();
                  if (changedByEmail?.toLowerCase() === userEmail && 
                      lastAction.fromStatus === userWorkflowStatus &&
                      (lastAction.toStatus === 'Approved' || lastAction.toStatus === 'Rejected')) {
                    userHasProcessed = true;
                  }
                }
              }
            }
            
            tasks.push({
              id: doc._id,
              submodule: submodule,
              submoduleName: config.name,
              title: doc[config.titleField] || 'N/A',
              description: doc[config.descriptionField] || '',
              amount: doc[config.amountField] || null,
              date: doc[config.dateField] || doc.createdAt,
              workflowStatus: currentStatus,
              status: doc.status || 'Draft',
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
              createdBy: doc.createdBy,
              updatedBy: doc.updatedBy,
              workflowHistory: workflowHistory,
              userAssignedStatus: userWorkflowStatus, // User's assigned status
              userHasProcessed: userHasProcessed, // Whether user has already processed this
              routePath: config.routePath,
              viewPath: config.routePath,
              editPath: doc._id ? `${config.routePath}/edit/${doc._id}` : null,
              icon: config.icon
            });
          });
        } catch (error) {
          console.error(`Error fetching tasks from ${submodule}:`, error);
          // Continue with other submodules even if one fails
        }
      }
      
      // Sort by updated date (most recent first)
      tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      res.json({
        success: true,
        data: {
          tasks,
          totalTasks: tasks.length,
          byStatus: groupTasksByStatus(tasks),
          bySubmodule: groupTasksBySubmodule(tasks)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin tasks',
        error: error.message
      });
    }
  })
);

// @route   GET /api/admin/dashboard/stats
// @desc    Get dashboard statistics for admin module
// @access  Private (Admin)
router.get('/stats',
  authMiddleware,
  permissions.checkSubRolePermission('admin', 'payment_settlement', 'read'),
  asyncHandler(async (req, res) => {
    try {
      const userRole = req.user.role;
      const userEmail = req.user.email;
      // Get workflow status based on user email (priority) or role (fallback)
      const userWorkflowStatus = getWorkflowStatusForUserAndRole(userEmail, userRole);
      
      const stats = {
        totalTasks: 0,
        byStatus: {},
        bySubmodule: {},
        pendingTasks: 0,
        recentTasks: 0
      };
      
      const workflowModules = getWorkflowModules();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      for (const submodule of workflowModules) {
        const config = getModuleConfig(submodule);
        if (!config) continue;
        
        try {
          // Dynamic model loading using configured path
          const Model = require(config.modelPath);
          
          const query = {};
          if (userWorkflowStatus) {
            query[config.workflowStatusField] = userWorkflowStatus;
          }
          
          const [total, recent] = await Promise.all([
            Model.countDocuments(query),
            Model.countDocuments({
              ...query,
              updatedAt: { $gte: sevenDaysAgo }
            })
          ]);
          
          stats.totalTasks += total;
          stats.recentTasks += recent;
          stats.bySubmodule[submodule] = total;
          
          // Count by workflow status
          const statusCounts = await Model.aggregate([
            { $match: query },
            {
              $group: {
                _id: `$${config.workflowStatusField}`,
                count: { $sum: 1 }
              }
            }
          ]);
          
          statusCounts.forEach(item => {
            const status = item._id || 'Draft';
            stats.byStatus[status] = (stats.byStatus[status] || 0) + item.count;
            if (status === 'Draft' || status === 'Active' || status.includes('Send to')) {
              stats.pendingTasks += item.count;
            }
          });
        } catch (error) {
          console.error(`Error fetching stats from ${submodule}:`, error);
        }
      }
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
        error: error.message
      });
    }
  })
);

// Helper function to group tasks by status
function groupTasksByStatus(tasks) {
  const grouped = {};
  tasks.forEach(task => {
    const status = task.workflowStatus || 'Draft';
    if (!grouped[status]) {
      grouped[status] = [];
    }
    grouped[status].push(task);
  });
  return grouped;
}

// Helper function to group tasks by submodule
function groupTasksBySubmodule(tasks) {
  const grouped = {};
  tasks.forEach(task => {
    if (!grouped[task.submodule]) {
      grouped[task.submodule] = [];
    }
    grouped[task.submodule].push(task);
  });
  return grouped;
}

module.exports = router;

