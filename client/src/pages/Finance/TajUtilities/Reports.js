import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
  Grid
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { fetchAllInvoices } from '../../../services/propertyInvoiceService';
import { fetchResidents } from '../../../services/tajResidentsService';
import { fetchProperties } from '../../../services/tajPropertiesService';
import { fetchReceipts } from '../../../services/propertyReceiptService';
import { fetchSectors } from '../../../services/tajSectorsService';
import { fetchAllDeposits, fetchResidentTransactions } from '../../../services/tajResidentsService';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const formatDate = (date) => (date ? dayjs(date).format('DD MMM YYYY') : '-');

// Helper function to calculate adjusted grandTotal for overdue unpaid invoices
const getAdjustedGrandTotal = (invoice) => {
  if (!invoice) return 0;
  
  const invoiceDueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const dueStart = invoiceDueDate ? new Date(invoiceDueDate) : null; if (dueStart) dueStart.setHours(0, 0, 0, 0);
  const isOverdue = dueStart && todayStart > dueStart;
  const isUnpaid = invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial_paid' || (invoice.balance || 0) > 0;
  
  if (!isOverdue || !isUnpaid) {
    return invoice.grandTotal || 0;
  }
  
  let chargesForMonth = invoice.subtotal || 0;
  
  if (invoice.charges && Array.isArray(invoice.charges) && invoice.charges.length > 0) {
    const totalChargesAmount = invoice.charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
    if (totalChargesAmount > 0) {
      chargesForMonth = totalChargesAmount;
    }
  }
  
  const latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
  const originalGrandTotal = invoice.grandTotal || (chargesForMonth + (invoice.totalArrears || 0));
  
  return originalGrandTotal + latePaymentSurcharge;
};

