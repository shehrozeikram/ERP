/** Mirrors server/utils/utilityBillApprovalSlots.js for centralized store bill UI. */

export const ROLE_ORDER = ['manager', 'hod', 'sr_manager', 'avp_taj'];

export const ROLE_LABELS = {
  manager: 'Manager Approver',
  hod: 'Head Of Department Approver',
  sr_manager: 'Sr Manager',
  avp_taj: 'AVP Taj'
};

export const getApprovalRoleLabel = (role, indexFallback = 0) => {
  const r = String(role || '').trim().toLowerCase();
  if (ROLE_LABELS[r]) return ROLE_LABELS[r];
  if (indexFallback === 0) return ROLE_LABELS.manager;
  if (indexFallback === 1) return ROLE_LABELS.hod;
  if (indexFallback === 2) return ROLE_LABELS.sr_manager;
  if (indexFallback === 3) return ROLE_LABELS.avp_taj;
  return 'Approver';
};

export const buildApprovalSlotsPayload = ({
  managerApprover,
  hodApprover,
  enableSrManager,
  srManagerApprover,
  enableAvpTaj,
  avpTajApprover
}) => {
  const slots = [];
  if (managerApprover?._id) {
    slots.push({ role: 'manager', approverId: String(managerApprover._id) });
  }
  if (hodApprover?._id) {
    slots.push({ role: 'hod', approverId: String(hodApprover._id) });
  }
  if (enableSrManager && srManagerApprover?._id) {
    slots.push({ role: 'sr_manager', approverId: String(srManagerApprover._id) });
  }
  if (enableAvpTaj && avpTajApprover?._id) {
    slots.push({ role: 'avp_taj', approverId: String(avpTajApprover._id) });
  }
  return slots;
};
