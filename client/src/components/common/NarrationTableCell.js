import React from 'react';
import { TableCell, Tooltip, Typography } from '@mui/material';

const NarrationTableCell = ({ text, minWidth = 180, maxWidth = 260 }) => {
  const display = text || '—';
  return (
    <TableCell sx={{ minWidth, maxWidth: maxWidth + 20 }}>
      <Tooltip title={display} placement="top-start">
        <Typography
          variant="body2"
          sx={{
            maxWidth,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.35
          }}
        >
          {display}
        </Typography>
      </Tooltip>
    </TableCell>
  );
};

export default NarrationTableCell;
