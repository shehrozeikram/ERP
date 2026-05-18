import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from '@mui/material';

/**
 * Confirm resend to Pre-Audit: optional replies per open observation + optional note to audit.
 */
export function ResendToPreAuditDialog({
  open,
  onClose,
  submitting,
  observations = [],
  isObservationOpen = (obs) => !obs?.resolved,
  getObservationKey = (obs) => String(obs?._id || obs?.id || ''),
  resendComments,
  onResendCommentsChange,
  resendAnswers,
  onResendAnswerChange,
  onSubmit,
  title = 'Resend to Pre-Audit',
  intro = (
    <>
      Save any changes with <strong>Edit</strong> before confirming. Add replies for each open observation, then send
      the document back to the audit queue.
    </>
  ),
  confirmLabel = 'Confirm & send to Pre-Audit'
}) {
  const openObs = observations.filter((o) => isObservationOpen(o));

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {intro}
        </Typography>
        {openObs.length > 0 && (
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
            Replies to observations
          </Typography>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          {openObs.map((obs, idx) => {
            const k = getObservationKey(obs) || `open-${idx}`;
            return (
              <Box key={k}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Observation {idx + 1}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
                  {obs.observation}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Your reply"
                  value={resendAnswers[k] || ''}
                  onChange={(e) => onResendAnswerChange(k, e.target.value)}
                />
              </Box>
            );
          })}
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Optional note to audit (overall)"
            value={resendComments}
            onChange={(e) => onResendCommentsChange(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Sending…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
