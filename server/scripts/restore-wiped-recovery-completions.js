#!/usr/bin/env node
/**
 * Restore wiped recovery completions for ALL assignees (dynamic).
 *
 * 1) For existing RecoveryTasks: rebuild completionHistory from WhatsApp /
 *    outbound fields / feedback inside each task window.
 * 2) For calendar months with outbound WhatsApp but no RecoveryTask:
 *    recreate a completed monthly sector task per assignee + sector, and
 *    archive matching completions into completionHistory.
 *
 * Current pending work is not flipped back to completed.
 *
 * Usage:
 *   NODE_ENV=production node server/scripts/restore-wiped-recovery-completions.js
 *   NODE_ENV=production node server/scripts/restore-wiped-recovery-completions.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { getMongooseClientOptions } = require('../config/database');
const {
  buildScopeQuery,
  countCompletionsForTaskPeriod,
  endOfDay
} = require('../utils/recoveryAssignmentUnassign');
const { normalizePhoneForLookup, variantsForRecoveryPhone } = require('../utils/recoveryWhatsAppPhone');

const apply = process.argv.includes('--apply');

const inWindow = (date, start, end) => {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
};

const historyHasWindowEntry = (history, start, end) =>
  (Array.isArray(history) ? history : []).some((h) => inWindow(h.completedAt, start, end));

const monthBounds = (year, monthIndex0) => {
  const start = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999));
  return { start, end };
};

const monthLabel = (year, monthIndex0) =>
  new Date(Date.UTC(year, monthIndex0, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_LOCAL;
  await mongoose.connect(uri, getMongooseClientOptions(uri, /localhost|127/.test(uri || '')));

  require('../models/finance/RecoveryTask');
  require('../models/finance/RecoveryAssignment');
  require('../models/finance/RecoveryMember');
  require('../models/finance/WhatsAppOutgoingMessage');
  require('../models/hr/Employee');
  require('../models/User');

  const RecoveryTask = mongoose.model('RecoveryTask');
  const RecoveryAssignment = mongoose.model('RecoveryAssignment');
  const RecoveryMember = mongoose.model('RecoveryMember');
  const WhatsAppOutgoingMessage = mongoose.model('WhatsAppOutgoingMessage');
  const User = mongoose.model('User');
  const db = mongoose.connection.db;

  const members = await RecoveryMember.find({})
    .populate('employee', 'firstName lastName employeeId user')
    .lean();

  /** userId → member */
  const memberByUserId = new Map();
  /** memberId → { member, userId, name } */
  const memberMeta = new Map();

  for (const m of members) {
    let userId = m.employee?.user || null;
    if (!userId && m.employee?.employeeId) {
      const u = await User.findOne({ employeeId: m.employee.employeeId }).select('_id').lean();
      userId = u?._id || null;
    }
    if (!userId && m.employee?._id) {
      const u = await User.findOne({ employee: m.employee._id }).select('_id').lean();
      userId = u?._id || null;
    }
    const name = m.employee
      ? [m.employee.firstName, m.employee.lastName].filter(Boolean).join(' ').trim() || m.employee.employeeId
      : String(m._id);
    const meta = { member: m, userId, name };
    memberMeta.set(String(m._id), meta);
    if (userId) memberByUserId.set(String(userId), meta);
  }

  const tasks = await RecoveryTask.find({ status: { $ne: 'cancelled' } })
    .populate({ path: 'assignedTo', populate: { path: 'employee', select: 'firstName lastName employeeId user' } })
    .sort({ startDate: 1 })
    .lean();

  const minOutbound = new Date('2026-05-01T00:00:00.000Z');
  const outbound = await WhatsAppOutgoingMessage.find({
    sentAt: { $gte: minOutbound }
  })
    .select('to sentAt sentBy')
    .lean();

  /** phone → [{ sentAt, sentBy }] */
  const outByPhone = new Map();
  for (const msg of outbound) {
    const canon = normalizePhoneForLookup(msg.to);
    if (!canon) continue;
    if (!outByPhone.has(canon)) outByPhone.set(canon, []);
    outByPhone.get(canon).push({ sentAt: msg.sentAt, sentBy: msg.sentBy });
  }

  const findBestOutbound = (mobile, start, end) => {
    const phone = normalizePhoneForLookup(mobile);
    if (!phone) return null;
    const variants = [...new Set([phone, ...variantsForRecoveryPhone(phone).map(normalizePhoneForLookup)])];
    let best = null;
    for (const v of variants) {
      for (const m of outByPhone.get(v) || []) {
        if (!inWindow(m.sentAt, start, end)) continue;
        if (!best || new Date(m.sentAt) > new Date(best.sentAt)) best = m;
      }
    }
    return best;
  };

  const summary = {
    apply,
    existingTaskRestores: 0,
    reconstructedTasks: 0,
    historyRowsWritten: 0,
    byAssignee: {},
    tasksCreated: [],
    sample: []
  };

  const bumpAssignee = (name, n = 1) => {
    summary.byAssignee[name] = (summary.byAssignee[name] || 0) + n;
  };

  const archiveHistory = async (row, completedAt, completedBy, start, end) => {
    if (
      (row.taskStatus === 'completed' && inWindow(row.taskCompletedAt, start, end)) ||
      historyHasWindowEntry(row.completionHistory, start, end)
    ) {
      return false;
    }
    if (!apply) return true;
    const history = Array.isArray(row.completionHistory) ? [...row.completionHistory] : [];
    history.push({
      completedAt: new Date(completedAt),
      ...(completedBy ? { completedBy } : {})
    });
    await db.collection('recoveryassignments').updateOne(
      { _id: row._id },
      { $set: { completionHistory: history, updatedAt: new Date() } }
    );
    summary.historyRowsWritten += 1;
    return true;
  };

  // ── Pass 1: existing RecoveryTasks ───────────────────────────────────────
  for (const task of tasks) {
    const start = task.startDate ? new Date(task.startDate) : null;
    const end = endOfDay(task.endDate);
    if (!start || !end || Number.isNaN(start.getTime())) continue;

    const assigneeId = String(task.assignedTo?._id || task.assignedTo || '');
    const meta = memberMeta.get(assigneeId);
    const assigneeName = meta?.name || assigneeId;
    const defaultCompletedBy = meta?.userId || null;

    const scopeQuery = buildScopeQuery({
      scopeType: task.scopeType,
      sector: task.sector,
      minAmount: task.minAmount,
      maxAmount: task.maxAmount
    });
    const assignments = await RecoveryAssignment.find(scopeQuery).lean();
    let restored = 0;

    for (const row of assignments) {
      const bestOutbound = findBestOutbound(row.mobileNumber, start, end);
      const outboundField = inWindow(row.lastOutboundAt, start, end)
        ? row.lastOutboundAt
        : inWindow(row.lastCampaignSentAt, start, end)
          ? row.lastCampaignSentAt
          : null;
      const hasFeedback =
        Boolean(String(row.whatsappFeedback || '').trim()) ||
        Boolean(String(row.callFeedback || '').trim());
      const feedbackInWindow = hasFeedback && inWindow(row.updatedAt, start, end);

      let completedAt = null;
      let completedBy = defaultCompletedBy;
      if (bestOutbound) {
        completedAt = bestOutbound.sentAt;
        completedBy = bestOutbound.sentBy || defaultCompletedBy;
      } else if (outboundField) {
        completedAt = outboundField;
      } else if (feedbackInWindow) {
        completedAt = row.updatedAt;
      } else {
        continue;
      }

      const ok = await archiveHistory(row, completedAt, completedBy, start, end);
      if (!ok) continue;
      restored += 1;
      bumpAssignee(assigneeName);
      if (summary.sample.length < 20) {
        summary.sample.push({
          kind: 'existing_task',
          assignee: assigneeName,
          orderCode: row.orderCode,
          period: `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`
        });
      }
    }

    summary.existingTaskRestores += restored;

    if (apply && restored > 0) {
      const completed = await countCompletionsForTaskPeriod({
        scopeType: task.scopeType,
        sector: task.sector,
        minAmount: task.minAmount,
        maxAmount: task.maxAmount,
        startDate: task.startDate,
        endDate: task.endDate
      });
      const nextProgress =
        task.targetCount != null && task.targetCount > 0
          ? Math.min(100, Math.round((completed / task.targetCount) * 100))
          : Math.min(100, Math.max(0, Number(task.progressPercent) || 0));
      let nextStatus = task.status;
      if (task.status !== 'cancelled') {
        if (task.targetCount != null && task.targetCount > 0 && completed >= task.targetCount) {
          nextStatus = 'completed';
        } else if (task.endDate && new Date(task.endDate) < new Date()) {
          nextStatus = 'completed';
        } else if (completed > 0 && task.status === 'pending') {
          nextStatus = 'in_progress';
        }
      }
      await db.collection('recoverytasks').updateOne(
        { _id: task._id },
        {
          $set: {
            completedCount: completed,
            progressPercent: nextProgress,
            status: nextStatus,
            updatedAt: new Date()
          }
        }
      );
    }
  }

  // ── Pass 2: reconstruct missing monthly sector tasks from WhatsApp ───────
  // Build phone → assignment sector map
  const allAssignments = await RecoveryAssignment.find({})
    .select('_id mobileNumber sector orderCode customerName completionHistory taskStatus taskCompletedAt lastOutboundAt lastCampaignSentAt')
    .lean();
  /** phone → assignment docs */
  const assignmentsByPhone = new Map();
  for (const row of allAssignments) {
    const phone = normalizePhoneForLookup(row.mobileNumber);
    if (!phone) continue;
    if (!assignmentsByPhone.has(phone)) assignmentsByPhone.set(phone, []);
    assignmentsByPhone.get(phone).push(row);
  }

  /** key = `${memberId}|${yyyy-mm}|${sector}` → { assignmentIds:Set, lastAt, completedBy } */
  const buckets = new Map();

  for (const msg of outbound) {
    const meta = msg.sentBy ? memberByUserId.get(String(msg.sentBy)) : null;
    if (!meta) continue;
    const sentAt = new Date(msg.sentAt);
    if (Number.isNaN(sentAt.getTime())) continue;
    // Only reconstruct past full months (not current month — active work)
    const now = new Date();
    if (
      sentAt.getUTCFullYear() > now.getUTCFullYear() ||
      (sentAt.getUTCFullYear() === now.getUTCFullYear() && sentAt.getUTCMonth() >= now.getUTCMonth())
    ) {
      continue;
    }

    const phone = normalizePhoneForLookup(msg.to);
    if (!phone) continue;
    const rows = assignmentsByPhone.get(phone) || [];
    if (!rows.length) continue;

    const y = sentAt.getUTCFullYear();
    const m = sentAt.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;

    for (const row of rows) {
      const sector = String(row.sector || '').trim();
      if (!sector) continue;
      const key = `${meta.member._id}|${monthKey}|${sector}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          memberId: String(meta.member._id),
          assigneeName: meta.name,
          userId: meta.userId,
          year: y,
          monthIndex0: m,
          sector,
          assignmentMap: new Map(),
          lastAt: sentAt
        });
      }
      const b = buckets.get(key);
      const prev = b.assignmentMap.get(String(row._id));
      if (!prev || sentAt > new Date(prev.completedAt)) {
        b.assignmentMap.set(String(row._id), {
          row,
          completedAt: sentAt,
          completedBy: msg.sentBy || meta.userId
        });
      }
      if (sentAt > b.lastAt) b.lastAt = sentAt;
    }
  }

  for (const b of buckets.values()) {
    const { start, end } = monthBounds(b.year, b.monthIndex0);
    const count = b.assignmentMap.size;
    if (count < 1) continue;

    // Skip if a RecoveryTask already covers this assignee+sector overlapping this month
    const existing = await RecoveryTask.findOne({
      assignedTo: b.memberId,
      scopeType: 'sector',
      sector: new RegExp(`^${b.sector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      startDate: { $lte: end },
      endDate: { $gte: start },
      status: { $ne: 'cancelled' }
    }).lean();

    let restoredInBucket = 0;
    for (const { row, completedAt, completedBy } of b.assignmentMap.values()) {
      const ok = await archiveHistory(row, completedAt, completedBy, start, end);
      if (ok) {
        restoredInBucket += 1;
        bumpAssignee(b.assigneeName);
      }
    }

    if (existing) {
      if (apply && restoredInBucket > 0) {
        const completed = await countCompletionsForTaskPeriod({
          scopeType: 'sector',
          sector: b.sector,
          startDate: existing.startDate,
          endDate: existing.endDate
        });
        await db.collection('recoverytasks').updateOne(
          { _id: existing._id },
          {
            $set: {
              completedCount: completed,
              progressPercent:
                existing.targetCount > 0
                  ? Math.min(100, Math.round((completed / existing.targetCount) * 100))
                  : 100,
              status: 'completed',
              updatedAt: new Date()
            }
          }
        );
      }
      continue;
    }

    // Create reconstructed monthly task so July/August appear again for the assignee
    const title = `${b.sector} — ${monthLabel(b.year, b.monthIndex0)} (restored)`;
    summary.reconstructedTasks += 1;
    summary.tasksCreated.push({
      assignee: b.assigneeName,
      sector: b.sector,
      month: monthLabel(b.year, b.monthIndex0),
      completions: count,
      title
    });

    if (!apply) continue;

    const completed = await countCompletionsForTaskPeriod({
      scopeType: 'sector',
      sector: b.sector,
      startDate: start,
      endDate: end
    });

    await db.collection('recoverytasks').insertOne({
      title,
      assignedTo: new mongoose.Types.ObjectId(b.memberId),
      scopeType: 'sector',
      sector: b.sector,
      minAmount: 0,
      maxAmount: null,
      startDate: start,
      endDate: end,
      targetCount: completed || count,
      completedCount: completed || count,
      progressPercent: 100,
      status: 'completed',
      notes: 'Auto-restored from WhatsApp activity after completion wipe on reassignment',
      action: 'both',
      createdBy: b.userId || null,
      createdAt: start,
      updatedAt: new Date()
    });
  }

  // Refresh rule completedCounts using live completed + history (best effort)
  if (apply) {
    const rules = await db.collection('recoverytaskassignmentrules').find({ isActive: true }).toArray();
    for (const rule of rules) {
      const scopeQuery = buildScopeQuery({
        type: rule.type,
        sector: rule.sector,
        minAmount: rule.minAmount,
        maxAmount: rule.maxAmount
      });
      const current = await RecoveryAssignment.countDocuments({ ...scopeQuery, taskStatus: 'completed' });
      const histAgg = await RecoveryAssignment.aggregate([
        { $match: { ...scopeQuery, 'completionHistory.0': { $exists: true } } },
        { $project: { n: { $size: { $ifNull: ['$completionHistory', []] } } } },
        { $group: { _id: null, total: { $sum: '$n' } } }
      ]);
      // Prefer max(current, stored) so we don't shrink known progress; history may double-count
      const histTotal = histAgg[0]?.total || 0;
      const completed = Math.max(current, Number(rule.completedCount) || 0, histTotal > 0 ? current + 0 : current);
      const target = rule.targetCount != null ? Number(rule.targetCount) : null;
      const progressPercent =
        target > 0 ? Math.min(100, Math.round((Math.max(current, Number(rule.completedCount) || 0) / target) * 100)) : Number(rule.progressPercent) || 0;
      // Keep existing completedCount if higher than live current (don't erase stored progress)
      const nextCount = Math.max(current, Number(rule.completedCount) || 0);
      let nextStatus = rule.status;
      if (rule.status !== 'cancelled' && target > 0) {
        if (nextCount >= target) nextStatus = 'completed';
        else if (nextCount > 0) nextStatus = 'in_progress';
      }
      await db.collection('recoverytaskassignmentrules').updateOne(
        { _id: rule._id },
        {
          $set: {
            completedCount: nextCount,
            progressPercent: target > 0 ? Math.min(100, Math.round((nextCount / target) * 100)) : progressPercent,
            status: nextStatus,
            updatedAt: new Date()
          }
        }
      );
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  console.log(apply ? 'APPLY_OK' : 'DRY_RUN_OK');
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
