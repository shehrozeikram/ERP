import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { fetchPayFromAccounts } from '../../utils/payFromAccounts';

const defaultPaymentData = () => ({
  amount: 0,
  paymentMethod: 'bank_transfer',
  reference: '',
  paymentDate: new Date().toISOString().split('T')[0],
  whtRate: 0,
  bankAccountId: '',
  advanceRemarks: ''
});

export const mapPaymentMethodToCaLabel = (paymentMethod) => {
  const v = String(paymentMethod || 'bank_transfer').toLowerCase().replace(/\s+/g, '_');
  if (v === 'cash') return 'Cash';
  if (v === 'check' || v === 'cheque') return 'Cheque';
  if (v === 'bank_transfer' || v === 'bank') return 'Bank Transfer';
  return 'Online Transfer';
};

export const useCashApprovalPaymentFields = (ca, { active = false, includePendingFinance = false, seedCaId = null } = {}) => {
  const [payeeEmployees, setPayeeEmployees] = useState([]);
  const [payFromAccountOptions, setPayFromAccountOptions] = useState([]);
  const [selectedPayee, setSelectedPayee] = useState({ employeeId: '', employeeName: '' });
  const [paymentData, setPaymentData] = useState(defaultPaymentData);
  const [outstandingTransactions, setOutstandingTransactions] = useState([]);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  const loadBankAccounts = useCallback(() => {
    fetchPayFromAccounts(api)
      .then(setPayFromAccountOptions)
      .catch(() => setPayFromAccountOptions([]));
  }, []);

  const loadPayeeEmployees = useCallback((seedEmployee = null) => {
    const params = includePendingFinance ? { includePending: 'true' } : {};
    api.get('/cash-approvals/finance/advance-payment/employee-payees', { params })
      .then((res) => {
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        if (seedEmployee?.employeeId && !rows.some((r) => String(r.employeeId) === String(seedEmployee.employeeId))) {
          rows.unshift(seedEmployee);
        }
        setPayeeEmployees(rows);
      })
      .catch(() => setPayeeEmployees(seedEmployee?.employeeId ? [seedEmployee] : []));
  }, [includePendingFinance]);

  const loadOutstandingByEmployee = useCallback(async (employeeId, seedId = null) => {
    if (!employeeId) {
      setOutstandingTransactions([]);
      return;
    }
    try {
      setLoadingOutstanding(true);
      const params = { employeeId };
      if (includePendingFinance) params.includePending = 'true';
      const res = await api.get('/cash-approvals/finance/advance-payment/outstanding', { params });
      const effectiveSeedId = seedId || seedCaId;
      const rows = (Array.isArray(res.data?.data) ? res.data.data : []).map((row) => ({
        ...row,
        payAmount: effectiveSeedId && String(row.cashApprovalId) === String(effectiveSeedId) ? row.outstanding : (Number(row.payAmount) || 0)
      }));
      setOutstandingTransactions(rows);
      const totalPay = Math.round(rows.reduce((s, r) => s + (Number(r.payAmount) || 0), 0) * 100) / 100;
      setPaymentData((prev) => ({ ...prev, amount: totalPay > 0 ? totalPay : prev.amount }));
    } catch {
      setOutstandingTransactions([]);
    } finally {
      setLoadingOutstanding(false);
    }
  }, [includePendingFinance, seedCaId]);

  useEffect(() => {
    if (!active || !ca) return;
    loadBankAccounts();
    const employeeId = String(ca?.advanceToEmployee?._id || ca?.advanceToEmployee || '').trim();
    const employeeName = ca?.advanceToName
      || [ca?.advanceToEmployee?.firstName, ca?.advanceToEmployee?.lastName].filter(Boolean).join(' ').trim()
      || '';
    loadPayeeEmployees(employeeId ? {
      employeeId,
      employeeName,
      employeeCode: ca?.advanceToEmployee?.employeeId || ''
    } : null);
  }, [active, ca, loadBankAccounts, loadPayeeEmployees]);

  useEffect(() => {
    if (!active || !ca) return;
    const employeeId = String(ca?.advanceToEmployee?._id || ca?.advanceToEmployee || '').trim();
    const employeeName = ca?.advanceToName
      || [ca?.advanceToEmployee?.firstName, ca?.advanceToEmployee?.lastName].filter(Boolean).join(' ').trim()
      || '';
    const rawOpen = Number(ca?.advanceAmount) > 0 ? ca.advanceAmount : ca?.totalAmount;
    const openAmount = Math.round((Number(rawOpen) || 0) * 100) / 100;
    setSelectedPayee({ employeeId, employeeName });
    setPaymentData({
      amount: openAmount,
      paymentMethod: 'bank_transfer',
      reference: ca?.signedCheckNumber || '',
      paymentDate: ca?.signedCheckDate
        ? new Date(ca.signedCheckDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      whtRate: Number(ca?.advanceWhtRate) || 0,
      bankAccountId: String(ca?.advanceBankAccount?._id || ca?.advanceBankAccount || ''),
      advanceRemarks: ca?.advanceRemarks || ''
    });
    if (employeeId) {
      loadOutstandingByEmployee(employeeId, ca._id);
    }
  }, [active, ca, loadOutstandingByEmployee]);

  const getAllocationRows = () => outstandingTransactions
    .filter((r) => Number(r.payAmount) > 0)
    .map((r) => ({
      cashApprovalId: r.cashApprovalId,
      amount: Math.round((Number(r.payAmount) || 0) * 100) / 100
    }));

  return {
    payeeEmployees,
    payFromAccountOptions,
    bankAccounts: payFromAccountOptions,
    selectedPayee,
    setSelectedPayee,
    paymentData,
    setPaymentData,
    outstandingTransactions,
    setOutstandingTransactions,
    loadingOutstanding,
    loadOutstandingByEmployee,
    getAllocationRows
  };
};
