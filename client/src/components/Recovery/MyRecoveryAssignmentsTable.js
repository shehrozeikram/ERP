import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  RECOVERY_STATUS_LABELS,
  RECOVERY_ACTION_LABELS,
  formatRecoveryMonthYearLabel
} from '../../utils/recoveryAssignmentRows';

/**
 * Read-only "Rules & tasks by month" table (Task Assignment style) for My Tasks.
 */
const MyRecoveryAssignmentsTable = ({
  rows = [],
  selectedTaskId = '',
  selectedRuleId = '',
  onSelectTask,
  onSelectRule,
  onSelectAll
}) => {
  if (!rows.length) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        No assignment rules or time-bound tasks assigned to you yet.
      </Typography>
    );
  }

  const grouped = rows.reduce((acc, row) => {
    const key = row.monthYear && row.monthYear !== '—' ? row.monthYear : '_other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const monthKeys = Object.keys(grouped).sort((a, b) => {
    if (a === '_other') return 1;
    if (b === '_other') return -1;
    return b.localeCompare(a);
  });

  const isRowSelected = (row) => {
    if (row.kind === 'task') return selectedTaskId === row.id;
    if (row.kind === 'rule') return selectedRuleId === row.id;
    return false;
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ mb: 1 }}>
        <Chip
          size="small"
          label="All customers (every rule)"
          clickable
          color={!selectedTaskId && !selectedRuleId ? 'primary' : 'default'}
          variant={!selectedTaskId && !selectedRuleId ? 'filled' : 'outlined'}
          onClick={onSelectAll}
        />
      </Box>
      {monthKeys.map((key, index) => {
        const monthRows = grouped[key];
        const label = formatRecoveryMonthYearLabel(key);
        return (
          <Accordion
            key={key}
            defaultExpanded={index === 0}
            disableGutters
            sx={{ '&:before': { display: 'none' }, boxShadow: 0, border: '1px solid', borderColor: 'divider', '& + &': { mt: 0.5 } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'grey.50', minHeight: 48 }}>
              <Typography fontWeight={600}>{label}</Typography>
              <Chip size="small" label={`${monthRows.length} item${monthRows.length !== 1 ? 's' : ''}`} sx={{ ml: 2 }} variant="outlined" />
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer component={Paper} variant="outlined" square>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Type</strong></TableCell>
                      <TableCell><strong>Scope</strong></TableCell>
                      <TableCell><strong>Assigned to</strong></TableCell>
                      <TableCell><strong>Assigned By</strong></TableCell>
                      <TableCell><strong>Assigned date</strong></TableCell>
                      <TableCell><strong>Action</strong></TableCell>
                      <TableCell><strong>Period</strong></TableCell>
                      <TableCell><strong>Target count</strong></TableCell>
                      <TableCell><strong>Progress</strong></TableCell>
                      <TableCell><strong>Status</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthRows.map((row) => (
                      <TableRow
                        key={`${row.kind}-${row.id}`}
                        hover
                        selected={isRowSelected(row)}
                        onClick={() => {
                          if (row.kind === 'task' && onSelectTask) onSelectTask(row.task);
                          if (row.kind === 'rule' && onSelectRule) onSelectRule(row.rule);
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Chip
                            size="small"
                            label={row.typeLabel}
                            color={row.kind === 'task' ? 'primary' : 'warning'}
                            variant={row.kind === 'task' ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 600, minWidth: 62, justifyContent: 'center' }}
                          />
                        </TableCell>
                        <TableCell>{row.scope}</TableCell>
                        <TableCell>{row.member}</TableCell>
                        <TableCell>{row.assignedBy || '—'}</TableCell>
                        <TableCell>{row.assignedDate || '—'}</TableCell>
                        <TableCell>{RECOVERY_ACTION_LABELS[row.action] || row.action || '—'}</TableCell>
                        <TableCell>{row.period}</TableCell>
                        <TableCell>{row.targetCount != null ? row.targetCount : '—'}</TableCell>
                        <TableCell>{row.progress}</TableCell>
                        <TableCell>
                          {row.status ? (
                            <Chip
                              size="small"
                              label={RECOVERY_STATUS_LABELS[row.status] || row.status}
                              variant={row.status === 'completed' ? 'filled' : 'outlined'}
                              color={row.status === 'completed' ? 'success' : 'default'}
                            />
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

export default MyRecoveryAssignmentsTable;
