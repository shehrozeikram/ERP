/** Newest time-bound recovery task assignments first (second assigned appears before first). */
export function sortRecoveryTasksNewestFirst(tasks = []) {
  return [...tasks].sort((a, b) => {
    const ta = new Date(a?.createdAt || a?.startDate || 0).getTime();
    const tb = new Date(b?.createdAt || b?.startDate || 0).getTime();
    return tb - ta;
  });
}

export function formatRecoveryTaskScope(task) {
  if (!task) return '';
  if (task.scopeType === 'sector') {
    return task.sector ? `Sector: ${task.sector}` : 'All sectors';
  }
  const max = task.maxAmount != null && task.maxAmount !== '' ? task.maxAmount : 'above';
  const sector = task.sector ? ` · ${task.sector}` : '';
  return `Slab: ${task.minAmount ?? 0} – ${max}${sector}`;
}

export function formatRecoveryTaskPeriod(task) {
  if (!task?.startDate && !task?.endDate) return '';
  const fmt = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const start = fmt(task.startDate);
  const end = fmt(task.endDate);
  if (start && end) return `${start} – ${end}`;
  return start || end || '';
}
