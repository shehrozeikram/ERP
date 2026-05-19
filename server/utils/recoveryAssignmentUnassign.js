const RecoveryAssignment = require('../models/finance/RecoveryAssignment');
const RecoveryTaskAssignmentRule = require('../models/finance/RecoveryTaskAssignmentRule');

/** Excluded from My Tasks and similar active-work lists. */
const UNASSIGNED_TASK_STATUS = 'unassigned';

const UNASSIGN_UPDATE = {
  $set: {
    taskStatus: UNASSIGNED_TASK_STATUS,
    whatsappFeedback: '',
    callFeedback: ''
  },
  $unset: {
    taskCompletedAt: '',
    taskCompletedBy: ''
  }
};

function normalizeSectorValue(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectorExactRegex(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return new RegExp(`^${escapeRegex(trimmed)}$`, 'i');
}

/** scopeType (tasks) or type (rules): 'sector' | 'slab' */
function buildScopeQuery({ scopeType, type, sector, minAmount, maxAmount }) {
  const ruleType = type || scopeType;
  const query = {};
  const sectorRegex = sectorExactRegex(sector);
  if (sectorRegex) query.sector = sectorRegex;

  if (ruleType === 'slab') {
    const min = Number(minAmount) || 0;
    const max = maxAmount !== undefined && maxAmount !== null && maxAmount !== '' ? Number(maxAmount) : null;
    query.currentlyDue = max != null ? { $gte: min, $lt: max } : { $gte: min };
  }
  return query;
}

function partitionRules(rules) {
  return {
    sectorRules: rules.filter((r) => r.type === 'sector'),
    slabRules: rules.filter((r) => r.type === 'slab')
  };
}

/** True when any active rule still assigns this record (same logic as My Tasks). */
function assignmentMatchesRules(record, sectorRules, slabRules) {
  const sector = normalizeSectorValue(record.sector);
  const due = Number(record.currentlyDue) || 0;

  const sectorRule = sectorRules.find((r) => normalizeSectorValue(r.sector) === sector);
  if (sectorRule) return true;

  return slabRules.some((r) => {
    const min = Number(r.minAmount) || 0;
    const max = r.maxAmount != null && r.maxAmount !== '' ? Number(r.maxAmount) : null;
    const sectorMatch = !normalizeSectorValue(r.sector) || normalizeSectorValue(r.sector) === sector;
    const inRange = due >= min && (max === null || due < max);
    return sectorMatch && inRange;
  });
}

/**
 * Mark recovery assignments in scope as unassigned when no other active rule covers them.
 * Master rows stay in Recovery Assignments; they leave My Tasks / active work.
 */
async function unassignOrphanedAssignmentsByScope({
  scopeType,
  type,
  sector,
  minAmount,
  maxAmount,
  excludeRuleId
}) {
  const scopeQuery = buildScopeQuery({ scopeType, type, sector, minAmount, maxAmount });
  const ruleQuery = { isActive: true };
  if (excludeRuleId) {
    ruleQuery._id = { $ne: excludeRuleId };
  }

  const remainingRules = await RecoveryTaskAssignmentRule.find(ruleQuery).lean();
  const { sectorRules, slabRules } = partitionRules(remainingRules);

  const candidates = await RecoveryAssignment.find(scopeQuery)
    .select('_id sector currentlyDue')
    .lean();

  const idsToUnassign = candidates
    .filter((r) => !assignmentMatchesRules(r, sectorRules, slabRules))
    .map((r) => r._id);

  if (!idsToUnassign.length) return 0;

  const result = await RecoveryAssignment.updateMany({ _id: { $in: idsToUnassign } }, UNASSIGN_UPDATE);
  return result.modifiedCount || 0;
}

module.exports = {
  UNASSIGNED_TASK_STATUS,
  MY_TASKS_ACTIVE_STATUS_FILTER: { $nin: ['completed', UNASSIGNED_TASK_STATUS] },
  REOPEN_FROM_STATUSES: ['completed', UNASSIGNED_TASK_STATUS],
  buildScopeQuery,
  unassignOrphanedAssignmentsByScope
};
