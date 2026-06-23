import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { numberToWords } from '../../utils/numberToWords';

export const DEFAULT_TRANSFER_PAYMENT_TYPES = [
  'District Council Fee',
  'Stamp Duty',
  'Tehsil Fee',
  'Form No.32',
  'Miscellaneous Charges',
  'Advance Tax',
  'PLRA (Punjab Land Records Authority)'
];

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const makeRowId = () => `tp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const defaultTransferPaymentRows = () =>
  DEFAULT_TRANSFER_PAYMENT_TYPES.map((paymentType) => ({
    _localId: makeRowId(),
    paymentType,
    amount: '',
    amountInWords: ''
  }));

export const mapTransferPaymentsFromApi = (rows = []) => {
  if (!rows.length) return defaultTransferPaymentRows();
  return rows.map((row) => ({
    ...row,
    _localId: row._id || makeRowId(),
    paymentType: row.paymentType || '',
    status: row.status || 'Paid',
    amount: row.amount ?? '',
    amountInWords: row.amountInWords || ''
  }));
};

export const serializeTransferPayments = (rows = []) =>
  rows
    .filter((row) => row.paymentType)
    .map((row) => {
      const { _localId, ...rest } = row;
      return {
        ...rest,
        paymentType: row.paymentType,
        status: row.status || 'Paid',
        amount: Number(row.amount) || 0,
        amountInWords: numberToWords(Number(row.amount) || 0)
      };
    });

export default function LandTransferPaymentsPanel({ payments, onChange, customTypes = [], onAddCustomType, readOnly = false }) {
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  const paymentTypeOptions = useMemo(() => {
    const fromRows = payments.map((row) => row.paymentType).filter(Boolean);
    const merged = [...DEFAULT_TRANSFER_PAYMENT_TYPES, ...customTypes, ...fromRows];
    return [...new Set(merged)];
  }, [payments, customTypes]);

  const totalAmount = useMemo(
    () => payments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [payments]
  );

  const totalInWords = useMemo(() => numberToWords(totalAmount), [totalAmount]);

  const updateRow = (localId, patch) => {
    onChange(payments.map((row) => (row._localId === localId ? { ...row, ...patch } : row)));
  };

  const handleAmountChange = (localId, value) => {
    updateRow(localId, {
      amount: value,
      amountInWords: value === '' ? '' : numberToWords(Number(value) || 0)
    });
  };

  const addRow = (paymentType = '') => {
    onChange([
      ...payments,
      { _localId: makeRowId(), paymentType, status: 'Pending', amount: '', amountInWords: '' }
    ]);
  };

  const removeRow = (localId) => {
    onChange(payments.filter((row) => row._localId !== localId));
  };

  const handleAddCustomType = () => {
    const name = newTypeName.trim();
    if (!name) return;
    onAddCustomType?.(name);
    addRow(name);
    setNewTypeName('');
    setNewTypeOpen(false);
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>Transfer Payments</Typography>
        {!readOnly && (
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addRow()}>
              Add Transfer Payment
            </Button>
            <Button size="small" variant="contained" onClick={() => setNewTypeOpen(true)}>
              Add New Payment Type
            </Button>
          </Stack>
        )}
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText', minWidth: 180 }}>Payment Type</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText', width: 140 }} align="right">Amount</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText' }}>Amount in Words</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText', minWidth: 120 }}>Status</TableCell>
              {!readOnly && <TableCell sx={{ fontWeight: 700, color: 'primary.contrastText', width: 80 }} align="center">Action</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 4 : 5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No transfer payments added yet.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((row) => (
                <TableRow key={row._localId} hover>
                  <TableCell>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={row.paymentType}
                      onChange={(e) => updateRow(row._localId, { paymentType: e.target.value })}
                      InputProps={{ readOnly }}
                      sx={readOnly ? { '& .MuiInputBase-root': { bgcolor: 'grey.50' }, pointerEvents: 'none' } : {}}
                    >
                      <MenuItem value="">Select type</MenuItem>
                      {paymentTypeOptions.map((type) => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={row.amount}
                      onChange={(e) => handleAmountChange(row._localId, e.target.value)}
                      inputProps={{ min: 0, step: 0.01, readOnly }}
                      sx={{ maxWidth: 140, ml: 'auto', ...(readOnly && { '& .MuiInputBase-root': { bgcolor: 'grey.50' } }) }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      size="small"
                      value={row.amountInWords || (row.amount !== '' ? numberToWords(Number(row.amount) || 0) : '')}
                      InputProps={{ readOnly: true }}
                      sx={{ '& .MuiInputBase-input': { bgcolor: 'grey.50' } }}
                    />
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{
                          color: row.status === 'Paid' ? 'success.main' : row.status === 'Partial' ? 'warning.main' : 'error.main'
                        }}
                      >
                        {row.status || 'Paid'}
                      </Typography>
                    ) : (
                      <TextField
                        select
                        fullWidth
                        size="small"
                        value={row.status || 'Paid'}
                        onChange={(e) => updateRow(row._localId, { status: e.target.value })}
                        sx={{
                          '& .MuiInputBase-root': {
                            color: row.status === 'Paid' ? 'success.main' : row.status === 'Partial' ? 'warning.main' : 'error.main',
                            fontWeight: 700
                          }
                        }}
                      >
                        <MenuItem value="Pending">Pending</MenuItem>
                        <MenuItem value="Partial">Partial</MenuItem>
                        <MenuItem value="Paid">Paid</MenuItem>
                      </TextField>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell align="center">
                      <IconButton size="small" color="error" onClick={() => removeRow(row._localId)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
            <TableRow sx={{ bgcolor: 'primary.dark' }}>
              <TableCell sx={{ color: 'primary.contrastText', fontWeight: 700 }}>Total</TableCell>
              <TableCell align="right" sx={{ color: 'primary.contrastText', fontWeight: 700 }}>
                {formatMoney(totalAmount)}
              </TableCell>
              <TableCell sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                {totalInWords}
              </TableCell>
              <TableCell />
              {!readOnly && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={newTypeOpen} onClose={() => setNewTypeOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add New Payment Type</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            autoFocus
            label="Payment type name"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="e.g. Legal Fee"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTypeOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddCustomType} disabled={!newTypeName.trim()}>
            Add Type
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
