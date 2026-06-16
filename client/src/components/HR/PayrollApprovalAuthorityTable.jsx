import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { format } from 'date-fns';
import { DigitalSignatureImage } from '../common/DigitalSignatureImage';
import { buildPayrollApprovalAuthorityRows } from '../../utils/payrollStatusHelpers';

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd-MMM-yyyy HH:mm');
  } catch {
    return '—';
  }
};

const PayrollApprovalAuthorityTable = ({ monthlyApproval, title = 'Approval Authority' }) => {
  const rows = buildPayrollApprovalAuthorityRows(monthlyApproval);

  return (
    <Paper variant="outlined" sx={{ mt: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'grey.200' }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {title}
        </Typography>
      </Box>
      <Table
        size="small"
        sx={{
          '& th': {
            fontWeight: 800,
            bgcolor: 'grey.100',
            fontSize: 13
          },
          '& td': {
            fontSize: 13,
            py: 1.2
          }
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Authority</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Digital Signature</TableCell>
            <TableCell>Date &amp; Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell sx={{ fontWeight: 700 }}>{row.authority}</TableCell>
              <TableCell>{row.name || '—'}</TableCell>
              <TableCell>
                {row.signatureUser ? (
                  <DigitalSignatureImage userOrPath={row.signatureUser} alt={`${row.authority} signature`} />
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>{formatDateTime(row.dateTime)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
};

export default PayrollApprovalAuthorityTable;
