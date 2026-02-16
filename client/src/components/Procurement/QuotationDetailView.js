import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import dayjs from 'dayjs';

/**
 * Shared Quotation detail view (same as Procurement > Quotations view dialog).
 * Used in Procurement (Quotations page view) and Pre-Audit (Quotations tab).
 * @param {Object} quotation - Full quotation object (vendor, items, indent, etc.)
 * @param {function} formatNumber - (num) => string, default uses toFixed(2)
 * @param {function} formatDateForPrint - (date) => DD/MM/YYYY
 * @param {function} formatDateForQuotation - (date) => DD-Month-YYYY
 */
const QuotationDetailView = ({
  quotation,
  formatNumber = (num) => (num == null ? '0.00' : parseFloat(num).toFixed(2)),
  formatDateForPrint = (date) => {
    if (date === undefined || date === null || date === '') return '';
    const d = dayjs(date);
    return d.isValid() ? d.format('DD/MM/YYYY') : '';
  },
  formatDateForQuotation = (date) => {
    if (!date) return '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(date);
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  }
}) => {
  if (!quotation) return null;
  const data = quotation;

  return (
    <Paper
      sx={{
        p: { xs: 3, sm: 3.5, md: 4 },
        maxWidth: '210mm',
        mx: 'auto',
        backgroundColor: '#fff',
        boxShadow: 'none',
        width: '100%',
        fontFamily: 'Arial, sans-serif',
        '@media print': { boxShadow: 'none', p: 2.5, maxWidth: '100%', mx: 0, width: '100%', pageBreakInside: 'avoid' }
      }}
      className="print-content quotation-detail-view"
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: '1.2rem', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>
            {data.vendor?.name || 'Vendor Name'}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', flex: 1 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}>{data.vendor?.name || 'Vendor Name'}</Typography>
          <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>Date: {formatDateForQuotation(data.quotationDate)}</Typography>
          <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>Ref No: {data.quotationNumber || 'N/A'}</Typography>
          {data.vendor?.ntnNo && <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>NTN No: {data.vendor.ntnNo}</Typography>}
          {data.vendor?.gstNo && <Typography sx={{ fontSize: '0.85rem', mb: 0.3 }}>GST No: {data.vendor.gstNo}</Typography>}
        </Box>
      </Box>

      <Typography variant="h4" align="center" sx={{ fontSize: '1.8rem', fontWeight: 700, mb: 3, textDecoration: 'underline', textDecorationThickness: '2px' }}>
        Quotation
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>M/S: Taj Residencia Islamabad</Typography>
      </Box>

      <Box sx={{ mb: 1.5, fontSize: '0.9rem', lineHeight: 1.8, textAlign: 'center' }}>
        <Typography component="span" fontWeight={600}>Quotation No.:</Typography>
        <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>{data.quotationNumber || '___________'}</Typography>
      </Box>

      <Box sx={{ mb: 1.5, fontSize: '0.9rem', lineHeight: 1.8 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
          <Box sx={{ minWidth: '120px' }}>
            <Typography component="span" fontWeight={600}>Quotation Date:</Typography>
            <Typography component="span" sx={{ ml: 1 }}>{formatDateForPrint(data.quotationDate)}</Typography>
          </Box>
          <Box sx={{ minWidth: '150px' }}>
            <Typography component="span" fontWeight={600}>Expiry Date:</Typography>
            <Typography component="span" sx={{ ml: 1 }}>{data.expiryDate ? formatDateForPrint(data.expiryDate) : '___________'}</Typography>
          </Box>
          <Box sx={{ minWidth: '120px' }}>
            <Typography component="span" fontWeight={600}>Indent No.:</Typography>
            <Typography component="span" sx={{ ml: 1 }}>{data.indent?.indentNumber || '___________'}</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mb: 3, fontSize: '0.9rem', lineHeight: 1.8 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
          <Box sx={{ minWidth: '200px' }}>
            <Typography component="span" fontWeight={600}>Vendor:</Typography>
            <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>{data.vendor?.name || '___________'}</Typography>
          </Box>
          <Box sx={{ minWidth: '200px' }}>
            <Typography component="span" fontWeight={600}>Department:</Typography>
            <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>{data.indent?.department?.name || '___________'}</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.9rem', fontFamily: 'Arial, sans-serif' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
              <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', fontWeight: 700, width: '8%' }}>S/No</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '50%' }}>Items Description</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 700, width: '12%' }}>Qty.</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', fontWeight: 700, width: '15%' }}>Unit Rate</th>
              <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', fontWeight: 700, width: '15%' }}>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items?.length > 0 ? data.items.map((item, index) => {
              const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
              return (
                <tr key={index} style={{ border: '1px solid #000' }}>
                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'left', verticalAlign: 'top' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>{item.description || '___________'}</td>
                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>{item.quantity ?? '___'}</td>
                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>{formatNumber(item.unitPrice)}</td>
                  <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>{formatNumber(itemTotal)}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>No items</td>
              </tr>
            )}
            {data.items?.length > 0 && (
              <tr style={{ borderTop: '2px solid #000', borderBottom: '1px solid #000' }}>
                <td colSpan={3} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 700 }}>Total Amount</td>
                <td style={{ border: '1px solid #000', padding: '10px 8px' }} />
                <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', fontWeight: 700 }}>{formatNumber(data.totalAmount || 0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </Box>

      <Box sx={{ mb: 2, fontSize: '0.9rem', lineHeight: 2 }}>
        <Typography sx={{ mb: 0.5 }}>Above prices are CASH</Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 0.5 }}>
          <Typography component="span" sx={{ minWidth: '100px' }}>Delivery:</Typography>
          <Typography component="span">{data.deliveryTime || '2 to 3 days'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 0.5 }}>
          <Typography component="span" sx={{ minWidth: '100px' }}>Payment:</Typography>
          <Typography component="span">{data.paymentTerms || 'Upon Delivery.'}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1 }}>
          <Typography component="span" sx={{ minWidth: '100px' }}>Validity:</Typography>
          <Typography component="span">{data.validityDays ? `${data.validityDays}Days` : '30Days'}</Typography>
        </Box>
        {data.attachments?.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography component="span" sx={{ minWidth: '100px' }}>Attachments:</Typography>
            {data.attachments.map((att, i) => (
              <Typography key={i} component="span" sx={{ mr: 1 }}>
                <a href={att.url} target="_blank" rel="noopener noreferrer">{att.filename || att.url}</a>
              </Typography>
            ))}
          </Box>
        )}
        <Typography sx={{ mb: 2 }}>For further Information, please feel free to contact us.</Typography>
      </Box>

      <Box sx={{ mb: 3, fontSize: '0.9rem' }}>
        <Typography sx={{ mb: 0.5 }}>With regards.</Typography>
        <Typography sx={{ mb: 1, fontWeight: 600 }}>For {data.vendor?.name || 'Vendor Name'}</Typography>
        {data.vendor?.email && <Typography sx={{ mb: 0.5, color: '#0066cc' }}>Email: {data.vendor.email}</Typography>}
        {data.vendor?.website && <Typography sx={{ mb: 0.5, color: '#0066cc' }}>{data.vendor.website}</Typography>}
      </Box>

      <Box sx={{ textAlign: 'center', fontSize: '0.8rem', mt: 4, pt: 2, borderTop: '1px solid #ccc' }}>
        <Typography>
          {data.vendor?.address && <span>{data.vendor.address}</span>}
          {data.vendor?.phone && <span>{data.vendor?.address ? ' Cell: ' : ''}{data.vendor.phone}{data.vendor?.officePhone ? ` | Office: ${data.vendor.officePhone}` : ''}</span>}
          {!data.vendor?.address && !data.vendor?.phone && '—'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default QuotationDetailView;
