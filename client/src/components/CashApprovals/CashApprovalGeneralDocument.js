import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { DigitalSignatureImage } from '../common/DigitalSignatureImage';
import { getImageUrl } from '../../utils/imageService';
import LineAttachmentsView from '../UtilityBill/LineAttachmentsView';
import {
  advanceEmployeeLabel,
  approvalTableSx,
  buildGeneralCashApprovalApprovalRows,
  buildGeneralCashApprovalStampRows,
  documentPaperSx,
  formatDecimalPk,
  formatInvoiceDateDmy,
  formatInvoiceTime12h,
  getCashApprovalCompanyLabel,
  getSignatureSource,
  lineTableSx
} from './cashApprovalGeneralDocumentUtils';

/**
 * Shared General-module cash approval document (same layout as centralized store bill view).
 */
const CashApprovalGeneralDocument = ({ ca, elevation = 2, sx = {} }) => {
  const linesTotal = useMemo(
    () => (ca?.items || []).reduce((s, li) => s + (Number(li.amount) || 0), 0),
    [ca?.items]
  );
  const approvalRows = useMemo(() => buildGeneralCashApprovalApprovalRows(ca), [ca]);
  const stampRows = useMemo(() => buildGeneralCashApprovalStampRows(ca), [ca]);

  if (!ca) return null;

  return (
    <Paper elevation={elevation} sx={{ ...documentPaperSx, ...sx }}>
      <Box
        textAlign="center"
        sx={{
          lineHeight: 1.12,
          mb: 1.75,
          pb: 1.25,
          borderBottom: '1px solid',
          borderColor: 'grey.200'
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700,
            fontSize: { xs: 20, md: 22 }
          }}
        >
          {ca.requestingDepartment || 'General'}
        </Typography>
        <Typography
          variant="h6"
          sx={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 700,
            fontSize: { xs: 16, md: 18 },
            mt: 0.5
          }}
        >
          Cash Approval
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {ca.caNumber}
        </Typography>
      </Box>

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
        <Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 0.75, columnGap: 1, fontSize: 13 }}>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Date</Typography>
          <Typography sx={{ fontWeight: 700 }}>{formatInvoiceDateDmy(ca.approvalDate || ca.createdAt)}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Reference</Typography>
          <Typography sx={{ fontWeight: 700 }}>{ca.caNumber}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Department</Typography>
          <Typography sx={{ fontWeight: 700 }}>{ca.requestingDepartment || '—'}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Advance to</Typography>
          <Typography sx={{ fontWeight: 700 }}>{advanceEmployeeLabel(ca)}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Finance company</Typography>
          <Typography sx={{ fontWeight: 700 }}>{getCashApprovalCompanyLabel(ca) || '—'}</Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>GL account</Typography>
          <Typography sx={{ fontWeight: 700 }}>
            {ca.advanceGlAccount?.accountNumber || ca.advanceGlAccountNumber || '—'}
            {ca.advanceGlAccount?.name ? ` — ${ca.advanceGlAccount.name}` : ''}
          </Typography>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Priority</Typography>
          <Typography sx={{ fontWeight: 700 }}>{ca.priority || '—'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'baseline', gap: 1, fontSize: 13 }}>
          <Typography sx={{ fontWeight: 800, color: 'grey.700' }}>Time</Typography>
          <Typography sx={{ fontWeight: 700 }}>{formatInvoiceTime12h(ca.createdAt)}</Typography>
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
        Narration: {ca.purpose || '—'}
      </Box>

      <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size="small" sx={lineTableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '4%' }}>S. No</TableCell>
              <TableCell sx={{ width: '14%' }}>Item name</TableCell>
              <TableCell sx={{ width: '22%' }}>Description / narration</TableCell>
              <TableCell sx={{ width: '12%' }}>Location</TableCell>
              <TableCell sx={{ width: '7%' }}>Unit</TableCell>
              <TableCell sx={{ width: '8%', textAlign: 'right' }}>Qty</TableCell>
              <TableCell sx={{ width: '10%', textAlign: 'right' }}>Rate</TableCell>
              <TableCell sx={{ width: '12%', textAlign: 'right' }}>Net Amount</TableCell>
              <TableCell sx={{ width: '11%' }}>Attachment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(ca.items || []).map((line, i) => {
              const amt = Number(line.amount) || 0;
              const qty = Number(line.quantity) || 1;
              const rate = Number(line.unitPrice) || amt;
              return (
                <TableRow key={i}>
                  <TableCell sx={{ textAlign: 'center' }}>{i + 1}</TableCell>
                  <TableCell sx={{ wordBreak: 'break-word' }}>{line.itemName || line.description || '—'}</TableCell>
                  <TableCell sx={{ lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
                    {line.specification || line.description || '—'}
                  </TableCell>
                  <TableCell>{line.location || '—'}</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>{line.unit || 'pcs'}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDecimalPk(qty)}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDecimalPk(rate)}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {formatDecimalPk(amt)}
                  </TableCell>
                  <TableCell>
                    <LineAttachmentsView
                      line={line}
                      previewTitle={line.itemName || line.description || `Line ${i + 1}`}
                    />
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
                {formatDecimalPk(linesTotal)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, mb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            width: 280,
            fontWeight: 800,
            fontSize: 13,
            borderBottom: '3px double',
            borderColor: 'grey.900',
            pb: 0.5
          }}
        >
          <Typography component="span">Net Total</Typography>
          <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatDecimalPk(ca.totalAmount || linesTotal)}
          </Typography>
        </Box>
      </Box>

      {ca.notes && (
        <Box sx={{ mt: 1, mb: 2, p: 1.5, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13 }}>Notes</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{ca.notes}</Typography>
        </Box>
      )}

      <Table size="small" sx={approvalTableSx}>
        <TableHead>
          <TableRow>
            <TableCell>Authority</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Digital Signature</TableCell>
            <TableCell>Date &amp; Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {approvalRows.map((row) => (
            <TableRow key={row.authority}>
              <TableCell sx={{ fontWeight: 800 }}>{row.authority}</TableCell>
              <TableCell>{row.name || '—'}</TableCell>
              <TableCell>
                {row.typedSignature ? (
                  <Typography variant="body2" sx={{ fontStyle: 'italic', fontWeight: 600 }}>
                    {row.typedSignature}
                  </Typography>
                ) : getSignatureSource(row) ? (
                  <DigitalSignatureImage userOrPath={getSignatureSource(row)} alt={`${row.authority} signature`} />
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>{row.dateTime || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {stampRows.length > 0 && (
        <Box
          sx={{
            mt: 3,
            p: 2.5,
            border: '2px solid',
            borderColor: 'grey.300',
            borderRadius: 1.5,
            backgroundColor: 'grey.50'
          }}
        >
          <Typography sx={{ fontWeight: 900, fontSize: 17, mb: 2 }}>Approval Stamp</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {stampRows.map((stampRow) => (
              <Box
                key={stampRow.authority}
                sx={{
                  flex: 1,
                  minWidth: 260,
                  p: 2,
                  bgcolor: 'white',
                  border: '1.5px solid',
                  borderColor: 'grey.400',
                  borderRadius: 1.5
                }}
              >
                <Typography sx={{ fontWeight: 700, mb: 1 }}>{stampRow.authority}</Typography>
                <Box
                  component="img"
                  src={getImageUrl(stampRow.stampImage)}
                  alt={stampRow.authority}
                  sx={{
                    display: 'block',
                    maxHeight: 170,
                    width: '100%',
                    objectFit: 'contain',
                    border: '2px dashed',
                    borderColor: 'grey.400',
                    p: 1.5,
                    bgcolor: '#fff'
                  }}
                />
                <Typography sx={{ mt: 1, fontSize: 12.5, color: 'grey.700' }}>
                  {stampRow.dateTime || '—'}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      <Box sx={{ mt: 5, minHeight: 80 }} />
    </Paper>
  );
};

export default CashApprovalGeneralDocument;
