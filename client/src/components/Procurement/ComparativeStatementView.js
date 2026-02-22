import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  CircularProgress,
  Chip,
  Tooltip
} from '@mui/material';
import { Print as PrintIcon, CheckCircle as CheckCircleIcon, Save as SaveIcon, CallSplit as SplitIcon } from '@mui/icons-material';

/**
 * Shared Comparative Statement view. Used in Procurement (Comparative Statements page) and Pre-Audit (PO view tab).
 * @param {Object} requisition - Indent/requisition (items, indentNumber, erpRef, title, notes)
 * @param {Array} quotations - List of quotations for comparison
 * @param {Object} approvalAuthority - { preparedBy, verifiedBy, authorisedRep, financeRep, managerProcurement }
 * @param {string} note - Note text (display only when readOnly; editable when !readOnly)
 * @param {boolean} readOnly - If true, no edit controls (approval as text, no Save, no Select buttons)
 * @param {function} formatNumber - (num) => string
 * @param {boolean} loadingQuotations - Show spinner instead of table
 * @param {function} onSaveApprovals - Called when Save approval authorities is clicked (optional)
 * @param {function} onSelectVendor - (quotation) => void — selects entire quotation as winner (optional)
 * @param {boolean} savingApprovals - Disable save button (optional)
 * @param {boolean} updating - Disable select buttons (optional)
 * @param {string} approvalsSavedForRequisition - Requisition id when approvals saved; enables Select (optional)
 * @param {function} onNoteChange - (value) => void when note is edited (optional, for !readOnly)
 * @param {function} onApprovalChange - (key, value) => void when approval field is edited (optional, for !readOnly)
 * @param {boolean} showPrintButton - Show Print button (default true when !readOnly)
 * @param {function} onCreateSplitPOs - ({ vendorAssignments }) => void — called when user clicks "Create Split POs" (optional)
 * @param {boolean} creatingSplitPOs - Disables the Create Split POs button while in progress (optional)
 */
