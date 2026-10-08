/**
 * Utility to track who is currently holding a document based on its status and approval flow.
 */

export const getCurrentHolder = (documentType, document) => {
  if (!document) return { holder: 'Unknown', type: 'unknown' };

  if (documentType === 'PO') {
    return getPOHolder(document);
  } else if (documentType === 'UtilityBill' || documentType === 'VendorBill') {
    return getBillHolder(document);
  }

  return { holder: 'Unknown', type: 'unknown' };
};

const getPOHolder = (po) => {
  const { status, approvalAuthorities, authorityApprovals } = po;

  if (status === 'Draft' || status === 'Returned from CEO Office' || status === 'Returned from Audit' || status === 'Returned from CEO Secretariat' || status === 'Returned from Finance') {
    return { holder: 'Procurement (Initiator)', type: 'department' };
  }

  if (status === 'Pending Approval') {
    // Check which authority is next
    if (approvalAuthorities) {
      // Order: preparedBy -> managerProcurement -> srManagerProcurement -> chiefOperatingOfficer -> …
      // Only slots with a non-empty assigned name are required (empty schema defaults are not pending).
      const requiredKeys = [
        'preparedBy',
        'managerProcurement',
        'srManagerProcurement',
        'chiefOperatingOfficer',
        'verifiedBy',
        'technicalDepartment',
        'avpTaj',
        'authorisedRep',
        'financeRep'
      ];
      
      const approvals = authorityApprovals || [];
      const approvedKeys = approvals.map(a => a.authorityKey);

      for (const key of requiredKeys) {
        const assignedName = String(approvalAuthorities[key] || '').trim();
        if (!assignedName) continue;
        if (!approvedKeys.includes(key)) {
          let roleName = key.replace(/([A-Z])/g, ' $1');
          roleName = roleName.charAt(0).toUpperCase() + roleName.slice(1);
          return { holder: `${roleName} (${assignedName})`, type: 'authority' };
        }
      }
      return { holder: 'Pending Final Authority', type: 'authority' };
    }
    return { holder: 'Authorities', type: 'authority' };
  }

  if (status === 'Pending Audit') return { holder: 'Audit Department', type: 'department' };
  if (status === 'Forwarded to Audit Director') return { holder: 'Audit Director', type: 'authority' };
  if (status === 'Pending Finance' || status === 'Sent to Finance') return { holder: 'Finance Department', type: 'department' };
  if (status === 'Send to CEO Office' || status === 'Forwarded to CEO') return { holder: 'CEO Office', type: 'department' };
  
  if (status === 'Approved' || status === 'Ordered') return { holder: 'Procurement / Store (Awaiting GRN)', type: 'department' };
  if (status === 'Sent to Store') return { holder: 'Store (Receiving)', type: 'department' };
  if (status === 'GRN Created') return { holder: 'Procurement / Finance (Awaiting Bill)', type: 'department' };
  if (status === 'Received') return { holder: 'Completed', type: 'completed' };
  if (status === 'Cancelled' || status === 'Rejected') return { holder: 'None (Terminated)', type: 'terminated' };

  return { holder: status, type: 'unknown' };
};

const getBillHolder = (bill) => {
  const { status, approvalStatus, forwardedTo } = bill;

  if (approvalStatus === 'Draft' || approvalStatus === 'Rejected') {
    return { holder: 'Initiator', type: 'department' };
  }

  if (approvalStatus === 'Submitted') {
    if (forwardedTo && forwardedTo.firstName) {
      return { holder: `${forwardedTo.firstName} ${forwardedTo.lastName}`, type: 'user' };
    }
    return { holder: 'Approver', type: 'authority' };
  }

  if (approvalStatus === 'Approved') {
    if (status === 'Pending' || status === 'Partial' || status === 'Overdue') {
      return { holder: 'Finance (Awaiting Payment)', type: 'department' };
    }
    if (status === 'Paid') {
      return { holder: 'Completed', type: 'completed' };
    }
  }

  return { holder: approvalStatus || status, type: 'unknown' };
};