const Reports = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filters
  const [dateFrom, setDateFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedResident, setSelectedResident] = useState(null);
  const [selectedSector, setSelectedSector] = useState(null);
  const [chargeTypeFilter, setChargeTypeFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Data
  const [invoices, setInvoices] = useState([]);
  const [residents, setResidents] = useState([]);
  const [properties, setProperties] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [residentsRes, propertiesRes, sectorsRes] = await Promise.all([
          fetchResidents({ isActive: 'true' }),
          fetchProperties({}),
          fetchSectors({ isActive: 'true' })
        ]);
        setResidents(residentsRes.data?.data || []);
        setProperties(propertiesRes.data?.data || []);
        setSectors(sectorsRes.data?.data || []);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadFilterOptions();
  }, []);
  
  // Load report data
  const loadReportData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {
        page: 1,
        limit: 10000 // Get all records for reports
      };
      
      // Apply filters
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (selectedProperty) params.propertyId = selectedProperty._id;
      if (selectedResident) params.residentId = selectedResident._id;
      if (selectedSector) {
        const sectorName = selectedSector.name || selectedSector.sectorName || selectedSector;
        params.sector = sectorName;
      }
      if (chargeTypeFilter !== 'all') {
        if (chargeTypeFilter === 'OPEN_INVOICE') {
          params.openInvoices = 'true';
        } else {
          params.chargeType = chargeTypeFilter;
        }
      }
      if (paymentStatusFilter !== 'all') params.paymentStatus = paymentStatusFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      // Load invoices
      const invoicesRes = await fetchAllInvoices(params);
      setInvoices(invoicesRes.data?.data || []);
      
      // Load receipts if needed
      if (activeTab === 4) { // Payments tab
        const receiptsRes = await fetchReceipts({
          dateFrom,
          dateTo,
          propertyId: selectedProperty?._id,
          residentId: selectedResident?._id
        });
        setReceipts(receiptsRes.data?.data || []);
      }
      
      // Load transactions if needed
      if (activeTab === 0 && selectedResident) { // Residents tab with selected resident
        const transactionsRes = await fetchResidentTransactions(selectedResident._id, {
          dateFrom,
          dateTo
        });
        setTransactions(transactionsRes.data?.data || []);
      }
      
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, selectedProperty, selectedResident, selectedSector, chargeTypeFilter, paymentStatusFilter, statusFilter]);
  
  useEffect(() => {
    loadReportData();
  }, [loadReportData]);
  
  // Filtered and processed data based on active tab
  const reportData = useMemo(() => {
    switch (activeTab) {
      case 0: // Residents Report
        return residents.map(resident => {
          const residentInvoices = invoices.filter(inv => 
            inv.property?.resident?._id === resident._id || 
            inv.property?.residentId === resident._id
          );
          const totalInvoices = residentInvoices.length;
          const totalAmount = residentInvoices.reduce((sum, inv) => sum + getAdjustedGrandTotal(inv), 0);
          const totalPaid = residentInvoices.reduce((sum, inv) => sum + (inv.totalPaid || 0), 0);
          const totalBalance = totalAmount - totalPaid;
          
          return {
            ...resident,
            totalInvoices,
            totalAmount,
            totalPaid,
            totalBalance,
            invoices: residentInvoices
          };
        });
        
      case 1: // CAM Charges Report
        return invoices.filter(inv => 
          inv.chargeTypes?.includes('CAM')
        ).map(invoice => ({
          ...invoice,
          adjustedGrandTotal: getAdjustedGrandTotal(invoice),
          balance: getAdjustedGrandTotal(invoice) - (invoice.totalPaid || 0)
        }));
        
      case 2: // Electricity Bills Report
        return invoices.filter(inv => 
          inv.chargeTypes?.includes('ELECTRICITY')
        ).map(invoice => ({
          ...invoice,
          adjustedGrandTotal: getAdjustedGrandTotal(invoice),
          balance: getAdjustedGrandTotal(invoice) - (invoice.totalPaid || 0)
        }));
        
      case 3: // Rental Management Report
        return invoices.filter(inv => 
          inv.chargeTypes?.includes('RENT')
        ).map(invoice => ({
          ...invoice,
          adjustedGrandTotal: getAdjustedGrandTotal(invoice),
          balance: getAdjustedGrandTotal(invoice) - (invoice.totalPaid || 0)
        }));
        
      case 4: // Payments Report
        return receipts;
        
      case 5: // Invoices Report
      default:
        return invoices.map(invoice => ({
          ...invoice,
          adjustedGrandTotal: getAdjustedGrandTotal(invoice),
          balance: getAdjustedGrandTotal(invoice) - (invoice.totalPaid || 0)
        }));
    }
  }, [activeTab, invoices, residents, receipts]);
  
  // Summary statistics
  const summary = useMemo(() => {
    const data = reportData;
    return {
      totalRecords: data.length,
      totalAmount: data.reduce((sum, item) => sum + (item.adjustedGrandTotal || item.totalAmount || item.grandTotal || item.amount || 0), 0),
      totalPaid: data.reduce((sum, item) => sum + (item.totalPaid || item.paidAmount || 0), 0),
      totalBalance: data.reduce((sum, item) => sum + (item.balance || item.totalBalance || 0), 0)
    };
  }, [reportData]);
  
  const handleExport = () => {
    // TODO: Implement export functionality
    alert('Export functionality will be implemented');
  };
  
  const getChargeTypesLabel = (chargeTypes) => {
    if (!chargeTypes || chargeTypes.length === 0) return '—';
    return chargeTypes.map(type => {
      switch (type) {
        case 'ELECTRICITY': return 'Electricity';
        case 'CAM': return 'CAM';
        case 'RENT': return 'Rent';
        default: return type;
      }
    }).join(', ');
  };
  
  const getPaymentStatusConfig = (status) => {
    const normalized = (status || 'unpaid').toLowerCase();
    switch (normalized) {
      case 'paid':
        return { color: 'success', label: 'Paid' };
      case 'partial_paid':
      case 'partial':
        return { color: 'warning', label: 'Partial Paid' };
      case 'unpaid':
      default:
        return { color: 'error', label: 'Unpaid' };
    }
  };
  
  const renderResidentsReport = () => (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Resident ID</strong></TableCell>
            <TableCell><strong>Name</strong></TableCell>
            <TableCell><strong>Contact</strong></TableCell>
            <TableCell align="right"><strong>Total Invoices</strong></TableCell>
            <TableCell align="right"><strong>Total Amount</strong></TableCell>
            <TableCell align="right"><strong>Total Paid</strong></TableCell>
            <TableCell align="right"><strong>Balance</strong></TableCell>
            <TableCell align="right"><strong>Current Balance</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reportData.map((resident) => (
            <TableRow key={resident._id} hover>
              <TableCell>{resident.residentId || '-'}</TableCell>
              <TableCell>{resident.name || '-'}</TableCell>
              <TableCell>{resident.contactNumber || '-'}</TableCell>
              <TableCell align="right">{resident.totalInvoices || 0}</TableCell>
              <TableCell align="right">{formatCurrency(resident.totalAmount || 0)}</TableCell>
              <TableCell align="right">{formatCurrency(resident.totalPaid || 0)}</TableCell>
              <TableCell align="right">
                <Typography color={(resident.totalBalance || 0) > 0 ? 'error.main' : 'success.main'}>
                  {formatCurrency(resident.totalBalance || 0)}
                </Typography>
              </TableCell>
              <TableCell align="right">{formatCurrency(resident.balance || 0)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
  
  const renderInvoicesReport = () => (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Invoice #</strong></TableCell>
            <TableCell><strong>Property</strong></TableCell>
            <TableCell><strong>Resident</strong></TableCell>
            <TableCell><strong>Charge Types</strong></TableCell>
            <TableCell><strong>Invoice Date</strong></TableCell>
            <TableCell><strong>Due Date</strong></TableCell>
            <TableCell align="right"><strong>Grand Total</strong></TableCell>
            <TableCell align="right"><strong>Paid</strong></TableCell>
            <TableCell align="right"><strong>Balance</strong></TableCell>
            <TableCell><strong>Status</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reportData.map((invoice) => (
            <TableRow key={invoice._id} hover>
              <TableCell>{invoice.invoiceNumber || '-'}</TableCell>
              <TableCell>
                {invoice.property ? (
                  invoice.property.propertyName || invoice.property.plotNumber || '-'
                ) : (
                  invoice.customerName || 'Open Invoice'
                )}
              </TableCell>
              <TableCell>
                {invoice.property?.resident?.name || invoice.property?.ownerName || invoice.customerName || '-'}
              </TableCell>
              <TableCell>{getChargeTypesLabel(invoice.chargeTypes)}</TableCell>
              <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
              <TableCell>{formatDate(invoice.dueDate)}</TableCell>
              <TableCell align="right">{formatCurrency(invoice.adjustedGrandTotal || invoice.grandTotal || 0)}</TableCell>
              <TableCell align="right">{formatCurrency(invoice.totalPaid || 0)}</TableCell>
              <TableCell align="right">
                <Typography color={(invoice.balance || 0) > 0 ? 'error.main' : 'success.main'}>
                  {formatCurrency(invoice.balance || 0)}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={getPaymentStatusConfig(invoice.paymentStatus).label}
                  color={getPaymentStatusConfig(invoice.paymentStatus).color}
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
  
  const renderPaymentsReport = () => (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Receipt #</strong></TableCell>
            <TableCell><strong>Date</strong></TableCell>
            <TableCell><strong>Property</strong></TableCell>
            <TableCell><strong>Resident</strong></TableCell>
            <TableCell align="right"><strong>Amount</strong></TableCell>
            <TableCell><strong>Payment Method</strong></TableCell>
            <TableCell><strong>Status</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reportData.map((receipt) => (
            <TableRow key={receipt._id} hover>
              <TableCell>{receipt.receiptNumber || '-'}</TableCell>
              <TableCell>{formatDate(receipt.receiptDate || receipt.createdAt)}</TableCell>
              <TableCell>
                {receipt.property?.propertyName || receipt.property?.plotNumber || '-'}
              </TableCell>
              <TableCell>
                {receipt.resident?.name || receipt.property?.ownerName || '-'}
              </TableCell>
              <TableCell align="right">{formatCurrency(receipt.totalAmount || 0)}</TableCell>
              <TableCell>{receipt.paymentMethod || '-'}</TableCell>
              <TableCell>
                <Chip label={receipt.status || 'Active'} color="success" size="small" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
  
  const renderReportContent = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }
    
    if (error) {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      );
    }
    
    if (reportData.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">No data found for the selected filters</Typography>
        </Box>
      );
    }
    
    switch (activeTab) {
      case 0:
        return renderResidentsReport();
      case 1:
      case 2:
      case 3:
      case 5:
        return renderInvoicesReport();
      case 4:
        return renderPaymentsReport();
      default:
        return renderInvoicesReport();
    }
  };
  
  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <AssessmentIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Taj Utilities & Charges Reports
          </Typography>
          <Typography color="text.secondary">
            Comprehensive reports for residents, invoices, and payments
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadReportData}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={loading || reportData.length === 0}
          >
            Export
          </Button>
        </Stack>
      </Stack>
      
      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Date From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Date To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Autocomplete
                size="small"
                options={properties}
                getOptionLabel={(option) => 
                  `${option.propertyName || option.plotNumber || 'N/A'} - ${option.ownerName || 'N/A'}`
                }
                value={selectedProperty}
                onChange={(event, newValue) => setSelectedProperty(newValue)}
                filterOptions={(options, { inputValue }) => {
                  const searchValue = inputValue.toLowerCase();
                  return options.filter((option) => {
                    const propertyName = (option.propertyName || '').toLowerCase();
                    const plotNumber = (option.plotNumber || '').toLowerCase();
                    const ownerName = (option.ownerName || '').toLowerCase();
                    const srNo = String(option.srNo || '').toLowerCase();
                    const propertyId = String(option._id || '').toLowerCase();
                    return (
                      propertyName.includes(searchValue) ||
                      plotNumber.includes(searchValue) ||
                      ownerName.includes(searchValue) ||
                      srNo.includes(searchValue) ||
                      propertyId.includes(searchValue)
                    );
                  });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Property" placeholder="Search by name, plot, ID..." />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Autocomplete
                size="small"
                options={residents}
                getOptionLabel={(option) => option.name || ''}
                value={selectedResident}
                onChange={(event, newValue) => setSelectedResident(newValue)}
                filterOptions={(options, { inputValue }) => {
                  const searchValue = inputValue.toLowerCase();
                  return options.filter((option) => {
                    const name = (option.name || '').toLowerCase();
                    const residentId = (option.residentId || '').toLowerCase();
                    const contactNumber = (option.contactNumber || '').toLowerCase();
                    const cnic = (option.cnic || '').toLowerCase();
                    const residentIdStr = String(option._id || '').toLowerCase();
                    return (
                      name.includes(searchValue) ||
                      residentId.includes(searchValue) ||
                      contactNumber.includes(searchValue) ||
                      cnic.includes(searchValue) ||
                      residentIdStr.includes(searchValue)
                    );
                  });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Resident" placeholder="Search by name, ID, CNIC..." />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Autocomplete
                size="small"
                options={sectors}
                getOptionLabel={(option) => option.name || option.sectorName || String(option)}
                value={selectedSector}
                onChange={(event, newValue) => setSelectedSector(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="Sector" placeholder="All Sectors" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Charge Type</InputLabel>
                <Select
                  value={chargeTypeFilter}
                  label="Charge Type"
                  onChange={(e) => setChargeTypeFilter(e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="ELECTRICITY">Electricity</MenuItem>
                  <MenuItem value="CAM">CAM</MenuItem>
                  <MenuItem value="RENT">Rent</MenuItem>
                  <MenuItem value="OPEN_INVOICE">Open Invoice</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Payment Status</InputLabel>
                <Select
                  value={paymentStatusFilter}
                  label="Payment Status"
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                  <MenuItem value="partial_paid">Partial Paid</MenuItem>
                  <MenuItem value="unpaid">Unpaid</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="Issued">Issued</MenuItem>
                  <MenuItem value="Draft">Draft</MenuItem>
                  <MenuItem value="Cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Records</Typography>
              <Typography variant="h5" fontWeight={600}>
                {summary.totalRecords}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Amount</Typography>
              <Typography variant="h5" fontWeight={600}>
                {formatCurrency(summary.totalAmount)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Paid</Typography>
              <Typography variant="h5" fontWeight={600} color="success.main">
                {formatCurrency(summary.totalPaid)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">Total Balance</Typography>
              <Typography variant="h5" fontWeight={600} color="error.main">
                {formatCurrency(summary.totalBalance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Report Tabs */}
      <Card>
        <CardContent>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Residents Report" />
            <Tab label="CAM Charges Report" />
            <Tab label="Electricity Bills Report" />
            <Tab label="Rental Management Report" />
            <Tab label="Payments Report" />
            <Tab label="Invoices Report" />
          </Tabs>
          
          {renderReportContent()}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Reports;
