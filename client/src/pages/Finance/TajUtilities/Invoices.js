import React, { useEffect, useState, useMemo } from 'react';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  Stack,
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Autocomplete
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { fetchAllInvoices, deleteInvoice } from '../../../services/propertyInvoiceService';
import { fetchProperties } from '../../../services/tajPropertiesService';
import { fetchResidents } from '../../../services/tajResidentsService';
import { fetchSectors } from '../../../services/tajSectorsService';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

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

const Invoices = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [properties, setProperties] = useState([]);
  const [residents, setResidents] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [residentFilter, setResidentFilter] = useState('');
  const [chargeTypeFilter, setChargeTypeFilter] = useState('all');
  const [sectorFilter, setSectorFilter] = useState('');
  const [expandedMonths, setExpandedMonths] = useState([]);
  
  // Pagination
  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [statusFilter, paymentStatusFilter, propertyFilter, residentFilter, chargeTypeFilter, sectorFilter]
  });

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (paymentStatusFilter !== 'all') params.paymentStatus = paymentStatusFilter;
      if (propertyFilter) params.propertyId = propertyFilter;
      
      const response = await fetchAllInvoices(params);
      let invoicesData = response.data?.data || [];
      
      // Filter by resident if selected (client-side filter for resident)
      if (residentFilter) {
        invoicesData = invoicesData.filter(invoice => {
          const propertyResident = invoice.property?.resident;
          if (!propertyResident) return false;
          
          // Handle both populated object and ObjectId string
          let residentId;
          if (typeof propertyResident === 'object' && propertyResident !== null) {
            residentId = propertyResident._id || propertyResident.id || propertyResident;
          } else {
            residentId = propertyResident;
          }
          
          return String(residentId) === String(residentFilter);
        });
      }
      
      // Filter by charge type if selected (client-side filter)
      if (chargeTypeFilter !== 'all') {
        invoicesData = invoicesData.filter(invoice => {
          const chargeTypes = invoice.chargeTypes || [];
          return chargeTypes.includes(chargeTypeFilter);
        });
      }
      
      // Filter by sector if selected (client-side filter)
      if (sectorFilter) {
        invoicesData = invoicesData.filter(invoice => {
          const propertySector = invoice.property?.sector;
          if (!propertySector) return false;
          // Handle both string sector and sector object
          const sectorValue = typeof propertySector === 'object' && propertySector !== null
            ? (propertySector.name || propertySector.sectorName || String(propertySector))
            : String(propertySector);
          return sectorValue.toLowerCase() === String(sectorFilter).toLowerCase();
        });
      }
      
      setInvoices(invoicesData);
      if (response.data?.pagination) {
        pagination.setTotal(response.data.pagination.total);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      setPropertiesLoading(true);
      const response = await fetchProperties({});
      setProperties(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load properties:', err);
    } finally {
      setPropertiesLoading(false);
    }
  };

  const loadResidents = async () => {
    try {
      setResidentsLoading(true);
      const response = await fetchResidents({ isActive: 'true' });
      setResidents(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load residents:', err);
    } finally {
      setResidentsLoading(false);
    }
  };

  const loadSectors = async () => {
    try {
      setSectorsLoading(true);
      const response = await fetchSectors({ isActive: 'true' });
      setSectors(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load sectors:', err);
    } finally {
      setSectorsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.rowsPerPage, statusFilter, paymentStatusFilter, propertyFilter, residentFilter, chargeTypeFilter, sectorFilter]);

  useEffect(() => {
    loadProperties();
    loadResidents();
    loadSectors();
  }, []);

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteInvoice(invoiceId);
      setSuccess('Invoice deleted successfully');
      loadInvoices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete invoice');
    }
  };

  const handleViewInvoice = (invoice) => {
    // Navigate to property detail page where invoice can be viewed
    // Pass invoice ID as query parameter to highlight/show the invoice
    if (invoice.property?._id) {
      navigate(`/finance/taj-utilities-charges/taj-properties/${invoice.property._id}?invoiceId=${invoice._id}`);
    } else {
      // If no property, show error
      setError('Property information not available for this invoice');
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      !search ||
      invoice.invoiceNumber?.toLowerCase().includes(searchLower) ||
      invoice.property?.propertyName?.toLowerCase().includes(searchLower) ||
      invoice.property?.ownerName?.toLowerCase().includes(searchLower) ||
      invoice.property?.plotNumber?.toLowerCase().includes(searchLower) ||
      invoice.property?.address?.toLowerCase().includes(searchLower);
    
    return matchesSearch;
  });

  // Group invoices by month based on period dates
  const invoicesByMonth = useMemo(() => {
    const grouped = {};
    filteredInvoices.forEach((invoice) => {
      // Use periodTo if available, otherwise periodFrom, otherwise invoiceDate as fallback
      const periodDate = invoice.periodTo 
        ? dayjs(invoice.periodTo) 
        : invoice.periodFrom 
        ? dayjs(invoice.periodFrom) 
        : invoice.invoiceDate 
        ? dayjs(invoice.invoiceDate) 
        : dayjs();
      const monthKey = periodDate.format('YYYY-MM');
      const monthLabel = periodDate.format('MMMM YYYY');
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          label: monthLabel,
          invoices: [],
          total: 0,
          paid: 0,
          balance: 0
        };
      }
      
      grouped[monthKey].invoices.push(invoice);
      grouped[monthKey].total += invoice.grandTotal || 0;
      grouped[monthKey].paid += invoice.totalPaid || 0;
      grouped[monthKey].balance += invoice.balance || 0;
    });
    
    // Sort months in descending order (newest first)
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredInvoices]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => {
      if (prev.includes(monthKey)) {
        return prev.filter(key => key !== monthKey);
      } else {
        return [...prev, monthKey];
      }
    });
  };

  // Expand all months by default on initial load
  useEffect(() => {
    if (invoicesByMonth.length > 0 && expandedMonths.length === 0) {
      const allMonths = invoicesByMonth.map(m => m.key);
      setExpandedMonths(allMonths);
    }
  }, [invoicesByMonth.length]); // Only depend on length to avoid re-triggering on filter changes

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

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Invoices
          </Typography>
          <Typography color="text.secondary">
            View and manage all property invoices.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 250 }}
          />
          <Autocomplete
            size="small"
            options={properties}
            getOptionLabel={(option) => 
              `${option.propertyName || option.plotNumber || 'N/A'} - ${option.ownerName || 'N/A'}`
            }
            value={properties.find(p => String(p._id) === String(propertyFilter)) || null}
            onChange={(event, newValue) => {
              setPropertyFilter(newValue ? String(newValue._id) : '');
            }}
            loading={propertiesLoading}
            sx={{ minWidth: 250 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Property"
                placeholder="Select property"
              />
            )}
          />
          <Autocomplete
            size="small"
            options={residents}
            getOptionLabel={(option) => option.name || ''}
            value={residents.find(r => String(r._id) === String(residentFilter)) || null}
            onChange={(event, newValue) => {
              setResidentFilter(newValue ? String(newValue._id) : '');
            }}
            loading={residentsLoading}
            sx={{ minWidth: 200 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Resident"
                placeholder="Select resident"
              />
            )}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Payment</InputLabel>
            <Select
              value={paymentStatusFilter}
              label="Payment"
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="partial_paid">Partial Paid</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
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
            </Select>
          </FormControl>
          <Autocomplete
            size="small"
            options={sectors}
            getOptionLabel={(option) => option.name || option.sectorName || String(option)}
            value={sectors.find(s => {
              const sectorName = s.name || s.sectorName || String(s);
              return String(sectorName).toLowerCase() === String(sectorFilter).toLowerCase();
            }) || null}
            onChange={(event, newValue) => {
              if (newValue) {
                const sectorName = newValue.name || newValue.sectorName || String(newValue);
                setSectorFilter(sectorName);
              } else {
                setSectorFilter('');
              }
            }}
            loading={sectorsLoading}
            sx={{ minWidth: 200 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Sector"
                placeholder="Select sector"
              />
            )}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={loadInvoices} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Statistics */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Total Invoices</Typography>
            <Typography variant="h5" fontWeight={600}>
              {pagination.total || invoices.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Current Page</Typography>
            <Typography variant="h5" fontWeight={600}>
              {invoices.length} of {pagination.total || invoices.length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Total Amount</Typography>
            <Typography variant="h5" fontWeight={600}>
              {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0))}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Total Balance</Typography>
            <Typography variant="h5" fontWeight={600} color="error.main">
              {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0))}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : invoicesByMonth.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="text.secondary">No invoices found</Typography>
            </Box>
          ) : (
            invoicesByMonth.map((monthGroup) => (
              <Box key={monthGroup.key} sx={{ mb: 3 }}>
                <Card variant="outlined" sx={{ mb: 1 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ cursor: 'pointer' }}
                      onClick={() => toggleMonth(monthGroup.key)}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMonth(monthGroup.key);
                          }}
                        >
                          {expandedMonths.includes(monthGroup.key) ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                        <Typography variant="h6" fontWeight={600}>
                          {monthGroup.label}
                        </Typography>
                        <Chip
                          label={`${monthGroup.invoices.length} invoice${monthGroup.invoices.length !== 1 ? 's' : ''}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>
                      <Stack direction="row" spacing={3}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Total
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(monthGroup.total)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Paid
                          </Typography>
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            {formatCurrency(monthGroup.paid)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Balance
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color={monthGroup.balance > 0 ? 'error.main' : 'success.main'}
                          >
                            {formatCurrency(monthGroup.balance)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
                <Collapse in={expandedMonths.includes(monthGroup.key)}>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Invoice #</TableCell>
                          <TableCell>Property</TableCell>
                          <TableCell>Owner</TableCell>
                          <TableCell>Charge Types</TableCell>
                          <TableCell>Period From</TableCell>
                          <TableCell>Period To</TableCell>
                          <TableCell>Due Date</TableCell>
                          <TableCell align="right">Grand Total</TableCell>
                          <TableCell align="right">Paid</TableCell>
                          <TableCell align="right">Balance</TableCell>
                          <TableCell>Payment Status</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Recorded By</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {monthGroup.invoices.map((invoice) => (
                          <TableRow key={invoice._id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600}>
                                {invoice.invoiceNumber || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {invoice.property?.propertyName || invoice.property?.plotNumber || 'N/A'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {invoice.property?.address || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {invoice.property?.ownerName || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {getChargeTypesLabel(invoice.chargeTypes)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {invoice.periodFrom ? dayjs(invoice.periodFrom).format('MMM D, YYYY') : '—'}
                            </TableCell>
                            <TableCell>
                              {invoice.periodTo ? dayjs(invoice.periodTo).format('MMM D, YYYY') : '—'}
                            </TableCell>
                            <TableCell>
                              {invoice.dueDate ? dayjs(invoice.dueDate).format('MMM D, YYYY') : 'N/A'}
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight={600}>
                                {formatCurrency(invoice.grandTotal || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(invoice.totalPaid || 0)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                fontWeight={600}
                                color={invoice.balance > 0 ? 'error.main' : 'success.main'}
                              >
                                {formatCurrency(invoice.balance || 0)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const { color, label } = getPaymentStatusConfig(invoice.paymentStatus);
                                return (
                                  <Chip
                                    label={label}
                                    color={color}
                                    size="small"
                                  />
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={invoice.status || 'Issued'}
                                size="small"
                                color={
                                  invoice.status === 'Issued' ? 'primary' :
                                  invoice.status === 'Draft' ? 'default' :
                                  invoice.status === 'Cancelled' ? 'error' : 'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {invoice.createdBy 
                                  ? `${invoice.createdBy.firstName || ''} ${invoice.createdBy.lastName || ''}`.trim() || 'N/A'
                                  : 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={1} justifyContent="flex-end">
                                <Tooltip title="View Invoice">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleViewInvoice(invoice)}
                                  >
                                    <ViewIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Invoice">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteInvoice(invoice._id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Collapse>
              </Box>
            ))
          )}
          {!loading && invoicesByMonth.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <TablePaginationWrapper
                page={pagination.page}
                rowsPerPage={pagination.rowsPerPage}
                total={pagination.total}
                onPageChange={pagination.handleChangePage}
                onRowsPerPageChange={pagination.handleChangeRowsPerPage}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Invoices;

