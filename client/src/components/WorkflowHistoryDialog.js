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
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';

const formatDateForDocument = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
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
            {workflowHistory.map((entry, index) => (
              <Box
                key={index}
                sx={{
                  mb: 3,
                  p: 2,
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  background: index === 0 ? '#f5f5f5' : '#ffffff',
                  position: 'relative',
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

