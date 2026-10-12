/**
 * Centralized Store Bill approval slots.
 * Standard: Manager + HOD (at least one). Optional (checkbox): Sr Manager, AVP Taj.
 * Order is always sequential: manager → hod → sr_manager → avp_taj.
 */

const ROLE_ORDER = ['manager', 'hod', 'sr_manager', 'avp_taj'];

const ROLE_LABELS = {
  manager: 'Manager Approver',
  hod: 'Head Of Department Approver',
  sr_manager: 'Sr Manager',
  avp_taj: 'AVP Taj'
};

const OPTIONAL_ROLES = new Set(['sr_manager', 'avp_taj']);
const BASE_ROLES = new Set(['manager', 'hod']);

const normalizeRole = (role) => {
  const r = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (r === 'sr_manager' || r === 'srmanager' || r === 'senior_manager') return 'sr_manager';
  if (r === 'avp_taj' || r === 'avptaj' || r === 'avp') return 'avp_taj';
  if (r === 'manager') return 'manager';
  if (r === 'hod' || r === 'head_of_department') return 'hod';
  return '';
};

const parseJsonMaybe = (value, fallback = []) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

/**
 * Normalize incoming slots from body / draft.
 * @returns {{ role: string, approverId: string }[]}
 */
const normalizeApprovalSlots = (raw) => {
  const list = Array.isArray(raw) ? raw : parseJsonMaybe(raw, []);
  if (!Array.isArray(list)) return [];

  const byRole = new Map();
  list.forEach((entry) => {
    if (!entry) return;
    const role = normalizeRole(entry.role || entry.authority);
    const approverId = String(entry.approverId || entry.approver?._id || entry.approver || '').trim();
    if (!role || !approverId || !ROLE_ORDER.includes(role)) return;
    byRole.set(role, { role, approverId });
  });

  return ROLE_ORDER.map((role) => byRole.get(role)).filter(Boolean);
};

/** Build slots from legacy ordered approverIds (manager, hod[, sr, avp]). */
const slotsFromApproverIds = (ids = []) => {
  const list = (Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean);
  return list.slice(0, 4).map((approverId, idx) => ({
    role: ROLE_ORDER[idx] || 'manager',
    approverId
  }));
};

const validateCentralizedApprovalSlots = (slots = []) => {
  if (!slots.length) {
    return { ok: false, message: 'Select at least Manager Approver or Head Of Department Approver' };
  }
  if (slots.length > 4) {
    return { ok: false, message: 'Too many approval authorities selected' };
  }

  const roles = slots.map((s) => s.role);
  const hasBase = roles.some((r) => BASE_ROLES.has(r));
  if (!hasBase) {
    return { ok: false, message: 'Select at least Manager Approver or Head Of Department Approver' };
  }

  const ids = slots.map((s) => s.approverId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: 'Each approval authority must be a different person' };
  }

  return { ok: true };
};

const validateStandardApprovalSlots = (slots = []) => {
  if (slots.length !== 2) {
    return { ok: false, message: 'Select Manager Approver and Head Of Department Approver' };
  }
  if (slots[0].role !== 'manager' || slots[1].role !== 'hod') {
    return { ok: false, message: 'Select Manager Approver and Head Of Department Approver' };
  }
  if (slots[0].approverId === slots[1].approverId) {
    return { ok: false, message: 'Manager Approver and Head Of Department Approver must be different' };
  }
  return { ok: true };
};

const roleLabel = (role, indexFallback = 0) => {
  const normalized = normalizeRole(role);
  if (normalized && ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  if (indexFallback === 0) return ROLE_LABELS.manager;
  if (indexFallback === 1) return ROLE_LABELS.hod;
  if (indexFallback === 2) return ROLE_LABELS.sr_manager;
  if (indexFallback === 3) return ROLE_LABELS.avp_taj;
  return 'Approver';
};

module.exports = {
  ROLE_ORDER,
  ROLE_LABELS,
  OPTIONAL_ROLES,
  BASE_ROLES,
  normalizeRole,
  normalizeApprovalSlots,
  slotsFromApproverIds,
  validateCentralizedApprovalSlots,
  validateStandardApprovalSlots,
  roleLabel
};
