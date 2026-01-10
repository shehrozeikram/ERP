/**
 * Payment Settlement Workflow Utility
 * Maps user roles and specific users to workflow statuses for role-based document visibility
 */

// Map specific users (by email) to their corresponding workflow status
const USER_EMAIL_TO_STATUS_MAP = {
  'rizwan@tovus.net': 'Send to AM Admin',
  'ejazahmed@tovus.net': 'Send to HOD Admin'
  // Add more user assignments here as needed
  // 'user@example.com': 'Send to Audit',
  // 'another@example.com': 'Send to Finance',
};

// Map roles to their corresponding workflow status (fallback for role-based access)
const ROLE_TO_STATUS_MAP = {
  'super_admin': null, // Can see all
  'higher_management': null, // Can see all
  'admin': null, // Can see all
  'am_admin': 'Send to AM Admin',
  'hod_admin': 'Send to HOD Admin',
  'audit_manager': 'Send to Audit',
  'finance_manager': 'Send to Finance',
  'ceo_office': 'Send to CEO Office'
};

// Get workflow status for a user (by email, takes priority over role)
const getWorkflowStatusForUser = (userEmail) => {
  return USER_EMAIL_TO_STATUS_MAP[userEmail?.toLowerCase()] || null;
};

// Get workflow status for a user role
const getWorkflowStatusForRole = (userRole) => {
  return ROLE_TO_STATUS_MAP[userRole] || null;
};

// Get workflow status for a user (checks email first, then role)
const getWorkflowStatusForUserAndRole = (userEmail, userRole) => {
  // Check user email mapping first (takes priority)
  const emailStatus = getWorkflowStatusForUser(userEmail);
  if (emailStatus) {
    return emailStatus;
  }
  // Fallback to role-based mapping
  return getWorkflowStatusForRole(userRole);
};

// Check if user can see documents with this workflow status
const canUserAccessStatus = (userRole, workflowStatus) => {
  // Super admin, higher management, and admin can see all
  if (['super_admin', 'higher_management', 'admin'].includes(userRole)) {
    return true;
  }

  const roleStatus = getWorkflowStatusForRole(userRole);
  if (!roleStatus) {
    return false;
  }

  // User can see documents assigned to their role's status
  return workflowStatus === roleStatus;
};

// Get all workflow statuses
const getAllWorkflowStatuses = () => {
  return [
    'Draft',
    'Active',
    'Send to AM Admin',
    'Send to HOD Admin',
    'Send to Audit',
    'Send to Finance',
    'Send to CEO Office',
    'Forwarded to CEO',
    'Approved',
    'Rejected',
    'Returned from Audit',
    'Returned from CEO Office'
  ];
};

// Extract base status from workflow status (handles "Approved (from Send to AM Admin)" format)
const getBaseWorkflowStatus = (workflowStatus) => {
  if (!workflowStatus) return 'Draft';
  
  // Check if it's an approved/rejected status with source
  if (workflowStatus.startsWith('Approved (from ')) {
    return 'Approved';
  }
  if (workflowStatus.startsWith('Rejected (from ')) {
    return 'Rejected';
  }
  
  return workflowStatus;
};

// Extract source status from workflow status (e.g., "Send to AM Admin" from "Approved (from Send to AM Admin)")
const getSourceStatus = (workflowStatus) => {
  if (!workflowStatus) return null;
  
  // Check if it's an approved/rejected status with source
  if (workflowStatus.startsWith('Approved (from ')) {
    const match = workflowStatus.match(/^Approved \(from (.+)\)$/);
    return match ? match[1] : null;
  }
  if (workflowStatus.startsWith('Rejected (from ')) {
    const match = workflowStatus.match(/^Rejected \(from (.+)\)$/);
    return match ? match[1] : null;
  }
  
  return null;
};

// Check if status is approved (handles both "Approved" and "Approved (from ...)" formats)
const isApprovedStatus = (workflowStatus) => {
  return workflowStatus && workflowStatus.startsWith('Approved');
};

