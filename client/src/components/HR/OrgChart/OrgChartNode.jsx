import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { getOrgNodeSx } from './orgChartTheme';

const OrgChartNode = ({ node, highlighted, collapsed, hasChildren, onToggle }) => {
  const displayName = node.name?.trim();

  return (
    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={getOrgNodeSx(node, highlighted)}>
        <Typography
          component="div"
          sx={{
            fontWeight: 'inherit',
            fontSize: 'inherit',
            color: 'inherit',
            lineHeight: 1.25
          }}
        >
          {node.title}
        </Typography>
        {displayName && (
          <Typography
            component="div"
            sx={{
              mt: 0.25,
              fontSize: '0.85em',
              color: 'inherit',
              fontStyle: node.isVacant ? 'italic' : 'normal',
              opacity: node.isVacant ? 1 : 0.9
            }}
          >
            {displayName}
          </Typography>
        )}
        {node.isVacant && !displayName && (
          <Typography component="div" sx={{ mt: 0.25, fontSize: '0.85em', color: '#D32F2F', fontStyle: 'italic' }}>
            Vacant
          </Typography>
        )}
      </Box>
      {hasChildren && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          sx={{ mt: 0.25, p: 0.25 }}
        >
          {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
        </IconButton>
      )}
    </Box>
  );
};

export default OrgChartNode;
