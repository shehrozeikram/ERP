import React from 'react';
import { TablePagination } from '@mui/material';

/**
 * Reusable TablePagination wrapper component
 * @param {Object} props
 * @param {number} props.page - Current page (0-based)
 * @param {number} props.rowsPerPage - Rows per page
 * @param {number} props.total - Total number of items
 * @param {Function} props.onPageChange - Handler for page change
 * @param {Function} props.onRowsPerPageChange - Handler for rows per page change
 * @param {Array} props.rowsPerPageOptions - Options for rows per page (default: [25, 50, 100, 200])
 * @param {string} props.labelRowsPerPage - Label for rows per page (default: "Rows per page:")
 * @param {Function} props.onResetExpanded - Optional callback to reset expanded rows on page change
 */
const TablePaginationWrapper = ({
  page,
  rowsPerPage,
  total,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [25, 50, 100, 200],
  labelRowsPerPage = 'Rows per page:',
  onResetExpanded
}) => {
  const handlePageChange = (event, newPage) => {
    if (onResetExpanded) {
      onResetExpanded();
    }
    onPageChange(event, newPage);
  };

  return (
    <TablePagination
      component="div"
      count={total}
      page={page}
      onPageChange={handlePageChange}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={onRowsPerPageChange}
      rowsPerPageOptions={rowsPerPageOptions}
      labelRowsPerPage={labelRowsPerPage}
    />
  );
};

export default TablePaginationWrapper;

