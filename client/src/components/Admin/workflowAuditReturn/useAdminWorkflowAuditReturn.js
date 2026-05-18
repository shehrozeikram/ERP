import { useCallback, useMemo, useState } from 'react';
import {
  findLatestWorkflowFeedbackEntry,
  findLatestWorkflowReturnEntry,
  getWorkflowFeedbackObservations
} from './workflowAuditReturnUtils';

/**
 * Shared state + submit handler for "returned from audit → reply to observations → optional note → resend to Pre-Audit".
 * Per-module rules (who can edit, when resend is allowed) stay in `computeAuditUi`.
 *
 * @param {object} params
 * @param {object|null|undefined} params.document
 * @param {(doc: object) => { auditBlocksEdit: boolean, canResendToPreAudit: boolean }} params.computeAuditUi
 * @param {string} [params.workflowHistoryPath]
 * @param {(doc: object) => unknown[]} [params.getObservations]
 * @param {(obs: object) => string} [params.getObservationKey]
 * @param {(obs: object) => boolean} [params.isObservationOpen]
 * @param {(payload: { resubmitComments: string, observationAnswers: { observationId: string, answer: string }[] }) => Promise<object>} params.onResend
 * @param {(updated: object) => void} [params.onDocumentUpdate]
 * @param {(message: string) => void} [params.onError]
 * @param {(message: string) => void} [params.onSuccess]
 */
export function useAdminWorkflowAuditReturn({
  document,
  computeAuditUi,
  workflowHistoryPath = 'workflowHistory',
  getObservations = getWorkflowFeedbackObservations,
  getObservationKey = (obs) => String(obs?._id || obs?.id || ''),
  isObservationOpen = (obs) => !obs?.resolved,
  onResend,
  onDocumentUpdate,
  onError,
  onSuccess
}) {
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendComments, setResendComments] = useState('');
  const [resendAnswers, setResendAnswers] = useState({});

  const latestReturnHistory = useMemo(() => {
    const hist = document?.[workflowHistoryPath];
    return findLatestWorkflowFeedbackEntry(hist) || findLatestWorkflowReturnEntry(hist);
  }, [document, workflowHistoryPath]);

  const observations = useMemo(() => getObservations(document), [document, getObservations]);

  const { auditBlocksEdit, canResendToPreAudit } = useMemo(
    () => computeAuditUi(document || {}),
    [document, computeAuditUi]
  );

  const openResendDialog = useCallback(() => {
    const next = {};
    observations.forEach((obs) => {
      const k = getObservationKey(obs);
      if (k) next[k] = obs.answer || '';
    });
    setResendAnswers(next);
    setResendComments('');
    setResendDialogOpen(true);
  }, [getObservationKey, observations]);

  const closeResendDialog = useCallback(() => {
    if (!resendSubmitting) setResendDialogOpen(false);
  }, [resendSubmitting]);

  const handleResendToAudit = useCallback(async () => {
    const pending = observations.filter((obs) => isObservationOpen(obs));
    if (pending.length) {
      const missing = pending.filter((obs) => !String(resendAnswers[getObservationKey(obs)] || '').trim());
      if (missing.length) {
        onError?.('Add a short reply for each open observation before resending to Pre-Audit.');
        return;
      }
    }

    try {
      setResendSubmitting(true);
      const observationAnswers = observations
        .map((obs) => ({
          observationId: obs._id || obs.id,
          answer: String(resendAnswers[getObservationKey(obs)] || '').trim()
        }))
        .filter((x) => x.observationId && x.answer);

      const updated = await onResend({
        resubmitComments: resendComments,
        observationAnswers
      });
      if (updated && onDocumentUpdate) onDocumentUpdate(updated);
      setResendDialogOpen(false);
      onSuccess?.('Sent back to the Pre-Audit queue.');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to resend to audit';
      onError?.(msg);
    } finally {
      setResendSubmitting(false);
    }
  }, [
    getObservationKey,
    isObservationOpen,
    observations,
    onDocumentUpdate,
    onError,
    onResend,
    onSuccess,
    resendAnswers,
    resendComments
  ]);

  return {
    latestReturnHistory,
    observations,
    auditBlocksEdit,
    canResendToPreAudit,
    resendDialogOpen,
    resendSubmitting,
    resendComments,
    setResendComments,
    resendAnswers,
    setResendAnswers,
    openResendDialog,
    closeResendDialog,
    handleResendToAudit
  };
}
