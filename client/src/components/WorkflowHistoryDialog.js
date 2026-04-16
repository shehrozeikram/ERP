import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip
} from '@mui/material';
import {
  History as HistoryIcon,
  ArrowForward as ArrowForwardIcon,
  WarningAmber as WarningAmberIcon
} from '@mui/icons-material';

const formatDateForDocument = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getHeldInfo = (entry) => {
  if (!entry?.changedAt) return null;
  const ts = new Date(entry.changedAt).getTime();
  if (!Number.isFinite(ts)) return null;

  const status = String(entry.toStatus || '').toLowerCase();
  const terminalKeywords = ['approved', 'rejected', 'cancelled', 'fulfilled', 'paid', 'completed', 'closed'];
  if (terminalKeywords.some((k) => status.includes(k))) return null;

  const elapsedMs = Date.now() - ts;
  if (elapsedMs < DAY_IN_MS) return null;

  const days = Math.floor(elapsedMs / DAY_IN_MS);
  const hours = Math.floor((elapsedMs % DAY_IN_MS) / (60 * 60 * 1000));

  return { days, hours };
};

const getHeldDurationMs = (startAt, endAt) => {
  if (!startAt || !endAt) return null;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return end - start;
};

const formatHeldDuration = (durationMs) => {
  if (durationMs == null) return 'Held: N/A';
  const totalMinutes = Math.floor(durationMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Held: ${days}d ${hours}h ${minutes}m`;
  }
  return `Held: ${hours}h ${minutes}m (<1 day)`;
};

const getHoldSeverity = (days) => {
  if (days >= 3) return 'critical';
  if (days >= 2) return 'high';
  return 'warning';
};

const holdSeverityStyles = {
  warning: {
    bg: '#fffaf0',
    border: '#f59e0b',
    text: '#92400e',
    chipColor: 'warning',
    badgeBg: '#fef3c7'
  },
  high: {
    bg: '#fff4f3',
    border: '#f97316',
    text: '#9a3412',
    chipColor: 'error',
    badgeBg: '#ffedd5'
  },
  critical: {
    bg: '#fef2f2',
    border: '#dc2626',
    text: '#991b1b',
    chipColor: 'error',
    badgeBg: '#fee2e2'
  }
};

const WorkflowHistoryDialog = ({ open, onClose, document, documentType = 'document' }) => {
  // Use fullWorkflowHistory when present (e.g. PO with related indent: indent flow then PO flow); otherwise workflowHistory
  const rawHistory = document?.fullWorkflowHistory ?? document?.workflowHistory ?? [];
  // Sort by changedAt so full flow is in chronological order (backend may not always send sorted)
  const workflowHistory = [...rawHistory].sort((a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0));
  const referenceNumber = document?.referenceNumber || document?.documentNumber || document?.orderNumber || 'N/A';
  const title = documentType === 'settlement' ? 'Payment Settlement' : 
                documentType === 'preAudit' ? 'Pre Audit Document' : 
                document?.orderNumber ? 'Purchase Order' : 'Document';
  const currentStatus = String(
    document?.workflowStatus ||
    document?.status ||
    ''
  ).trim();

  // Identify the active stage by current status (latest matching transition); fallback to last entry.
  const activeEntryIndex = (() => {
    if (!workflowHistory.length) return -1;
    if (!currentStatus) return workflowHistory.length - 1;
    for (let i = workflowHistory.length - 1; i >= 0; i -= 1) {
      if (String(workflowHistory[i]?.toStatus || '').trim() === currentStatus) {
        return i;
      }
    }
    return workflowHistory.length - 1;
  })();

  const latestEntry = activeEntryIndex >= 0 ? workflowHistory[activeEntryIndex] : null;
  const latestHeldInfo = getHeldInfo(latestEntry);
  const latestHoldSeverity = latestHeldInfo ? getHoldSeverity(latestHeldInfo.days) : null;
  const latestHoldStyle = latestHoldSeverity ? holdSeverityStyles[latestHoldSeverity] : null;
  const latestHandledBy = latestEntry?.changedBy
    ? `${latestEntry.changedBy.firstName || ''} ${latestEntry.changedBy.lastName || ''}`.trim()
    : '';

  const moduleColor = (module) => {
    if (!module) return 'default';
    if (module === 'Indent') return 'success';
    if (module === 'Requisition') return 'success'; // Procurement Requisition (indent in procurement)
    if (module === 'Procurement') return 'primary';
    if (module === 'Pre-Audit') return 'secondary';
    if (module === 'CEO Secretariat') return 'info';
    if (module === 'Finance') return 'warning';
    return 'default';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          '@keyframes holdPulse': {
            '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.45)' },
            '70%': { boxShadow: '0 0 0 8px rgba(211, 47, 47, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' }
          }
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6">Workflow History</Typography>
        </Box>
        {document && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {title} Reference: {referenceNumber}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {document?.orderNumber && document?.fullWorkflowHistory?.length
            ? 'Full flow: Indent → Requisition → Purchase Order (Procurement → Pre-Audit → CEO Secretariat)'
            : 'Full flow: Procurement → Pre-Audit → CEO Secretariat'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {workflowHistory.length > 0 ? (
          <Box sx={{ mt: 2 }}>
            {latestHeldInfo && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 1.5,
                  backgroundColor: latestHoldStyle.bg,
                  border: `1px solid ${latestHoldStyle.border}`,
                  borderLeft: `5px solid ${latestHoldStyle.border}`,
                  animation: latestHoldSeverity === 'critical' ? 'holdPulse 1.4s ease-in-out infinite' : 'none'
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
                  <WarningAmberIcon sx={{ color: latestHoldStyle.border, fontSize: 18 }} />
                  <Typography variant="body2" sx={{ color: latestHoldStyle.text, fontWeight: 800 }}>
                    Hold Alert
                  </Typography>
                  <Chip
                    size="small"
                    label={`${latestHeldInfo.days}d${latestHeldInfo.hours > 0 ? ` ${latestHeldInfo.hours}h` : ''}`}
                    sx={{
                      height: 22,
                      fontWeight: 700,
                      backgroundColor: latestHoldStyle.badgeBg,
                      color: latestHoldStyle.text,
                      border: `1px solid ${latestHoldStyle.border}`
                    }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: latestHoldStyle.text, fontWeight: 600 }}>
                  This document is pending for {latestHeldInfo.days} day{latestHeldInfo.days !== 1 ? 's' : ''}{latestHeldInfo.hours > 0 ? ` ${latestHeldInfo.hours} hour${latestHeldInfo.hours !== 1 ? 's' : ''}` : ''}.
                </Typography>
                <Typography variant="caption" sx={{ color: latestHoldStyle.text, display: 'block', mt: 0.5 }}>
                  Current stage: {latestEntry?.toStatus || 'Pending'}{latestHandledBy ? ` • Last handled by: ${latestHandledBy}` : ''}
                </Typography>
                <Typography variant="caption" sx={{ color: latestHoldStyle.text, display: 'block', mt: 0.5, fontWeight: 700 }}>
                  Severity: {latestHoldSeverity === 'critical' ? 'Critical (3+ days)' : latestHoldSeverity === 'high' ? 'High (2+ days)' : 'Warning (1+ day)'}
                </Typography>
              </Box>
            )}
            {workflowHistory.map((entry, index) => (
              (() => {
                const nextEntry = index < workflowHistory.length - 1 ? workflowHistory[index + 1] : null;
                const heldDurationMs = getHeldDurationMs(entry?.changedAt, nextEntry?.changedAt || Date.now());
                const heldInfo = index === activeEntryIndex ? getHeldInfo(entry) : null;
                const severity = heldInfo ? getHoldSeverity(heldInfo.days) : null;
                const style = severity ? holdSeverityStyles[severity] : null;
                return (
              <Box
                key={index}
                sx={{
                  mb: 3,
                  p: 2,
                  border: index === activeEntryIndex && heldInfo
                    ? `1px solid ${style.border}`
                    : '1px solid #e0e0e0',
                  borderLeft: index === activeEntryIndex && heldInfo
                    ? `4px solid ${style.border}`
                    : '1px solid #e0e0e0',
                  borderRadius: 2,
                  background: index === 0 ? '#f5f5f5' : '#ffffff',
                  position: 'relative',
                  animation: severity === 'critical' ? 'holdPulse 1.4s ease-in-out infinite' : 'none',
                  '&::before': index < workflowHistory.length - 1 ? {
                    content: '""',
                    position: 'absolute',
                    left: '24px',
                    top: '60px',
                    bottom: '-16px',
                    width: '2px',
                    background: '#e0e0e0'
                  } : {}
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <Box sx={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: index === 0 ? '#1976d2' : '#9e9e9e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '14px'
                  }}>
                    {index + 1}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    {entry.module && (
                      <Chip
                        label={entry.module}
                        size="small"
                        color={moduleColor(entry.module)}
                        sx={{ mb: 0.5, fontSize: '10px' }}
                      />
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={entry.fromStatus || 'Draft'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '11px' }}
                      />
                      <ArrowForwardIcon sx={{ fontSize: '16px', color: '#666' }} />
                      <Chip
                        label={entry.toStatus || 'N/A'}
                        size="small"
                        color={entry.toStatus?.includes('Approved') ? 'success' : 
                               entry.toStatus?.includes('Rejected') ? 'error' : 
                               entry.toStatus?.includes('Returned') ? 'warning' : 'primary'}
                        sx={{ fontSize: '11px', fontWeight: 600 }}
                      />
                      {index === activeEntryIndex && heldInfo && (
                        <Chip
                          label={`Held ${heldInfo.days} day${heldInfo.days !== 1 ? 's' : ''}`}
                          size="small"
                          color={style.chipColor}
                          sx={{
                            fontSize: '11px',
                            fontWeight: 700,
                            ...(severity === 'warning' ? {
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #f59e0b'
                            } : {}),
                            ...(severity === 'high' ? {
                              backgroundColor: '#ffedd5',
                              color: '#9a3412',
                              border: '1px solid #f97316'
                            } : {}),
                            ...(severity === 'critical' ? {
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #dc2626'
                            } : {})
                          }}
                        />
                      )}
                    </Box>
                    {entry.changedBy && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        By: {entry.changedBy.firstName} {entry.changedBy.lastName}
                        {entry.changedAt && ` • ${formatDateForDocument(entry.changedAt)}`}
                      </Typography>
                    )}
                    {!entry.changedBy && entry.changedAt && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {formatDateForDocument(entry.changedAt)}
                      </Typography>
                    )}
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.4, color: 'text.secondary', fontWeight: 600 }}>
                      {formatHeldDuration(heldDurationMs)}
                    </Typography>
                  </Box>
                </Box>
                {entry.comments && (
                  <Box sx={{
                    mt: 1.5,
                    p: 1.5,
                    background: '#f9f9f9',
                    borderRadius: 1,
                    borderLeft: '3px solid #1976d2'
                  }}>
                    <Typography variant="body2" sx={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                      {entry.comments}
                    </Typography>
                  </Box>
                )}
              </Box>
                );
              })()
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No workflow history available
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WorkflowHistoryDialog;

