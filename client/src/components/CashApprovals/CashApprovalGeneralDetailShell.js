import React from 'react';
import { Box, Button, Chip, Stack } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Print as PrintIcon } from '@mui/icons-material';
import CashApprovalGeneralDocument from './CashApprovalGeneralDocument';
import { WorkflowAuditFeedbackPanel } from '../Admin/workflowAuditReturn';
import {
  formatDateTime,
  getStatusColor,
  printGeneralCashApproval,
  userDisplayName
} from './cashApprovalGeneralDocumentUtils';

/**
 * Toolbar + document layout for General cash approvals (full page or embedded in dialogs).
 */
const CashApprovalGeneralDetailShell = ({
  ca,
  embedded = false,
  hideBack = false,
  backLabel = 'Back',
  onBack,
  toolbarActions = null,
  topAlerts = null,
  showStatusChips = true
}) => {
  if (!ca) return null;

  const handlePrint = () => {
    printGeneralCashApproval(ca, (msg) => {
      if (typeof window !== 'undefined') window.alert(msg);
    });
  };

  return (
    <Box sx={{ p: embedded ? 0 : 3 }}>
      {(!hideBack || toolbarActions || showStatusChips) && (
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={embedded ? 1.5 : 3}
          gap={2}
          flexWrap="wrap"
          className="app-print-hide"
        >
          {!hideBack && onBack ? (
            <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
              {backLabel}
            </Button>
          ) : (
            <Box />
          )}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            {showStatusChips && (
              <>
                <Chip label={`Status: ${ca.status}`} color={getStatusColor(ca.status)} size="small" />
                {ca.departmentApprovalStatus && (
                  <Chip label={`Dept: ${ca.departmentApprovalStatus}`} size="small" variant="outlined" />
                )}
              </>
            )}
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
              Print
            </Button>
            {toolbarActions}
          </Stack>
        </Box>
      )}

      {topAlerts}

      <WorkflowAuditFeedbackPanel
        document={ca}
        formatDateTime={formatDateTime}
        userDisplayName={userDisplayName}
        returnedIntro={(
          <>
            This cash approval was returned or rejected. Review the observations below, use <strong>Edit</strong> to
            update the request, then resubmit for approval.
          </>
        )}
      />

      <CashApprovalGeneralDocument ca={ca} elevation={embedded ? 0 : 2} />
    </Box>
  );
};

export default CashApprovalGeneralDetailShell;
