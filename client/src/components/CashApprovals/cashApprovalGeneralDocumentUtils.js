import { getImageUrl } from '../../utils/imageService';
import { normalizeUploadPath, resolveUploadFileHref } from '../../utils/uploadPaths';

export { normalizeUploadPath };

export const isGeneralModuleCashApproval = (ca) =>
  String(ca?.originatingModule || '').toLowerCase() === 'general';

export const formatInvoiceDateDmy = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/ /g, '-');
};

export const formatInvoiceTime12h = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDecimalPk = (amount) =>
  new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));

export const userDisplayName = (user) => {
  if (!user) return '';
  if (typeof user === 'string') return user;
  return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || user.employeeId || '';
};

export const getSignatureSource = (row) =>
  row?.signaturePath || row?.signatureUser?.digitalSignature || row?.signatureUser?.approvalStamp || '';

/** Public URL for files under /uploads (cash approval line attachments, etc.) */
export const resolveUploadPublicUrl = (relativePath) =>
  resolveUploadFileHref(relativePath) || '';

export const getStatusColor = (status) => {
  if (status === 'Draft') return 'default';
  if (status === 'Pending Approval') return 'warning';
  if (['Pending Audit', 'Forwarded to Audit Director'].includes(status)) return 'info';
  if (['Completed', 'Advance Issued', 'Payment Settled', 'Finance Authority Approved'].includes(status)) {
    return 'success';
  }
  if (['Rejected', 'Cancelled'].includes(status)) return 'error';
  return 'primary';
};

export const advanceEmployeeLabel = (ca) => {
  const emp = ca?.advanceToEmployee;
  const name = ca?.advanceToName || userDisplayName(emp) || userDisplayName(ca?.advanceTo);
  const code = emp?.employeeId ? ` (${emp.employeeId})` : '';
  return `${name}${code}`.trim() || '—';
};

export const buildGeneralCashApprovalApprovalRows = (ca) => {
  if (!ca) return [];
  const chain = ca.departmentApprovalChain || [];
  const history = Array.isArray(ca.workflowHistory) ? [...ca.workflowHistory].reverse() : [];
  const normalize = (v) => String(v || '').trim().toLowerCase();

  const isDepartmentSentToAuditQueue = (entry) => {
    const from = normalize(entry?.fromStatus);
    const to = normalize(entry?.toStatus);
    if (from !== 'pending approval' || to !== 'pending audit') return false;
    const comments = normalize(entry?.comments);
    return (
      comments.includes('manager / hod') ||
      comments.includes('sent to pre-audit after') ||
      comments.includes('approval authority approved')
    );
  };

  const matchingAuditHistory = (keywords) =>
    history.filter((entry) => {
      if (isDepartmentSentToAuditQueue(entry)) return false;
      const to = normalize(entry?.toStatus);
      return keywords.some((keyword) => to === keyword || to.startsWith(keyword));
    });

  const findPreferredAuditEntry = (keywords) => {
    const entries = matchingAuditHistory(keywords);
    return (
      entries.find((e) => e?.stampUsed && e?.stampImage) ||
      entries.find((e) => e?.changedBy?.digitalSignature) ||
      entries[0] ||
      null
    );
  };

  const preAuditFromHistory = findPreferredAuditEntry([
    'forwarded to audit director',
    'initial audit approval',
    'pending audit'
  ]);
  const preAuditActor = preAuditFromHistory?.changedBy || ca.preAuditInitialApprovedBy || null;
  const preAuditAt = preAuditFromHistory?.changedAt || ca.preAuditInitialApprovedAt;

  const directorFromHistory = findPreferredAuditEntry([
    'approved (from forwarded to audit director)',
    'approved (from send to audit)',
    'send to ceo office',
    'pending finance'
  ]);
  const directorActor = directorFromHistory?.changedBy || ca.auditApprovedBy || null;
  const directorAt = directorFromHistory?.changedAt || ca.auditApprovedAt;

  const ceoSecretariatActor = ca.ceoForwardedBy || null;
  const ceoActor = ca.ceoApprovedBy || null;
  const ceoTypedSignature =
    ca.ceoDigitalSignature &&
    !String(ca.ceoDigitalSignature).startsWith('/') &&
    !String(ca.ceoDigitalSignature).startsWith('http')
      ? String(ca.ceoDigitalSignature).trim()
      : '';
  const ceoImageSignature =
    (ca.ceoDigitalSignature && String(ca.ceoDigitalSignature).startsWith('/')
      ? ca.ceoDigitalSignature
      : '') || ceoActor?.digitalSignature || '';

  return [
    {
      authority: 'Sig of Requester',
      name: userDisplayName(ca.createdBy),
      signatureUser: ca.createdBy,
      dateTime: formatDateTime(ca.createdAt)
    },
    {
      authority: 'Manager Approver',
      name: userDisplayName(chain[0]?.approver),
      signatureUser: chain[0]?.status === 'approved' ? chain[0]?.approver : null,
      dateTime: chain[0]?.status === 'approved' ? formatDateTime(chain[0]?.actedAt) : '—'
    },
    {
      authority: 'Head Of Department Approver',
      name: userDisplayName(chain[1]?.approver),
      signatureUser: chain[1]?.status === 'approved' ? chain[1]?.approver : null,
      dateTime: chain[1]?.status === 'approved' ? formatDateTime(chain[1]?.actedAt) : '—'
    },
    {
      authority: 'Pre-Audit Authority',
      name: preAuditActor ? userDisplayName(preAuditActor) : '—',
      signatureUser: preAuditActor || null,
      signaturePath:
        preAuditFromHistory?.stampUsed && preAuditFromHistory?.stampImage
          ? preAuditFromHistory.stampImage
          : preAuditActor?.digitalSignature || '',
      dateTime: preAuditActor ? formatDateTime(preAuditAt) : '—'
    },
    {
      authority: 'Audit Director',
      name: directorActor ? userDisplayName(directorActor) : '—',
      signatureUser: directorActor || null,
      signaturePath:
        directorFromHistory?.stampUsed && directorFromHistory?.stampImage
          ? directorFromHistory.stampImage
          : directorActor?.digitalSignature || '',
      dateTime: directorActor ? formatDateTime(directorAt) : '—'
    },
    {
      authority: 'PS to CEO',
      name: ceoSecretariatActor ? userDisplayName(ceoSecretariatActor) : '—',
      signatureUser: ceoSecretariatActor || null,
      dateTime: ceoSecretariatActor && ca.ceoForwardedAt ? formatDateTime(ca.ceoForwardedAt) : '—'
    },
    {
      authority: 'CEO',
      name: ceoActor ? userDisplayName(ceoActor) : '—',
      signatureUser: ceoActor || null,
      signaturePath: ceoImageSignature,
      typedSignature: ceoTypedSignature,
      dateTime: ceoActor && ca.ceoApprovedAt ? formatDateTime(ca.ceoApprovedAt) : '—'
    }
  ];
};

