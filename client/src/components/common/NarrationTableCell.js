import React from 'react';
import { TableCell, Tooltip, Typography } from '@mui/material';

const NarrationTableCell = ({ text, minWidth = 180, maxWidth = 260 }) => {
  const display = text || '—';
  const fixedLayout = minWidth === 0;
  return (
    <TableCell
      sx={
        fixedLayout
          ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, px: { xs: 0.75, md: 1 } }
          : { minWidth, maxWidth: maxWidth + 20 }
      }
    >
      <Tooltip title={display} placement="top-start">
        <Typography
          variant="body2"
          sx={
            fixedLayout
              ? {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }
              : {
                  maxWidth,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.35
                }
          }
        >
          {display}
        </Typography>
      </Tooltip>
    </TableCell>
  );
};

export default NarrationTableCell;