const ComparativeStatementView = ({
  requisition,
  quotations = [],
  approvalAuthority = {},
  note = '',
  readOnly = false,
  formatNumber = (n) => (n == null ? '0.00' : parseFloat(n).toFixed(2)),
  loadingQuotations = false,
  onSaveApprovals,
  onSelectVendor,
  savingApprovals = false,
  updating = false,
  approvalsSavedForRequisition = null,
  onNoteChange,
  onApprovalChange,
  showPrintButton = !readOnly,
  onCreateSplitPOs,
  creatingSplitPOs = false
}) => {
  const selectedRequisition = requisition;
  const comparativeNote = note;
  const keys = ['preparedBy', 'verifiedBy', 'authorisedRep', 'financeRep', 'managerProcurement'];

  // Per-item vendor assignment: { itemIndex: quotationId }
  const [vendorAssignments, setVendorAssignments] = useState({});

  const handleAssignVendorToItem = useCallback((itemIndex, quotationId) => {
    setVendorAssignments(prev => {
      // Toggle off if already assigned to same vendor
      if (prev[itemIndex] === quotationId) {
        const next = { ...prev };
        delete next[itemIndex];
        return next;
      }
      return { ...prev, [itemIndex]: quotationId };
    });
  }, []);

  const allItemsAssigned =
    selectedRequisition?.items?.length > 0 &&
    selectedRequisition.items.every((_, idx) => vendorAssignments[idx]);

  const assignedCount = Object.keys(vendorAssignments).length;
  const totalItems = selectedRequisition?.items?.length || 0;

  const handleCreateSplitPOs = () => {
    if (onCreateSplitPOs) {
      onCreateSplitPOs({ vendorAssignments });
    }
  };

  return (
    <Paper
      sx={{
        p: { xs: 3, sm: 3.5, md: 4 },
        maxWidth: '297mm',
        mx: 'auto',
        backgroundColor: '#fff',
        boxShadow: 'none',
        width: '100%',
        fontFamily: 'Arial, sans-serif',
        '@media print': {
          boxShadow: 'none',
          p: 1.5,
          maxWidth: '100%',
          mx: 0,
          width: '100%',
          pageBreakInside: 'avoid'
        }
      }}
      className="print-content comparative-statement-view"
    >
      {/* Header */}
      <Box sx={{ mb: 3, position: 'relative', '@media print': { mb: 1.5 } }}>
        <Typography variant="h4" fontWeight={700} align="center" sx={{ textTransform: 'uppercase', mb: { xs: 3, print: 1 }, fontSize: { xs: '1.8rem', print: '1.3rem' }, letterSpacing: 1 }}>
          Comparative Statement
        </Typography>
        <Typography variant="h6" align="center" sx={{ mb: { xs: 2, print: 0.5 }, fontSize: { xs: '1.2rem', print: '0.9rem' }, fontWeight: 500 }}>
          Taj Residencia
        </Typography>
        <Box sx={{ position: 'absolute', top: 0, right: 0, textAlign: 'right', fontSize: { xs: '0.9rem', print: '0.75rem' } }}>
          <Typography sx={{ mb: 0.5 }}>POR {selectedRequisition?.erpRef?.split('#').pop() || selectedRequisition?.indentNumber || 'N/A'}</Typography>
          <Typography>Indent {selectedRequisition?.indentNumber || 'N/A'}</Typography>
        </Box>
      </Box>

      {showPrintButton && (
        <Box sx={{ mb: 2, textAlign: 'right', '@media print': { display: 'none' } }}>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
        </Box>
      )}

      {/* Approval authorities - editable or read-only */}
      <Box sx={{ mb: 3, '@media print': { pageBreakInside: 'avoid' } }}>
        {!readOnly && (
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, '@media print': { display: 'none' } }}>
            Approval authorities (fill and save below, then you can select vendor)
          </Typography>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'Arial, sans-serif' }}>
          <tbody>
            <tr>
              {['Prepared By', 'Verified By: Procurement Committee', 'Authorised Rep.', 'Finance Rep.', 'Manager Procurement'].map((label, i) => {
                const fieldKey = keys[i];
                const value = approvalAuthority[fieldKey] || '';
                return (
                  <td key={fieldKey} style={{ padding: '20px 10px', textAlign: 'center', width: '20%', verticalAlign: 'bottom' }} className="signature-cell">
                    <Box sx={{ minHeight: '60px', borderBottom: '1px solid #000', mb: 1 }} />
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{label}</Typography>
                    {readOnly ? (
                      <Typography variant="body2" sx={{ mt: 0.5, textAlign: 'center' }}>{value || '—'}</Typography>
                    ) : (
                      <TextField
                        size="small"
                        placeholder="Name / Designation"
                        value={value}
                        onChange={(e) => onApprovalChange && onApprovalChange(fieldKey, e.target.value)}
                        sx={{ mt: 0.5, '& .MuiInputBase-input': { fontSize: '0.75rem', textAlign: 'center' }, '& .MuiOutlinedInput-notchedOutline': { border: 'none', borderBottom: '1px solid #ccc' }, minWidth: '100%' }}
                        variant="standard"
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        {!readOnly && onSaveApprovals && (
          <Box sx={{ mt: 2, mb: 1, display: 'flex', justifyContent: 'flex-end', '@media print': { display: 'none' } }}>
            <Button variant="contained" color="primary" size="small" startIcon={savingApprovals ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={onSaveApprovals} disabled={savingApprovals}>
              {savingApprovals ? 'Saving…' : 'Save approval authorities'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Comparative Table */}
      {loadingQuotations ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : !quotations || quotations.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}><Typography>No quotations available for comparison</Typography></Box>
      ) : (
        <>
          {/* Per-item vendor assignment info bar */}
          {!readOnly && onCreateSplitPOs && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f0f4ff', borderRadius: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', '@media print': { display: 'none' } }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Split PO Mode:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Click a vendor cell in any item row to assign that item to that vendor. Then click "Create Split POs".
              </Typography>
              <Chip
                size="small"
                label={`${assignedCount} / ${totalItems} items assigned`}
                color={allItemsAssigned ? 'success' : assignedCount > 0 ? 'warning' : 'default'}
              />
              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={creatingSplitPOs ? <CircularProgress size={16} color="inherit" /> : <SplitIcon />}
                onClick={handleCreateSplitPOs}
                disabled={creatingSplitPOs || assignedCount === 0}
                sx={{ ml: 'auto' }}
              >
                {creatingSplitPOs ? 'Creating…' : 'Create Split POs'}
              </Button>
            </Box>
          )}

          <Box sx={{ mb: 3, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.85rem', fontFamily: 'Arial, sans-serif', minWidth: '1000px' }} className="comparative-table">
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                  <th colSpan={4} style={{ border: '1px solid #000', padding: '8px 6px', fontWeight: 700, textAlign: 'center', fontSize: '0.85rem' }}>Vendor</th>
                  {quotations.map((quote, idx) => (
                    <th key={idx} colSpan={2} style={{ border: '1px solid #000', padding: '8px 6px', fontWeight: 700, textAlign: 'center', fontSize: '0.85rem', backgroundColor: quote.status === 'Finalized' ? '#c8e6c9' : '#f5f5f5', verticalAlign: 'top' }}>
                      {!readOnly && onSelectVendor && (
                        <Box sx={{ mb: 1, '@media print': { display: 'none' } }}>
                          <Button
                            variant={quote.status === 'Finalized' ? 'contained' : 'outlined'}
                            color={quote.status === 'Finalized' ? 'success' : 'primary'}
                            startIcon={quote.status === 'Finalized' ? <CheckCircleIcon /> : null}
                            onClick={() => onSelectVendor(quote)}
                            disabled={updating || quote.status === 'Finalized' || approvalsSavedForRequisition !== selectedRequisition?._id}
                            size="small"
                            sx={{ fontSize: '0.7rem', padding: '4px 8px', minWidth: 'auto' }}
                          >
                            {quote.status === 'Finalized' ? 'Selected' : 'Select All'}
                          </Button>
                        </Box>
                      )}
                      {quote.vendor?.name || `Vendor ${idx + 1}`}
                      {quote.status === 'Finalized' && <Box component="span" sx={{ display: 'block', fontSize: '0.7rem', mt: 0.5, color: '#2e7d32', fontWeight: 600 }}>(Selected)</Box>}
                    </th>
                  ))}
                </tr>
                <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                  <th style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 700, width: '4%', fontSize: '0.8rem' }}>Sr no</th>
                  <th style={{ border: '1px solid #000', padding: '8px 6px', fontWeight: 700, textAlign: 'left', width: '35%', fontSize: '0.8rem' }}>Item Description</th>
                  <th style={{ border: '1px solid #000', padding: '8px 6px', fontWeight: 700, textAlign: 'center', width: '8%', fontSize: '0.8rem' }}>Unit</th>
                  <th style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 700, width: '6%', fontSize: '0.8rem' }}>Qty</th>
                  {quotations.map((_, idx) => (
                    <React.Fragment key={idx}>
                      <th style={{ border: '1px solid #000', padding: '8px 6px', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>Rate</th>
                      <th style={{ border: '1px solid #000', padding: '8px 6px', fontWeight: 700, textAlign: 'center', fontSize: '0.8rem' }}>Total</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedRequisition?.items?.length > 0 ? selectedRequisition.items.map((item, itemIndex) => {
                  const assignedQuotationId = vendorAssignments[itemIndex];
                  return (
                    <tr key={itemIndex} style={{ border: '1px solid #000', backgroundColor: assignedQuotationId ? '#f0fff0' : undefined }}>
                      <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '0.8rem' }}>{itemIndex + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '6px 6px', verticalAlign: 'top', fontSize: '0.8rem' }}>
                        {item.itemName || item.description || '___________'}
                        {assignedQuotationId && !readOnly && (
                          <Box component="span" sx={{ display: 'block', fontSize: '0.7rem', color: '#2e7d32', fontWeight: 600, '@media print': { display: 'none' } }}>
                            → {quotations.find(q => q._id === assignedQuotationId)?.vendor?.name || 'Vendor'}
                          </Box>
                        )}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '0.8rem' }}>{item.unit || 'Nos'}</td>
                      <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'center', verticalAlign: 'top', fontSize: '0.8rem' }}>{item.quantity ?? '___'}</td>
                      {quotations.map((quote, quoteIdx) => {
                        const quoteItem = quote.items?.[itemIndex];
                        const itemTotal = quoteItem ? (quoteItem.quantity || 0) * (quoteItem.unitPrice || 0) : 0;
                        const isAssignedToThis = vendorAssignments[itemIndex] === quote._id;
                        const cellBg = isAssignedToThis ? '#c8e6c9' : undefined;
                        return (
                          <React.Fragment key={quoteIdx}>
                            <td
                              style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', verticalAlign: 'top', fontSize: '0.8rem', backgroundColor: cellBg, cursor: !readOnly && onCreateSplitPOs ? 'pointer' : undefined }}
                              onClick={!readOnly && onCreateSplitPOs && quoteItem ? () => handleAssignVendorToItem(itemIndex, quote._id) : undefined}
                            >
                              {quoteItem ? formatNumber(quoteItem.unitPrice) : '___________'}
                            </td>
                            <Tooltip
                              title={!readOnly && onCreateSplitPOs && quoteItem ? (isAssignedToThis ? 'Click to unassign' : 'Click to assign this item to this vendor') : ''}
                              placement="top"
                            >
                              <td
                                style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', verticalAlign: 'top', fontSize: '0.8rem', backgroundColor: cellBg, cursor: !readOnly && onCreateSplitPOs && quoteItem ? 'pointer' : undefined }}
                                onClick={!readOnly && onCreateSplitPOs && quoteItem ? () => handleAssignVendorToItem(itemIndex, quote._id) : undefined}
                              >
                                {quoteItem ? formatNumber(itemTotal) : '___________'}
                                {isAssignedToThis && !readOnly && (
                                  <CheckCircleIcon sx={{ fontSize: '0.8rem', ml: 0.5, color: '#2e7d32', verticalAlign: 'middle', '@media print': { display: 'none' } }} />
                                )}
                              </td>
                            </Tooltip>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4 + quotations.length * 2} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>No items</td>
                  </tr>
                )}
                <tr style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000', backgroundColor: '#e8e8e8', fontWeight: 700 }}>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontSize: '0.8rem' }}>TOTAL</td>
                  {quotations.map((quote, idx) => (
                    <td key={idx} colSpan={2} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontSize: '0.8rem' }}>{formatNumber(quote.totalAmount || 0)}</td>
                  ))}
                </tr>
                <tr style={{ border: '1px solid #000', fontWeight: 600 }}>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontSize: '0.8rem' }}>Income Tax</td>
                  {quotations.map((_, idx) => <td key={idx} colSpan={2} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'center', fontSize: '0.8rem' }}>Not Included</td>)}
                </tr>
                <tr style={{ border: '1px solid #000', fontWeight: 600 }}>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontSize: '0.8rem' }}>Transportation</td>
                  {quotations.map((_, idx) => <td key={idx} colSpan={2} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'center', fontSize: '0.8rem' }}>Not Included</td>)}
                </tr>
                <tr style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000', backgroundColor: '#d0d0d0', fontWeight: 700 }}>
                  <td colSpan={4} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontSize: '0.85rem' }}>Grand Total</td>
                  {quotations.map((quote, idx) => (
                    <td key={idx} colSpan={2} style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'right', fontSize: '0.85rem' }}>{formatNumber(quote.totalAmount || 0)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Box>
        </>
      )}

      {/* Terms & Conditions */}
      {quotations?.length > 0 && (
        <Box sx={{ mb: 3, mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, fontSize: '1rem', textDecoration: 'underline' }}>Term & Condition</Typography>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.85rem', fontFamily: 'Arial, sans-serif' }} className="terms-table">
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left', fontWeight: 700, width: '20%', fontSize: '0.8rem' }}>Delivery Time</th>
                {quotations.map((_, idx) => <th key={idx} style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem' }}>{idx + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr style={{ border: '1px solid #000' }}>
                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 600, fontSize: '0.8rem' }}></td>
                {quotations.map((quote, idx) => <td key={idx} style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '0.8rem' }}>{quote.deliveryTime || '7 Days'}</td>)}
              </tr>
              <tr style={{ border: '1px solid #000' }}>
                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 600, fontSize: '0.8rem' }}>Payment Term</td>
                {quotations.map((quote, idx) => <td key={idx} style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '0.8rem' }}>{quote.paymentTerms || '100% Advance'}</td>)}
              </tr>
              <tr style={{ border: '1px solid #000' }}>
                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 600, fontSize: '0.8rem' }}>Delivery Place</td>
                {quotations.map((_, idx) => <td key={idx} style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontSize: '0.8rem' }}>Ex-Site</td>)}
              </tr>
            </tbody>
          </table>
        </Box>
      )}

      {/* Note */}
      <Box sx={{ mb: 3, fontSize: '0.9rem' }}>
        <Typography component="span" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>Note:</Typography>
        {readOnly ? (
          <Typography component="span">{comparativeNote || '—'}</Typography>
        ) : onNoteChange ? (
          <TextField fullWidth multiline minRows={2} placeholder="Add note (save with approval authorities above)" value={comparativeNote} onChange={(e) => onNoteChange(e.target.value)} variant="outlined" size="small" sx={{ '& .MuiInputBase-input': { fontSize: '0.9rem' } }} />
        ) : (
          <Typography component="span">{comparativeNote || '—'}</Typography>
        )}
      </Box>
    </Paper>
  );
};

export default ComparativeStatementView;
