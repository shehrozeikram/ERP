import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, MenuItem, Button, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox
} from '@mui/material';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';

const VendorBills = () => {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [grns, setGrns] = useState([]);
  const [selected, setSelected] = useState({});
  const [allocations, setAllocations] = useState({});
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/procurement/vendors', { params: { limit: 1000 } });
        setVendors(res.data?.data?.vendors || []);
      } catch {
        setError('Failed to load vendors');
      }
    })();
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setGrns([]);
      setSelected({});
      setAllocations({});
      return;
    }
    (async () => {
      try {
        const res = await api.get('/procurement/vendor-bills/billable-grns', { params: { vendorId } });
        setGrns(res.data?.data?.grns || []);
        setSelected({});
        setAllocations({});
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load billable GRNs');
      }
    })();
  }, [vendorId]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const total = useMemo(() => grns.filter((g) => selected[g._id]).reduce((s, g) => s + (Number(allocations[g._id]) || 0), 0), [grns, selected, allocations]);

  const onCreate = async () => {
    if (!vendorId || selectedIds.length === 0) {
      setError('Select vendor and at least one GRN');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await api.post('/procurement/vendor-bills', {
        vendorId,
        grnIds: selectedIds,
        grnAllocations: selectedIds.map((id) => ({ grnId: id, amount: Number(allocations[id]) || 0 })).filter((x) => x.amount > 0),
        billDate,
        paymentTerms,
        vendorInvoiceNumber,
        notes
      });
      setSuccess(`Bill created: ${res.data?.data?.billNumber || 'success'}`);
      setSelected({});
      setAllocations({});
      const refresh = await api.get('/procurement/vendor-bills/billable-grns', { params: { vendorId } });
      setGrns(refresh.data?.data?.grns || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create vendor bill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>Procurement Vendor Bill</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField fullWidth select label="Supplier/Vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <MenuItem value="">Select vendor</MenuItem>
              {vendors.map((v) => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField fullWidth type="date" label="Bill Date" value={billDate} onChange={(e) => setBillDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField fullWidth select label="Terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
              <MenuItem value="due_on_receipt">Due on receipt</MenuItem>
              <MenuItem value="net_15">Net 15</MenuItem>
              <MenuItem value="net_30">Net 30</MenuItem>
              <MenuItem value="net_45">Net 45</MenuItem>
              <MenuItem value="net_60">Net 60</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField fullWidth label="Vendor Bill No." value={vendorInvoiceNumber} onChange={(e) => setVendorInvoiceNumber(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button fullWidth variant="contained" disabled={loading || !vendorId || selectedIds.length === 0} onClick={onCreate}>
              Create Bill
            </Button>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          Billable GRNs (Bill -> GRN -> PO) | Selected Total: {formatPKR(total)}
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>GRN</TableCell>
                <TableCell>PO</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Billing</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Billed</TableCell>
                <TableCell align="right">Remaining</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grns.map((g) => (
                <TableRow key={g._id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={!!selected[g._id]}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelected((p) => ({ ...p, [g._id]: checked }));
                        if (checked) {
                          setAllocations((p) => ({ ...p, [g._id]: Number(g.remainingAmount) || 0 }));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>{g.receiveNumber}</TableCell>
                  <TableCell>{g.poNumber || '-'}</TableCell>
                  <TableCell>{g.status}</TableCell>
                  <TableCell>{g.billingStatus}</TableCell>
                  <TableCell align="right">{formatPKR(g.amount || 0)}</TableCell>
                  <TableCell align="right">{formatPKR(g.billedAmount || 0)}</TableCell>
                  <TableCell align="right">{formatPKR(g.remainingAmount || 0)}</TableCell>
                  <TableCell align="right" sx={{ width: 180 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={allocations[g._id] ?? (selected[g._id] ? (Number(g.remainingAmount) || 0) : 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        setAllocations((p) => ({ ...p, [g._id]: v }));
                      }}
                      inputProps={{ min: 0, max: Number(g.remainingAmount) || 0, step: 0.01 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {grns.length === 0 && (
                <TableRow><TableCell colSpan={9} align="center">No billable GRNs for selected vendor</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default VendorBills;

