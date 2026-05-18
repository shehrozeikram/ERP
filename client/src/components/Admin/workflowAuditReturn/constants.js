/** Audit queue stages where the document must not be edited (typical admin workflow + utility bills). */
export const DEFAULT_AUDIT_STATUSES_BLOCKING_EDIT = [
  'Send to Audit',
  'Forwarded to Audit Director',
  'Approved (from Send to Audit)',
  'Approved (from Forwarded to Audit Director)'
];