// Check if status is rejected (handles both "Rejected" and "Rejected (from ...)" formats)
const isRejectedStatus = (workflowStatus) => {
  return workflowStatus && workflowStatus.startsWith('Rejected');
};

// Get approval statuses
const getApprovalStatuses = () => {
  return ['Approved', 'Rejected'];
};

// Check if status is an approval status (handles dynamic formats)
const isApprovalStatus = (status) => {
  return isApprovedStatus(status) || isRejectedStatus(status);
};

// Get next possible statuses (for workflow progression)
const getNextPossibleStatuses = (currentStatus) => {
  // Extract base status if it's a dynamic status like "Approved (from Send to AM Admin)"
  const baseStatus = getBaseWorkflowStatus(currentStatus);
  
  const statusFlow = {
    'Draft': ['Active', 'Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'],
    'Active': ['Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'],
    'Send to AM Admin': ['Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office', 'Approved', 'Rejected'],
    'Send to HOD Admin': ['Send to Audit', 'Send to Finance', 'Send to CEO Office', 'Approved', 'Rejected'],
    'Send to Audit': ['Send to Finance', 'Send to CEO Office', 'Approved', 'Rejected'],
    'Send to Finance': ['Send to CEO Office', 'Approved', 'Rejected'],
    'Send to CEO Office': ['Forwarded to CEO', 'Rejected', 'Returned from CEO Office'], // Coordinator can forward or reject
    'Forwarded to CEO': ['Approved', 'Rejected', 'Returned from CEO Office'], // CEO can approve, reject, or return with objection
    'Approved': ['Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'], // Can forward to any status after approval
    'Rejected': ['Draft', 'Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'], // Can be sent back to draft or forwarded
    'Returned from Audit': ['Send to Audit', 'Draft'], // Can resubmit to Pre Audit or go back to Draft
    'Returned from CEO Office': ['Draft', 'Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'] // Can go back to Draft or resubmit to any department including CEO Office
  };

  return statusFlow[baseStatus] || [];
};

// Check if status transition is valid
const isValidStatusTransition = (fromStatus, toStatus) => {
  // Same status is always valid (no change)
  if (fromStatus === toStatus) {
    return true;
  }

  // Allow "Returned from Audit" to go directly to "Send to Audit"
  if (fromStatus === 'Returned from Audit' && toStatus === 'Send to Audit') {
    return true;
  }

  // Allow "Returned from CEO Office" to go back to Draft or any department including CEO Office
  if (fromStatus === 'Returned from CEO Office') {
    const allowedStatuses = ['Draft', 'Send to AM Admin', 'Send to HOD Admin', 'Send to Audit', 'Send to Finance', 'Send to CEO Office'];
    if (allowedStatuses.includes(toStatus)) {
      return true;
    }
  }

  // If fromStatus is Approved or Rejected (base status), allow transition to any "Send to..." status
  if (fromStatus === 'Approved' || fromStatus === 'Rejected') {
    const allForwardStatuses = [
      'Send to AM Admin',
      'Send to HOD Admin',
      'Send to Audit',
      'Send to Finance',
      'Send to CEO Office'
    ];
    // Allow transition to any forward status, or back to Draft for Rejected
    if (fromStatus === 'Rejected' && toStatus === 'Draft') {
      return true;
    }
    return allForwardStatuses.includes(toStatus);
  }

  // For other statuses, use the standard flow
  const nextStatuses = getNextPossibleStatuses(fromStatus);
  return nextStatuses.includes(toStatus);
};

module.exports = {
  ROLE_TO_STATUS_MAP,
  USER_EMAIL_TO_STATUS_MAP,
  getWorkflowStatusForRole,
  getWorkflowStatusForUser,
  getWorkflowStatusForUserAndRole,
  canUserAccessStatus,
  getAllWorkflowStatuses,
  getNextPossibleStatuses,
  isValidStatusTransition,
  getApprovalStatuses,
  isApprovalStatus,
  getBaseWorkflowStatus,
  getSourceStatus,
  isApprovedStatus,
  isRejectedStatus
};

