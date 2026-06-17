import React from 'react';
import { Box, Paper, Typography, Divider } from '@mui/material';
import { AccountBalance as AssetIcon, AccountBalanceWallet as BookValueIcon } from '@mui/icons-material';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatBlock({ icon: Icon, label, value, color, bgcolor }) {
  return (
    <Box
      sx={{
        flex: '1 1 220px',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: { xs: 1.5, sm: 2 },
        py: 1.5
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1.5,
          bgcolor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <Icon sx={{ color, fontSize: 22 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block">
          {label}
        </Typography>
        <Typography
          variant="h5"
          fontWeight={700}
          color={color}
          lineHeight={1.2}
          sx={{ fontSize: { xs: '1.15rem', sm: '1.35rem' } }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function FixedAssetGrandTotals({ totalCount = 0, totalBookValue = 0, scopeLabel, sx }) {
  const scope = scopeLabel || 'all pages';
  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        mb: 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        borderColor: 'divider',
        overflow: 'hidden',
        ...sx
      }}
    >
      <StatBlock
        icon={AssetIcon}
        label={`Total assets (${scope})`}
        value={totalCount}
        color="primary.main"
        bgcolor="primary.50"
      />
      <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
      <Divider sx={{ width: '100%', display: { xs: 'block', sm: 'none' } }} />
      <StatBlock
        icon={BookValueIcon}
        label={`Total book value (${scope})`}
        value={`PKR ${fmt(totalBookValue)}`}
        color="success.dark"
        bgcolor="success.50"
      />
    </Paper>
  );
}
