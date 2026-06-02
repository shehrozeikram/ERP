import React from 'react';
import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import LineAttachmentsView from './LineAttachmentsView';
import {
  displayBillValue,
  formatDecimalPk,
  formatInvoiceDateDmy,
  formatInvoiceTime12h,
  getStoreInvoiceLinesTotal,
  getStoreInvoiceNarration,
  getStoreLineDescription,
  getStoreLineProductCode,
  getVendorSupplierLine
} from '../../utils/centralizedStoreBillDisplay';

const CHARGE_LABELS = [
  'Service Charges',
  'Freight Charges',
  'Packing Charges',
  'Loading Charges',
  'Income Tax',
  'Special Excise Duty',
  'Custom Duty',
  'Sales Tax'
];

/**
 * Centralized store bill invoice table (line items + per-line attachment carousel).
 * Used on bill detail and audit / workflow document views.
 */
const CentralizedStoreBillInvoiceBody = ({ bill, showChargesSummary = true }) => {
  if (!bill) return null;
  const lines = bill.billLines || [];
  const totalVal = getStoreInvoiceLinesTotal(bill);

  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: { xs: 2, md: 3 },
          mb: 2,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'grey.400'
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: '88px 1fr', rowGap: 0.75, columnGap: 1, fontSize: 13 }}>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Date</Typography>
          <Typography sx={{ fontWeight: 700 }}>{formatInvoiceDateDmy(bill.billDate)}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Bill ID</Typography>
          <Typography sx={{ fontWeight: 700 }}>{bill.billId}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Supplier</Typography>
          <Typography sx={{ fontWeight: 700 }}>{getVendorSupplierLine(bill)}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Address</Typography>
          <Typography sx={{ fontWeight: 700 }}>{displayBillValue(bill.location)}</Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
            alignItems: 'baseline',
            gap: 1,
            fontSize: 13
          }}
        >
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Time</Typography>
          <Typography sx={{ fontWeight: 700 }}>
            {formatInvoiceTime12h(bill.createdAt || bill.billDate)}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          bgcolor: '#ffe7c2',
          border: '1px solid #e8b86a',
          p: 1.5,
          mb: 2,
          fontWeight: 700,
          fontSize: 13,
          lineHeight: 1.45
        }}
      >
        Narration: {getStoreInvoiceNarration(bill)}
      </Box>

      <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
        <Table
          size="small"
          sx={{
            border: '1px solid',
            borderColor: 'grey.500',
            '& th': {
              bgcolor: 'grey.100',
              border: '1px solid',
              borderColor: 'grey.500',
              fontSize: 11,
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.2,
              py: 1,
              px: 0.5
            },
            '& td': {
              border: '1px solid',
              borderColor: 'grey.400',
              fontSize: 12,
              py: 1,
              px: 0.75,
              verticalAlign: 'top'
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '4%' }}>S. No</TableCell>
              <TableCell sx={{ width: '11%' }}>Product Code</TableCell>
              <TableCell sx={{ width: '22%' }}>Description</TableCell>
              <TableCell sx={{ width: '14%', minWidth: 120 }}>Attachments</TableCell>
              <TableCell sx={{ width: '7%' }}>Units</TableCell>
              <TableCell sx={{ width: '9%', textAlign: 'right' }}>Quantity</TableCell>
              <TableCell sx={{ width: '10%', textAlign: 'right' }}>Rate</TableCell>
              <TableCell sx={{ width: '12%', textAlign: 'right' }}>Value Excluding Sales Tax</TableCell>
              <TableCell sx={{ width: '7%', textAlign: 'center' }}>Discount</TableCell>
              <TableCell sx={{ width: '12%', textAlign: 'right' }}>Net Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line, i) => {
              const amt = Number(line.amount) || 0;
              const lineLabel = getStoreLineDescription(line);
              return (
                <TableRow key={line._id || line.storeItem || i}>
                  <TableCell sx={{ textAlign: 'center' }}>{i + 1}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-all', fontSize: 11 }}>
                    {getStoreLineProductCode(line)}
                  </TableCell>
                  <TableCell sx={{ lineHeight: 1.35 }}>{lineLabel}</TableCell>
                  <TableCell>
                    <LineAttachmentsView line={line} previewTitle={lineLabel} />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>Nos</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimalPk(1)}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimalPk(amt)}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimalPk(amt)}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>0 %</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {formatDecimalPk(amt)}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow
              sx={{
                '& td': {
                  fontWeight: 800,
                  borderTop: '2px solid',
                  borderColor: 'grey.800',
                  bgcolor: 'grey.50'
                }
              }}
            >
              <TableCell colSpan={7} align="right" sx={{ borderRight: '1px solid', borderColor: 'grey.400' }}>
                Sub Total
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDecimalPk(totalVal)}
              </TableCell>
              <TableCell />
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDecimalPk(totalVal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {showChargesSummary && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Stack spacing={0.35} sx={{ width: 280, fontSize: 12 }}>
            {CHARGE_LABELS.map((label) => (
              <Box
                key={label}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid',
                  borderColor: 'grey.300',
                  py: 0.35
                }}
              >
                <Typography component="span" sx={{ fontSize: 12 }}>
                  {label}
                </Typography>
                <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatDecimalPk(0)}
                </Typography>
              </Box>
            ))}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                pt: 1,
                mt: 0.5,
                fontWeight: 800,
                fontSize: 13,
                borderBottom: '3px double',
                borderColor: 'grey.900',
                pb: 0.5
              }}
            >
              <Typography component="span">Net Total</Typography>
              <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDecimalPk(totalVal)}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}
    </>
  );
};

export default CentralizedStoreBillInvoiceBody;
