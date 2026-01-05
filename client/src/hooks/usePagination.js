import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing pagination state
 * @param {Object} options - Pagination options
 * @param {number} options.defaultPage - Default page (0-based)
 * @param {number} options.defaultRowsPerPage - Default rows per page
 * @param {Array} options.resetDependencies - Dependencies that should reset page to 0
 * @returns {Object} Pagination state and handlers
 */
export const usePagination = ({
  defaultPage = 0,
  defaultRowsPerPage = 50,
  resetDependencies = []
} = {}) => {
  const [page, setPage] = useState(defaultPage);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [total, setTotal] = useState(0);

  // Reset to first page when dependencies change
  useEffect(() => {
    if (page !== 0) {
      setPage(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetDependencies);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0); // Reset to first page when changing rows per page
  }, []);

  // Get API params (1-based page for backend)
  const getApiParams = useCallback(() => ({
    page: page + 1,
    limit: rowsPerPage
  }), [page, rowsPerPage]);

  return {
    page,
    rowsPerPage,
    total,
    setTotal,
    setPage,
    setRowsPerPage,
    handleChangePage,
    handleChangeRowsPerPage,
    getApiParams
  };
};

