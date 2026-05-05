import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Chip,
  Stack,
  Button,
  Tabs,
  Tab
} from '@mui/material';
import { DigitalSignatureImage } from '../common/DigitalSignatureImage';
import ComparativeStatementView from './ComparativeStatementView';
import QuotationDetailView from './QuotationDetailView';
import { formatPKR } from '../../utils/currency';

const formatDateForPrint = (date) => {
  if (!date) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(date);
  return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0.00';
  return parseFloat(num).toFixed(2);
};

const formatDateTime = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const renderIndentApprovalProgress = (indent, { title = 'Indent approval progress' } = {}) => {
  if (!indent) return null;
  const steps = Array.isArray(indent.approvalChain) ? indent.approvalChain : [];
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {steps.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No indent approval chain is recorded for this requisition.
        </Typography>
      ) : (
        <Table size="small" sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 760 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700 }}>Approver</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date &amp; time</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="center">Digital signature</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {steps.map((step, idx) => {
              const approver = step.approver;
              const aid = approver?._id || approver;
              const name =
                [approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() ||
                approver?.email ||
                (aid ? `User ${String(aid).slice(-6)}` : `Approver ${idx + 1}`);
              const status = step.status || 'pending';
              const chipColor = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning';
              const chipLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending approval';
              return (
                <TableRow key={String(aid || idx)}>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={chipLabel} color={chipColor} variant={status === 'pending' ? 'outlined' : 'filled'} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(step?.actedAt)}
                  </TableCell>
                  <TableCell align="center">
                    {status === 'approved' && approver?.digitalSignature ? (
                      <DigitalSignatureImage userOrPath={approver} alt={`Signature ${name}`} />
                    ) : status === 'approved' ? (
                      <Typography variant="caption" color="text.secondary">No signature on file</Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

const CashApprovalDetailTabsView = ({
  cashApproval,
  tabValue = 0,
  onTabChange,
  quotations = [],
  linkedDocs = []
}) => {
  if (!cashApproval) return null;
  return (
    <>
      <Tabs
        value={tabValue}
        onChange={(_, v) => onTabChange?.(v)}
        sx={{ px: 2, pt: 1, borderBottom: 1, borderColor: 'divider', '@media print': { display: 'none' } }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Indent" />
        <Tab label="Cash Approval" />
        <Tab label="Comparative Statement" />
        <Tab label={`Quotations (${quotations?.length || 0})`} />
        <Tab label={`Linked Documents (${linkedDocs?.length || 0})`} />
      </Tabs>

      {tabValue === 0 && (
        <Box sx={{ p: 2, overflowX: 'auto' }}>
          {!cashApproval?.indent ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No indent linked to this Cash Approval.
            </Typography>
          ) : (
            <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h5" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: 1 }}>
                Purchase Request Form
              </Typography>
              {cashApproval.indent.title && (
                <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2 }}>
                  {cashApproval.indent.title}
                </Typography>
              )}
              <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
                <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
                <Typography component="span" sx={{ ml: 1 }}>
                  {cashApproval.indent.erpRef || 'PR #' + (cashApproval.indent.indentNumber?.split('-').pop() || '')}
                </Typography>
              </Box>
              <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Box><Typography component="span" fontWeight={600}>Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(cashApproval.indent.requestedDate)}</Typography></Box>
                <Box><Typography component="span" fontWeight={600}>Required Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(cashApproval.indent.requiredDate) || '—'}</Typography></Box>
                <Box><Typography component="span" fontWeight={600}>Indent No.:</Typography><Typography component="span" sx={{ ml: 1 }}>{cashApproval.indent.indentNumber || '—'}</Typography></Box>
              </Box>
              <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Box><Typography component="span" fontWeight={600}>Department:</Typography><Typography component="span" sx={{ ml: 1 }}>{cashApproval.indent.department?.name || cashApproval.indent.department || '—'}</Typography></Box>
                <Box><Typography component="span" fontWeight={600}>Originator:</Typography><Typography component="span" sx={{ ml: 1 }}>{cashApproval.indent.requestedBy?.firstName && cashApproval.indent.requestedBy?.lastName ? `${cashApproval.indent.requestedBy.firstName} ${cashApproval.indent.requestedBy.lastName}` : cashApproval.indent.requestedBy?.name || '—'}</Typography></Box>
              </Box>
              <Box sx={{ mb: 3 }}>
                <Table size="small" sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>S#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Item Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Brand</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Unit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="center">Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }}>Purpose</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', border: '1px solid', borderColor: 'divider' }} align="right">Est. Cost</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(cashApproval.indent.items || []).map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{idx + 1}</TableCell>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.itemName || '—'}</TableCell>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.description || '—'}</TableCell>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.brand || '—'}</TableCell>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.unit || '—'}</TableCell>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="center">{item.quantity ?? '—'}</TableCell>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }}>{item.purpose || '—'}</TableCell>
                        <TableCell sx={{ border: '1px solid', borderColor: 'divider' }} align="right">{item.estimatedCost != null ? Number(item.estimatedCost).toFixed(2) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              {cashApproval.indent.justification && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Justification:</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    {cashApproval.indent.justification}
                  </Typography>
                </Box>
              )}
              {renderIndentApprovalProgress(cashApproval.indent, {
                title: 'Indent approval progress'
              })}
            </Paper>
          )}
        </Box>
      )}

      {tabValue === 1 && (
        <Paper sx={{ p: 4, maxWidth: '210mm', mx: 'auto', backgroundColor: '#fff', boxShadow: 'none', border: '1px solid', borderColor: 'divider', '@media print': { p: 2.5, maxWidth: '100%', mx: 0 } }}>
          <Typography variant="h5" align="center" fontWeight={700} sx={{ mb: 2, letterSpacing: 1 }}>
            CASH APPROVAL
          </Typography>
          <Box sx={{ mb: 1.5, fontSize: '0.9rem', textAlign: 'center' }}>
            <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
            <Typography component="span" sx={{ ml: 1 }}>
              {cashApproval?.indent?.erpRef || cashApproval?.caNumber || '—'}
            </Typography>
          </Box>
          <Box sx={{ mb: 1.5, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Box><Typography component="span" fontWeight={600}>CA Number:</Typography><Typography component="span" sx={{ ml: 1 }}>{cashApproval.caNumber || '—'}</Typography></Box>
            <Box><Typography component="span" fontWeight={600}>Date:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(cashApproval.approvalDate)}</Typography></Box>
            <Box><Typography component="span" fontWeight={600}>Status:</Typography><Typography component="span" sx={{ ml: 1 }}>{cashApproval.status || '—'}</Typography></Box>
          </Box>
          <Box sx={{ mb: 3, fontSize: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Box><Typography component="span" fontWeight={600}>Vendor:</Typography><Typography component="span" sx={{ ml: 1 }}>{cashApproval.vendor?.name || '—'}</Typography></Box>
            <Box><Typography component="span" fontWeight={600}>Expected Purchase:</Typography><Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(cashApproval.expectedPurchaseDate) || '—'}</Typography></Box>
            <Box><Typography component="span" fontWeight={600}>Total:</Typography><Typography component="span" sx={{ ml: 1, fontWeight: 700 }}>{formatPKR(cashApproval.totalAmount)}</Typography></Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Items</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(cashApproval.items || []).map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell align="right">{row.quantity}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell align="right">{formatPKR(row.unitPrice)}</TableCell>
                    <TableCell align="right">{formatPKR(row.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Approval authorities</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Authority</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Approver</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date &amp; Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="center">Digital Signature</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const authorityRows = [
                    { key: 'preparedBy', label: 'Prepared By' },
                    { key: 'verifiedBy', label: 'Verified By (Procurement Committee)' },
                    { key: 'authorisedRep', label: 'Authorised Rep.' },
                    { key: 'financeRep', label: 'Finance Rep.' },
                    { key: 'managerProcurement', label: 'Manager Procurement' }
                  ];
                  if (cashApproval?.preAuditInitialApprovedBy || cashApproval?.preAuditInitialApprovedAt) {
                    authorityRows.push({
                      label: 'Pre-Audit Initial Approval',
                      directApproval: true,
                      approver: cashApproval.preAuditInitialApprovedBy || null,
                      approvedAt: cashApproval.preAuditInitialApprovedAt || null
                    });
                  }
                  if (cashApproval?.auditApprovedBy || cashApproval?.auditApprovedAt) {
                    authorityRows.push({
                      label: 'Audit Final Approval',
                      directApproval: true,
                      approver: cashApproval.auditApprovedBy || null,
                      approvedAt: cashApproval.auditApprovedAt || null
                    });
                  }
                  const authorityApprovals = Array.isArray(cashApproval?.authorityApprovals)
                    ? cashApproval.authorityApprovals
                    : [];
                  const byKey = new Map(
                    authorityApprovals
                      .map((a) => [String(a?.authorityKey || '').trim(), a])
                      .filter(([k]) => Boolean(k))
                  );
                  const normalizeToken = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
                  const legacyApprover = cashApproval?.authorityApprovedBy;
                  const legacyAt = cashApproval?.authorityApprovedAt;
                  const legacyTokens = [
                    [legacyApprover?.firstName, legacyApprover?.lastName].filter(Boolean).join(' ').trim(),
                    legacyApprover?.email,
                    legacyApprover?.employeeId
                  ].map(normalizeToken).filter(Boolean);
                  let legacyApplied = false;
                  return authorityRows.map((row) => {
                    const explicitApproval = row?.key ? byKey.get(row.key) : null;
                    let approver = row?.directApproval
                      ? row.approver
                      : (explicitApproval?.approver && typeof explicitApproval.approver === 'object'
                        ? explicitApproval.approver
                        : null);
                    let approvedAt = row?.directApproval ? (row.approvedAt || null) : (explicitApproval?.approvedAt || null);
                    const assignedText = (cashApproval?.approvalAuthorities || {})[row.key] || '';
                    const assignedToken = normalizeToken(assignedText);
                    const legacyMatch = assignedToken && legacyTokens.some((t) => t === assignedToken || t.includes(assignedToken) || assignedToken.includes(t));
                    if (!row?.directApproval && !explicitApproval && !legacyApplied && legacyApprover && legacyAt && legacyMatch) {
                      approver = legacyApprover;
                      approvedAt = legacyAt;
                      legacyApplied = true;
                    }
                    const approverName = approver
                      ? ([approver?.firstName, approver?.lastName].filter(Boolean).join(' ').trim() || approver?.email || assignedText || '—')
                      : (assignedText || '—');
                    const isApproved = Boolean(approvedAt);
                    return (
                      <TableRow key={row.key || row.label}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell>{approverName}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={isApproved ? 'Approved' : 'Pending'}
                            color={isApproved ? 'success' : 'warning'}
                            variant={isApproved ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell>{approvedAt ? new Date(approvedAt).toLocaleString() : '—'}</TableCell>
                        <TableCell align="center">
                          {isApproved && approver?.digitalSignature ? (
                            <DigitalSignatureImage userOrPath={approver} alt={`${row.label} signature`} />
                          ) : isApproved ? (
                            <Typography variant="caption" color="text.secondary">No signature on file</Typography>
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {tabValue === 2 && (
        <Box sx={{ p: 2, overflowX: 'auto' }}>
          <ComparativeStatementView
            requisition={cashApproval?.indent}
            quotations={quotations || []}
            approvalAuthority={cashApproval?.indent?.comparativeStatementApprovals || {}}
            note={cashApproval?.indent?.notes ?? ''}
            readOnly
            formatNumber={formatNumber}
            loadingQuotations={false}
            showPrintButton={false}
          />
        </Box>
      )}

      {tabValue === 3 && (
        <Box sx={{ p: 2 }}>
          {(!quotations || quotations.length === 0) ? (
            <Typography color="text.secondary">No quotations for this requisition.</Typography>
          ) : (
            <Stack spacing={4}>
              {quotations.map((q) => (
                <QuotationDetailView
                  key={q._id}
                  quotation={q}
                  formatNumber={formatNumber}
                  formatDateForPrint={formatDateForPrint}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}

      {tabValue === 4 && (
        <Box sx={{ p: 2 }}>
          {(!linkedDocs || linkedDocs.length === 0) ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No linked documents found for this Cash Approval.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Document</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linkedDocs.map((doc, idx) => (
                    <TableRow key={doc.id || idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{doc.source || 'Attachment'}</TableCell>
                      <TableCell>{doc.name || 'Document'}</TableCell>
                      <TableCell>{doc.uploadedAt ? formatDateTime(doc.uploadedAt) : '—'}</TableCell>
                      <TableCell align="right">
                        {doc.url ? (
                          <Button size="small" variant="outlined" onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}>
                            Open
                          </Button>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </>
  );
};

export default CashApprovalDetailTabsView;
