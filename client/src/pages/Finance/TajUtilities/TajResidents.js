import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePagination } from '../../../hooks/usePagination';
import TablePaginationWrapper from '../../../components/TablePaginationWrapper';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
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
  MenuItem,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Divider,
  Checkbox,
  Autocomplete,
  Skeleton
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  AccountBalance as AccountBalanceIcon,
  GetApp as GetAppIcon,
  Payment as PaymentIcon,
  Home as HomeIcon,
  Link as LinkIcon,
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import {
  fetchResidents,
  createResident,
  updateResident,
  deleteResident,
  depositMoney,
  updateDeposit,
  payBill,
  fetchResidentTransactions,
  assignProperties,
  unassignProperties,
  autoMatchProperties,
  getUnassignedProperties
} from '../../../services/tajResidentsService';
import { fetchInvoicesForProperty } from '../../../services/propertyReceiptService';
import { fetchAllInvoices } from '../../../services/propertyInvoiceService';
import api from '../../../services/api';

// Constants
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Other'];
const ACCOUNT_TYPES = ['Resident', 'Property Dealer', 'Other'];
const BANK_REQUIRED_METHODS = ['Bank Transfer', 'Cheque', 'Online'];

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

// Default form values
const defaultFormData = {
  name: '',
  accountType: 'Resident',
  cnic: '',
  contactNumber: '',
  email: '',
  address: '',
  balance: 0,
  notes: ''
};

const defaultTransactionForm = {
  amount: '',
  description: '',
  paymentMethod: 'Bank Transfer',
  bank: '',
  referenceNumberExternal: '',
  depositDate: dayjs().format('YYYY-MM-DD')
};

const defaultPayForm = {
  amount: '',
  referenceType: 'CAM',
  referenceId: '',
  referenceNumber: '',
  description: '',
  paymentDate: dayjs().format('YYYY-MM-DD'),
  bankName: '',
  bankReference: '',
  paymentMethod: 'Bank Transfer'
};

// Helper functions
const getInvoiceDescription = (invoice) => {
  if (invoice.periodFrom && invoice.periodTo) {
    const from = dayjs(invoice.periodFrom).format('DD-MMM-YYYY');
    const to = dayjs(invoice.periodTo).format('DD-MMM-YYYY');
    const type = invoice.chargeTypes?.join(', ') || 'Invoice';
    return `${type} From ${from} To ${to}`;
  }
  return invoice.description || invoice.invoiceNumber || 'Invoice';
};

// Helper function to get available amount from deposit (optimized - used multiple times)
const getDepositAvailableAmount = (deposit) => 
  deposit.remainingAmount !== undefined ? deposit.remainingAmount : (deposit.amount || 0);

// Helper function to determine invoice type from chargeTypes
// Must return one of: 'CAM', 'Electricity', 'Water', 'RENT', 'ELECTRICITY', 'Other'
const getInvoiceTypeFromCharges = (chargeTypes) => {
  if (!chargeTypes || !Array.isArray(chargeTypes)) return 'Other';
  if (chargeTypes.includes('ELECTRICITY')) return 'ELECTRICITY';
  if (chargeTypes.includes('RENT')) return 'RENT';
  if (chargeTypes.includes('CAM')) return 'CAM';
  if (chargeTypes.includes('Water')) return 'Water';
  if (chargeTypes.includes('Electricity')) return 'Electricity';
  // For any other charge types (e.g., 'Ground Booking', 'Billboard', 'Events', etc.), return 'Other'
  return 'Other';
};

