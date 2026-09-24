/**
 * Build a chronological full workflow trail for a Finance vendor bill,
 * merging related Indent / PO / Cash Approval / Utility Bill / AP steps.
 */

const tagEntries = (entries, defaultModule) =>
  (Array.isArray(entries) ? entries : [])
    .filter(Boolean)
    .map((e) => ({
      fromStatus: e.fromStatus || '—',
      toStatus: e.toStatus || e.status || '—',
      changedBy: e.changedBy || null,
      changedAt: e.changedAt || e.actedAt || e.date || null,
      comments: e.comments || e.observation || e.remarks || '',
      module: e.module || defaultModule,
      approvalStamp: e.approvalStamp || e.stampImage || undefined,
      digitalSignature: e.digitalSignature || undefined,
      stampUsed: e.stampUsed,
      stampImage: e.stampImage
    }));

/** Mirror of procurement indent trail so bill details match PO history. */
const buildIndentWorkflowHistory = (indent) => {
  if (!indent) return [];
  const entries = [];
  const createdAt = indent.createdAt || indent.updatedAt;
  const createdBy = indent.createdBy;

  entries.push({
    fromStatus: '—',
    toStatus: 'Draft',
    changedBy: createdBy,
    changedAt: createdAt,
    comments: 'Indent created',
    module: 'Indent'
  });

  if (
    indent.status &&
    indent.status !== 'Draft' &&
    !['Approved', 'Rejected', 'Rejected in Procurement', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'].includes(
      indent.status
    )
  ) {
    entries.push({
      fromStatus: 'Draft',
      toStatus: indent.status === 'Submitted' ? 'Submitted' : 'Under Review',
      changedBy: indent.updatedBy || indent.requestedBy || createdBy,
      changedAt: indent.updatedAt || createdAt,
      comments: indent.status === 'Submitted' ? 'Indent submitted' : 'Indent under review',
      module: 'Indent'
    });
  }

  if (indent.status === 'Approved' && indent.approvedBy && indent.approvedDate) {
    entries.push({
      fromStatus: 'Under Review',
      toStatus: 'Approved',
      changedBy: indent.approvedBy,
      changedAt: indent.approvedDate,
      comments: 'Indent approved',
      module: 'Indent'
    });
  }

  if (indent.status === 'Rejected') {
    entries.push({
      fromStatus: 'Under Review',
      toStatus: 'Rejected',
      changedBy: indent.updatedBy || null,
      changedAt: indent.updatedAt || new Date(),
      comments: indent.rejectionReason || 'Indent rejected',
      module: 'Indent'
    });
  }

  if (indent.storeRoutingStatus === 'moved_to_procurement' && indent.movedToProcurementBy && indent.movedToProcurementAt) {
    entries.push({
      fromStatus: 'Approved',
      toStatus: 'Moved to Procurement',
      changedBy: indent.movedToProcurementBy,
      changedAt: indent.movedToProcurementAt,
      comments: indent.movedToProcurementReason || 'Moved to Procurement (requisition)',
      module: 'Indent'
    });
    entries.push({
      fromStatus: 'Moved to Procurement',
      toStatus: 'Requisition in Procurement',
      changedBy: indent.movedToProcurementBy,
      changedAt: indent.movedToProcurementAt,
      comments: 'Requisition available in Procurement for quotations',
      module: 'Requisition'
    });
  }

  // Prefer explicit workflowHistory when present (newer indents)
  const stored = tagEntries(indent.workflowHistory, 'Indent');
  if (stored.length) {
    const byKey = new Set(
      stored.map(
        (e) =>
          `${String(e.toStatus)}|${e.changedAt ? new Date(e.changedAt).getTime() : ''}|${String(
            e.changedBy?._id || e.changedBy || ''
          )}`
      )
    );
    const extras = entries.filter((e) => {
      const key = `${String(e.toStatus)}|${e.changedAt ? new Date(e.changedAt).getTime() : ''}|${String(
        e.changedBy?._id || e.changedBy || ''
      )}`;
      return !byKey.has(key);
    });
    return [...stored, ...extras];
  }

  return entries;
};

const buildUtilityBillSynthetic = (src) => {
  if (!src) return [];
  const entries = [];
  if (src.createdAt) {
    entries.push({
      fromStatus: '—',
      toStatus: 'Draft',
      changedBy: src.createdBy || null,
      changedAt: src.createdAt,
      comments: 'Utility / store bill created',
      module: 'Centralized Store'
    });
  }
  const chain = Array.isArray(src.approvalChain) ? src.approvalChain : [];
  chain.forEach((step) => {
    if (step.status === 'approved' && step.approver) {
      entries.push({
        fromStatus: 'Pending Approval',
        toStatus: 'Manager / HOD Approved',
        changedBy: step.approver,
        changedAt: step.actedAt || src.approvedAt,
        comments: step.comment || 'Department approval',
        module: 'Centralized Store'
      });
    }
  });
  if (src.approvedBy && src.approvedAt && !chain.some((s) => s.status === 'approved')) {
    entries.push({
      fromStatus: 'Pending Approval',
      toStatus: 'Approved',
      changedBy: src.approvedBy,
      changedAt: src.approvedAt,
      comments: 'Bill approved',
      module: 'Centralized Store'
    });
  }
  return entries;
};

