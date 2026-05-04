import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Alert, Divider, Grid, Table, TableBody, TableCell, TableHead, TableRow, Paper } from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import procurementService from '../../services/procurementService';
import { formatDate } from '../../utils/dateUtils';
import { formatPKR } from '../../utils/currency';

const CashApprovalDocumentView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ca, setCa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await procurementService.getCashApprovalById(id);
        setCa(res.data);
      } catch {
        setError('Failed to load Cash Approval');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!ca) return null;

  const aa = ca.approvalAuthorities || {};

  return (
    <Box>
      {/* Screen-only action bar */}
      <Box sx={{ display: 'flex', gap: 1, p: 2, mb: 1 }} className="app-print-hide">
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>Back</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
      </Box>

      {/* Printable document */}
      <Box sx={{ maxWidth: 900, mx: 'auto', p: 4, bgcolor: 'white', fontFamily: 'Arial, sans-serif' }}
        id="ca-print-area">

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: 2, textTransform: 'uppercase' }}>
            CASH APPROVAL
          </Typography>
          <Typography variant="subtitle2" color="text.secondary">Sung Choi Group of Companies</Typography>
          <Divider sx={{ my: 1 }} />
        </Box>

        {/* Meta info */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={6}>
            <InfoRow label="CA Number" value={ca.caNumber} />
            <InfoRow label="Approval Date" value={formatDate(ca.approvalDate)} />
            <InfoRow label="Expected Purchase Date" value={formatDate(ca.expectedPurchaseDate)} />
            <InfoRow label="Priority" value={ca.priority} />
          </Grid>
          <Grid item xs={6}>
            <InfoRow label="Vendor" value={ca.vendor?.name || '—'} />
            <InfoRow label="Vendor Contact" value={ca.vendor?.email || ca.vendor?.phone || '—'} />
            <InfoRow label="Status" value={ca.status} />
            {ca.deliveryAddress && <InfoRow label="Delivery Address" value={ca.deliveryAddress} />}
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Items Table */}
        <Typography variant="subtitle1" fontWeight={700} mb={1}>Items</Typography>
        <Table size="small" sx={{ border: '1px solid #ccc', mb: 2 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc', width: 40 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc' }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc' }}>Specification / Brand</TableCell>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc', textAlign: 'center' }}>Qty</TableCell>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc' }}>Unit</TableCell>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc', textAlign: 'right' }}>Unit Price</TableCell>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc', textAlign: 'right' }}>Tax %</TableCell>
              <TableCell sx={{ fontWeight: 700, border: '1px solid #ccc', textAlign: 'right' }}>Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(ca.items || []).map((item, i) => (
              <TableRow key={i}>
                <TableCell sx={{ border: '1px solid #ccc' }}>{i + 1}</TableCell>
                <TableCell sx={{ border: '1px solid #ccc' }}>{item.description}</TableCell>
                <TableCell sx={{ border: '1px solid #ccc' }}>{[item.specification, item.brand].filter(Boolean).join(' / ') || '—'}</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', textAlign: 'center' }}>{item.quantity}</TableCell>
                <TableCell sx={{ border: '1px solid #ccc' }}>{item.unit}</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', textAlign: 'right' }}>{formatPKR(item.unitPrice)}</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', textAlign: 'right' }}>{item.taxRate || 0}%</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', textAlign: 'right' }}>{formatPKR(item.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={7} sx={{ border: '1px solid #ccc', textAlign: 'right', fontWeight: 600 }}>Subtotal</TableCell>
              <TableCell sx={{ border: '1px solid #ccc', textAlign: 'right', fontWeight: 600 }}>{formatPKR(ca.subtotal)}</TableCell>
            </TableRow>
            {ca.taxAmount > 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ border: '1px solid #ccc', textAlign: 'right' }}>Tax</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', textAlign: 'right' }}>{formatPKR(ca.taxAmount)}</TableCell>
              </TableRow>
            )}
            {ca.shippingCost > 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ border: '1px solid #ccc', textAlign: 'right' }}>Shipping</TableCell>
                <TableCell sx={{ border: '1px solid #ccc', textAlign: 'right' }}>{formatPKR(ca.shippingCost)}</TableCell>
              </TableRow>
            )}
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell colSpan={7} sx={{ border: '1px solid #ccc', textAlign: 'right', fontWeight: 700, fontSize: 15 }}>TOTAL AMOUNT</TableCell>
              <TableCell sx={{ border: '1px solid #ccc', textAlign: 'right', fontWeight: 700, fontSize: 15 }}>{formatPKR(ca.totalAmount)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Finance / Advance info (if issued) */}
        {ca.advanceAmount > 0 && (
          <Box sx={{ border: '1px solid #ccc', p: 2, mb: 2, borderRadius: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>Advance Details</Typography>
            <Grid container spacing={1}>
              <Grid item xs={4}><InfoRow label="Advance To" value={ca.advanceToName || (ca.advanceTo ? `${ca.advanceTo.firstName} ${ca.advanceTo.lastName}` : '—')} /></Grid>
              <Grid item xs={4}><InfoRow label="Advance Amount" value={formatPKR(ca.advanceAmount)} /></Grid>
              <Grid item xs={4}><InfoRow label="Payment Method" value={ca.advancePaymentMethod} /></Grid>
              {ca.advanceVoucherNo && <Grid item xs={4}><InfoRow label="Voucher No." value={ca.advanceVoucherNo} /></Grid>}
              {ca.advanceIssuedBy && <Grid item xs={4}><InfoRow label="Issued By" value={`${ca.advanceIssuedBy.firstName} ${ca.advanceIssuedBy.lastName}`} /></Grid>}
              {ca.advanceIssuedAt && <Grid item xs={4}><InfoRow label="Issued On" value={formatDate(ca.advanceIssuedAt)} /></Grid>}
            </Grid>
          </Box>
        )}

        {/* Settlement info (if settled) */}
        {ca.actualAmountSpent > 0 && (
          <Box sx={{ border: '1px solid #ccc', p: 2, mb: 2, borderRadius: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>Settlement Details</Typography>
            <Grid container spacing={1}>
              <Grid item xs={4}><InfoRow label="Actual Amount Spent" value={formatPKR(ca.actualAmountSpent)} /></Grid>
              <Grid item xs={4}><InfoRow label="Excess Returned" value={formatPKR(ca.excessReturned)} /></Grid>
              <Grid item xs={4}><InfoRow label="Additional Paid" value={formatPKR(ca.additionalPaid)} /></Grid>
              {ca.settlementDate && <Grid item xs={4}><InfoRow label="Settlement Date" value={formatDate(ca.settlementDate)} /></Grid>}
            </Grid>
          </Box>
        )}

        {ca.notes && (
          <Box mb={2}>
            <Typography variant="subtitle2" fontWeight={600}>Notes:</Typography>
            <Typography variant="body2">{ca.notes}</Typography>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Approval Authorities Signature Block */}
        <Typography variant="subtitle1" fontWeight={700} mb={2} sx={{ textAlign: 'center' }}>APPROVAL AUTHORITIES</Typography>
        <Table sx={{ border: '1px solid #ccc', mb: 4 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Prepared By</TableCell>
              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Verified By<br />(Procurement Committee)</TableCell>
              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Authorised Rep.</TableCell>
              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Finance Rep.</TableCell>
              <TableCell sx={{ border: '1px solid #ccc', fontWeight: 700, textAlign: 'center' }}>Manager Procurement</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              {['preparedBy', 'verifiedBy', 'authorisedRep', 'financeRep', 'managerProcurement'].map((key) => (
                <TableCell key={key} sx={{ border: '1px solid #ccc', height: 60, verticalAlign: 'top', textAlign: 'center' }}>
                  <Typography variant="body2" fontWeight={600}>{aa[key] || ''}</Typography>
                </TableCell>
              ))}
            </TableRow>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              {['Signature', 'Signature', 'Signature', 'Signature', 'Signature'].map((s, i) => (
                <TableCell key={i} sx={{ border: '1px solid #ccc', height: 50, textAlign: 'center', color: '#aaa', fontSize: 11 }}>{s}</TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>

        {/* CEO Digital Signature (if approved) */}
        {ca.ceoApprovedBy && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="caption" color="text.secondary">CEO Approved by: {ca.ceoApprovedBy.firstName} {ca.ceoApprovedBy.lastName} on {formatDate(ca.ceoApprovedAt)}</Typography>
            {ca.ceoDigitalSignature && <Typography variant="body2" fontStyle="italic" mt={0.5}>{ca.ceoDigitalSignature}</Typography>}
          </Box>
        )}

        {/* Footer */}
        <Divider sx={{ mt: 4, mb: 1 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          Generated: {new Date().toLocaleString()} — SGC ERP System
        </Typography>
      </Box>

      <style>{`
        @media print {
          .app-print-hide { display: none !important; }
          body { margin: 0; }
          #ca-print-area { max-width: 100% !important; padding: 20px !important; }
        }
      `}</style>
    </Box>
  );
};

const InfoRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, flexShrink: 0 }}>{label}:</Typography>
    <Typography variant="body2" fontWeight={500}>{value || '—'}</Typography>
  </Box>
);

export default CashApprovalDocumentView;
