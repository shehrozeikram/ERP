import React from 'react';
import { Box, Typography, TextField, MenuItem, Button } from '@mui/material';
import { getPaginationSlice } from '../../utils/fixedAssetPaginationTotals';

export default function FixedAssetPaginationBar({
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  totalCount
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const { start, end } = getPaginationSlice(page, rowsPerPage, totalCount);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, p: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {totalCount > 0 ? (
          <>Showing <strong>{start}–{end}</strong> of <strong>{totalCount}</strong></>
        ) : (
          'No assets'
        )}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Rows"
          value={rowsPerPage}
          onChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          sx={{ width: 110, mr: 1 }}
        >
          {[100, 250, 500].map((n) => (
            <MenuItem key={n} value={n}>{n}</MenuItem>
          ))}
        </TextField>
        <Button size="small" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
          Prev
        </Button>
        <Typography variant="body2" sx={{ px: 1.5, alignSelf: 'center' }}>
          Page {totalCount === 0 ? 0 : page + 1} / {totalPages}
        </Typography>
        <Button
          size="small"
          onClick={() => setPage((p) => p + 1)}
          disabled={(page + 1) * rowsPerPage >= totalCount}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}