const buildFinanceBillSynthetic = (bill) => {
  if (!bill) return [];
  const entries = [];
  if (bill.createdAt) {
    entries.push({
      fromStatus: '—',
      toStatus: 'Bill Created',
      changedBy: bill.createdBy || null,
      changedAt: bill.createdAt,
      comments: bill.billNumber ? `Vendor bill ${bill.billNumber} created in Finance` : 'Vendor bill created in Finance',
      module: 'Finance'
    });
  }
  if (bill.approval?.approvedBy && bill.approval?.approvedDate) {
    entries.push({
      fromStatus: bill.status || 'Open',
      toStatus: 'Finance Approved',
      changedBy: bill.approval.approvedBy,
      changedAt: bill.approval.approvedDate,
      comments: bill.approval.comments || 'Approved by Finance',
      module: 'Finance'
    });
  }
  if (Array.isArray(bill.financeApprovalAuthorities)) {
    bill.financeApprovalAuthorities.forEach((auth) => {
      if (auth.actedAt || auth.status === 'approved') {
        entries.push({
          fromStatus: 'Pending Finance Authority',
          toStatus: auth.status === 'rejected' ? 'Finance Authority Rejected' : 'Finance Authority Approved',
          changedBy: auth.assignedUser || null,
          changedAt: auth.actedAt || null,
          comments: auth.levelName || auth.levelKey || auth.comments || 'Finance authority action',
          module: 'Finance'
        });
      }
    });
  }
  if (Array.isArray(bill.payments)) {
    bill.payments.forEach((p) => {
      if (!p?.paymentDate && !p?.amount) return;
      entries.push({
        fromStatus: bill.status || 'Open',
        toStatus: 'Payment Recorded',
        changedBy: p.recordedBy || p.createdBy || null,
        changedAt: p.paymentDate || p.createdAt || null,
        comments: `Payment ${p.paymentMethod || ''} ${p.reference ? `(${p.reference})` : ''}`.trim(),
        module: 'Finance'
      });
    });
  }
  if ((Number(bill.advanceApplied) || 0) > 0) {
    entries.push({
      fromStatus: bill.status || 'Open',
      toStatus: 'Advance Applied',
      changedBy: bill.lastModifiedBy || bill.createdBy || null,
      changedAt: bill.updatedAt || bill.createdAt || null,
      comments: `Advance applied: ${bill.advanceApplied}`,
      module: 'Finance'
    });
  }
  return entries;
};

/**
 * @param {object} opts
 * @param {object} opts.bill - AP bill (lean)
 * @param {object|null} opts.indent
 * @param {object|null} opts.po
 * @param {object|null} opts.cashApproval
 * @param {object|null} opts.sourceUtilityBill
 */
const buildVendorBillFullWorkflowHistory = ({
  bill,
  indent = null,
  po = null,
  cashApproval = null,
  sourceUtilityBill = null
} = {}) => {
  const merged = [];

  if (indent) {
    merged.push(...buildIndentWorkflowHistory(indent));
  }

  if (po) {
    const poHistory = tagEntries(po.workflowHistory, 'Procurement');
    if (poHistory.length) {
      merged.push(...poHistory);
    }
  }

  if (cashApproval) {
    merged.push(...tagEntries(cashApproval.workflowHistory, 'Cash Approval'));
  }

  if (sourceUtilityBill) {
    const utilHist = tagEntries(sourceUtilityBill.workflowHistory, 'Centralized Store');
    if (utilHist.length) {
      merged.push(...utilHist);
    } else {
      merged.push(...buildUtilityBillSynthetic(sourceUtilityBill));
    }
  }

  const apHist = tagEntries(bill?.workflowHistory, 'Finance');
  if (apHist.length) {
    merged.push(...apHist);
  } else {
    merged.push(...buildFinanceBillSynthetic(bill));
  }

  // If AP already had history, still append payment/advance steps not already present
  if (apHist.length) {
    const paymentSteps = buildFinanceBillSynthetic(bill).filter((e) =>
      ['Payment Recorded', 'Advance Applied', 'Finance Approved', 'Bill Created'].includes(e.toStatus)
    );
    const existingKeys = new Set(
      merged.map(
        (e) =>
          `${e.toStatus}|${e.changedAt ? new Date(e.changedAt).getTime() : ''}|${String(e.module || '')}`
      )
    );
    paymentSteps.forEach((e) => {
      const key = `${e.toStatus}|${e.changedAt ? new Date(e.changedAt).getTime() : ''}|${String(e.module || '')}`;
      if (!existingKeys.has(key)) merged.push(e);
    });
  }

  return merged
    .filter((e) => e && (e.toStatus || e.comments))
    .sort((a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0));
};

module.exports = {
  buildVendorBillFullWorkflowHistory,
  buildIndentWorkflowHistory,
  tagEntries
};
