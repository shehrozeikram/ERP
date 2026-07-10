import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, Stack, CircularProgress, Alert, Chip, Grid, Card, CardContent, Button,
  Avatar, Tabs, Tab, Dialog, DialogTitle, DialogContent, IconButton
} from '@mui/material';
import { ArrowBack as BackIcon, Close as CloseIcon, Visibility as ViewIcon } from '@mui/icons-material';
import api from '../../services/api';
import toast from 'react-hot-toast';
import CentralizedStoreBillInvoiceBody from '../UtilityBill/CentralizedStoreBillInvoiceBody';
import { DigitalSignatureImage } from '../common/DigitalSignatureImage';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_COLOR = {
  paid: 'success',
  partial: 'info',
  pending: 'warning',
  overdue: 'error',
  approved: 'info',
  draft: 'default',
  received: 'default',
  cancelled: 'default'
};

const BILL_STATUS_OPTIONS = ['', 'draft', 'pending', 'approved', 'partial', 'paid', 'overdue', 'cancelled'];

export default function FinanceVendorsAuditPanel({ open = true, embedded = false }) {
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [billStatusFilter, setBillStatusFilter] = useState('');
  const [detailTab, setDetailTab] = useState(0);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBill, setLoadingBill] = useState(false);

  const handleViewBill = async (bill) => {
    try {
      setLoadingBill(true);
      const res = await api.get(`/pre-audit/finance-vendors/bills/${bill._id}`);
      if (res.data?.success) {
        setSelectedBill(res.data.data);
        setViewDialogOpen(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch bill details');
    } finally {
      setLoadingBill(false);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 500, page: 1 };
      if (searchDebounced) params.search = searchDebounced;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/pre-audit/finance-vendors', { params });
      setVendors(res.data?.data?.vendors || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendors');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, statusFilter]);

  const loadVendorDetail = useCallback(async (vendor, billStatus = '') => {
    if (!vendor?._id) return;
    setDetailLoading(true);
    setError('');
    try {
      const params = {};
      if (billStatus) params.billStatus = billStatus;
      const res = await api.get(`/pre-audit/finance-vendors/${vendor._id}`, { params });
      setDetail(res.data?.data || null);
      setSelectedVendor(vendor);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor bills');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !selectedVendor) loadVendors();
  }, [open, selectedVendor, loadVendors]);

  useEffect(() => {
    if (!open) {
      setSelectedVendor(null);
      setDetail(null);
      setDetailTab(0);
      setBillStatusFilter('');
      setSearch('');
      setSearchDebounced('');
    }
  }, [open]);

  useEffect(() => {
    if (selectedVendor && open) {
      loadVendorDetail(selectedVendor, billStatusFilter);
    }
  }, [billStatusFilter, selectedVendor, open, loadVendorDetail]);

  const listTotals = useMemo(() => vendors.reduce(
    (acc, v) => ({
      count: acc.count + 1,
      billed: acc.billed + Number(v.finance?.totalBilled || 0),
      outstanding: acc.outstanding + Number(v.finance?.outstanding || 0)
    }),
    { count: 0, billed: 0, outstanding: 0 }
  ), [vendors]);

  if (!open) return null;

  const supplier = detail?.supplier || selectedVendor;
  const summary = detail?.summary || selectedVendor?.finance || {};

  const vendorListView = (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Vendors (matching filters)</Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">{listTotals.count}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Total billed (PKR)</Typography>
              <Typography variant="h6" fontWeight={700}>{fmt(listTotals.billed)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">Total outstanding (PKR)</Typography>
              <Typography variant="h6" fontWeight={700} color="error.main">{fmt(listTotals.outstanding)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Search vendors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name, ID, email, contact…"
          sx={{ minWidth: 220 }}
        />
        <TextField
          size="small"
          select
          label="Vendor status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="Active">Active</MenuItem>
          <MenuItem value="Inactive">Inactive</MenuItem>
        </TextField>
      </Stack>

      {loading ? (
        <Box py={4} textAlign="center"><CircularProgress size={28} /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell><b>Vendor ID</b></TableCell>
                <TableCell><b>Name</b></TableCell>
                <TableCell><b>Contact</b></TableCell>
                <TableCell align="right"><b>Total billed</b></TableCell>
                <TableCell align="right"><b>Outstanding</b></TableCell>
                <TableCell align="center"><b>Bills</b></TableCell>
                <TableCell><b>Status</b></TableCell>
                <TableCell align="center"><b>Action</b></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No vendors match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((v) => (
                  <TableRow key={v._id} hover>
                    <TableCell>{v.supplierId || '—'}</TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 11 }}>{(v.name || 'V').charAt(0)}</Avatar>
                        {v.name}
                      </Stack>
                    </TableCell>
                    <TableCell>{v.contactPerson || '—'}</TableCell>
                    <TableCell align="right">{fmt(v.finance?.totalBilled)}</TableCell>
                    <TableCell align="right" sx={{ color: (v.finance?.outstanding || 0) > 0 ? 'error.main' : 'inherit' }}>
                      {fmt(v.finance?.outstanding)}
                    </TableCell>
                    <TableCell align="center">{v.finance?.billCount || 0}</TableCell>
                    <TableCell>
                      <Chip label={v.status || '—'} size="small" color={v.status === 'Active' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="center">
                      <Button size="small" variant="outlined" onClick={() => {
                        setDetailTab(0);
                        setBillStatusFilter('');
                        loadVendorDetail(v, '');
                      }}>
                        View bills
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );

  const vendorDetailView = (
    <>
      <Button
        size="small"
        startIcon={<BackIcon />}
        onClick={() => {
          setSelectedVendor(null);
          setDetail(null);
          setBillStatusFilter('');
          setDetailTab(0);
          loadVendors();
        }}
        sx={{ mb: 2 }}
      >
        Back to vendor list
      </Button>

      <Stack direction="row" alignItems="center" gap={1.5} mb={2} flexWrap="wrap">
        <Avatar sx={{ bgcolor: 'primary.main' }}>{(supplier?.name || 'V').charAt(0).toUpperCase()}</Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700}>{supplier?.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {supplier?.supplierId} · {supplier?.contactPerson || '—'} · {supplier?.phone || '—'}
          </Typography>
        </Box>
        <Chip label={supplier?.status || '—'} size="small" color={supplier?.status === 'Active' ? 'success' : 'default'} />
      </Stack>

      {detailLoading ? (
        <Box py={4} textAlign="center"><CircularProgress size={28} /></Box>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: 'Total billed (PKR)', value: summary.totalBilled, color: 'primary.main' },
              { label: 'Total paid (PKR)', value: summary.totalPaid, color: 'success.main' },
              { label: 'Outstanding (PKR)', value: summary.outstanding, color: 'error.main' },
              { label: 'Advance balance (PKR)', value: summary.advanceBalance, color: 'info.main' }
            ].map((c) => (
              <Grid item xs={12} sm={6} md={3} key={c.label}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">{c.label}</Typography>
                    <Typography variant="h6" fontWeight={700} color={c.color}>{fmt(c.value)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper variant="outlined" sx={{ mb: 2 }}>
            <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} variant="scrollable" scrollButtons="auto">
              <Tab label={`AP Bills (${detail?.bills?.length || 0})`} />
              <Tab label={`Advances (${detail?.advances?.length || 0})`} />
            </Tabs>
          </Paper>

          {detailTab === 0 && (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  select
                  label="Bill status"
                  value={billStatusFilter}
                  onChange={(e) => setBillStatusFilter(e.target.value)}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">All statuses</MenuItem>
                  {BILL_STATUS_OPTIONS.filter(Boolean).map((s) => (
                    <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell><b>Bill #</b></TableCell>
                      <TableCell><b>Invoice #</b></TableCell>
                      <TableCell><b>Bill date</b></TableCell>
                      <TableCell><b>Due date</b></TableCell>
                      <TableCell align="right"><b>Total</b></TableCell>
                      <TableCell align="right"><b>Paid</b></TableCell>
                      <TableCell align="right"><b>Balance</b></TableCell>
                      <TableCell><b>Status</b></TableCell>
                      <TableCell align="center"><b>Action</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail?.bills || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          No bills for this vendor{billStatusFilter ? ` with status "${billStatusFilter}"` : ''}.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (detail?.bills || []).map((b) => (
                        <TableRow key={b._id} hover>
                          <TableCell>{b.billNumber || '—'}</TableCell>
                          <TableCell>{b.vendorInvoiceNumber || '—'}</TableCell>
                          <TableCell>{b.billDate ? new Date(b.billDate).toLocaleDateString() : '—'}</TableCell>
                          <TableCell>{b.dueDate ? new Date(b.dueDate).toLocaleDateString() : '—'}</TableCell>
                          <TableCell align="right">{fmt(b.totalAmount)}</TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>{fmt(b.amountPaid)}</TableCell>
                          <TableCell align="right" sx={{ color: 'error.main' }}>{fmt(b.balanceDue)}</TableCell>
                          <TableCell>
                            <Chip label={b.status || '—'} size="small" color={STATUS_COLOR[b.status] || 'default'} />
                          </TableCell>
                          <TableCell align="center">
                            <Button 
                              size="small" 
                              variant="outlined" 
                              startIcon={<ViewIcon />}
                              onClick={() => handleViewBill(b)}
                              disabled={loadingBill}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {detailTab === 1 && (
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><b>Date</b></TableCell>
                    <TableCell><b>Reference</b></TableCell>
                    <TableCell align="right"><b>Amount</b></TableCell>
                    <TableCell align="right"><b>Applied</b></TableCell>
                    <TableCell align="right"><b>Balance</b></TableCell>
                    <TableCell><b>Status</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(detail?.advances || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No vendor advances recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (detail?.advances || []).map((a) => (
                      <TableRow key={a._id} hover>
                        <TableCell>{a.paymentDate ? new Date(a.paymentDate).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>{a.reference || '—'}</TableCell>
                        <TableCell align="right">{fmt(a.amount)}</TableCell>
                        <TableCell align="right">{fmt(a.appliedAmount)}</TableCell>
                        <TableCell align="right">{fmt(a.balance)}</TableCell>
                        <TableCell><Chip label={a.status || '—'} size="small" /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Bill Details Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Bill Details: {selectedBill?.billNumber}
          <IconButton onClick={() => setViewDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedBill && (
            <>
              <CentralizedStoreBillInvoiceBody 
                bill={{
                  ...selectedBill,
                  billId: selectedBill.billNumber,
                  billDate: selectedBill.billDate,
                  createdAt: selectedBill.createdAt || selectedBill.billDate,
                  provider: selectedBill.vendorName || selectedBill.vendor?.name,
                  location: selectedBill.vendor?.address?.city || selectedBill.department || 'N/A',
                  notes: selectedBill.notes || selectedBill.internalNotes,
                  billLines: (selectedBill.lineItems || []).map((line) => ({
                    ...line,
                    itemName: line.description,
                    itemCode: line.itemCode || 'N/A',
                    amount: line.amount || (line.quantity * line.unitPrice)
                  }))
                }}
                showChargesSummary={true}
              />
              {(() => {
                const getApprovalRows = () => {
                  const formatDateTime = (date) => {
                    if (!date) return '-';
                    return new Date(date).toLocaleString('en-PK', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    });
                  };

                  const rows = [];
                  
                  // If linked to a Cash Approval, show its workflow history
                  if (selectedBill?.cashApproval?.workflowHistory?.length > 0) {
                    const history = [...selectedBill.cashApproval.workflowHistory].reverse();
                    history.forEach(entry => {
                      let actionDesc = entry.toStatus;
                      if (entry.comments) {
                        actionDesc += ` (${entry.comments})`;
                      }
                      rows.push({
                        authority: actionDesc,
                        name: [entry.changedBy?.firstName, entry.changedBy?.lastName].filter(Boolean).join(' ') || entry.changedBy?.name || 'System',
                        signatureUser: entry.changedBy,
                        dateTime: entry.changedAt ? formatDateTime(entry.changedAt) : '-'
                      });
                    });
                    return rows;
                  }

                  // If linked to a Purchase Order, show its workflow history
                  if (selectedBill?.poDetail?.po?.workflowHistory?.length > 0) {
                    const history = [...selectedBill.poDetail.po.workflowHistory].reverse();
                    history.forEach(entry => {
                      let actionDesc = entry.toStatus;
                      if (entry.comments) {
                        actionDesc += ` (${entry.comments})`;
                      }
                      rows.push({
                        authority: actionDesc,
                        name: [entry.changedBy?.firstName, entry.changedBy?.lastName].filter(Boolean).join(' ') || entry.changedBy?.name || 'System',
                        signatureUser: entry.changedBy,
                        dateTime: entry.changedAt ? formatDateTime(entry.changedAt) : '-'
                      });
                    });
                    return rows;
                  }

                  // Fallback for bills without workflow history
                  rows.push({
                    authority: 'Preparer',
                    name: [selectedBill?.createdBy?.firstName, selectedBill?.createdBy?.lastName].filter(Boolean).join(' ') || selectedBill?.createdBy?.name || '-',
                    signatureUser: selectedBill?.createdBy,
                    dateTime: selectedBill?.createdAt ? formatDateTime(selectedBill.createdAt) : '-'
                  });

                  if (selectedBill?.approval?.approvedBy) {
                    rows.push({
                      authority: 'Approver',
                      name: [selectedBill.approval.approvedBy?.firstName, selectedBill.approval.approvedBy?.lastName].filter(Boolean).join(' ') || selectedBill.approval.approvedBy?.name || '-',
                      signatureUser: selectedBill.approval.approvedBy,
                      dateTime: selectedBill.approval.approvedDate ? formatDateTime(selectedBill.approval.approvedDate) : '-'
                    });
                  }
                  return rows;
                };
                const getSignatureSource = (row) => row?.signatureUser?.digitalSignature || '';
                return (
                  <Table
                    size="small"
                    sx={{
                      mt: 4,
                      mb: 2,
                      border: '1px solid',
                      borderColor: 'grey.300',
                      '& th': {
                        bgcolor: 'grey.100',
                        fontWeight: 800,
                        fontSize: 14,
                        borderBottom: '1px solid',
                        borderColor: 'grey.300'
                      },
                      '& td': {
                        fontSize: 14,
                        borderBottom: '1px solid',
                        borderColor: 'grey.200',
                        py: 1.4
                      },
                      '& tr:last-child td': {
                        borderBottom: 0
                      }
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Authority</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Digital Signature</TableCell>
                        <TableCell>Date &amp; Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {getApprovalRows().map((row) => (
                        <TableRow key={row.authority}>
                          <TableCell sx={{ fontWeight: 800 }}>{row.authority}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>
                            {getSignatureSource(row) ? (
                              <DigitalSignatureImage userOrPath={getSignatureSource(row)} alt={`${row.authority} signature`} />
                            ) : (
                              row.signature || '-'
                            )}
                          </TableCell>
                          <TableCell>{row.dateTime}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  const content = (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {selectedVendor ? vendorDetailView : vendorListView}
    </>
  );

  if (embedded) {
    return <Box>{content}</Box>;
  }

  return (
    <Paper variant="outlined" sx={{ mb: 3, p: 2, bgcolor: 'grey.50' }}>
      {content}
    </Paper>
  );
}