const TajResidents = () => {
  const navigate = useNavigate();
  // State
  const [loading, setLoading] = useState(false);
  const [residents, setResidents] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('');
  
  // Pagination
  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [search, accountTypeFilter]
  });
  
  // Dialogs
  const [formDialog, setFormDialog] = useState(false);
  const [depositDialog, setDepositDialog] = useState(false);
  const [payDialog, setPayDialog] = useState(false);
  const [transactionsDialog, setTransactionsDialog] = useState(false);
  const [depositsDialog, setDepositsDialog] = useState(false);
  const [propertiesDialog, setPropertiesDialog] = useState(false);
  
  // Form state
  const [selectedResident, setSelectedResident] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [depositForm, setDepositForm] = useState(defaultTransactionForm);
  const [editingDeposit, setEditingDeposit] = useState(null);
  const [payForm, setPayForm] = useState(defaultPayForm);
  
  // Invoice payment state
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [allocations, setAllocations] = useState([]);
  
  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  
  // Deposit payment state
  const [depositPaymentDialog, setDepositPaymentDialog] = useState(false);
  const [selectedDeposits, setSelectedDeposits] = useState([]);
  const [depositUsage, setDepositUsage] = useState({}); // Track how much from each deposit is being used: { depositId: amount }
  const [properties, setProperties] = useState([]);
  const [depositPaymentForm, setDepositPaymentForm] = useState({
    receiptDate: dayjs().format('YYYY-MM-DD'),
    bankName: '',
    bankReference: '',
    description: '',
    paymentMethod: 'Cash'
  });
  const [depositPaymentAllocations, setDepositPaymentAllocations] = useState([]);
  
  // Property management state
  const [unassignedProperties, setUnassignedProperties] = useState([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState([]);
  const [propertySearch, setPropertySearch] = useState('');
  
  // Bank management state
  const [customBanks, setCustomBanks] = useState(() => {
    const stored = localStorage.getItem('tajCustomBanks');
    return stored ? JSON.parse(stored) : [];
  });
  const [addBankDialog, setAddBankDialog] = useState(false);
  const [newBankName, setNewBankName] = useState('');

  // Computed values
  const filteredResidents = useMemo(
    () => residents.filter(r => r.isActive !== false),
    [residents]
  );

  const availableResidents = useMemo(
    () => filteredResidents.filter(r => r._id !== selectedResident?._id),
    [filteredResidents, selectedResident]
  );

  const totals = useMemo(() => {
    const totalAllocated = allocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
    const receiptAmount = Number(payForm.amount) || 0;
    return {
      totalAllocated,
      unallocated: receiptAmount - totalAllocated
    };
  }, [allocations, payForm.amount]);

  // Filter properties to only show those assigned to selected resident (for deposit payment dialog)
  // Use unassignedProperties which includes all properties regardless of category
  const filteredPropertiesForDeposit = useMemo(() => {
    // Use unassignedProperties which is loaded from /unassigned-properties with includeAssigned: 'true'
    // This ensures all properties are shown regardless of category
    const propertiesToFilter = unassignedProperties.length > 0 ? unassignedProperties : properties;
    
    if (!selectedResident) {
      return propertiesToFilter;
    }
    
    // If resident has no properties or properties array is empty, show all properties
    if (!selectedResident.properties || !Array.isArray(selectedResident.properties) || selectedResident.properties.length === 0) {
      return propertiesToFilter;
    }
    
    // Get IDs of properties assigned to this resident (convert all to strings for comparison)
    const residentPropertyIds = selectedResident.properties.map(p => {
      const id = typeof p === 'object' ? (p._id || p) : p;
      return String(id);
    });
    
    // Filter properties to only include those assigned to the resident
    // Convert property._id to string for comparison
    const filtered = propertiesToFilter.filter(property => {
      const propertyId = String(property._id || property);
      return residentPropertyIds.includes(propertyId);
    });
    
    // If filtered list is empty but resident has properties, use resident's properties directly
    // This handles cases where properties might not be in the unassignedProperties list
    if (filtered.length === 0 && selectedResident.properties.length > 0) {
      return selectedResident.properties;
    }
    
    return filtered;
  }, [unassignedProperties, properties, selectedResident]);

  // API calls
  const loadResidents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage
      };
      if (search) params.search = search;
      if (accountTypeFilter) params.accountType = accountTypeFilter;
      const response = await fetchResidents(params);
      const residentsList = response.data.data || [];
      setResidents(residentsList);
      if (response.data.pagination) {
        pagination.setTotal(response.data.pagination.total);
      }
      // Keep selectedResident in sync so Current Balance / totalRemainingDeposits stay correct after deposit or pay
      setSelectedResident((prev) => {
        if (!prev?._id) return prev;
        const updated = residentsList.find((r) => r._id === prev._id);
        return updated ? { ...updated } : prev;
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load residents');
    } finally {
      setLoading(false);
    }
  }, [search, accountTypeFilter, pagination.page, pagination.rowsPerPage]);

  const loadUnassignedProperties = useCallback(async (searchTerm = '') => {
    try {
      setPropertiesLoading(true);
      const params = {};
      const search = searchTerm || propertySearch;
      if (search?.trim()) {
        params.search = search.trim();
      }
      params.includeAssigned = 'true';
      const response = await getUnassignedProperties(params);
      setUnassignedProperties(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load properties');
    } finally {
      setPropertiesLoading(false);
    }
  }, [propertySearch]);

  // Effects
  useEffect(() => {
    loadResidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.rowsPerPage, search, accountTypeFilter]);

  useEffect(() => {
    if (propertiesDialog && propertySearch) {
      const timeoutId = setTimeout(() => {
        loadUnassignedProperties(propertySearch);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else if (propertiesDialog && !propertySearch) {
      loadUnassignedProperties('');
    }
  }, [propertySearch, propertiesDialog, loadUnassignedProperties]);

  // Handlers
  const resetForm = useCallback(() => {
    setFormData(defaultFormData);
    setSelectedResident(null);
  }, []);

  const resetTransactionForm = useCallback(() => {
    setDepositForm(defaultTransactionForm);
  }, []);

  const resetPayForm = useCallback(() => {
    setPayForm(defaultPayForm);
    setSelectedProperty(null);
    setInvoices([]);
    setAllocations([]);
  }, []);

  const showSuccess = useCallback((message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  const handleError = useCallback((err, defaultMessage) => {
    setError(err.response?.data?.message || defaultMessage);
  }, []);

  const handleCreate = useCallback(() => {
    resetForm();
    setFormDialog(true);
  }, [resetForm]);

  const handleEdit = useCallback((resident) => {
    setSelectedResident(resident);
    setFormData({
      name: resident.name || '',
      accountType: resident.accountType || 'Resident',
      cnic: resident.cnic || '',
      contactNumber: resident.contactNumber || '',
      email: resident.email || '',
      address: resident.address || '',
      balance: resident.balance || 0,
      notes: resident.notes || ''
    });
    setFormDialog(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      if (selectedResident) {
        await updateResident(selectedResident._id, formData);
        showSuccess('Resident updated successfully');
      } else {
        await createResident(formData);
        showSuccess('Resident created successfully');
      }
      setFormDialog(false);
      loadResidents();
    } catch (err) {
      handleError(err, 'Failed to save resident');
    } finally {
      setLoading(false);
    }
  }, [selectedResident, formData, loadResidents, showSuccess, handleError]);

  const handleDelete = useCallback(async (resident) => {
    if (!window.confirm(`Are you sure you want to delete ${resident.name}?`)) return;
    try {
      setLoading(true);
      await deleteResident(resident._id);
      showSuccess('Resident deleted successfully');
      loadResidents();
    } catch (err) {
      handleError(err, 'Failed to delete resident');
    } finally {
      setLoading(false);
    }
  }, [loadResidents, showSuccess, handleError]);

  const handleDeposit = useCallback((resident) => {
    setSelectedResident(resident);
    setEditingDeposit(null);
    resetTransactionForm();
    setDepositDialog(true);
  }, [resetTransactionForm]);

  const handlePay = useCallback(async (resident) => {
    setSelectedResident(resident);
    
    // Check if this is TAJ MANAGEMENT (TCM) - residentId 00434
    const isTajManagement = resident.residentId === '00434' || 
                           resident.residentId === 434 || 
                           resident.name?.toUpperCase().includes('TAJ MANAGEMENT') ||
                           resident.name?.toUpperCase().includes('TCM');
    
    if (isTajManagement) {
      // For TAJ MANAGEMENT, open regular pay dialog and load open invoices
      setPayDialog(true);
      setSelectedProperty(null);
      setInvoices([]);
      setAllocations([]);
      setPayForm({
        amount: '',
        paymentDate: dayjs().format('YYYY-MM-DD'),
        description: '',
        bankName: '',
        bankReference: '',
        paymentMethod: 'Bank Transfer'
      });
      
      // Load open invoices (invoices without property) that are unpaid or partially paid
      try {
        setLoadingInvoices(true);
        // Fetch open invoices with paymentStatus filter (backend now supports comma-separated values)
        const response = await fetchAllInvoices({
          openInvoices: 'true',
          paymentStatus: 'unpaid,partial_paid',
          limit: 1000 // Get all open invoices
        });
        // Filter for invoices with balance > 0 (backend should already filter by paymentStatus)
        const openInvoicesList = (response.data?.data || []).filter(
          inv => inv && (inv.balance || 0) > 0
        );
        setInvoices(openInvoicesList);
        
        const outstandingInvoices = openInvoicesList.filter(inv => (inv.balance || 0) > 0);
        setAllocations(outstandingInvoices.map(inv => ({
          invoice: inv._id,
          invoiceNumber: inv.invoiceNumber,
          invoiceType: getInvoiceTypeFromCharges(inv.chargeTypes),
          balance: inv.balance || 0,
          allocatedAmount: 0,
          remaining: inv.balance || 0
        })));
      } catch (err) {
        console.error('Error loading open invoices:', err);
        handleError(err, 'Failed to load open invoices');
        setInvoices([]);
        setAllocations([]);
      } finally {
        setLoadingInvoices(false);
      }
      
      // Refresh resident data to get latest balance
      try {
        await loadResidents();
        const response = await fetchResidents({});
        const updatedResident = response.data.data.find(r => r._id === resident._id);
        if (updatedResident) {
          setSelectedResident(updatedResident);
        }
      } catch (err) {
        console.error('Error refreshing resident data:', err);
      }
    } else {
      // For other residents, use deposit payment dialog (existing flow)
      // Load all deposits for this resident and open deposit payment dialog directly
      try {
        setDepositsLoading(true);
        // Request all deposits by setting a high limit and filtering by transactionType
        const response = await fetchResidentTransactions(resident._id, {
          transactionType: 'deposit',
          limit: 1000 // Get all deposits (adjust if needed)
        });
        const allDeposits = (response.data.data.transactions || []).filter(
          txn => txn.transactionType === 'deposit' && 
                 (!txn.referenceNumberExternal || !txn.referenceNumberExternal.startsWith('REV-'))
        );
        setSelectedDeposits(allDeposits);
        setDeposits(allDeposits);
        
        // Initialize deposit usage - all deposits start with 0 usage
        const initialUsage = {};
        allDeposits.forEach(dep => {
          initialUsage[dep._id] = 0;
        });
        setDepositUsage(initialUsage);
      } catch (err) {
        handleError(err, 'Failed to load deposit transactions');
        setSelectedDeposits([]);
        setDeposits([]);
        setDepositUsage({});
      } finally {
        setDepositsLoading(false);
      }
      
      // Open deposit payment dialog directly
      setDepositPaymentDialog(true);
      setSelectedProperty(null);
      setDepositPaymentAllocations([]);
      setDepositPaymentForm({
        receiptDate: dayjs().format('YYYY-MM-DD'),
        bankName: '',
        bankReference: '',
        description: '',
        paymentMethod: 'Cash'
      });
      
      // Refresh resident data to get latest balance
      try {
        await loadResidents();
        // Update selectedResident with latest balance
        const response = await fetchResidents({});
        const updatedResident = response.data.data.find(r => r._id === resident._id);
        if (updatedResident) {
          setSelectedResident(updatedResident);
        }
      } catch (err) {
        console.error('Error refreshing resident data:', err);
      }
      
      // Load properties
      try {
        const response = await api.get('/taj-utilities/properties');
        setProperties(response.data?.data || []);
      } catch (err) {
        console.error('Error loading properties:', err);
      }
    }
  }, [handleError, loadResidents]);

  const handlePropertyChange = useCallback(async (property) => {
    setSelectedProperty(property);
    if (!property?._id) {
      setInvoices([]);
      setAllocations([]);
      return;
    }

    try {
      setLoadingInvoices(true);
      
      // Refresh resident data to get latest balance
      if (selectedResident?._id) {
        try {
          const response = await fetchResidents({});
          const updatedResident = response.data.data.find(r => r._id === selectedResident._id);
          if (updatedResident) {
            setSelectedResident(updatedResident);
          }
        } catch (err) {
          // Error refreshing resident - continue with invoice loading
        }
      }
      
      const response = await fetchInvoicesForProperty(property._id);
      const invoiceList = response.data?.data || [];
      setInvoices(invoiceList);
      
      const outstandingInvoices = invoiceList.filter(inv => (inv.balance || 0) > 0);
      
      setAllocations(outstandingInvoices.map(inv => ({
        invoice: inv._id,
        invoiceNumber: inv.invoiceNumber,
        invoiceType: getInvoiceTypeFromCharges(inv.chargeTypes),
        balance: inv.balance || 0,
        allocatedAmount: 0,
        remaining: inv.balance || 0
      })));
    } catch (err) {
      handleError(err, 'Failed to load invoices');
      setInvoices([]);
      setAllocations([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [handleError, selectedResident]);

  const handleAllocationChange = useCallback((index, value) => {
    const numValue = Number(value) || 0;
    const balance = allocations[index].balance;
    const newAllocated = Math.min(Math.max(0, numValue), balance);
    
    const updated = [...allocations];
    updated[index] = {
      ...updated[index],
      allocatedAmount: newAllocated,
      remaining: balance - newAllocated
    };
    setAllocations(updated);
    
    const totalAllocated = updated.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
    setPayForm(prev => ({ ...prev, amount: totalAllocated.toString() }));
  }, [allocations]);

  const handleViewTransactions = useCallback(async (resident) => {
    setSelectedResident(resident);
    setTransactionsDialog(true);
    try {
      setTransactionsLoading(true);
      const response = await fetchResidentTransactions(resident._id);
      setTransactions(response.data.data.transactions || []);
    } catch (err) {
      handleError(err, 'Failed to load transactions');
    } finally {
      setTransactionsLoading(false);
    }
  }, [handleError]);

  const handleManageProperties = useCallback(async (resident) => {
    setSelectedResident(resident);
    setSelectedPropertyIds([]);
    setPropertySearch('');
    setPropertiesDialog(true);
    await loadUnassignedProperties();
  }, [loadUnassignedProperties]);

  const handlePayFromDeposit = useCallback(async (depositTransactions) => {
    // Load all deposits for this resident (not just the clicked one)
    try {
      const response = await fetchResidentTransactions(selectedResident._id);
      const allDeposits = (response.data.data.transactions || []).filter(
        txn => txn.transactionType === 'deposit' && 
               (!txn.referenceNumberExternal || !txn.referenceNumberExternal.startsWith('REV-'))
      );
      setSelectedDeposits(allDeposits);
      // Initialize deposit usage - all deposits start with 0 usage
      const initialUsage = {};
      allDeposits.forEach(dep => {
        initialUsage[dep._id] = 0;
      });
      setDepositUsage(initialUsage);
    } catch (err) {
      console.error('Error loading deposits:', err);
      setSelectedDeposits(depositTransactions);
      setDepositUsage({});
    }
    
    setSelectedProperty(null);
    setDepositPaymentAllocations([]);
    setDepositPaymentForm({
      receiptDate: dayjs().format('YYYY-MM-DD'),
      bankName: '',
      bankReference: '',
      description: '',
      paymentMethod: 'Cash'
    });
    
    // Refresh resident data to get latest balance and properties
    try {
      await loadResidents();
      // Update selectedResident with latest balance and properties
      const response = await fetchResidents({});
      const updatedResident = response.data.data.find(r => r._id === selectedResident?._id);
      if (updatedResident) {
        setSelectedResident(updatedResident);
      }
    } catch (err) {
      console.error('Error refreshing resident data:', err);
    }
    
    // Load all properties (regardless of category) for deposit payment BEFORE opening dialog
    try {
      await loadUnassignedProperties('');
    } catch (err) {
      console.error('Error loading properties:', err);
    }
    
    // Open dialog after properties are loaded
    setDepositPaymentDialog(true);
  }, [selectedResident, loadResidents, loadUnassignedProperties]);

  // Helper function to calculate subtotal from invoice (excluding arrears)
  const calculateInvoiceSubtotal = useCallback((inv) => {
    if (!inv) return 0;
    
    // First try: use subtotal field if available and > 0
    let subtotal = Number(inv.subtotal) || 0;
    if (subtotal > 0) return subtotal;
    
    // Second try: calculate from charges array (sum of charge.amount, not charge.arrears)
    if (inv.charges && Array.isArray(inv.charges) && inv.charges.length > 0) {
      subtotal = inv.charges.reduce((sum, charge) => {
        const chargeAmount = Number(charge?.amount) || 0;
        return sum + chargeAmount;
      }, 0);
      if (subtotal > 0) return subtotal;
    }
    
    // Third try: use grandTotal - totalArrears
    const grandTotal = Number(inv.grandTotal) || 0;
    const totalArrears = Number(inv.totalArrears) || 0;
    if (grandTotal > 0) {
      subtotal = grandTotal - totalArrears;
      if (subtotal > 0) return subtotal;
    }
    
    // Final fallback: use grandTotal if nothing else works
    return grandTotal;
  }, []);

  // Helper for "Pay Invoices from Deposit" dialog:
  // Returns the effective invoice amount to show in the Amount column,
  // including late payment surcharge (10%) when the invoice is overdue AND unpaid/partial.
  // This matches the logic from the Invoices page (getAdjustedGrandTotal).
  const getDepositInvoiceDisplayAmount = useCallback((inv) => {
    if (!inv) return 0;
    
    // Check if invoice is overdue (after due date + 4-day grace period ends) and unpaid/partially paid
    const GRACE_PERIOD_DAYS = 4;
    const invoiceDueDate = inv.dueDate ? new Date(inv.dueDate) : null;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const dueStart = invoiceDueDate ? new Date(invoiceDueDate) : null; if (dueStart) dueStart.setHours(0, 0, 0, 0);
    const dueWithGrace = dueStart ? new Date(dueStart) : null; if (dueWithGrace) dueWithGrace.setDate(dueWithGrace.getDate() + GRACE_PERIOD_DAYS);
    const isOverdue = dueWithGrace && todayStart > dueWithGrace;
    const isUnpaid = inv.paymentStatus === 'unpaid' || inv.paymentStatus === 'partial_paid' || (inv.balance || 0) > 0;
    
    // If not overdue or already paid, return original grandTotal
    if (!isOverdue || !isUnpaid) {
      return inv.grandTotal || 0;
    }
    
    // Calculate late payment surcharge (10% of charges for the month)
    let chargesForMonth = inv.subtotal || 0;
    
    // If invoice has charges array, sum up the amount (not arrears) for each charge
    if (inv.charges && Array.isArray(inv.charges) && inv.charges.length > 0) {
      const totalChargesAmount = inv.charges.reduce((sum, charge) => sum + (charge.amount || 0), 0);
      if (totalChargesAmount > 0) {
        chargesForMonth = totalChargesAmount;
      }
    }
    
    // Calculate late payment surcharge
    const latePaymentSurcharge = Math.max(Math.round(chargesForMonth * 0.1), 0);
    
    // Calculate original grandTotal (without surcharge)
    const originalGrandTotal = inv.grandTotal || (chargesForMonth + (inv.totalArrears || 0));
    
    // Return adjusted grandTotal (original + surcharge)
    return originalGrandTotal + latePaymentSurcharge;
  }, []);

  const handleDepositPaymentPropertyChange = useCallback(async (property) => {
    setSelectedProperty(property);
    if (!property?._id) {
      setDepositPaymentAllocations([]);
      return;
    }

    try {
      setLoadingInvoices(true);
      
      // Refresh resident data to get latest balance
      if (selectedResident?._id) {
        try {
          const response = await fetchResidents({});
          const updatedResident = response.data.data.find(r => r._id === selectedResident._id);
          if (updatedResident) {
            setSelectedResident(updatedResident);
          }
        } catch (err) {
          // Error refreshing resident - continue with invoice loading
        }
      }
      
      const response = await fetchInvoicesForProperty(property._id);
      const invoiceList = response.data?.data || [];
      
      setInvoices(invoiceList);
      
      // For deposit payments: exclude arrears from balance calculation
      // Only show invoices that have a balance excluding arrears (subtotal - totalPaid > 0)
      const outstandingInvoices = invoiceList.filter(inv => {
        const subtotal = calculateInvoiceSubtotal(inv);
        const totalPaid = Number(inv.totalPaid) || 0;
        const balanceWithoutArrears = subtotal - totalPaid;
        return balanceWithoutArrears > 0; // Only show if balance (excluding arrears) > 0
      });
      
      setDepositPaymentAllocations(outstandingInvoices.map(inv => {
        // Use exact same calculation as Invoices page Balance column
        // Direct copy: getAdjustedGrandTotal(invoice) - (invoice.totalPaid || 0)
        const adjustedGrandTotal = getDepositInvoiceDisplayAmount(inv);
        const balance = adjustedGrandTotal - (inv.totalPaid || 0);
        
        return {
          invoice: inv._id,
          invoiceNumber: inv.invoiceNumber,
          invoiceType: getInvoiceTypeFromCharges(inv.chargeTypes),
          balance: balance, // Exact same value as Invoices page Balance column
          allocatedAmount: 0,
          remaining: balance
        };
      }));
    } catch (err) {
      handleError(err, 'Failed to load invoices');
      setDepositPaymentAllocations([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [handleError, selectedResident, calculateInvoiceSubtotal]);

  const handleDepositPaymentAllocationChange = useCallback((index, value) => {
    const numValue = Number(value) || 0;
    const balance = depositPaymentAllocations[index].balance;
    const newAllocated = Math.min(Math.max(0, numValue), balance);
    
    const updated = [...depositPaymentAllocations];
    updated[index] = {
      ...updated[index],
      allocatedAmount: newAllocated,
      remaining: balance - newAllocated
    };
    setDepositPaymentAllocations(updated);
    
    // User manually controls deposit usage - no auto-distribution
    // They adjust "Amount to Use" for each deposit independently
  }, [depositPaymentAllocations]);

  const handleDepositUsageChange = useCallback((depositId, value) => {
    const deposit = selectedDeposits.find(d => d._id === depositId);
    if (!deposit) return;
    
    const numValue = Number(value) || 0;
    const availableAmount = getDepositAvailableAmount(deposit);
    const newUsage = Math.min(Math.max(0, numValue), availableAmount);
    
    setDepositUsage(prev => ({
      ...prev,
      [depositId]: newUsage
    }));
  }, [selectedDeposits]);

  const depositPaymentTotals = useMemo(() => {
    const totalAllocated = depositPaymentAllocations.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
    const remainingBalance = selectedResident?.balance || 0;
    const totalDepositAmount = selectedDeposits.reduce((sum, d) => sum + getDepositAvailableAmount(d), 0);
    const totalDepositUsage = Object.values(depositUsage).reduce((sum, usage) => sum + (usage || 0), 0);
    
    return {
      totalAllocated,
      remainingBalance,
      totalDepositAmount,
      totalDepositUsage,
      unallocated: remainingBalance - totalAllocated,
      depositUnused: totalDepositAmount - totalDepositUsage,
      unallocatedFromDeposits: totalDepositUsage - totalAllocated
    };
  }, [depositPaymentAllocations, selectedResident, selectedDeposits, depositUsage]);

  const handleSubmitDepositPayment = useCallback(async () => {
    if (!selectedProperty) {
      setError('Please select a property');
      return;
    }

    if (selectedDeposits.length === 0) {
      setError('Please select at least one deposit');
      return;
    }

    const validAllocations = depositPaymentAllocations.filter(a => a.allocatedAmount > 0);
    if (validAllocations.length === 0) {
      setError('Please allocate at least one invoice');
      return;
    }

    // Validate total allocated must exactly equal total deposit usage
    if (depositPaymentTotals.totalAllocated !== depositPaymentTotals.totalDepositUsage) {
      if (depositPaymentTotals.totalAllocated < depositPaymentTotals.totalDepositUsage) {
        setError(`Total allocated to invoices (${formatCurrency(depositPaymentTotals.totalAllocated)}) is less than total amount being used from deposits (${formatCurrency(depositPaymentTotals.totalDepositUsage)}). Please allocate the full amount to invoices.`);
      } else {
        setError(`Total allocated to invoices (${formatCurrency(depositPaymentTotals.totalAllocated)}) exceeds total amount being used from deposits (${formatCurrency(depositPaymentTotals.totalDepositUsage)}). Please reduce invoice allocations.`);
      }
      return;
    }

    // When paying from deposits, validate against deposit availability, not resident balance
    // The resident balance check is not needed here since deposits are being used
    // Only check if total deposit usage exceeds available deposits
    if (depositPaymentTotals.totalDepositUsage > depositPaymentTotals.totalDepositAmount) {
      setError(`Total amount being used from deposits (${formatCurrency(depositPaymentTotals.totalDepositUsage)}) exceeds available deposit amount (${formatCurrency(depositPaymentTotals.totalDepositAmount)}). Please reduce deposit usage.`);
      return;
    }

    // Validate each deposit usage doesn't exceed available amount
    for (const deposit of selectedDeposits) {
      const usage = depositUsage[deposit._id] || 0;
      const availableAmount = getDepositAvailableAmount(deposit);
      if (usage > availableAmount) {
        setError(`Usage amount for deposit dated ${dayjs(deposit.createdAt).format('DD MMM YYYY')} cannot exceed available amount (${formatCurrency(availableAmount)})`);
        return;
      }
    }

    try {
      setLoading(true);
      setError('');
      
      // Prepare deposit usages array for tracking (needed for backend to calculate remainingAmount)
      const depositsUsed = selectedDeposits
        .filter(dep => (depositUsage[dep._id] || 0) > 0)
        .map(dep => ({
          depositId: dep._id,
          depositDate: dayjs(dep.createdAt).format('DD MMM YYYY'),
          amount: depositUsage[dep._id] || 0
        }));
      
      const depositUsagesArray = depositsUsed.map(d => ({
        depositId: d.depositId,
        amount: d.amount
      }));
      
      const depositInfo = depositsUsed.length > 0 
        ? ` (Paid from ${depositsUsed.length} deposit${depositsUsed.length > 1 ? 's' : ''}: ${depositsUsed.map(d => `${d.depositDate} - ${formatCurrency(d.amount)}`).join(', ')})`
        : ' (Paid from Deposit)';
      
      const { totalAllocated } = depositPaymentTotals;
      
      // Process payments sequentially when using deposits to avoid race conditions
      // with balance updates and ensure all invoices are paid correctly
      for (const allocation of validAllocations) {
        const invoice = invoices.find(inv => inv._id === allocation.invoice);
        if (!invoice || allocation.allocatedAmount <= 0) continue;
        
        // Calculate proportional deposit usage for this invoice payment
        const proportion = allocation.allocatedAmount / totalAllocated;
        const proportionalDepositUsages = depositUsagesArray.map(du => ({
          depositId: du.depositId,
          amount: Math.round((du.amount * proportion) * 100) / 100
        }));
        
        await payBill(selectedResident._id, {
          amount: allocation.allocatedAmount,
          referenceType: allocation.invoiceType,
          referenceId: String(invoice._id),
          referenceNumber: invoice.invoiceNumber || '',
          description: `${allocation.invoiceType} - ${getInvoiceDescription(invoice)}${depositInfo}`,
          paymentDate: depositPaymentForm.receiptDate,
          paymentMethod: depositPaymentForm.paymentMethod,
          depositUsages: proportionalDepositUsages
        });
      }
      
      showSuccess('Payment successful');
      setDepositPaymentDialog(false);
      setDepositsDialog(false);
      loadResidents();
      
      // Reload invoices to get updated totalPaid and balance
      if (selectedProperty?._id) {
        try {
          const response = await fetchInvoicesForProperty(selectedProperty._id);
          const invoiceList = response.data?.data || [];
          setInvoices(invoiceList);
          
          // For deposit payments: exclude arrears from balance calculation
          // Only show invoices that have a balance excluding arrears (subtotal - totalPaid > 0)
          const outstandingInvoices = invoiceList.filter(inv => {
            const subtotal = calculateInvoiceSubtotal(inv);
            const totalPaid = Number(inv.totalPaid) || 0;
            const balanceWithoutArrears = subtotal - totalPaid;
            return balanceWithoutArrears > 0; // Only show if balance (excluding arrears) > 0
          });
          
          setDepositPaymentAllocations(outstandingInvoices.map(inv => {
            // Use exact same calculation as Invoices page Balance column
            // Direct copy: getAdjustedGrandTotal(invoice) - (invoice.totalPaid || 0)
            const adjustedGrandTotal = getDepositInvoiceDisplayAmount(inv);
            const balance = adjustedGrandTotal - (inv.totalPaid || 0);
            
            return {
              invoice: inv._id,
              invoiceNumber: inv.invoiceNumber,
              invoiceType: getInvoiceTypeFromCharges(inv.chargeTypes),
              balance: balance, // Exact same value as Invoices page Balance column
              allocatedAmount: 0,
              remaining: balance
            };
          }));
        } catch (err) {
          // Error reloading invoices - non-critical, continue
        }
      }
      
      // Refresh deposits to get updated remainingAmount values
      // Use same parameters as handlePay to ensure we get all deposits with remainingAmount
      try {
        const response = await fetchResidentTransactions(selectedResident._id, {
          transactionType: 'deposit',
          limit: 1000 // Get all deposits
        });
        const depositTransactions = (response.data.data.transactions || []).filter(
          txn => txn.transactionType === 'deposit' && 
                 (!txn.referenceNumberExternal || !txn.referenceNumberExternal.startsWith('REV-'))
        );
        setDeposits(depositTransactions);
        // Update selectedDeposits with fresh data including updated remainingAmount
        setSelectedDeposits(depositTransactions);
        // Reset deposit usage
        const resetUsage = {};
        depositTransactions.forEach(dep => {
          resetUsage[dep._id] = 0;
        });
        setDepositUsage(resetUsage);
      } catch (err) {
        // Error reloading deposits - non-critical, continue
      }
    } catch (err) {
      handleError(err, 'Failed to pay invoices');
    } finally {
      setLoading(false);
    }
  }, [selectedProperty, selectedDeposits, depositPaymentAllocations, depositPaymentTotals, selectedResident, invoices, depositPaymentForm, loadResidents, showSuccess, handleError, calculateInvoiceSubtotal]);

  const handleAutoMatch = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await autoMatchProperties(selectedResident._id);
      showSuccess(response.data.message || 'Properties auto-matched successfully');
      setPropertiesDialog(false);
      loadResidents();
    } catch (err) {
      handleError(err, 'Failed to auto-match properties');
    } finally {
      setLoading(false);
    }
  }, [selectedResident, loadResidents, showSuccess, handleError]);

  const handleAssignProperties = useCallback(async () => {
    if (selectedPropertyIds.length === 0) {
      setError('Please select at least one property');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await assignProperties(selectedResident._id, selectedPropertyIds);
      showSuccess('Properties assigned successfully');
      setSelectedPropertyIds([]);
      
      // Refresh resident data
      const response = await fetchResidents({});
      const updatedResident = response.data.data.find(r => r._id === selectedResident._id);
      if (updatedResident) {
        setSelectedResident(updatedResident);
      }
      
      loadResidents();
      loadUnassignedProperties();
    } catch (err) {
      handleError(err, 'Failed to assign properties');
    } finally {
      setLoading(false);
    }
  }, [selectedResident, selectedPropertyIds, loadResidents, loadUnassignedProperties, showSuccess, handleError]);

  const handleUnassignProperty = useCallback(async (propertyId) => {
    try {
      setLoading(true);
      setError('');
      await unassignProperties(selectedResident._id, [propertyId]);
      showSuccess('Property unassigned successfully');
      
      // Refresh resident data
      const response = await fetchResidents({});
      const updatedResident = response.data.data.find(r => r._id === selectedResident._id);
      if (updatedResident) {
        setSelectedResident(updatedResident);
      }
      
      loadResidents();
      loadUnassignedProperties();
    } catch (err) {
      handleError(err, 'Failed to unassign property');
    } finally {
      setLoading(false);
    }
  }, [selectedResident, loadResidents, loadUnassignedProperties, showSuccess, handleError]);

  const submitTransaction = useCallback(async (type, form, apiCall) => {
    try {
      setLoading(true);
      setError('');
      const data = {
        ...form,
        amount: parseFloat(form.amount) || 0
      };
      await apiCall(selectedResident._id, data);
      showSuccess(`${type} successful`);
      if (type === 'Deposit') setDepositDialog(false);
      loadResidents();
    } catch (err) {
      handleError(err, `Failed to ${type.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [selectedResident, loadResidents, showSuccess, handleError]);

  const handleEditDeposit = useCallback((deposit) => {
    setEditingDeposit(deposit);
    setDepositForm({
      amount: deposit.amount || '',
      paymentMethod: deposit.paymentMethod || 'Cash',
      bank: deposit.bank || '',
      referenceNumberExternal: deposit.referenceNumberExternal || '',
      description: deposit.description || '',
      depositDate: dayjs(deposit.createdAt).format('YYYY-MM-DD')
    });
    setDepositDialog(true);
  }, []);

  const submitDeposit = useCallback(async () => {
    if (editingDeposit) {
      // Update existing deposit
      try {
        setLoading(true);
        setError('');
        await updateDeposit(selectedResident._id, editingDeposit._id, depositForm);
        showSuccess('Deposit updated successfully');
        setDepositDialog(false);
        setEditingDeposit(null);
        setDepositForm(defaultTransactionForm);
        loadResidents();
        // Reload deposits if deposits dialog is open
        if (depositsDialog) {
          setDepositsLoading(true);
          try {
            const response = await fetchResidentTransactions(selectedResident._id, {
              transactionType: 'deposit',
              limit: 1000
            });
            const allDeposits = (response.data.data.transactions || []).filter(
              txn => txn.transactionType === 'deposit' && 
                     (!txn.referenceNumberExternal || !txn.referenceNumberExternal.startsWith('REV-'))
            );
            setDeposits(allDeposits);
          } catch (err) {
            console.error('Error reloading deposits:', err);
          } finally {
            setDepositsLoading(false);
          }
        }
      } catch (err) {
        handleError(err, 'Failed to update deposit');
      } finally {
        setLoading(false);
      }
    } else {
      // Create new deposit
      submitTransaction('Deposit', depositForm, depositMoney);
    }
  }, [editingDeposit, depositForm, selectedResident, updateDeposit, submitTransaction, depositMoney, loadResidents, depositsDialog, fetchResidentTransactions, showSuccess, handleError]);

  const submitPay = useCallback(async () => {
    // Check if this is TAJ MANAGEMENT (TCM) - property selection not required for open invoices
    const isTajManagement = selectedResident?.residentId === '00434' || 
                           selectedResident?.residentId === 434 || 
                           selectedResident?.name?.toUpperCase().includes('TAJ MANAGEMENT') ||
                           selectedResident?.name?.toUpperCase().includes('TCM');
    
    if (!isTajManagement && !selectedProperty) {
      setError('Please select a property');
      return;
    }

    const amountNum = Number(payForm.amount) || 0;
    if (amountNum <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    const validAllocations = allocations.filter(a => a.allocatedAmount > 0);
    if (validAllocations.length === 0) {
      setError('Please allocate at least one invoice');
      return;
    }

    if (totals.totalAllocated > amountNum) {
      setError('Total allocated amount cannot exceed payment amount');
      return;
    }

    if (amountNum > (selectedResident?.balance || 0)) {
      setError(`Insufficient balance. Current balance: ${formatCurrency(selectedResident?.balance || 0)}`);
      return;
    }

    // Validate bank name for payment methods that require it
    if (BANK_REQUIRED_METHODS.includes(payForm.paymentMethod) && !payForm.bankName) {
      setError('Bank selection is required for this payment method');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await Promise.all(
        validAllocations.map(async (allocation) => {
          const invoice = invoices.find(inv => inv._id === allocation.invoice);
          if (invoice && allocation.allocatedAmount > 0) {
            return payBill(selectedResident._id, {
              amount: allocation.allocatedAmount,
              referenceType: allocation.invoiceType,
              referenceId: String(invoice._id),
              referenceNumber: invoice.invoiceNumber || '',
              description: `${allocation.invoiceType} - ${getInvoiceDescription(invoice)}`,
              paymentDate: payForm.paymentDate,
              bankName: payForm.bankName || '',
              bankReference: payForm.bankReference || '',
              paymentMethod: payForm.paymentMethod
            });
          }
        })
      );
      
      showSuccess('Payment successful');
      setPayDialog(false);
      resetPayForm();
      loadResidents();
      
      // Reload invoices to get updated totalPaid and balance
      if (isTajManagement) {
        // For TAJ MANAGEMENT, reload open invoices
        try {
          const response = await fetchAllInvoices({
            openInvoices: 'true',
            paymentStatus: 'unpaid,partial_paid',
            limit: 1000 // Get all open invoices
          });
          // Filter for invoices with balance > 0 (backend should already filter by paymentStatus)
          const openInvoicesList = (response.data?.data || []).filter(
            inv => inv && (inv.balance || 0) > 0
          );
          setInvoices(openInvoicesList);
          
          const outstandingInvoices = openInvoicesList.filter(inv => (inv.balance || 0) > 0);
          setAllocations(outstandingInvoices.map(inv => ({
            invoice: inv._id,
            invoiceNumber: inv.invoiceNumber,
            invoiceType: getInvoiceTypeFromCharges(inv.chargeTypes),
            balance: inv.balance || 0,
            allocatedAmount: 0,
            remaining: inv.balance || 0
          })));
        } catch (err) {
          console.error('Error reloading open invoices:', err);
          // Error reloading invoices - non-critical, continue
        }
      } else if (selectedProperty?._id) {
        // For other residents, reload property invoices
        try {
          const response = await fetchInvoicesForProperty(selectedProperty._id);
          const invoiceList = response.data?.data || [];
          setInvoices(invoiceList);
          
          const outstandingInvoices = invoiceList.filter(inv => (inv.balance || 0) > 0);
          setAllocations(outstandingInvoices.map(inv => ({
            invoice: inv._id,
            invoiceNumber: inv.invoiceNumber,
            invoiceType: getInvoiceTypeFromCharges(inv.chargeTypes),
            balance: inv.balance || 0,
            allocatedAmount: 0,
            remaining: inv.balance || 0
          })));
        } catch (err) {
          // Error reloading invoices - non-critical, continue
        }
      }
    } catch (err) {
      console.error('Payment error details:', err);
      const errorMessage = err.response?.data?.message || 
                          (err.response?.data?.errors && err.response.data.errors.length > 0 
                            ? err.response.data.errors.map(e => e.msg || e.message).join(', ')
                            : null) ||
                          err.message || 
                          'Failed to pay invoices';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedProperty, payForm, allocations, totals, selectedResident, invoices, resetPayForm, loadResidents, showSuccess, handleError]);

  // Payment method change handler
  const handlePaymentMethodChange = useCallback((form, setForm, newMethod) => {
    setForm({
      ...form,
      paymentMethod: newMethod,
      bank: BANK_REQUIRED_METHODS.includes(newMethod) ? form.bank : ''
    });
  }, []);

  // Bank management handlers
  const handleAddBank = useCallback(() => {
    if (!newBankName.trim()) return;
    const trimmedName = newBankName.trim();
    if (customBanks.includes(trimmedName)) {
      setError('Bank already exists');
      return;
    }
    const updated = [...customBanks, trimmedName];
    setCustomBanks(updated);
    localStorage.setItem('tajCustomBanks', JSON.stringify(updated));
    // Auto-select the newly added bank in the active form
    if (depositDialog) {
      setDepositForm((prev) => ({ ...prev, bank: trimmedName }));
    }
    if (payDialog) {
      setPayForm((prev) => ({ ...prev, bankName: trimmedName }));
    }
    if (depositPaymentDialog) {
      setDepositPaymentForm((prev) => ({ ...prev, bankName: trimmedName }));
    }
    setNewBankName('');
    setAddBankDialog(false);
    setError('');
  }, [newBankName, customBanks, depositDialog, payDialog, depositPaymentDialog]);

  const handleRemoveBank = useCallback((bankName, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Remove "${bankName}" from the bank list?`)) return;
    const updated = customBanks.filter(b => b !== bankName);
    setCustomBanks(updated);
    localStorage.setItem('tajCustomBanks', JSON.stringify(updated));
    // Clear bank field if it was the removed bank
    if (depositForm.bank === bankName) {
      setDepositForm((prev) => ({ ...prev, bank: '' }));
    }
    showSuccess('Bank removed successfully');
  }, [customBanks, depositForm.bank, showSuccess]);

  // Render helpers
  const renderBankField = useCallback((form, setForm, show = true) => {
    if (!show || !BANK_REQUIRED_METHODS.includes(form.paymentMethod)) return null;
    return (
      <Grid item xs={12} md={6}>
        <FormControl fullWidth>
          <InputLabel>Bank</InputLabel>
          <Select
            value={form.bank}
            label="Bank"
            onChange={(e) => {
              if (e.target.value === 'add_new') {
                setAddBankDialog(true);
                setNewBankName('');
              } else {
                setForm({ ...form, bank: e.target.value });
              }
            }}
          >
            {customBanks.length === 0 ? (
              <MenuItem disabled value="">
                <Typography variant="body2" color="text.secondary">
                  No banks available. Add a new bank.
                </Typography>
              </MenuItem>
            ) : (
              customBanks.map((bank) => (
                <MenuItem 
                  key={bank} 
                  value={bank}
                  sx={{ 
                    '&:hover .delete-bank-btn': { 
                      visibility: 'visible' 
                    } 
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ flex: 1 }}>{bank}</span>
                    <IconButton
                      className="delete-bank-btn"
                      size="small"
                      onClick={(e) => handleRemoveBank(bank, e)}
                      sx={{ 
                        ml: 1, 
                        p: 0.5,
                        visibility: 'hidden'
                      }}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </MenuItem>
              ))
            )}
            <MenuItem 
              value="add_new" 
              sx={{ 
                borderTop: customBanks.length > 0 ? '1px solid #e0e0e0' : 'none',
                backgroundColor: '#f5f5f5',
                '&:hover': {
                  backgroundColor: '#e3f2fd'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AddIcon fontSize="small" />
                Add New Bank
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
      </Grid>
    );
  }, [customBanks, handleRemoveBank]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Taj Residents
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Add Resident
        </Button>
      </Box>

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

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, CNIC, phone, email..."
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={accountTypeFilter}
                  label="Account Type"
                  onChange={(e) => setAccountTypeFilter(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {ACCOUNT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadResidents}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Resident ID</strong></TableCell>
                <TableCell><strong>Resident Name</strong></TableCell>
                <TableCell><strong>Account Type</strong></TableCell>
                <TableCell><strong>Properties</strong></TableCell>
                <TableCell><strong>Balance</strong></TableCell>
                <TableCell><strong>Contact</strong></TableCell>
                <TableCell><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                // Skeleton loading rows
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell>
                      <Skeleton variant="text" width={60} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width="60%" />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="rectangular" width={100} height={24} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width={40} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width={80} />
                    </TableCell>
                    <TableCell>
                      <Skeleton variant="text" width={120} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Skeleton variant="circular" width={32} height={32} />
                        <Skeleton variant="circular" width={32} height={32} />
                        <Skeleton variant="circular" width={32} height={32} />
                        <Skeleton variant="circular" width={32} height={32} />
                        <Skeleton variant="circular" width={32} height={32} />
                        <Skeleton variant="circular" width={32} height={32} />
                        <Skeleton variant="circular" width={32} height={32} />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                filteredResidents.map((resident) => (
                <TableRow key={resident._id}>
                  <TableCell>{resident.residentId || '-'}</TableCell>
                  <TableCell>{resident.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={resident.accountType}
                      size="small"
                      color={resident.accountType === 'Resident' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{resident.propertyCount || 0}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      {formatCurrency(resident.totalRemainingDeposits ?? resident.balance ?? 0)}
                    </Typography>
                  </TableCell>
                  <TableCell>{resident.contactNumber || '-'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => navigate(`/finance/taj-utilities-charges/taj-residents/${resident._id}`)}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Deposit">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleDeposit(resident)}
                        >
                          <GetAppIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Pay Bill">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => handlePay(resident)}
                        >
                          <AccountBalanceIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Properties">
                        <IconButton
                          size="small"
                          color="info"
                          onClick={() => handleManageProperties(resident)}
                        >
                          <HomeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Transactions">
                        <IconButton
                          size="small"
                          onClick={() => handleViewTransactions(resident)}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleEdit(resident)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(resident)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePaginationWrapper
          page={pagination.page}
          rowsPerPage={pagination.rowsPerPage}
          total={pagination.total}
          onPageChange={pagination.handleChangePage}
          onRowsPerPageChange={pagination.handleChangeRowsPerPage}
        />

      {/* Create/Edit Form Dialog */}
      <Dialog open={formDialog} onClose={() => setFormDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedResident ? 'Edit Resident' : 'Add Resident'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={formData.accountType}
                  label="Account Type"
                  onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
                >
                  {ACCOUNT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="CNIC"
                value={formData.cnic}
                onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contact Number"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase().trim() })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Initial Balance"
                type="number"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={loading || !formData.name}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={depositDialog} onClose={() => {
        setDepositDialog(false);
        setEditingDeposit(null);
        setDepositForm(defaultTransactionForm);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDeposit ? 'Edit Deposit' : 'Deposit Money'} - {selectedResident?.name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Alert severity="info">
                Current Balance: {formatCurrency(selectedResident?.totalRemainingDeposits ?? selectedResident?.balance ?? 0)}
              </Alert>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Deposit Date"
                type="date"
                value={depositForm.depositDate || dayjs().format('YYYY-MM-DD')}
                onChange={(e) => setDepositForm({ ...depositForm, depositDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={depositForm.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => handlePaymentMethodChange(depositForm, setDepositForm, e.target.value)}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {renderBankField(depositForm, setDepositForm)}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Transaction Number"
                value={depositForm.referenceNumberExternal}
                onChange={(e) => setDepositForm({ ...depositForm, referenceNumberExternal: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={depositForm.description}
                onChange={(e) => setDepositForm({ ...depositForm, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDepositDialog(false);
            setEditingDeposit(null);
            setDepositForm(defaultTransactionForm);
          }}>Cancel</Button>
          <Button onClick={submitDeposit} variant="contained" disabled={loading || !depositForm.amount || !depositForm.referenceNumberExternal}>
            {editingDeposit ? 'Update' : 'Deposit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pay Invoice Dialog */}
      <Dialog open={payDialog} onClose={() => setPayDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {(() => {
                const isTajManagement = selectedResident?.residentId === '00434' || 
                                       selectedResident?.residentId === 434 || 
                                       selectedResident?.name?.toUpperCase().includes('TAJ MANAGEMENT') ||
                                       selectedResident?.name?.toUpperCase().includes('TCM');
                return isTajManagement 
                  ? `Pay Open Invoices - ${selectedResident?.name}` 
                  : `Pay Invoice - ${selectedResident?.name}`;
              })()}
            </Typography>
            <IconButton onClick={() => setPayDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <Alert severity="info">
                Current Balance: {formatCurrency(selectedResident?.totalRemainingDeposits ?? selectedResident?.balance ?? 0)}
              </Alert>
            </Grid>
            {/* Check if this is TAJ MANAGEMENT (TCM) - hide property selection for open invoices */}
            {(() => {
              const isTajManagement = selectedResident?.residentId === '00434' || 
                                     selectedResident?.residentId === 434 || 
                                     selectedResident?.name?.toUpperCase().includes('TAJ MANAGEMENT') ||
                                     selectedResident?.name?.toUpperCase().includes('TCM');
              
              if (!isTajManagement) {
                return (
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      options={selectedResident?.properties || []}
                      getOptionLabel={(option) => 
                        `${option.propertyName || option.plotNumber || ''} - ${option.ownerName || ''}`
                      }
                      value={selectedProperty}
                      onChange={(e, newValue) => handlePropertyChange(newValue)}
                      renderInput={(params) => (
                        <TextField {...params} label="Select Property" size="small" required />
                      )}
                    />
                  </Grid>
                );
              }
              return null;
            })()}
            <Grid item xs={12} sm={3}>
              <TextField
                label="Date"
                type="date"
                value={payForm.paymentDate}
                onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Amount"
                type="number"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                fullWidth
                size="small"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={payForm.description}
                onChange={(e) => setPayForm({ ...payForm, description: e.target.value })}
                fullWidth
                size="small"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Bank</InputLabel>
                <Select
                  value={payForm.bankName}
                  label="Bank"
                  onChange={(e) => {
                    if (e.target.value === 'add_new') {
                      setAddBankDialog(true);
                      setNewBankName('');
                    } else {
                      setPayForm({ ...payForm, bankName: e.target.value });
                    }
                  }}
                >
                  {customBanks.length === 0 ? (
                    <MenuItem disabled value="">
                      <Typography variant="body2" color="text.secondary">
                        No banks available. Add a new bank.
                      </Typography>
                    </MenuItem>
                  ) : (
                    customBanks.map((bank) => (
                      <MenuItem key={bank} value={bank}>
                        {bank}
                      </MenuItem>
                    ))
                  )}
                  <MenuItem 
                    value="add_new" 
                    sx={{ 
                      borderTop: customBanks.length > 0 ? '1px solid #e0e0e0' : 'none',
                      backgroundColor: '#f5f5f5',
                      '&:hover': {
                        backgroundColor: '#e3f2fd'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <AddIcon fontSize="small" />
                      Add New Bank
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bank Reference"
                value={payForm.bankReference}
                onChange={(e) => setPayForm({ ...payForm, bankReference: e.target.value })}
                fullWidth
                size="small"
              />
            </Grid>
          </Grid>

          {loadingInvoices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : allocations.length > 0 ? (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Nature</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      <TableCell align="right">Pay</TableCell>
                      <TableCell align="right">Remaining</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allocations.map((alloc, index) => {
                      const invoice = invoices.find(inv => inv._id === alloc.invoice);
                      return (
                        <TableRow key={alloc.invoice}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {invoice?.invoiceNumber || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>{alloc.invoiceType}</TableCell>
                          <TableCell>{getInvoiceDescription(invoice || {})}</TableCell>
                          <TableCell align="right">{formatCurrency(alloc.balance)}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              value={alloc.allocatedAmount || ''}
                              onChange={(e) => handleAllocationChange(index, e.target.value)}
                              size="small"
                              inputProps={{ min: 0, max: alloc.balance, step: 1 }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography color={alloc.remaining > 0 ? 'error.main' : 'success.main'}>
                              {formatCurrency(alloc.remaining)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Total Allocated:
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {formatCurrency(totals.totalAllocated)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Un-Allocated Payment:
                  </Typography>
                  <Typography 
                    variant="h6" 
                    fontWeight={600}
                    color={totals.unallocated < 0 ? 'error.main' : totals.unallocated > 0 ? 'warning.main' : 'success.main'}
                  >
                    {formatCurrency(totals.unallocated)}
                  </Typography>
                </Stack>
              </Box>
            </>
          ) : (() => {
            const isTajManagement = selectedResident?.residentId === '00434' || 
                                   selectedResident?.residentId === 434 || 
                                   selectedResident?.name?.toUpperCase().includes('TAJ MANAGEMENT') ||
                                   selectedResident?.name?.toUpperCase().includes('TCM');
            
            if (isTajManagement) {
              return <Alert severity="info">No outstanding open invoices found.</Alert>;
            } else if (selectedProperty) {
              return <Alert severity="info">No outstanding invoices found for this property.</Alert>;
            }
            return null;
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(false)}>Close</Button>
          <Button 
            onClick={submitPay} 
            variant="contained" 
            disabled={loading || totals.totalAllocated <= 0 || (() => {
              const isTajManagement = selectedResident?.residentId === '00434' || 
                                     selectedResident?.residentId === 434 || 
                                     selectedResident?.name?.toUpperCase().includes('TAJ MANAGEMENT') ||
                                     selectedResident?.name?.toUpperCase().includes('TCM');
              // For TAJ MANAGEMENT, property selection is not required
              // For other residents, property selection is required
              return !isTajManagement && !selectedProperty;
            })()}
          >
            {loading ? 'Paying...' : 'Pay Invoice'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={transactionsDialog} onClose={() => setTransactionsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Transaction History - {selectedResident?.name}
        </DialogTitle>
        <DialogContent>
          {transactionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Property</strong></TableCell>
                    <TableCell><strong>Amount</strong></TableCell>
                    <TableCell><strong>Balance Before</strong></TableCell>
                    <TableCell><strong>Balance After</strong></TableCell>
                    <TableCell><strong>Payment Method</strong></TableCell>
                    <TableCell><strong>Bank</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell><strong>Deposit Breakdown</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((txn) => {
                    const hasDepositBreakdown = txn.depositUsages && Array.isArray(txn.depositUsages) && txn.depositUsages.length > 0;
                    return (
                      <TableRow key={txn._id}>
                        <TableCell>{dayjs(txn.createdAt).format('DD MMM YYYY HH:mm')}</TableCell>
                        <TableCell>
                          <Chip
                            label={txn.transactionType}
                            size="small"
                            color={txn.transactionType === 'deposit' || txn.transactionType === 'transfer' ? 'success' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          {txn.property ? (
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {txn.property.propertyName || `SR# ${txn.property.srNo || 'N/A'}`}
                              </Typography>
                              {txn.property.propertyType && (
                                <Typography variant="caption" color="text.secondary">
                                  {txn.property.propertyType}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(txn.amount)}</TableCell>
                        <TableCell>{formatCurrency(txn.balanceBefore)}</TableCell>
                        <TableCell>{formatCurrency(txn.balanceAfter)}</TableCell>
                        <TableCell>{txn.paymentMethod || '-'}</TableCell>
                        <TableCell>{txn.bank || '-'}</TableCell>
                        <TableCell>{txn.description || '-'}</TableCell>
                        <TableCell>
                          {hasDepositBreakdown ? (
                            <Box>
                              {txn.depositUsages.map((usage, idx) => {
                                const depositDate = usage.depositId?.createdAt 
                                  ? dayjs(usage.depositId.createdAt).format('DD MMM YYYY')
                                  : usage.depositId?._id 
                                  ? 'Deposit'
                                  : 'Deposit';
                                const depositAmount = usage.depositId?.amount 
                                  ? formatCurrency(usage.depositId.amount)
                                  : '';
                                return (
                                  <Typography 
                                    key={idx} 
                                    variant="caption" 
                                    display="block" 
                                    sx={{ mb: 0.5 }}
                                    title={depositAmount ? `From deposit of ${depositAmount}` : ''}
                                  >
                                    <strong>{depositDate}:</strong> {formatCurrency(usage.amount)}
                                  </Typography>
                                );
                              })}
                            </Box>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransactionsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Deposits Dialog - Shows only deposit transactions */}
      <Dialog open={depositsDialog} onClose={() => setDepositsDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Transactions Deposited - {selectedResident?.name}
        </DialogTitle>
        <DialogContent>
          {depositsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Amount</strong></TableCell>
                    <TableCell><strong>Payment Method</strong></TableCell>
                    <TableCell><strong>Bank</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deposits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No deposit transactions found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    deposits.map((txn) => (
                      <TableRow key={txn._id}>
                        <TableCell>{dayjs(txn.createdAt).format('DD MMM YYYY HH:mm')}</TableCell>
                        <TableCell>
                          <Chip
                            label={txn.transactionType}
                            size="small"
                            color="success"
                          />
                        </TableCell>
                        <TableCell>{formatCurrency(txn.amount)}</TableCell>
                        <TableCell>{txn.paymentMethod || '-'}</TableCell>
                        <TableCell>{txn.bank || '-'}</TableCell>
                        <TableCell>{txn.description || '-'}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Tooltip title="Edit Deposit">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleEditDeposit(txn)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Pay Invoice">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handlePayFromDeposit([txn])}
                              >
                                <PaymentIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Properties Management Dialog */}
      <Dialog open={propertiesDialog} onClose={() => setPropertiesDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Manage Properties - {selectedResident?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {/* Current Properties */}
            {selectedResident?.properties && selectedResident.properties.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Current Properties ({selectedResident.properties.length})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Property Name</strong></TableCell>
                        <TableCell><strong>Meters</strong></TableCell>
                        <TableCell><strong>Plot Number</strong></TableCell>
                        <TableCell><strong>Sector</strong></TableCell>
                        <TableCell><strong>Block</strong></TableCell>
                        <TableCell><strong>Address</strong></TableCell>
                        <TableCell><strong>Actions</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedResident.properties.map((property) => {
                        const activeMetersCount = property.meters?.filter(m => m.isActive !== false).length || 0;
                        const totalMetersCount = property.meters?.length || 0;
                        return (
                        <TableRow key={property._id}>
                          <TableCell>{property.propertyName || '-'}</TableCell>
                          <TableCell>
                            {property.meters && Array.isArray(property.meters) && totalMetersCount > 0 ? (
                              <Chip 
                                label={`${activeMetersCount}${totalMetersCount !== activeMetersCount ? `/${totalMetersCount}` : ''}`}
                                size="small"
                                color={activeMetersCount > 0 ? "primary" : "default"}
                                variant={activeMetersCount > 0 ? "filled" : "outlined"}
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">0</Typography>
                            )}
                          </TableCell>
                          <TableCell>{property.plotNumber || '-'}</TableCell>
                          <TableCell>{property.sector || '-'}</TableCell>
                          <TableCell>{property.block || '-'}</TableCell>
                          <TableCell>{property.fullAddress || '-'}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleUnassignProperty(property._id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Auto-match Section */}
            <Box sx={{ mb: 3 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Auto-match will find properties where the owner name matches "{selectedResident?.name}"
              </Alert>
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleAutoMatch}
                disabled={loading}
              >
                Auto-Match Properties by Owner Name
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Assign New Properties */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Search & Assign Properties
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Search for properties by name, plot number, sector, block, or address. Select properties to link them to this resident.
              </Alert>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={9}>
                  <TextField
                    fullWidth
                    label="Search Properties"
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    placeholder="Type property name, plot number, sector, block, address, or owner name..."
                    autoFocus
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      setPropertySearch('');
                      loadUnassignedProperties('');
                    }}
                    disabled={propertiesLoading}
                  >
                    Clear & Refresh
                  </Button>
                </Grid>
              </Grid>

              {propertiesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : unassignedProperties.length === 0 ? (
                <Alert severity="info">
                  {propertySearch ? `No properties found matching "${propertySearch}"` : 'No properties found. Try searching by property name, plot number, or address.'}
                </Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={
                              unassignedProperties.length > 0 &&
                              unassignedProperties
                                .filter(p => !(p.resident && p.resident._id === selectedResident?._id))
                                .every(p => selectedPropertyIds.includes(p._id))
                            }
                            indeterminate={
                              selectedPropertyIds.length > 0 &&
                              selectedPropertyIds.length < unassignedProperties.filter(p => !(p.resident && p.resident._id === selectedResident?._id)).length
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const selectableProperties = unassignedProperties.filter(
                                  p => !(p.resident && p.resident._id === selectedResident?._id)
                                );
                                setSelectedPropertyIds(selectableProperties.map(p => p._id));
                              } else {
                                setSelectedPropertyIds([]);
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell><strong>Property Name</strong></TableCell>
                        <TableCell><strong>Meters</strong></TableCell>
                        <TableCell><strong>Plot Number</strong></TableCell>
                        <TableCell><strong>Sector</strong></TableCell>
                        <TableCell><strong>Block</strong></TableCell>
                        <TableCell><strong>Owner Name</strong></TableCell>
                        <TableCell><strong>Address</strong></TableCell>
                        <TableCell><strong>Current Resident</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {unassignedProperties.map((property) => {
                        const isAlreadyAssigned = property.resident && property.resident._id !== selectedResident?._id;
                        const isAssignedToThisResident = property.resident && property.resident._id === selectedResident?._id;
                        const activeMetersCount = property.meters?.filter(m => m.isActive !== false).length || 0;
                        const totalMetersCount = property.meters?.length || 0;
                        return (
                          <TableRow 
                            key={property._id}
                            sx={{
                              backgroundColor: isAssignedToThisResident ? 'action.selected' : isAlreadyAssigned ? 'error.light' : 'inherit',
                              opacity: isAssignedToThisResident ? 0.6 : 1
                            }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedPropertyIds.includes(property._id)}
                                disabled={isAssignedToThisResident}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPropertyIds([...selectedPropertyIds, property._id]);
                                  } else {
                                    setSelectedPropertyIds(selectedPropertyIds.filter(id => id !== property._id));
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={isAlreadyAssigned ? 'bold' : 'normal'}>
                                {property.propertyName || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {property.meters && Array.isArray(property.meters) && totalMetersCount > 0 ? (
                                <Chip 
                                  label={`${activeMetersCount}${totalMetersCount !== activeMetersCount ? `/${totalMetersCount}` : ''}`}
                                  size="small"
                                  color={activeMetersCount > 0 ? "primary" : "default"}
                                  variant={activeMetersCount > 0 ? "filled" : "outlined"}
                                />
                              ) : (
                                <Typography variant="body2" color="text.secondary">0</Typography>
                              )}
                            </TableCell>
                            <TableCell>{property.plotNumber || '-'}</TableCell>
                            <TableCell>{property.sector || '-'}</TableCell>
                            <TableCell>{property.block || '-'}</TableCell>
                            <TableCell>{property.ownerName || '-'}</TableCell>
                            <TableCell>{property.fullAddress || '-'}</TableCell>
                            <TableCell>
                              {isAssignedToThisResident ? (
                                <Chip label="Already Assigned" size="small" color="success" />
                              ) : isAlreadyAssigned ? (
                                <Chip label={property.resident?.name || 'Assigned'} size="small" color="warning" />
                              ) : (
                                <Chip label="Unassigned" size="small" color="default" />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPropertiesDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAssignProperties}
            variant="contained"
            disabled={loading || selectedPropertyIds.length === 0}
            startIcon={<LinkIcon />}
          >
            Assign Selected ({selectedPropertyIds.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deposit Payment Dialog - Similar to Receipt Create */}
      <Dialog open={depositPaymentDialog} onClose={() => setDepositPaymentDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Pay Invoices from Deposit</Typography>
            <IconButton onClick={() => setDepositPaymentDialog(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {/* All Deposits Table - User can see and allocate from each deposit */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Available Deposits
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              All deposits are shown below. You can allocate payments from multiple deposits. Adjust the "Amount to Use" for each deposit as needed.
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Deposit Date</strong></TableCell>
                    <TableCell><strong>Deposit Amount</strong></TableCell>
                    <TableCell><strong>Payment Method</strong></TableCell>
                    <TableCell><strong>Bank</strong></TableCell>
                    <TableCell><strong>Transaction Number</strong></TableCell>
                    <TableCell align="right"><strong>Amount to Use</strong></TableCell>
                    <TableCell align="right"><strong>Remaining</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedDeposits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          No deposits available
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedDeposits.map((deposit) => {
                      const usageAmount = depositUsage[deposit._id] || 0;
                      const availableAmount = getDepositAvailableAmount(deposit);
                      const remaining = availableAmount - usageAmount;
                      return (
                        <TableRow key={deposit._id}>
                          <TableCell>{dayjs(deposit.createdAt).format('DD MMM YYYY')}</TableCell>
                          <TableCell>
                            <Typography fontWeight={600}>
                              {formatCurrency(deposit.amount || 0)}
                            </Typography>
                            {deposit.remainingAmount !== undefined && deposit.remainingAmount < deposit.amount && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Available: {formatCurrency(deposit.remainingAmount)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{deposit.paymentMethod || '-'}</TableCell>
                          <TableCell>{deposit.bank || '-'}</TableCell>
                          <TableCell>{deposit.referenceNumberExternal || '-'}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              value={usageAmount || ''}
                              onChange={(e) => handleDepositUsageChange(deposit._id, e.target.value)}
                              size="small"
                              inputProps={{ 
                                min: 0, 
                                max: availableAmount, 
                                step: 1 
                              }}
                              sx={{ width: 150 }}
                              helperText={`Max: ${formatCurrency(availableAmount)}`}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography 
                              fontWeight={600}
                              color={remaining < 0 ? 'error.main' : remaining === 0 ? 'success.main' : 'text.primary'}
                            >
                              {formatCurrency(remaining)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Deposit Amount:
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {formatCurrency(depositPaymentTotals.totalDepositAmount)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Total Amount Being Used:
                </Typography>
                <Typography variant="h6" fontWeight={600} color="primary.main">
                  {formatCurrency(depositPaymentTotals.totalDepositUsage)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Remaining Available Balance:
                </Typography>
                <Typography 
                  variant="h6" 
                  fontWeight={600}
                  color={(depositPaymentTotals.totalDepositAmount - depositPaymentTotals.totalDepositUsage) < 0 ? 'error.main' : 'success.main'}
                >
                  {formatCurrency(depositPaymentTotals.totalDepositAmount - depositPaymentTotals.totalDepositUsage)}
                </Typography>
              </Stack>
            </Box>
          </Box>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                options={filteredPropertiesForDeposit}
                getOptionLabel={(option) => 
                  `${option.propertyName || option.plotNumber || ''} - ${option.ownerName || ''}`
                }
                value={selectedProperty}
                onChange={(e, newValue) => handleDepositPaymentPropertyChange(newValue)}
                loading={propertiesLoading}
                renderInput={(params) => (
                  <TextField {...params} label="Select Property" size="small" required />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Applied Date"
                type="date"
                value={depositPaymentForm.receiptDate}
                onChange={(e) => setDepositPaymentForm({ ...depositPaymentForm, receiptDate: e.target.value })}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Total Amount to Use"
                type="number"
                value={depositPaymentTotals.totalDepositUsage}
                fullWidth
                size="small"
                disabled
                InputLabelProps={{ shrink: true }}
                helperText="Sum of amounts from deposits"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={depositPaymentForm.description}
                onChange={(e) => setDepositPaymentForm({ ...depositPaymentForm, description: e.target.value })}
                fullWidth
                size="small"
                multiline
                rows={2}
              />
            </Grid>
          </Grid>

          {loadingInvoices ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : depositPaymentAllocations.length > 0 ? (
            <>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Invoice #</strong></TableCell>
                      <TableCell><strong>Invoice Date</strong></TableCell>
                      <TableCell><strong>Invoice Period</strong></TableCell>
                      <TableCell><strong>Due Date</strong></TableCell>
                      <TableCell align="right"><strong>Amount</strong></TableCell>
                      <TableCell align="right"><strong>Paid</strong></TableCell>
                      <TableCell align="right"><strong>Balance</strong></TableCell>
                      <TableCell align="right"><strong>Pay Now</strong></TableCell>
                      <TableCell align="right"><strong>Remaining</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {depositPaymentAllocations.map((alloc, index) => {
                      const invoice = invoices.find(inv => inv._id === alloc.invoice);
                      const periodText = invoice?.periodFrom && invoice?.periodTo
                        ? `${dayjs(invoice.periodFrom).format('DD MMM YYYY')} - ${dayjs(invoice.periodTo).format('DD MMM YYYY')}`
                        : '-';
                      // Calculate effective amount for display (handles CAM late surcharge after due date)
                      const displayAmount = getDepositInvoiceDisplayAmount(invoice);
                      // Format due date - use invoice.dueDate directly, matching the Invoices page display
                      const dueDateText = invoice?.dueDate
                        ? dayjs(invoice.dueDate).format('DD MMM YYYY')
                        : '-';
                      return (
                        <TableRow key={alloc.invoice}>
                          <TableCell>{invoice?.invoiceNumber || '-'}</TableCell>
                          <TableCell>{invoice?.invoiceDate ? dayjs(invoice.invoiceDate).format('DD MMM YYYY') : '-'}</TableCell>
                          <TableCell>{periodText}</TableCell>
                          <TableCell>{dueDateText}</TableCell>
                          <TableCell align="right">{formatCurrency(displayAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(invoice?.totalPaid || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(alloc.balance)}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              value={alloc.allocatedAmount || ''}
                              onChange={(e) => handleDepositPaymentAllocationChange(index, e.target.value)}
                              size="small"
                              inputProps={{ min: 0, max: alloc.balance, step: 1 }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography color={alloc.remaining > 0 ? 'error.main' : 'success.main'}>
                              {formatCurrency(alloc.remaining)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Amount Being Used:
                  </Typography>
                  <Typography variant="h6" fontWeight={600} color="primary.main">
                    {formatCurrency(depositPaymentTotals.totalDepositUsage)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Total Allocated to Invoices:
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {formatCurrency(depositPaymentTotals.totalAllocated)}
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Remaining to Allocate:
                  </Typography>
                  <Typography 
                    variant="h6" 
                    fontWeight={600}
                    color={
                      depositPaymentTotals.totalDepositUsage - depositPaymentTotals.totalAllocated === 0 
                        ? 'success.main' 
                        : depositPaymentTotals.totalAllocated < depositPaymentTotals.totalDepositUsage 
                        ? 'warning.main' 
                        : 'error.main'
                    }
                  >
                    {formatCurrency(depositPaymentTotals.totalDepositUsage - depositPaymentTotals.totalAllocated)}
                  </Typography>
                </Stack>
              </Box>
              {depositPaymentTotals.totalAllocated !== depositPaymentTotals.totalDepositUsage && (
                <Alert 
                  severity={depositPaymentTotals.totalAllocated < depositPaymentTotals.totalDepositUsage ? "warning" : "error"} 
                  sx={{ mt: 2 }}
                >
                  <Typography variant="body2">
                    {depositPaymentTotals.totalAllocated < depositPaymentTotals.totalDepositUsage ? (
                      <>
                        <strong>Incomplete Allocation:</strong> Total allocated to invoices ({formatCurrency(depositPaymentTotals.totalAllocated)}) is less than total amount being used from deposits ({formatCurrency(depositPaymentTotals.totalDepositUsage)}). 
                        Please allocate the full amount ({formatCurrency(depositPaymentTotals.totalDepositUsage - depositPaymentTotals.totalAllocated)}) to invoices.
                      </>
                    ) : (
                      <>
                        <strong>Over Allocation:</strong> Total allocated to invoices ({formatCurrency(depositPaymentTotals.totalAllocated)}) exceeds total amount being used from deposits ({formatCurrency(depositPaymentTotals.totalDepositUsage)}). 
                        Please reduce invoice allocations by {formatCurrency(depositPaymentTotals.totalAllocated - depositPaymentTotals.totalDepositUsage)}.
                      </>
                    )}
                  </Typography>
                </Alert>
              )}
            </>
          ) : selectedProperty ? (
            <Alert severity="info">No outstanding invoices found for this property.</Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositPaymentDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleSubmitDepositPayment}
            disabled={
              loading || 
              !selectedProperty || 
              depositPaymentTotals.totalAllocated <= 0 ||
              depositPaymentTotals.totalAllocated !== depositPaymentTotals.totalDepositUsage
            }
          >
            {loading ? 'Paying...' : 'Pay Invoices'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Bank Dialog */}
      <Dialog open={addBankDialog} onClose={() => setAddBankDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Bank</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Bank Name"
            value={newBankName}
            onChange={(e) => setNewBankName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddBank();
              }
            }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddBankDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleAddBank}
            disabled={!newBankName.trim()}
          >
            Add Bank
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TajResidents;
