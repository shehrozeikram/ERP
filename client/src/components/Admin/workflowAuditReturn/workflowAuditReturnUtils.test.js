import {
  findLatestWorkflowFeedbackEntry,
  findLatestWorkflowReturnEntry,
  getObservationsForSettlementView,
  getWorkflowFeedbackObservations,
  isWorkflowAuditBlockingEditStatus
} from './workflowAuditReturnUtils';

describe('findLatestWorkflowReturnEntry', () => {
  it('returns the most recent history entry whose toStatus matches return', () => {
    const hist = [
      { toStatus: 'Draft', comments: 'x' },
      { toStatus: 'Returned from Audit', comments: 'latest' },
      { toStatus: 'Submitted', comments: 'older' }
    ];
    const r = findLatestWorkflowReturnEntry(hist);
    expect(r?.comments).toBe('latest');
  });
});

describe('findLatestWorkflowFeedbackEntry', () => {
  it('finds reject summary rows', () => {
    const hist = [
      { toStatus: 'Send to Audit', comments: 'submitted' },
      { toStatus: 'Rejected (from Send to Audit)', comments: 'Rejected with observations: fix amounts' }
    ];
    const r = findLatestWorkflowFeedbackEntry(hist);
    expect(r?.comments).toContain('Rejected with observations');
  });
});

describe('isWorkflowAuditBlockingEditStatus', () => {
  it('is true for audit queue and approved-from-audit-prefix statuses', () => {
    expect(isWorkflowAuditBlockingEditStatus('Send to Audit')).toBe(true);
    expect(isWorkflowAuditBlockingEditStatus('Forwarded to Audit Director')).toBe(true);
    expect(isWorkflowAuditBlockingEditStatus('Approved (from Send to Audit)')).toBe(true);
    expect(isWorkflowAuditBlockingEditStatus('Approved (from Forwarded to Audit Director)')).toBe(true);
    expect(isWorkflowAuditBlockingEditStatus('')).toBe(false);
    expect(isWorkflowAuditBlockingEditStatus('Returned from Audit')).toBe(false);
  });
});

describe('getWorkflowFeedbackObservations', () => {
  it('returns empty for null/undefined', () => {
    expect(getWorkflowFeedbackObservations(null)).toEqual([]);
    expect(getWorkflowFeedbackObservations(undefined)).toEqual([]);
  });

  it('prefers document.observations when non-empty', () => {
    const obs = [{ _id: '1', observation: 'A', addedAt: '2024-01-01' }];
    const s = {
      observations: obs,
      workflowHistory: [{ comments: 'Observation (medium): fallback', changedBy: { _id: 'u' }, changedAt: 'x' }]
    };
    expect(getWorkflowFeedbackObservations(s)).toBe(obs);
  });

  it('maps auditRejectObservations for procurement POs', () => {
    const out = getWorkflowFeedbackObservations({
      auditRejectObservations: [{ observation: 'Missing GRN', severity: 'high' }],
      auditRejectedBy: { firstName: 'A', lastName: 'B' },
      auditRejectedAt: '2024-01-02'
    });
    expect(out).toHaveLength(1);
    expect(out[0].observation).toBe('Missing GRN');
    expect(out[0].severity).toBe('high');
  });

  it('parses Observation (severity): text from workflow history', () => {
    const row = {
      _id: 'h1',
      comments: 'Observation (high): fix VAT',
      changedBy: { firstName: 'A', lastName: 'B' },
      changedAt: '2024-06-01T10:00:00Z'
    };
    const out = getWorkflowFeedbackObservations({
      observations: [],
      workflowHistory: [row]
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      observation: 'fix VAT',
      severity: 'high'
    });
  });

  it('parses combined reject comments with Observations block', () => {
    const row = {
      comments:
        'Rejected with observations: Please correct. Observations: Observation 1 (medium): Wrong total; Observation 2 (high): Missing attachment'
    };
    const out = getWorkflowFeedbackObservations({
      workflowHistory: [row]
    });
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.some((o) => o.observation === 'Wrong total')).toBe(true);
    expect(out.some((o) => o.observation === 'Missing attachment')).toBe(true);
  });

  it('ignores history entries without keyword match', () => {
    const out = getWorkflowFeedbackObservations({
      observations: [],
      workflowHistory: [{ comments: 'Approved', changedBy: null }]
    });
    expect(out).toEqual([]);
  });

  it('preserves answer fields on structured observations', () => {
    const obs = [{
      _id: '1',
      observation: 'Fix amount',
      answer: 'Corrected in memo',
      answeredBy: { firstName: 'Admin', lastName: 'User' },
      answeredAt: '2024-06-02',
      resolved: true
    }];
    expect(getWorkflowFeedbackObservations({ observations: obs })[0].answer).toBe('Corrected in memo');
  });

  it('parses administration response lines from workflow history', () => {
    const out = getWorkflowFeedbackObservations({
      observations: [],
      workflowHistory: [{
        comments: 'Administration response to observation: "Fix VAT" — Updated rate applied',
        changedBy: { firstName: 'A', lastName: 'B' },
        changedAt: '2024-06-01'
      }]
    });
    expect(out).toHaveLength(1);
    expect(out[0].answer).toBe('Updated rate applied');
    expect(out[0].observation).toBe('Fix VAT');
  });
});

describe('getObservationsForSettlementView', () => {
  it('delegates to getWorkflowFeedbackObservations', () => {
    const obs = [{ observation: 'test' }];
    expect(getObservationsForSettlementView({ observations: obs })).toBe(obs);
  });
});
