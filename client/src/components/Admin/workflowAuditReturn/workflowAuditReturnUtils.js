const FEEDBACK_HISTORY_KEYWORDS = [
  'observation',
  'returned from pre audit',
  'returned from payments',
  'returned from ceo office',
  'rejected with observations',
  'administration response to observation',
  'admin reply to observation'
];

/** @param {unknown} comments */
function parseStructuredObservationComment(comments) {
  const c = String(comments || '').trim();
  if (!c) return null;

  let match = c.match(/^Observation\s*\(([^)]+)\):\s*(.+)$/i);
  if (match) {
    return { observation: match[2].trim(), severity: String(match[1]).toLowerCase() };
  }

  match = c.match(/^Observation\s+\d+\s*\(([^)]+)\):\s*(.+)$/i);
  if (match) {
    return { observation: match[2].trim(), severity: String(match[1]).toLowerCase() };
  }

  return null;
}

/** Split "Observation 1 (high): a; Observation 2 (low): b" into structured rows. */
function parseCombinedObservationsBlock(text) {
  const block = String(text || '').trim();
  if (!block) return [];

  const parts = block.split(/;\s*(?=Observation\s+\d+\s*\()/i);
  const rows = [];
  parts.forEach((part, idx) => {
    const trimmed = part.trim();
    const parsed = parseStructuredObservationComment(trimmed);
    if (parsed) {
      rows.push({ ...parsed, _id: `combined-${idx}` });
      return;
    }
    const numbered = trimmed.match(/^Observation\s+\d+\s*\(([^)]+)\):\s*(.+)$/i);
    if (numbered) {
      rows.push({
        observation: numbered[2].trim(),
        severity: String(numbered[1]).toLowerCase(),
        _id: `combined-${idx}`
      });
    }
  });
  return rows;
}

function mapHistoryEntryToObservation(entry, payload) {
  return {
    _id: entry?._id || payload._id,
    observation: payload.observation,
    severity: payload.severity || 'medium',
    addedBy: payload.addedBy || entry?.changedBy,
    addedAt: payload.addedAt || entry?.changedAt,
    answer: payload.answer,
    answeredBy: payload.answeredBy || (payload.answer ? entry?.changedBy : undefined),
    answeredAt: payload.answeredAt || (payload.answer ? entry?.changedAt : undefined),
    resolved: payload.resolved ?? false
  };
}

/**
 * @param {unknown[]} workflowHistory
 * @param {{ matchToStatus?: (toStatus: unknown, comments?: unknown) => boolean }} [options]
 */
export function findLatestWorkflowReturnEntry(workflowHistory, options = {}) {
  const { matchToStatus } = options;
  const match =
    matchToStatus ||
    ((toStatus) => String(toStatus || '').toLowerCase().includes('returned from audit'));
  if (!Array.isArray(workflowHistory) || !workflowHistory.length) return null;
  return [...workflowHistory].reverse().find((e) => match(e?.toStatus, e?.comments)) || null;
}

/**
 * Latest reject/return summary row from workflow history (for display above observation list).
 * @param {unknown[]} workflowHistory
 */
export function findLatestWorkflowFeedbackEntry(workflowHistory) {
  if (!Array.isArray(workflowHistory) || !workflowHistory.length) return null;

  return (
    [...workflowHistory].reverse().find((e) => {
      const comments = String(e?.comments || '').toLowerCase();
      const toStatus = String(e?.toStatus || '').toLowerCase();
      return (
        toStatus.includes('returned from audit') ||
        toStatus.includes('rejected') ||
        comments.includes('rejected with observations') ||
        comments.includes('returned from pre audit with observations') ||
        comments.includes('returned from payments with observations')
      );
    }) || null
  );
}

/**
 * Structured observations + parsed workflow history (reject/return from any department).
 * @param {object|null|undefined} doc
 */
