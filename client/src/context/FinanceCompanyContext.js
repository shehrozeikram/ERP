import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const STORAGE_KEY = 'financeSelectedCompanyId';
const HISTORICAL_COMPANY_NAME = 'SARDAR GROUP OF COMPANIES';

const FinanceCompanyContext = createContext({
  companies: [],
  selectedCompany: null,
  selectedCompanyId: '',
  loading: true,
  setSelectedCompanyId: () => {},
  refreshCompanies: async () => {}
});

export const FinanceCompanyProvider = ({ children }) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/finance/companies', { params: { status: 'active' } });
      const list = response.data?.data || [];
      setCompanies(list);

      const storedId = localStorage.getItem(STORAGE_KEY) || '';
      const storedExists = list.some((row) => String(row._id) === storedId);
      const historical = list.find(
        (row) => String(row.name || '').trim().toUpperCase() === HISTORICAL_COMPANY_NAME.toUpperCase()
      );
      const fallbackId = storedExists
        ? storedId
        : String(historical?._id || list[0]?._id || '');

      setSelectedCompanyIdState(fallbackId);
      if (fallbackId) {
        localStorage.setItem(STORAGE_KEY, fallbackId);
      }
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  const setSelectedCompanyId = useCallback((companyId) => {
    const next = String(companyId || '');
    setSelectedCompanyIdState(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, next);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((row) => String(row._id) === String(selectedCompanyId)) || null,
    [companies, selectedCompanyId]
  );

  const value = useMemo(
    () => ({
      companies,
      selectedCompany,
      selectedCompanyId,
      loading,
      setSelectedCompanyId,
      refreshCompanies
    }),
    [companies, selectedCompany, selectedCompanyId, loading, setSelectedCompanyId, refreshCompanies]
  );

  return (
    <FinanceCompanyContext.Provider value={value}>
      {children}
    </FinanceCompanyContext.Provider>
  );
};

export const useFinanceCompany = () => useContext(FinanceCompanyContext);

export default FinanceCompanyContext;
