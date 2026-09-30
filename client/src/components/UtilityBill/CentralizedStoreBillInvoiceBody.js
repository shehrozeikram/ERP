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
 * Centralized store / Chart of Accounts bill invoice table (line items + per-line attachments).
 * Used on bill detail, print, and audit / workflow document views.
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
          borderColor: 'grey.400',
          '@media print': {
            gridTemplateColumns: '1fr 1fr',
            gap: 1.5,
            mb: 1.25,
            pb: 1
          }
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
          lineHeight: 1.45,
          '@media print': { p: 1, mb: 1.25, fontSize: 11 }
        }}
      >
        Narration: {getStoreInvoiceNarration(bill)}
      </Box>

      <TableContainer
        sx={{
          width: '100%',
          overflowX: { xs: 'auto', md: 'visible' },
          WebkitOverflowScrolling: 'touch',
          '@media print': {
            overflow: 'visible !important',
            width: '100%'
          }
        }}
      >
        <Table
          size="small"
          sx={{
            width: '100%',
            tableLayout: 'fixed',
            minWidth: { xs: 720, md: 0 },
            border: '1px solid',
            borderColor: 'grey.500',
            '@media print': {
              minWidth: '0 !important',
              width: '100%',
              tableLayout: 'fixed'
            },
            '& th': {
              bgcolor: 'grey.100',
              border: '1px solid',
              borderColor: 'grey.500',
              fontSize: 11,
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.2,
              py: 1,
              px: 0.5,
              '@media print': {
                fontSize: '8.5px',
                py: 0.35,
                px: 0.25,
                lineHeight: 1.15
              }
            },
            '& td': {
              border: '1px solid',
              borderColor: 'grey.400',
              fontSize: 12,
              py: 0.75,
              px: 0.5,
              verticalAlign: 'top',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              '@media print': {
                py: 0.3,
                px: 0.25,
                fontSize: '8.5px'
              }
            }
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '4%', '@media print': { width: '4%' } }}>S. No</TableCell>
              <TableCell sx={{ width: isCoa ? '13%' : '10%', '@media print': { width: isCoa ? '14%' : '11%' } }}>
                {isCoa ? 'Category' : 'Product Code'}
              </TableCell>
              <TableCell sx={{ width: '9%', '@media print': { width: '10%' } }}>Company</TableCell>
              <TableCell sx={{ width: isCoa ? '22%' : '18%', '@media print': { width: isCoa ? '26%' : '22%' } }}>
                Description
              </TableCell>
              <TableCell sx={{ width: '10%', '@media print': { display: 'none' } }}>Attachments</TableCell>
              <TableCell sx={{ width: '6%', '@media print': { width: '7%' } }}>Units</TableCell>
              <TableCell sx={{ width: '7%', textAlign: 'right', '@media print': { width: '8%' } }}>Quantity</TableCell>
              <TableCell sx={{ width: '8%', textAlign: 'right', '@media print': { width: '9%' } }}>Rate</TableCell>
              <TableCell sx={{ width: '9%', textAlign: 'right', '@media print': { width: '11%' } }}>
                Value Excl. Tax
              </TableCell>
              <TableCell sx={{ width: '5%', textAlign: 'center', '@media print': { width: '6%' } }}>Disc</TableCell>
              <TableCell sx={{ width: '9%', textAlign: 'right', '@media print': { width: '12%' } }}>
                Net Amount
              </TableCell>
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
                  <TableCell sx={{ fontSize: 11, fontWeight: isCoa ? 600 : 400 }}>
                    {categoryOrCode}
                  </TableCell>
                  <TableCell sx={{ fontSize: 11 }}>{line.company || line.site || '—'}</TableCell>
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
              {/* Screen: 8 cols through Rate (incl. Attachments). Print: Attachments hidden → use 7. */}
              <TableCell
                colSpan={8}
                align="right"
                sx={{
                  borderRight: '1px solid',
                  borderColor: 'grey.400',
                  '@media print': { display: 'none' }
                }}
              >
                Sub Total
              </TableCell>
              <TableCell
                colSpan={7}
                align="right"
                sx={{
                  display: 'none',
                  borderRight: '1px solid',
                  borderColor: 'grey.400',
                  '@media print': { display: 'table-cell' }
                }}
              >
                Sub Total
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDecimalPk(totalVal)}
              </TableCell>
              <TableCell sx={{ textAlign: 'center' }}>0 %</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDecimalPk(totalVal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {showChargesSummary && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5, '@media print': { mt: 1 } }}>
          <Stack spacing={0.25} sx={{ width: { xs: '100%', sm: 240 }, fontSize: 12, '@media print': { width: 200 } }}>
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