export const buildGeneralCashApprovalStampRows = (ca) => {
  if (!ca) return [];
  const history = Array.isArray(ca.workflowHistory) ? [...ca.workflowHistory].reverse() : [];
  const normalize = (v) => String(v || '').trim().toLowerCase();
  const isDepartmentSentToAuditQueue = (entry) => {
    const from = normalize(entry?.fromStatus);
    const to = normalize(entry?.toStatus);
    if (from !== 'pending approval' || to !== 'pending audit') return false;
    const comments = normalize(entry?.comments);
    return comments.includes('manager / hod') || comments.includes('sent to pre-audit after');
  };
  const findStamp = (accepted) =>
    history.find(
      (e) =>
        !isDepartmentSentToAuditQueue(e) &&
        e?.stampUsed &&
        e?.stampImage &&
        accepted.some((k) => {
          const to = normalize(e?.toStatus);
          return to === k || to.startsWith(k);
        })
    );
  const preAuditStamp = findStamp([
    'forwarded to audit director',
    'initial audit approval',
    'pending audit'
  ]);
  const directorStamp = findStamp([
    'approved (from forwarded to audit director)',
    'approved (from send to audit)',
    'send to ceo office',
    'pending finance'
  ]);
  return [
    {
      authority: 'Pre-Audit Authority Stamp',
      stampImage: preAuditStamp?.stampImage,
      dateTime: formatDateTime(preAuditStamp?.changedAt)
    },
    {
      authority: 'Audit Director Stamp',
      stampImage: directorStamp?.stampImage,
      dateTime: formatDateTime(directorStamp?.changedAt)
    }
  ].filter((r) => r.stampImage);
};

