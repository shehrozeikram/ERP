import React from 'react';
import { Alert, Typography, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

/**
 * Shows comparative rejection observations when comparativeApproval.status === 'rejected'.
 * Used on Comparative Statements and Quotations (same requisition).
 */
export default function ComparativeRejectionObservationsAlert({
  comparativeApproval,
  showComparativeLink = false,
  sx = {}
}) {
  if (!comparativeApproval || comparativeApproval.status !== 'rejected') return null;

  const observations = Array.isArray(comparativeApproval.rejectionObservations)
    ? comparativeApproval.rejectionObservations
    : [];

  return (
    <Alert severity="warning" sx={{ mb: 2, ...sx }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Comparative statement — rejection observations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Update quotations or shortlisted vendor(s) as needed, add a resolution note on Comparative Statements,
        then resubmit. Approvers who already approved are not asked again; only pending steps (including the
        person who rejected) must act.
      </Typography>
      {(() => {
        if (observations.length === 0 && comparativeApproval.rejectionObservation) {
          return <Typography variant="body2">{comparativeApproval.rejectionObservation}</Typography>;
        }
        return observations.map((obs, idx) => {
          const by =
            [obs?.rejectedBy?.firstName, obs?.rejectedBy?.lastName].filter(Boolean).join(' ').trim() ||
            obs?.rejectedBy?.email ||
            (obs?.rejectedBy && String(obs.rejectedBy)) ||
            'Approver';
          const at = obs?.rejectedAt ? new Date(obs.rejectedAt).toLocaleString() : '';
          return (
            <Box key={`${obs?._id || idx}`} sx={{ mb: 1 }}>
              <Typography variant="body2">
                {idx + 1}. <strong>{by}</strong>
                {at ? ` (${at})` : ''}: {obs?.observation || '—'}
              </Typography>
              {obs?.resolutionNote ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 2 }}>
                  Resolution: {obs.resolutionNote}
                </Typography>
              ) : null}
            </Box>
          );
        });
      })()}
      {showComparativeLink ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
          <RouterLink to="/procurement/comparative-statements">Open Comparative Statements</RouterLink> to
          resubmit after corrections.
        </Typography>
      ) : null}
    </Alert>
  );
}
