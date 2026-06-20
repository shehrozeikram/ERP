import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  LinearProgress
} from '@mui/material';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import { formatPayFromAccountLabel } from '../../utils/payFromAccounts';
import CashApprovalCompanyChip from './CashApprovalCompanyChip';

const CashApprovalPaymentFieldsView = ({
  payeeEmployees,
  selectedPayee,
  onPayeeChange,
  paymentData,
  onPaymentDataChange,
  bankAccounts,
  outstandingTransactions,
  onOutstandingRowChange,
  loadingOutstanding,
  showAmountSubtitle = false,
  referenceRequired = false,
  ca = null
}) => (
  <>
    {ca && (
      <Grid item xs={12}>
        <CashApprovalCompanyChip ca={ca} />
      </Grid>
    )}
    {showAmountSubtitle && (
      <Grid item xs={12}>
        <Typography variant="body2" color="text.secondary">
          Amount to post: {formatPKR(paymentData.amount || 0)}
        </Typography>
      </Grid>
    )}
    <Grid item xs={12}>
      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
        <Grid container spacing={1}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Payee (Employee)</InputLabel>
              <Select
                value={selectedPayee.employeeId || ''}
                label="Payee (Employee)"
                onChange={(e) => onPayeeChange(e.target.value)}
              >
                {payeeEmployees.map((v) => (
                  <MenuItem key={v.employeeId} value={v.employeeId}>
                    {v.employeeCode ? `${v.employeeCode} — ` : ''}{v.employeeName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="caption" color="text.secondary">Selected Employee</Typography>
            <Typography fontWeight={700}>{selectedPayee.employeeName || '—'}</Typography>
          </Grid>
        </Grid>
      </Paper>
    </Grid>
    <Grid item xs={6}>
      <TextField
        fullWidth
        label="Payment Amount (PKR)"
        type="number"
        value={paymentData.amount}
        onChange={(e) => onPaymentDataChange({ ...paymentData, amount: Number(e.target.value) })}
        size="small"
        inputProps={{ min: 0, step: 0.01 }}
      />
    </Grid>
    <Grid item xs={6}>
      <TextField
        fullWidth
        label="WHT Rate %"
        type="number"
        placeholder="e.g. 4.5"
        value={paymentData.whtRate || ''}
        onChange={(e) => onPaymentDataChange({ ...paymentData, whtRate: e.target.value })}
        size="small"
        inputProps={{ min: 0, max: 30, step: 0.01 }}
        helperText={paymentData.whtRate > 0
          ? `WHT: PKR ${((paymentData.amount || 0) * (paymentData.whtRate / 100)).toFixed(2)} — Net to bank: PKR ${((paymentData.amount || 0) * (1 - paymentData.whtRate / 100)).toFixed(2)}`
          : 'Leave 0 if no WHT applies'}
      />
    </Grid>
    <Grid item xs={6}>
      <FormControl fullWidth size="small">
        <InputLabel>Payment Method</InputLabel>
        <Select
          value={paymentData.paymentMethod}
          onChange={(e) => onPaymentDataChange({ ...paymentData, paymentMethod: e.target.value })}
          label="Payment Method"
        >
          <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
          <MenuItem value="check">Check / Cheque</MenuItem>
          <MenuItem value="cash">Cash</MenuItem>
          <MenuItem value="other">Other</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid item xs={6}>
      <FormControl fullWidth size="small">
        <InputLabel>Pay From Account</InputLabel>
        <Select
          value={paymentData.bankAccountId || ''}
          onChange={(e) => onPaymentDataChange({ ...paymentData, bankAccountId: e.target.value })}
          label="Pay From Account"
        >
          <MenuItem value="">— Auto (default bank) —</MenuItem>
          {bankAccounts.map((item) => {
            const account = item?.account || item;
            const depth = item?.depth || 0;
            return (
              <MenuItem key={account._id} value={account._id}>
                {formatPayFromAccountLabel(account, depth)}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Grid>
    <Grid item xs={6}>
      <TextField
        fullWidth
        label="Payment Date"
        type="date"
        value={paymentData.paymentDate}
        onChange={(e) => onPaymentDataChange({ ...paymentData, paymentDate: e.target.value })}
        InputLabelProps={{ shrink: true }}
        size="small"
      />
    </Grid>
    <Grid item xs={6}>
      <TextField
        fullWidth
        required={referenceRequired}
        label="Reference / Cheque # / TT #"
        value={paymentData.reference}
        onChange={(e) => onPaymentDataChange({ ...paymentData, reference: e.target.value })}
        size="small"
        helperText={referenceRequired ? 'Required when creating voucher' : undefined}
      />
    </Grid>
    <Grid item xs={12}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Outstanding Transactions</Typography>
        {loadingOutstanding ? (
          <LinearProgress />
        ) : outstandingTransactions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No outstanding cash approvals for selected employee.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>CA #</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="right">Original Amount</TableCell>
                <TableCell align="right">Open Balance</TableCell>
                <TableCell align="right">Payment</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {outstandingTransactions.map((row, idx) => (
                <TableRow key={row.cashApprovalId}>
                  <TableCell>{row.caNumber}</TableCell>
                  <TableCell>{formatDate(row.dueDate)}</TableCell>
                  <TableCell align="right">{formatPKR(row.totalAmount)}</TableCell>
                  <TableCell align="right">{formatPKR(row.outstanding)}</TableCell>
                  <TableCell align="right" sx={{ minWidth: 160 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={row.payAmount}
                      inputProps={{ min: 0, max: row.outstanding, step: 0.01 }}
                      onChange={(e) => onOutstandingRowChange(idx, e.target.value, row.outstanding)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Grid>
  </>
);

export default CashApprovalPaymentFieldsView;
