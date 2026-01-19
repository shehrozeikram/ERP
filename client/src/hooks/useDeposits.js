import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePagination } from './usePagination';
import { fetchAllDeposits, updateDeposit, deleteDeposit, depositMoney, createResident, fetchResidents, transferDeposit } from '../services/tajResidentsService';
import dayjs from 'dayjs';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'Online', 'Other'];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

export const useDeposits = (options = {}) => {
  const { suspenseAccount = false } = options;
  
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedMonths, setExpandedMonths] = useState([]);
  const [suspenseAccountTotals, setSuspenseAccountTotals] = useState({
    totalAmount: 0,
    totalRemaining: 0,
    totalUsed: 0
  });

  // Pagination
  const pagination = usePagination({
    defaultRowsPerPage: 50,
    resetDependencies: [search, startDate, endDate]
  });

  // Destructure pagination values to avoid dependency issues
  const { page, rowsPerPage, setTotal } = pagination;

  // Edit dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    bank: '',
    referenceNumberExternal: '',
    description: '',
    depositDate: ''
  });

  // Create deposit dialog state
  const [createDialog, setCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    bank: '',
    referenceNumberExternal: '',
    description: '',
    depositDate: dayjs().format('YYYY-MM-DD'),
    residentId: '' // For suspense account: select existing unknown resident or create new
  });
  const [unknownResidents, setUnknownResidents] = useState([]);
  const [loadingResidents, setLoadingResidents] = useState(false);

  // Transfer deposit dialog state
  const [transferDialog, setTransferDialog] = useState(false);
  const [transferringDeposit, setTransferringDeposit] = useState(null);
  const [transferResidentSearch, setTransferResidentSearch] = useState('');
  const [transferResidentId, setTransferResidentId] = useState('');
  const [transferResidents, setTransferResidents] = useState([]);
  const [loadingTransferResidents, setLoadingTransferResidents] = useState(false);

  // Load deposits
  const loadDeposits = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: page + 1,
        limit: rowsPerPage
      };
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (suspenseAccount) params.suspenseAccount = 'true';

      const response = await fetchAllDeposits(params);
      const depositsData = response.data?.data?.deposits || [];
      setDeposits(depositsData);
      
      // Set total from pagination response (same pattern as Invoices page)
      // API returns: { data: { deposits: [...], pagination: { total: ... } } }
      if (response.data?.data?.pagination) {
        setTotal(response.data.data.pagination.total || 0);
      } else if (response.data?.pagination) {
        setTotal(response.data.pagination.total || 0);
      } else {
        // Fallback: use deposits length if pagination not available
        setTotal(depositsData.length);
      }

      // If not in suspense account mode, also fetch suspense account totals
      if (!suspenseAccount) {
        try {
          const suspenseParams = {
            page: 1,
            limit: 10000 // Get all suspense account deposits to calculate totals
          };
          if (startDate) suspenseParams.startDate = startDate;
          if (endDate) suspenseParams.endDate = endDate;
          suspenseParams.suspenseAccount = 'true';

          const suspenseResponse = await fetchAllDeposits(suspenseParams);
          const suspenseDeposits = suspenseResponse.data?.data?.deposits || [];
          
          // Calculate suspense account totals
          const suspenseTotalAmount = suspenseDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);
          const suspenseTotalRemaining = suspenseDeposits.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
          const suspenseTotalUsed = suspenseDeposits.reduce((sum, d) => sum + (d.totalUsed || 0), 0);
          
          setSuspenseAccountTotals({
            totalAmount: suspenseTotalAmount,
            totalRemaining: suspenseTotalRemaining,
            totalUsed: suspenseTotalUsed
          });
        } catch (suspenseErr) {
          console.error('Failed to load suspense account totals:', suspenseErr);
          setSuspenseAccountTotals({ totalAmount: 0, totalRemaining: 0, totalUsed: 0 });
        }
      } else {
        // If in suspense account mode, set suspense totals to 0
        setSuspenseAccountTotals({ totalAmount: 0, totalRemaining: 0, totalUsed: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load deposits');
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate, page, rowsPerPage, suspenseAccount, setTotal]);

  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  // Handle edit
  const handleEdit = useCallback((deposit) => {
    setEditingDeposit(deposit);
    const depositDate = deposit.createdAt 
      ? dayjs(deposit.createdAt).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD');
    setEditForm({
      amount: deposit.amount || '',
      paymentMethod: deposit.paymentMethod || 'Cash',
      bank: deposit.bank || '',
      referenceNumberExternal: deposit.referenceNumberExternal || '',
      description: deposit.description || '',
      depositDate: depositDate
    });
    setEditDialog(true);
  }, []);

  // Handle update
  const handleUpdate = useCallback(async () => {
    if (!editingDeposit) return;

    try {
      setLoading(true);
      setError('');
      await updateDeposit(editingDeposit.resident._id, editingDeposit._id, editForm);
      setSuccess('Deposit updated successfully');
      setEditDialog(false);
      setEditingDeposit(null);
      setEditForm({
        amount: '',
        paymentMethod: 'Cash',
        bank: '',
        referenceNumberExternal: '',
        description: '',
        depositDate: ''
      });
      loadDeposits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update deposit');
    } finally {
      setLoading(false);
    }
  }, [editingDeposit, editForm, loadDeposits]);

  // Handle delete
  const handleDelete = useCallback(async (deposit) => {
    const totalUsed = deposit.totalUsed || 0;
    const hasPayments = totalUsed > 0;
    
    let confirmMessage = `Are you sure you want to delete this deposit of ${formatCurrency(deposit.amount)}?`;
    if (hasPayments) {
      confirmMessage += `\n\n⚠️ WARNING: This deposit has been used in payment(s) (${formatCurrency(totalUsed)} used). Deleting this deposit will also automatically delete all associated payments and reverse their effects on invoices and resident balances.`;
    }
    confirmMessage += '\n\nThis action cannot be undone.';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await deleteDeposit(deposit.resident._id, deposit._id);
      const message = response?.data?.message || 'Deposit deleted successfully';
      setSuccess(message);
      loadDeposits();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete deposit');
    } finally {
      setLoading(false);
    }
  }, [loadDeposits]);

  // Load residents for deposit creation
  const loadUnknownResidents = useCallback(async () => {
    try {
      setLoadingResidents(true);
      const response = await fetchResidents({ 
        limit: 1000,
        search: '' // Get all to filter
      });
      const residents = response.data?.data?.residents || [];
      
      if (suspenseAccount) {
        // Filter for unknown residents (missing name or residentId)
        const unknown = residents.filter(r => 
          !r.name || r.name === '' || !r.residentId || r.residentId === ''
        );
        setUnknownResidents(unknown);
      } else {
        // For regular deposits, show all residents
        setUnknownResidents(residents);
      }
    } catch (err) {
      console.error('Failed to load residents:', err);
    } finally {
      setLoadingResidents(false);
    }
  }, [suspenseAccount]);

  // Handle create deposit dialog open
  const handleCreateDeposit = useCallback(() => {
    setCreateForm({
      amount: '',
      paymentMethod: 'Cash',
      bank: '',
      referenceNumberExternal: '',
      description: '',
      depositDate: dayjs().format('YYYY-MM-DD'),
      residentId: ''
    });
    loadUnknownResidents();
    setCreateDialog(true);
  }, [loadUnknownResidents]);

  // Handle create deposit
  const handleCreateDepositSubmit = useCallback(async () => {
    if (!createForm.amount || !createForm.referenceNumberExternal) {
      setError('Amount and Transaction Number are required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      let residentId = createForm.residentId;
      
      // For suspense account, create or use unknown resident
      if (suspenseAccount) {
        if (!residentId || residentId === 'new') {
          // Create new unknown resident
          const newResident = await createResident({
            name: '', // Empty name for suspense account
            accountType: 'Resident'
          });
          residentId = newResident.data.data._id;
        }
      } else {
        // For regular deposits, residentId must be provided
        if (!residentId) {
          setError('Please select a resident');
          return;
        }
      }

      // Create deposit
      const depositData = {
        amount: parseFloat(createForm.amount),
        paymentMethod: createForm.paymentMethod,
        referenceNumberExternal: createForm.referenceNumberExternal,
        description: createForm.description || '',
        depositDate: createForm.depositDate
      };
      
      if (createForm.paymentMethod !== 'Cash' && createForm.bank) {
        depositData.bank = createForm.bank;
      }

      await depositMoney(residentId, depositData);
      setSuccess('Deposit created successfully');
      setCreateDialog(false);
      setCreateForm({
        amount: '',
        paymentMethod: 'Cash',
        bank: '',
        referenceNumberExternal: '',
        description: '',
        depositDate: dayjs().format('YYYY-MM-DD'),
        residentId: ''
      });
      loadDeposits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create deposit');
    } finally {
      setLoading(false);
    }
  }, [createForm, suspenseAccount, loadDeposits]);

  // Load residents for transfer (known residents only) - load all at once
  const loadTransferResidents = useCallback(async (searchTerm = '') => {
    try {
      setLoadingTransferResidents(true);
      const params = {
        page: 1,
        limit: 10000 // Load all residents at once (no pagination)
      };
      // Only add search if there's a search term
      if (searchTerm && searchTerm.trim() !== '') {
        params.search = searchTerm.trim();
      }
      
      const response = await fetchResidents(params);
      // API returns: { data: [...], pagination: {...} }
      const residents = Array.isArray(response.data?.data) 
        ? response.data.data 
        : (response.data?.data?.residents || []);
      // Filter for known residents (must have name and residentId)
      const known = residents.filter(r => 
        r && r.name && r.name.trim() !== '' && r.residentId && r.residentId.trim() !== ''
      );
      
      setTransferResidents(known);
      
      return {
        residents: known,
        total: known.length
      };
    } catch (err) {
      console.error('Failed to load residents for transfer:', err);
      setTransferResidents([]);
      return { residents: [], total: 0 };
    } finally {
      setLoadingTransferResidents(false);
    }
  }, []);

  // Handle transfer deposit dialog open
  const handleTransferDeposit = useCallback(async (deposit) => {
    setTransferringDeposit(deposit);
    setTransferResidentSearch('');
    setTransferResidentId('');
    setTransferResidents([]);
    setTransferDialog(true);
    // Load all residents (no search, no pagination)
    await loadTransferResidents('');
  }, [loadTransferResidents]);

  // Handle transfer deposit
  const handleTransferDepositSubmit = useCallback(async () => {
    if (!transferringDeposit || !transferResidentId) {
      setError('Please select a resident to transfer to');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await transferDeposit(transferringDeposit._id, {
        targetResidentId: transferResidentId
      });
      
      setSuccess('Deposit transferred successfully');
      setTransferDialog(false);
      setTransferringDeposit(null);
      setTransferResidentSearch('');
      setTransferResidentId('');
      setTransferResidents([]);
      loadDeposits();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to transfer deposit');
    } finally {
      setLoading(false);
    }
  }, [transferringDeposit, transferResidentId, loadDeposits]);

  // Search residents for transfer (debounced)
  useEffect(() => {
    if (transferDialog) {
      const timeoutId = setTimeout(() => {
        loadTransferResidents(transferResidentSearch || '');
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [transferResidentSearch, transferDialog, loadTransferResidents]);

  // Filter deposits (client-side filtering removed - now handled by backend)
  const filteredDeposits = useMemo(() => {
    return deposits;
  }, [deposits]);

  // Group deposits by month
  const depositsByMonth = useMemo(() => {
    const grouped = {};
    filteredDeposits.forEach((deposit) => {
      const depositDate = deposit.createdAt ? dayjs(deposit.createdAt) : dayjs();
      const monthKey = depositDate.format('YYYY-MM');
      const monthLabel = depositDate.format('MMMM YYYY');
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          label: monthLabel,
          deposits: [],
          totalAmount: 0,
          totalRemaining: 0,
          totalUsed: 0
        };
      }
      
      grouped[monthKey].deposits.push(deposit);
      grouped[monthKey].totalAmount += deposit.amount || 0;
      grouped[monthKey].totalRemaining += deposit.remainingAmount || 0;
      grouped[monthKey].totalUsed += deposit.totalUsed || 0;
    });
    
    // Sort months in descending order (newest first)
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredDeposits]);

  const toggleMonth = useCallback((monthKey) => {
    setExpandedMonths(prev => {
      if (prev.includes(monthKey)) {
        return prev.filter(key => key !== monthKey);
      } else {
        return [...prev, monthKey];
      }
    });
  }, []);

  // Expand all months by default on initial load
  useEffect(() => {
    if (depositsByMonth.length > 0 && expandedMonths.length === 0) {
      const allMonths = depositsByMonth.map(m => m.key);
      setExpandedMonths(allMonths);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositsByMonth.length]);

  // Render bank field
  const renderBankField = useCallback((form, setForm) => {
    if (form.paymentMethod === 'Cash') return null;
    return {
      component: 'TextField',
      props: {
        fullWidth: true,
        label: 'Bank Name',
        value: form.bank || '',
        onChange: (e) => setForm({ ...form, bank: e.target.value }),
        required: form.paymentMethod !== 'Cash'
      }
    };
  }, []);

  return {
    // State
    loading,
    deposits,
    error,
    success,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    expandedMonths,
    editDialog,
    editingDeposit,
    editForm,
    setEditForm,
    // Computed
    filteredDeposits,
    depositsByMonth,
    pagination,
    // Actions
    loadDeposits,
    handleEdit,
    handleUpdate,
    handleDelete,
    toggleMonth,
    setEditDialog,
    setEditingDeposit,
    setError,
    setSuccess,
    // Create deposit
    createDialog,
    setCreateDialog,
    createForm,
    setCreateForm,
    handleCreateDeposit,
    handleCreateDepositSubmit,
    unknownResidents,
    loadingResidents,
    // Transfer deposit
    transferDialog,
    setTransferDialog,
    transferringDeposit,
    setTransferringDeposit,
    transferResidentSearch,
    setTransferResidentSearch,
    transferResidentId,
    setTransferResidentId,
    transferResidents,
    loadingTransferResidents,
    handleTransferDeposit,
    handleTransferDepositSubmit,
    suspenseAccountTotals,
    // Constants
    PAYMENT_METHODS,
    formatCurrency,
    renderBankField
  };
};
