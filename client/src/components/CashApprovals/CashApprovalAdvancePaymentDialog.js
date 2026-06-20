import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  Typography,
  CircularProgress
} from '@mui/material';
import procurementService from '../../services/procurementService';
import { formatPKR } from '../../utils/currency';
import { isGeneralModuleCashApproval } from './cashApprovalGeneralDocumentUtils';
import { useCashApprovalPaymentFields } from './useCashApprovalPaymentFields';
import CashApprovalPaymentFieldsView from './CashApprovalPaymentFieldsView';

const CashApprovalAdvancePaymentDialog = ({
  open,
  onClose,
  ca,
  onSuccess,
  onError
}) => {
  const [processing, setProcessing] = useState(false);
  const payment = useCashApprovalPaymentFields(ca, { active: open, includePendingFinance: false, seedCaId: ca?._id });

  const handleOutstandingRowChange = (idx, value, maxOutstanding) => {
    const next = [...payment.outstandingTransactions];
    const v = Math.max(0, Math.min(Number(value) || 0, maxOutstanding || 0));
    next[idx] = { ...next[idx], payAmount: v };
    payment.setOutstandingTransactions(next);
    const total = Math.round(next.reduce((s, r) => s + (Number(r.payAmount) || 0), 0) * 100) / 100;
    payment.setPaymentData((prev) => ({ ...prev, amount: total }));
  };

  const handlePayeeChange = async (employeeId) => {
    const row = payment.payeeEmployees.find((v) => String(v.employeeId) === String(employeeId));
    payment.setSelectedPayee({ employeeId, employeeName: row?.employeeName || '' });
    await payment.loadOutstandingByEmployee(employeeId, null);
  };

  const handlePostPayment = async () => {
    const payRows = payment.getAllocationRows();
    if (!payRows.length) {
      onError?.('Enter payment amount against at least one outstanding cash approval');
      return;
    }
    if (!payment.paymentData.reference?.trim()) {
      onError?.('Reference / Cheque # / TT # is required');
      return;
    }
    const primaryId = payRows[0]?.cashApprovalId || ca?._id;
    if (!primaryId) {
      onError?.('No cash approval selected for payment');
      return;
    }
    try {
      setProcessing(true);
      const res = await procurementService.caIssueAdvance(primaryId, {
        paymentMethod: payment.paymentData.paymentMethod,
        bankAccountId: payment.paymentData.bankAccountId || null,
        reference: payment.paymentData.reference,
        paymentDate: payment.paymentData.paymentDate,
        whtRate: Number(payment.paymentData.whtRate) || 0,
        advanceRemarks: payment.paymentData.advanceRemarks,
        allocations: payRows
      });
      onSuccess?.(res?.message || 'Advance payment posted');
      onClose();
    } catch (err) {
      onError?.(err.response?.data?.message || 'Failed to post advance payment');
    } finally {
      setProcessing(false);
    }
  };

  if (!ca || !isGeneralModuleCashApproval(ca)) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Cash Approval Payment
        <Typography variant="body2" color="text.secondary">
          Amount to post: {formatPKR(payment.paymentData.amount || 0)}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <CashApprovalPaymentFieldsView
            ca={ca}
            payeeEmployees={payment.payeeEmployees}
            selectedPayee={payment.selectedPayee}
            onPayeeChange={handlePayeeChange}
            paymentData={payment.paymentData}
            onPaymentDataChange={payment.setPaymentData}
            bankAccounts={payment.bankAccounts}
            outstandingTransactions={payment.outstandingTransactions}
            onOutstandingRowChange={handleOutstandingRowChange}
            loadingOutstanding={payment.loadingOutstanding}
          />
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label="Remarks"
              value={payment.paymentData.advanceRemarks}
              onChange={(e) => payment.setPaymentData({ ...payment.paymentData, advanceRemarks: e.target.value })}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handlePostPayment}
          disabled={processing || !payment.paymentData.amount}
        >
          {processing ? <CircularProgress size={20} /> : 'Post Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CashApprovalAdvancePaymentDialog;
