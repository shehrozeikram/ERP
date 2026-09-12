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
  getStoreLineCategoryOrCode,
  isChartOfAccountsBill,
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
  const isCoa = isChartOfAccountsBill(bill);

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
              py: 0.75,
              px: 0.5,
              verticalAlign: 'top',
              '@media print': {
                py: 0.4,
                px: 0.4,
                fontSize: '10px'
              }
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '4%' }}>S. No</TableCell>
              <TableCell sx={{ width: isCoa ? '18%' : '11%' }}>{isCoa ? 'Category' : 'Product Code'}</TableCell>
              <TableCell sx={{ width: isCoa ? '32%' : '27%' }}>Description</TableCell>
              <TableCell sx={{ width: '12%', '@media print': { display: 'none' } }}>Attachments</TableCell>
              <TableCell sx={{ width: '7%' }}>Units</TableCell>
              <TableCell sx={{ width: '8%', textAlign: 'right' }}>Quantity</TableCell>
              <TableCell sx={{ width: '9%', textAlign: 'right' }}>Rate</TableCell>
              <TableCell sx={{ width: '11%', textAlign: 'right' }}>Value Excl. Tax</TableCell>
              <TableCell sx={{ width: '6%', textAlign: 'center' }}>Disc</TableCell>
              <TableCell sx={{ width: '11%', textAlign: 'right' }}>Net Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line, i) => {
              const amt = Number(line.amount) || 0;
              const hasQty = line.quantity !== undefined && line.quantity !== null && line.quantity !== '';
              const qty = hasQty ? Number(line.quantity) : 1;
              const hasRate = line.unitPrice !== undefined && line.unitPrice !== null && line.unitPrice !== '';
              const rate = hasRate ? Number(line.unitPrice) : (qty ? amt / qty : amt);
              const lineLabel = isCoa
                ? (line.description || line.itemName || '—')
                : getStoreLineDescription(line);
              const categoryOrCode = getStoreLineCategoryOrCode(line, isCoa);
              return (
                <TableRow key={line._id || line.storeItem || i}>
                  <TableCell sx={{ textAlign: 'center' }}>{i + 1}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-word', fontSize: 11, fontWeight: isCoa ? 600 : 400 }}>
                    {categoryOrCode}
                  </TableCell>
                  <TableCell sx={{ lineHeight: 1.35 }}>{lineLabel}</TableCell>
                  <TableCell sx={{ '@media print': { display: 'none' } }}>
                    <LineAttachmentsView line={line} previewTitle={lineLabel} />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>{line.unit || (isCoa ? '—' : 'Nos')}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimalPk(qty)}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDecimalPk(rate)}
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
              <TableCell colSpan={6} align="right" sx={{ borderRight: '1px solid', borderColor: 'grey.400', '@media print': { display: 'table-cell' } }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
          <Stack spacing={0.25} sx={{ width: 240, fontSize: 12 }}>
            {CHARGE_LABELS.map((label) => (
              <Box
                key={label}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid',
                  borderColor: 'grey.300',
                  py: 0.25,
                  '@media print': { display: 'none' }
                }}
              >
                <Typography component="span" sx={{ fontSize: 11 }}>
                  {label}
                </Typography>
                <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
                  {formatDecimalPk(0)}
                </Typography>
              </Box>
            ))}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                pt: 0.5,
                mt: 0.25,
                fontWeight: 800,
                fontSize: 13,
                borderBottom: '3px double',
                borderColor: 'grey.900',
                pb: 0.25
              }}
            >
              <Typography component="span" sx={{ fontWeight: 800 }}>Net Total</Typography>
              <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>
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
