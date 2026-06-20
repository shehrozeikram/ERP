import { useEffect, useRef } from 'react';
import { useFinanceCompany } from '../context/FinanceCompanyContext';

/**
 * Re-run callback when the selected finance company changes.
 * Skips the first mount (caller loads on button click or own useEffect).
 */
export function useFinanceCompanyReload(callback, { skipInitial = true, enabled = true } = {}) {
  const { selectedCompanyId } = useFinanceCompany();
  const initial = useRef(true);

  useEffect(() => {
    if (!enabled || !selectedCompanyId) return;
    if (skipInitial && initial.current) {
      initial.current = false;
      return;
    }
    callback();
  }, [selectedCompanyId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useFinanceCompanyReady() {
  const { selectedCompanyId, selectedCompany, loading } = useFinanceCompany();
  return {
    selectedCompanyId,
    selectedCompany,
    ready: Boolean(selectedCompanyId) && !loading
  };
}
