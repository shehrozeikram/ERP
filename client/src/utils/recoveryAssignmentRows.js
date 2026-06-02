const formatAmount = (n) => {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return '—';
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return String(num);
};

export const RECOVERY_STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const RECOVERY_ACTION_LABELS = {
  whatsapp: 'WhatsApp message',
  call: 'Call',
  both: 'Both'
};

export const getRecoveryMemberName = (doc) => {
  const emp = doc?.assignedTo?.employee;
  if (!emp) return '—';
  return [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || emp.employeeId || '—';
};

export const getRecoveryCreatedByName = (doc) => {
  const u = doc?.createdBy;
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.employeeId || '—';
};

export const formatRecoveryAssignedDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatRecoveryTaskScopeDetail = (task) => {
  if (task.scopeType === 'sector') return task.sector ? `Sector: ${task.sector}` : '—';
  const min = formatAmount(task.minAmount);
  const max = task.maxAmount != null ? formatAmount(task.maxAmount) : 'above';
  return `${min} – ${max} PKR${task.sector ? ` (${task.sector})` : ''}`;
};

export const formatRecoveryTaskPeriodDetail = (task) => {
  if (!task?.startDate || !task?.endDate) return '—';
  const s = new Date(task.startDate).toLocaleDateString();
  const e = new Date(task.endDate).toLocaleDateString();
  return `${s} – ${e}`;
};

export const getRecoveryProgressPercent = (item) => {
  const target = Number(item?.targetCount);
  if (!Number.isNaN(target) && target > 0) {
    const completed = Math.max(0, Number(item?.completedCount) || 0);
    return Math.min(100, Math.round((completed / target) * 100));
  }
  const percent = Number(item?.progressPercent ?? item?.progress);
  if (Number.isNaN(percent)) return 0;
  return Math.min(100, Math.max(0, Math.round(percent)));
};

export const getRecoveryMonthYearKey = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const formatRecoveryMonthYearLabel = (key) => {
  if (!key || key === '_other') return key === '_other' ? 'Other' : '—';
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
};

const normalizeSector = (value) => String(value || '').trim().toLowerCase();

/** Build display rows for rules + tasks (same shape as Task Assignment page). */
export function buildRecoveryAssignmentRows(rules = [], tasks = []) {
  const taskScopeKeys = new Set(
    tasks.map((t) => {
      const scopeType = t.scopeType || 'sector';
      const assignedToId = t.assignedTo?._id || t.assignedTo || '';
      const sectorVal = t.sector || '';
      const min = scopeType === 'slab' ? (t.minAmount ?? 0) : '';
      const max = scopeType === 'slab' ? (t.maxAmount ?? null) : '';
      return `${scopeType}|${assignedToId}|${sectorVal}|${min}|${max}`;
    })
  );

  const sectorRules = rules.filter((r) => r.type === 'sector');
  const slabRules = rules.filter((r) => r.type === 'slab');

  const rows = [
    ...sectorRules
      .filter((r) => {
        const assignedToId = r.assignedTo?._id || r.assignedTo || '';
        const key = `sector|${assignedToId}|${r.sector || ''}||`;
        return !taskScopeKeys.has(key);
      })
      .map((r) => ({
        kind: 'rule',
        id: r._id,
        typeLabel: 'Rule',
        scope: r.sector || '—',
        member: getRecoveryMemberName(r),
        action: r.action || 'both',
        period: '—',
        targetCount: r.targetCount,
        progress:
          r.targetCount != null && r.targetCount > 0
            ? `${r.completedCount ?? 0}/${r.targetCount} (${getRecoveryProgressPercent(r)}%)`
            : `${getRecoveryProgressPercent(r)}%`,
        status: r.status || 'pending',
        rule: r,
        task: null,
        monthYear: getRecoveryMonthYearKey(r.createdAt) || '_other',
        assignedBy: getRecoveryCreatedByName(r),
        assignedDate: formatRecoveryAssignedDate(r.createdAt),
        sortAt: new Date(r.createdAt || 0).getTime()
      })),
    ...slabRules
      .filter((r) => {
        const assignedToId = r.assignedTo?._id || r.assignedTo || '';
        const min = r.minAmount ?? 0;
        const max = r.maxAmount ?? null;
        const key = `slab|${assignedToId}|${r.sector || ''}|${min}|${max}`;
        return !taskScopeKeys.has(key);
      })
      .map((r) => ({
        kind: 'rule',
        id: r._id,
        typeLabel: 'Rule',
        scope: `${formatAmount(r.minAmount)} – ${r.maxAmount != null ? formatAmount(r.maxAmount) : 'above'}${r.sector ? ` · ${r.sector}` : ''}`,
        member: getRecoveryMemberName(r),
        action: r.action || 'both',
        period: '—',
        targetCount: r.targetCount,
        progress:
          r.targetCount != null && r.targetCount > 0
            ? `${r.completedCount ?? 0}/${r.targetCount} (${getRecoveryProgressPercent(r)}%)`
            : `${getRecoveryProgressPercent(r)}%`,
        status: r.status || 'pending',
        rule: r,
        task: null,
        monthYear: getRecoveryMonthYearKey(r.createdAt) || '_other',
        assignedBy: getRecoveryCreatedByName(r),
        assignedDate: formatRecoveryAssignedDate(r.createdAt),
        sortAt: new Date(r.createdAt || 0).getTime()
      })),
    ...tasks.map((t) => ({
      kind: 'task',
      id: t._id,
      typeLabel: 'Task',
      scope: t.title
        ? `${t.title}${formatRecoveryTaskScopeDetail(t) !== '—' ? ` · ${formatRecoveryTaskScopeDetail(t)}` : ''}`
        : formatRecoveryTaskScopeDetail(t),
      member: getRecoveryMemberName(t),
      action: t.action || 'both',
      period: formatRecoveryTaskPeriodDetail(t),
      progress:
        t.targetCount != null && t.targetCount > 0
          ? `${t.completedCount ?? 0}/${t.targetCount} (${getRecoveryProgressPercent(t)}%)`
          : `${getRecoveryProgressPercent(t)}%`,
      status: t.status,
      targetCount: t.targetCount,
      rule: null,
      task: t,
      monthYear: getRecoveryMonthYearKey(t.createdAt || t.startDate) || '_other',
      assignedBy: getRecoveryCreatedByName(t),
      assignedDate: formatRecoveryAssignedDate(t.createdAt),
      sortAt: new Date(t.createdAt || t.startDate || 0).getTime()
    }))
  ];

  return rows.sort((a, b) => b.sortAt - a.sortAt);
}

export function groupRecoveryRowsByMonth(rows = []) {
  const grouped = rows.reduce((acc, row) => {
    const key = row.monthYear && row.monthYear !== '—' ? row.monthYear : '_other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const keys = Object.keys(grouped).sort((a, b) => {
    if (a === '_other') return 1;
    if (b === '_other') return -1;
    return b.localeCompare(a);
  });

  keys.forEach((key) => {
    grouped[key].sort((a, b) => b.sortAt - a.sortAt);
  });

  return { keys, grouped };
}

export function assignmentMatchesRecoveryRule(row, rule) {
  if (!row || !rule) return false;
  const sector = normalizeSector(row.sector);
  if (rule.type === 'sector') {
    return normalizeSector(rule.sector) === sector;
  }
  const due = Number(row.currentlyDue) || 0;
  const min = Number(rule.minAmount) || 0;
  const max = rule.maxAmount != null && rule.maxAmount !== '' ? Number(rule.maxAmount) : null;
  const inRange = due >= min && (max == null || due < max);
  const sectorMatch = !normalizeSector(rule.sector) || normalizeSector(rule.sector) === sector;
  return inRange && sectorMatch;
}