export function getDepartmentRejectionObservations(doc) {
  if (!doc) return [];

  const rows = [];
  const seen = new Set();
  const push = (row) => {
    const text = String(row?.observation || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    rows.push(row);
  };

  const reason = String(doc.departmentRejectionReason || '').trim();
  if (reason) {
    push({
      _id: 'department-rejection-reason',
      observation: reason,
      severity: 'high',
      addedBy: doc.departmentRejectedBy,
      addedAt: doc.departmentRejectedAt,
      resolved: false
    });
  }

  (doc.departmentApprovalChain || []).forEach((step, idx) => {
    if (step?.status !== 'rejected') return;
    const comment = String(step.comment || '').trim();
    if (!comment) return;
    const roleLabel = idx === 0 ? 'Manager' : idx === 1 ? 'Head of Department' : `Approver ${idx + 1}`;
    push({
      _id: `department-chain-reject-${idx}`,
      observation: comment,
      severity: 'high',
      addedBy: step.approver,
      addedAt: step.actedAt,
      resolved: false,
      roleLabel
    });
  });

  return rows;
}

export function getWorkflowFeedbackObservations(doc) {
  if (!doc) return [];

  const departmentRows = getDepartmentRejectionObservations(doc);
  let primary = [];

  if (Array.isArray(doc.observations) && doc.observations.length > 0) {
    primary = doc.observations;
  } else if (Array.isArray(doc.auditRejectObservations) && doc.auditRejectObservations.length > 0) {
    primary = doc.auditRejectObservations.map((obs, idx) => ({
      _id: obs._id || `audit-reject-${idx}`,
      observation: obs.observation || obs.text || String(obs),
      severity: obs.severity || 'medium',
      addedBy: doc.auditRejectedBy,
      addedAt: doc.auditRejectedAt,
      resolved: false
    }));
  } else if (Array.isArray(doc.auditObservations) && doc.auditObservations.length > 0) {
    primary = doc.auditObservations;
  } else {
    const history = Array.isArray(doc.workflowHistory) ? doc.workflowHistory : [];
    const parsed = [];
    const seen = new Set();

    const pushRow = (entry, row) => {
      const text = String(row.observation || '').trim();
      if (!text || seen.has(text)) return;
      seen.add(text);
      parsed.push(mapHistoryEntryToObservation(entry, row));
    };

    history.forEach((entry) => {
      const comments = entry?.comments;
      if (!comments) return;

      const lower = String(comments).toLowerCase();
      if (!FEEDBACK_HISTORY_KEYWORDS.some((k) => lower.includes(k))) return;

      const adminReply = String(comments).match(
        /Administration response to observation(?:\s*:\s*"([^"]*)")?\s*—\s*([\s\S]+)$/i
      );
      if (adminReply) {
        const quotedObs = adminReply[1]?.trim();
        const replyText = adminReply[2]?.trim();
        if (replyText) {
          pushRow(entry, {
            observation: quotedObs || 'Observation (see audit return)',
            severity: 'medium',
            answer: replyText,
            answeredBy: entry.changedBy,
            answeredAt: entry.changedAt,
            resolved: true
          });
        }
        return;
      }

      const structured = parseStructuredObservationComment(comments);
      if (structured) {
        pushRow(entry, structured);
        return;
      }

      const obsSection = String(comments).match(/\.\s*Observations:\s*([\s\S]+)$/i);
      if (obsSection) {
        parseCombinedObservationsBlock(obsSection[1]).forEach((row) => pushRow(entry, row));
        const rejectLead = String(comments).match(/Rejected with observations:\s*(.+?)\.\s*Observations:/i);
        if (rejectLead) {
          const lead = rejectLead[1].trim();
          if (lead) pushRow(entry, { observation: lead, severity: 'medium' });
        }
        return;
      }

      const rejectSummary = String(comments).match(/Rejected with observations:\s*(.+?)$/i);
      if (rejectSummary) {
        const text = rejectSummary[1].trim();
        if (text) pushRow(entry, { observation: text, severity: 'medium' });
        return;
      }

      const returnSummary = String(comments).match(/Returned from Pre Audit with observations:\s*(.+?)(?:\.\s*Observations:|$)/i);
      if (returnSummary) {
        pushRow(entry, { observation: returnSummary[1].trim(), severity: 'medium' });
        return;
      }

      const returnPayments = String(comments).match(/Returned from Payments with observations:\s*(.+?)(?:\.\s*Observations:|$)/i);
      if (returnPayments) {
        pushRow(entry, { observation: returnPayments[1].trim(), severity: 'medium' });
        return;
      }

      if (lower.includes('observation') || lower.includes('rejected')) {
        pushRow(entry, { observation: String(comments), severity: 'medium' });
      }
    });

    primary = parsed;
  }

  const merged = [...departmentRows];
  const seenTexts = new Set(merged.map((row) => String(row.observation || '').trim()));
  primary.forEach((row) => {
    const text = String(row.observation || '').trim();
    if (!text || seenTexts.has(text)) return;
    seenTexts.add(text);
    merged.push(row);
  });

  return merged;
}

/** Payment settlement / admin list view — alias for shared feedback extraction. */
export function getObservationsForSettlementView(settlement) {
  return getWorkflowFeedbackObservations(settlement);
}

/** True while the document is in the Pre-Audit / director queue and must not be edited (exact + common prefixed statuses). */
export function isWorkflowAuditBlockingEditStatus(status) {
  const s = String(status || '');
  if (!s) return false;
  if (['Send to Audit', 'Forwarded to Audit Director'].includes(s)) return true;
  if (/^Approved \(from Send to Audit/.test(s)) return true;
  if (/^Approved \(from Forwarded to Audit Director/.test(s)) return true;
  return false;
}

/** Workflow status used for audit feedback panels (utility bills use auditStatus). */
export function getWorkflowAuditStatusLabel(doc) {
  if (!doc) return '';
  return doc.auditStatus || doc.workflowStatus || doc.status || '';
}
