import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Stack, Chip
} from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon, Download as DownloadIcon } from '@mui/icons-material';
import api from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const STATUS_COLOR = { draft: 'default', pending: 'warning', approved: 'info', paid: 'success', partial: 'warning', overdue: 'error' };

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();

  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [invRes, cpRes] = await Promise.all([
          api.get(`/finance/accounts-receivable/${id}`),
          api.get('/finance/company-profile').catch(() => ({ data: { data: {} } }))
        ]);
        setInvoice(invRes.data.data || invRes.data);
        setCompany(cpRes.data.data || {});
      } catch (e) {
        setError(e.response?.data?.message || 'Invoice not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleDownloadPDF = () => {
    if (!invoice) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const co = company;
    // Header
    doc.setFillColor(25, 118, 210);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(co.name || 'SGC International', 14, 12);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Tax Invoice', 14, 20);
    if (co.ntn)  { doc.setFontSize(8); doc.text(`NTN: ${co.ntn}`, 14, 26); }
    if (co.strn) { doc.setFontSize(8); doc.text(`STRN: ${co.strn}`, 60, 26); }
    doc.setFontSize(10);
    doc.text(invoice.invoiceNumber, 196, 12, { align: 'right' });
    doc.text(`Status: ${invoice.status?.toUpperCase()}`, 196, 20, { align: 'right' });

    // Bill To / Invoice Info
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    let y = 36;
    doc.setFont('helvetica', 'bold'); doc.text('BILL TO:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.customer?.name || '—', 14, y + 5);
    if (invoice.customer?.email) doc.text(invoice.customer.email, 14, y + 10);
    if (invoice.customer?.phone) doc.text(invoice.customer.phone, 14, y + 15);
    if (invoice.customer?.address) doc.text(invoice.customer.address, 14, y + 20);

    doc.setFont('helvetica', 'bold'); doc.text('INVOICE DETAILS:', 130, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 130, y + 5);
    doc.text(`Date: ${fmtDate(invoice.invoiceDate)}`, 130, y + 10);
    doc.text(`Due Date: ${fmtDate(invoice.dueDate)}`, 130, y + 15);
    if (invoice.department) doc.text(`Dept: ${invoice.department}`, 130, y + 20);

    y += 30;
    doc.setDrawColor(200, 200, 200); doc.line(14, y, 196, y);
    y += 4;

    // Line items table
    const hasItems = invoice.lineItems && invoice.lineItems.length > 0;
    autoTable(doc, {
      startY: y,
      head: hasItems
        ? [['#', 'Description', 'Qty', 'Unit Price', 'Tax', 'Amount']]
        : [['Description', 'Amount']],
      body: hasItems
        ? invoice.lineItems.map((it, i) => [
            i + 1,
            it.description || it.itemName || '',
            it.quantity || 1,
            fmt(it.unitPrice || 0),
            it.taxRate ? `${it.taxRate}%` : '—',
            fmt(it.amount || 0)
          ])
        : [['Invoice Amount', fmt(invoice.totalAmount)]],
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [25, 118, 210], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: hasItems
        ? { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'center' }, 5: { halign: 'right' } }
        : { 1: { halign: 'right' } },
    });

    y = doc.lastAutoTable.finalY + 6;

    // Totals
    const totalsX = 130;
    const drawRow = (label, value, bold) => {
      if (bold) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); }
      else { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); }
      doc.text(label, totalsX, y);
      doc.text(value, 196, y, { align: 'right' });
      y += 6;
    };

    if (invoice.subtotal) drawRow('Subtotal:', fmt(invoice.subtotal));
    if (invoice.taxAmount) drawRow('Tax:', fmt(invoice.taxAmount));
    doc.setDrawColor(180); doc.line(totalsX, y - 2, 196, y - 2);
    drawRow('Total:', fmt(invoice.totalAmount), true);
    drawRow('Paid:', fmt(invoice.amountPaid || invoice.paidAmount || 0));
    doc.setTextColor(invoice.balanceDue > 0 ? 198 : 46, invoice.balanceDue > 0 ? 40 : 125, invoice.balanceDue > 0 ? 40 : 50);
    drawRow('Balance Due:', fmt(invoice.balanceDue || (invoice.totalAmount - (invoice.amountPaid || invoice.paidAmount || 0))), true);
    doc.setTextColor(40, 40, 40);

    // Footer
    if (invoice.notes) {
      y += 4;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.text('Notes:', 14, y);
      doc.setFont('helvetica', 'normal'); doc.text(invoice.notes, 14, y + 5);
    }

    y = 278;
    doc.setFontSize(8); doc.setTextColor(140);
    const footerText = co.invoiceFooter || `Thank you for your business — ${co.name || 'SGC International'}`;
    doc.text(footerText, 105, y, { align: 'center' });

    doc.save(`Invoice-${invoice.invoiceNumber}.pdf`);
  };

  if (loading) return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  if (error)   return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!invoice) return null;

  const balance = invoice.balanceDue ?? (invoice.totalAmount - (invoice.amountPaid || invoice.paidAmount || 0));

  return (
    <Box>
      {/* Action bar — hidden when printing */}
      <Box sx={{ p: 2, bgcolor: 'grey.100', display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center', '@media print': { display: 'none' } }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>Back</Button>
        <Box display="flex" gap={1}>
          <Button variant="outlined" color="error" startIcon={<DownloadIcon />} onClick={handleDownloadPDF}>Download PDF</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
        </Box>
      </Box>

      {/* Invoice document */}
      <Box ref={printRef} sx={{
        maxWidth: 820, mx: 'auto', p: 5, bgcolor: 'white',
        '@media print': { maxWidth: '100%', p: 3, margin: 0 }
      }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
          <Box>
            {company.logoUrl && <Box component="img" src={company.logoUrl} alt="Logo" sx={{ height: 48, mb: 0.5, display: 'block' }} />}
            <Typography variant="h4" fontWeight={900} color="primary.main">{company.name || 'SGC International'}</Typography>
            {company.address && <Typography variant="body2" color="text.secondary">{company.address}{company.city ? `, ${company.city}` : ''}</Typography>}
            {company.phone   && <Typography variant="body2" color="text.secondary">{company.phone}</Typography>}
            {company.email   && <Typography variant="body2" color="text.secondary">{company.email}</Typography>}
            {company.ntn     && <Typography variant="body2" color="text.secondary" fontWeight={600}>NTN: {company.ntn}</Typography>}
            {company.strn    && <Typography variant="body2" color="text.secondary" fontWeight={600}>STRN: {company.strn}</Typography>}
          </Box>
          <Box textAlign="right">
            <Typography variant="h5" fontWeight={800} color="text.primary">TAX INVOICE</Typography>
            <Typography variant="h6" color="primary.main">{invoice.invoiceNumber}</Typography>
            <Chip label={invoice.status?.toUpperCase()} size="small" color={STATUS_COLOR[invoice.status] || 'default'} sx={{ mt: 0.5 }} />
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Bill To / Invoice Info */}
        <Box display="flex" justifyContent="space-between" mb={4}>
          <Box>
            <Typography variant="overline" color="text.disabled" fontWeight={700}>Bill To</Typography>
            <Typography variant="h6" fontWeight={700}>{invoice.customer?.name || '—'}</Typography>
            {invoice.customer?.email    && <Typography variant="body2" color="text.secondary">{invoice.customer.email}</Typography>}
            {invoice.customer?.phone    && <Typography variant="body2" color="text.secondary">{invoice.customer.phone}</Typography>}
            {invoice.customer?.address  && <Typography variant="body2" color="text.secondary">{invoice.customer.address}</Typography>}
          </Box>
          <Box textAlign="right">
            <Typography variant="overline" color="text.disabled" fontWeight={700}>Invoice Details</Typography>
            <Table size="small" sx={{ mt: 0.5 }}>
              <TableBody>
                {[
                  ['Invoice Date', fmtDate(invoice.invoiceDate)],
                  ['Due Date', fmtDate(invoice.dueDate)],
                  ['Department', invoice.department || '—'],
                  ['Reference', invoice.referenceNumber || '—'],
                ].map(([k, v]) => (
                  <TableRow key={k} sx={{ '& td': { border: 'none', py: 0.25, px: 0.5 } }}>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 12, textAlign: 'right' }}>{k}:</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: 12, textAlign: 'right' }}>{v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Box>

        {/* Line items */}
        {invoice.lineItems?.length > 0 ? (
          <Table size="small" sx={{ mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                {['#', 'Description', 'Qty', 'Unit Price', 'Tax', 'Amount'].map(h => (
                  <TableCell key={h} sx={{ color: 'white', fontWeight: 700, fontSize: 12, py: 1 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {invoice.lineItems.map((it, i) => (
                <TableRow key={i} sx={{ '&:nth-of-type(even)': { bgcolor: 'grey.50' } }}>
                  <TableCell sx={{ fontSize: 12 }}>{i + 1}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{it.description || it.itemName}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{it.quantity || 1}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmt(it.unitPrice || 0)}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{it.taxRate ? `${it.taxRate}%` : '—'}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{fmt(it.amount || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table size="small" sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700, textAlign: 'right' }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Invoice Amount</TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>{fmt(invoice.totalAmount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        {/* Totals */}
        <Box display="flex" justifyContent="flex-end" mb={3}>
          <Table size="small" sx={{ maxWidth: 320, border: '1px solid', borderColor: 'divider' }}>
            <TableBody>
              {invoice.subtotal && (
                <TableRow><TableCell>Subtotal</TableCell><TableCell sx={{ textAlign: 'right' }}>{fmt(invoice.subtotal)}</TableCell></TableRow>
              )}
              {invoice.taxAmount > 0 && (
                <TableRow><TableCell>Tax</TableCell><TableCell sx={{ textAlign: 'right' }}>{fmt(invoice.taxAmount)}</TableCell></TableRow>
              )}
              <TableRow sx={{ bgcolor: 'primary.50' }}>
                <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: 'primary.main' }}>{fmt(invoice.totalAmount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>Amount Paid</TableCell>
                <TableCell sx={{ textAlign: 'right', color: 'text.secondary' }}>{fmt(invoice.amountPaid || invoice.paidAmount || 0)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: balance > 0 ? 'error.50' : 'success.50' }}>
                <TableCell sx={{ fontWeight: 800 }}>Balance Due</TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: balance > 0 ? 'error.main' : 'success.main' }}>{fmt(balance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {/* Notes */}
        {invoice.notes && (
          <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 3 }}>
            <Typography variant="overline" color="text.disabled" fontWeight={700}>Notes</Typography>
            <Typography variant="body2">{invoice.notes}</Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" color="text.disabled" display="block" textAlign="center">
          {company.invoiceFooter || `Thank you for your business — ${company.name || 'SGC International'}`}
          {company.email && ` — ${company.email}`}
          {company.website && ` — ${company.website}`}
        </Typography>
      </Box>
    </Box>
  );
}
