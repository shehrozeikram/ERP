import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableHead, TableRow, Chip
} from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon, Download as DownloadIcon } from '@mui/icons-material';
import api from '../../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const STATUS_COLOR = { draft: 'default', pending: 'warning', approved: 'info', paid: 'success', partial: 'warning', overdue: 'error' };

export default function BillPrint() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bill, setBill]       = useState(null);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [billRes, cpRes] = await Promise.all([
          api.get(`/finance/accounts-payable/${id}`),
          api.get('/finance/company-profile').catch(() => ({ data: { data: {} } }))
        ]);
        setBill(billRes.data.data || billRes.data);
        setCompany(cpRes.data.data || {});
      } catch (e) {
        setError(e.response?.data?.message || 'Bill not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const vendorName = bill?.vendor?.name || (typeof bill?.vendor === 'string' ? bill?.vendor : '—');

  const handleDownloadPDF = () => {
    if (!bill) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(198, 40, 40);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    const co = company;
    doc.text(co.name || 'SGC International', 14, 12);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Vendor Bill', 14, 20);
    if (co.ntn)  { doc.setFontSize(8); doc.text(`NTN: ${co.ntn}`, 14, 26); }
    if (co.strn) { doc.setFontSize(8); doc.text(`STRN: ${co.strn}`, 60, 26); }
    doc.text(bill.billNumber, 196, 12, { align: 'right' });
    doc.text(`Status: ${bill.status?.toUpperCase()}`, 196, 20, { align: 'right' });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    let y = 36;
    doc.setFont('helvetica', 'bold'); doc.text('VENDOR:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(vendorName, 14, y + 5);
    if (bill.vendor?.email) doc.text(bill.vendor.email, 14, y + 10);

    doc.setFont('helvetica', 'bold'); doc.text('BILL DETAILS:', 130, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill #: ${bill.billNumber}`, 130, y + 5);
    doc.text(`Bill Date: ${fmtDate(bill.billDate)}`, 130, y + 10);
    doc.text(`Due Date: ${fmtDate(bill.dueDate)}`, 130, y + 15);

    y += 28;
    doc.setDrawColor(200); doc.line(14, y, 196, y); y += 4;

    const hasItems = bill.lineItems?.length > 0;
    autoTable(doc, {
      startY: y,
      head: hasItems ? [['#', 'Description', 'Qty', 'Unit Price', 'Amount']] : [['Description', 'Amount']],
      body: hasItems
        ? bill.lineItems.map((it, i) => [i + 1, it.description || '', it.quantity || 1, fmt(it.unitPrice || 0), fmt(it.amount || 0)])
        : [['Bill Amount', fmt(bill.totalAmount)]],
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [198, 40, 40], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 250, 250] },
    });

    y = doc.lastAutoTable.finalY + 8;
    const balance = (bill.totalAmount || 0) - (bill.amountPaid || 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${fmt(bill.totalAmount)}`, 196, y, { align: 'right' }); y += 6;
    doc.text(`Paid: ${fmt(bill.amountPaid || 0)}`, 196, y, { align: 'right' }); y += 6;
    doc.setTextColor(balance > 0 ? 198 : 46, balance > 0 ? 40 : 125, balance > 0 ? 40 : 50);
    doc.text(`Balance Due: ${fmt(balance)}`, 196, y, { align: 'right' });

    if (bill.notes) {
      doc.setTextColor(80, 80, 80); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text('Notes: ' + bill.notes, 14, y + 8);
    }
    doc.save(`Bill-${bill.billNumber}.pdf`);
  };

  if (loading) return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  if (error)   return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!bill)   return null;

  const balance = (bill.totalAmount || 0) - (bill.amountPaid || 0);

  return (
    <Box>
      <Box sx={{ p: 2, bgcolor: 'grey.100', display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center', '@media print': { display: 'none' } }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)}>Back</Button>
        <Box display="flex" gap={1}>
          <Button variant="outlined" color="error" startIcon={<DownloadIcon />} onClick={handleDownloadPDF}>Download PDF</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print</Button>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 820, mx: 'auto', p: 5, bgcolor: 'white', '@media print': { maxWidth: '100%', p: 3, margin: 0 } }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
          <Box>
            {company.logoUrl && <Box component="img" src={company.logoUrl} alt="Logo" sx={{ height: 40, mb: 0.5, display: 'block' }} />}
            <Typography variant="h4" fontWeight={900} color="error.main">{company.name || 'SGC International'}</Typography>
            {company.ntn  && <Typography variant="body2" color="text.secondary" fontWeight={600}>NTN: {company.ntn}</Typography>}
            {company.strn && <Typography variant="body2" color="text.secondary" fontWeight={600}>STRN: {company.strn}</Typography>}
            <Typography variant="body2" color="text.secondary">accounts@sgc.international</Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="h5" fontWeight={800}>VENDOR BILL</Typography>
            <Typography variant="h6" color="error.main">{bill.billNumber}</Typography>
            <Chip label={bill.status?.toUpperCase()} size="small" color={STATUS_COLOR[bill.status] || 'default'} sx={{ mt: 0.5 }} />
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box display="flex" justifyContent="space-between" mb={4}>
          <Box>
            <Typography variant="overline" color="text.disabled" fontWeight={700}>Vendor</Typography>
            <Typography variant="h6" fontWeight={700}>{vendorName}</Typography>
            {bill.vendor?.email && <Typography variant="body2" color="text.secondary">{bill.vendor.email}</Typography>}
            {bill.vendor?.phone && <Typography variant="body2" color="text.secondary">{bill.vendor.phone}</Typography>}
          </Box>
          <Box textAlign="right">
            <Typography variant="overline" color="text.disabled" fontWeight={700}>Bill Details</Typography>
            <Table size="small">
              <TableBody>
                {[
                  ['Bill #', bill.billNumber],
                  ['Bill Date', fmtDate(bill.billDate)],
                  ['Due Date', fmtDate(bill.dueDate)],
                  ['Department', bill.department || '—'],
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

        {bill.lineItems?.length > 0 ? (
          <Table size="small" sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'error.main' }}>
                {['#', 'Description', 'Qty', 'Unit Price', 'Amount'].map(h => (
                  <TableCell key={h} sx={{ color: 'white', fontWeight: 700, fontSize: 12, py: 1 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {bill.lineItems.map((it, i) => (
                <TableRow key={i} sx={{ '&:nth-of-type(even)': { bgcolor: 'grey.50' } }}>
                  <TableCell sx={{ fontSize: 12 }}>{i + 1}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{it.description || it.itemName}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{it.quantity || 1}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmt(it.unitPrice || 0)}</TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{fmt(it.amount || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table size="small" sx={{ mb: 3, border: '1px solid', borderColor: 'divider' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'error.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700, textAlign: 'right' }}>Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Bill Amount</TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 600 }}>{fmt(bill.totalAmount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        <Box display="flex" justifyContent="flex-end" mb={3}>
          <Table size="small" sx={{ maxWidth: 300, border: '1px solid', borderColor: 'divider' }}>
            <TableBody>
              <TableRow sx={{ bgcolor: 'error.50' }}>
                <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: 'error.main' }}>{fmt(bill.totalAmount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>Amount Paid</TableCell>
                <TableCell sx={{ textAlign: 'right', color: 'text.secondary' }}>{fmt(bill.amountPaid || 0)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: balance > 0 ? 'error.50' : 'success.50' }}>
                <TableCell sx={{ fontWeight: 800 }}>Balance Due</TableCell>
                <TableCell sx={{ textAlign: 'right', fontWeight: 800, color: balance > 0 ? 'error.main' : 'success.main' }}>{fmt(balance)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {bill.notes && (
          <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 3 }}>
            <Typography variant="overline" color="text.disabled" fontWeight={700}>Notes</Typography>
            <Typography variant="body2">{bill.notes}</Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" color="text.disabled" display="block" textAlign="center">
          {company.invoiceFooter || `${company.name || 'SGC International'}`}
          {company.email && ` — ${company.email}`}
        </Typography>
      </Box>
    </Box>
  );
}