export const buildGeneralCashApprovalPrintHtml = (ca) => {
  if (!ca) return '';
  const linesTotal = (ca.items || []).reduce((s, li) => s + (Number(li.amount) || 0), 0);
  const approvalRows = buildGeneralCashApprovalApprovalRows(ca);
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const rows = (ca.items || [])
    .map((line, i) => {
      const amt = Number(line.amount) || 0;
      const qty = Number(line.quantity) || 1;
      const rate = Number(line.unitPrice) || amt;
      return `<tr>
          <td class="c">${i + 1}</td>
          <td>${esc(line.itemName || line.description)}</td>
          <td>${esc(line.specification || line.description)}</td>
          <td>${esc(line.location || '—')}</td>
          <td class="c">${esc(line.unit || 'pcs')}</td>
          <td class="r">${formatDecimalPk(qty)}</td>
          <td class="r">${formatDecimalPk(rate)}</td>
          <td class="r">${formatDecimalPk(amt)}</td>
        </tr>`;
    })
    .join('');
  const approvalHtml = approvalRows
    .map(
      (row) => `<tr>
          <td>${esc(row.authority)}</td>
          <td>${esc(row.name || '—')}</td>
          <td>${getSignatureSource(row) ? '<em>Signed</em>' : '—'}</td>
          <td>${esc(row.dateTime || '—')}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><title>${esc(ca.caNumber)}</title>
      <style>
        body{font-family:Georgia,serif;padding:24px;color:#111;font-size:12px}
        h1,h2{text-align:center;margin:0}
        h2{font-size:16px;margin-top:4px}
        .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin:16px 0;padding-bottom:12px;border-bottom:1px solid #999}
        .meta div{display:grid;grid-template-columns:100px 1fr;gap:4px}
        .meta b{color:#444}
        .narration{background:#ffe7c2;border:1px solid #e8b86a;padding:10px;margin-bottom:14px;font-weight:700}
        table{width:100%;border-collapse:collapse;margin-bottom:12px}
        th,td{border:1px solid #666;padding:6px}
        th{background:#f0f0f0;font-size:11px}
        .r{text-align:right}.c{text-align:center}
        .total{text-align:right;font-weight:800;font-size:14px;margin-top:8px}
      </style></head><body>
      <h1>${esc(ca.requestingDepartment || 'General')}</h1>
      <h2>Cash Approval</h2>
      <div class="meta">
        <div><b>Date</b><span>${formatInvoiceDateDmy(ca.approvalDate || ca.createdAt)}</span></div>
        <div><b>Reference</b><span>${esc(ca.caNumber)}</span></div>
        <div><b>Department</b><span>${esc(ca.requestingDepartment)}</span></div>
        <div><b>Priority</b><span>${esc(ca.priority)}</span></div>
        <div><b>Advance to</b><span>${esc(advanceEmployeeLabel(ca))}</span></div>
        <div><b>GL account</b><span>${esc(ca.advanceGlAccount?.accountNumber || ca.advanceGlAccountNumber || '—')}</span></div>
        <div><b>Time</b><span>${formatInvoiceTime12h(ca.createdAt)}</span></div>
      </div>
      <div class="narration">Narration: ${esc(ca.purpose)}</div>
      <table><thead><tr>
        <th>S.No</th><th>Item</th><th>Description</th><th>Location</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Net Amount</th>
      </tr></thead><tbody>${rows}
      <tr><td colspan="7" class="r"><b>Sub Total</b></td><td class="r"><b>${formatDecimalPk(linesTotal)}</b></td></tr>
      </tbody></table>
      <p class="total">Net Total: ${formatDecimalPk(ca.totalAmount || linesTotal)}</p>
      <table><thead><tr><th>Authority</th><th>Name</th><th>Signature</th><th>Date &amp; Time</th></tr></thead>
      <tbody>${approvalHtml}</tbody></table>
      </body></html>`
};

export const printGeneralCashApproval = (ca, onError) => {
  const html = buildGeneralCashApprovalPrintHtml(ca);
  const w = window.open('', '_blank');
  if (!w) {
    onError?.('Allow pop-ups to print');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
    w.close();
  }, 400);
};

export const documentPaperSx = {
  maxWidth: 1050,
  mx: 'auto',
  p: { xs: 2.25, md: 5 },
  bgcolor: 'background.paper',
  color: '#151515',
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: 'grey.200',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)'
};

export const lineTableSx = {
  border: '1px solid',
  borderColor: 'grey.500',
  '& th': {
    bgcolor: 'grey.100',
    border: '1px solid',
    borderColor: 'grey.500',
    fontSize: 11,
    fontWeight: 800,
    textAlign: 'center',
    lineHeight: 1.2,
    py: 1,
    px: 0.5
  },
  '& td': {
    border: '1px solid',
    borderColor: 'grey.400',
    fontSize: 12,
    py: 1,
    px: 0.75,
    verticalAlign: 'top'
  }
};

export const approvalTableSx = {
  mt: 7,
  border: '1px solid',
  borderColor: 'grey.300',
  '& th': {
    bgcolor: 'grey.100',
    fontWeight: 800,
    fontSize: 14,
    borderBottom: '1px solid',
    borderColor: 'grey.300'
  },
  '& td': {
    fontSize: 14,
    borderBottom: '1px solid',
    borderColor: 'grey.200',
    py: 1.4
  },
  '& tr:last-child td': {
    borderBottom: 0
  }
};
