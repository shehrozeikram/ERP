import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, CircularProgress, Alert, Paper,
  Table, TableBody, TableCell, TableHead, TableRow, Chip
} from '@mui/material';
import { Print as PrintIcon, ArrowBack as BackIcon, Download as DownloadIcon } from '@mui/icons-material';
import api from '../../services/api';
import CentralizedStoreBillInvoiceBody from '../../components/UtilityBill/CentralizedStoreBillInvoiceBody';
import { DigitalSignatureImage } from '../../components/common/DigitalSignatureImage';
import { getBillNarrationDisplay } from '../../utils/documentNarrationDisplay';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STATUS_COLOR = {
  draft: 'default',
  pending: 'warning',
  approved: 'info',
  paid: 'success',
  partial: 'warning',
  cancelled: 'error'
};

export default function BillPrint() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bill, setBill] = useState(null);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  if (error) return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!bill) return null;

  const vendorName = bill?.vendorName || bill?.vendor?.name || (typeof bill?.vendor === 'string' ? bill?.vendor : '—');
  const companyName = bill?.companyId?.name || bill?.company?.name || company?.name || 'SGC International';

  const normalizedBill = {
    ...bill,
    billId: bill.billNumber,
    billDate: bill.billDate,
    createdAt: bill.createdAt || bill.billDate,
    provider: vendorName,
    location: companyName,
    notes: bill.notes || bill.internalNotes || getBillNarrationDisplay(bill),
    forWhat: bill.forWhat || getBillNarrationDisplay(bill),
    billLines: (bill.lineItems && bill.lineItems.length > 0)
      ? bill.lineItems.map((line, idx) => ({
          ...line,
          category: line.category || line.accountName || line.account?.name || (line.accountNumber ? `Account ${line.accountNumber}` : '—'),
          accountName: line.accountName || line.account?.name || '',
          accountNumber: line.accountNumber || line.account?.accountNumber || '',
          itemName: line.description || line.itemName || (line.accountNumber ? `Account ${line.accountNumber}` : 'Item'),
          description: line.description || line.itemName || '',
          itemCode: line.itemCode || line.accountNumber || '—',
          amount: line.amount || (line.quantity * line.unitPrice) || 0
        }))
      : (bill.billLines || [])
  };

  const getApprovalRows = () => {
    const formatDateTime = (date) => {
      if (!date) return '-';
      return new Date(date).toLocaleString('en-PK', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    const userDisplayName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.name || '-';

    if (Array.isArray(bill?.financeApprovalAuthorities) && bill.financeApprovalAuthorities.length > 0) {
      return bill.financeApprovalAuthorities.map((auth) => ({
        authority: auth.levelName || auth.levelKey || 'Approval Authority',
        name: auth.assignedUser ? userDisplayName(auth.assignedUser) : (auth.userName || '-'),
        status: auth.status || 'Pending',
        signatureUser: auth.assignedUser || null,
        signaturePath: auth.digitalSignature || auth.assignedUser?.digitalSignature || '',
        dateTime: auth.actedAt ? formatDateTime(auth.actedAt) : '-'
      }));
    }

    const history = Array.isArray(bill?.workflowHistory) ? [...bill.workflowHistory].reverse() : [];
    const preAuditEntry = history.find((e) => e.toStatus === 'Forwarded to Audit Director' || e.toStatus === 'initial audit approval' || e.toStatus === 'Initial Pre-Audit Approved' || e.toStatus?.includes('Pre-Audit'));
    const directorEntry = history.find((e) => e.toStatus === 'approved' || e.toStatus === 'Approved' || e.toStatus?.includes('Audit Director'));

    return [
      {
        authority: 'Sig of Requester',
        name: userDisplayName(bill?.createdBy),
        status: 'Approved',
        signatureUser: bill?.createdBy,
        dateTime: bill?.createdAt ? formatDateTime(bill.createdAt) : '-'
      },
      {
        authority: 'Pre-Audit Authority',
        name: userDisplayName(preAuditEntry?.changedBy),
        status: preAuditEntry ? 'Approved' : 'Pending',
        signatureUser: preAuditEntry?.changedBy || null,
        dateTime: preAuditEntry?.changedAt ? formatDateTime(preAuditEntry.changedAt) : '-'
      },
      {
        authority: 'Audit Director',
        name: userDisplayName(directorEntry?.changedBy),
        status: directorEntry ? 'Approved' : 'Pending',
        signatureUser: directorEntry?.changedBy || null,
        signaturePath: directorEntry?.stampUsed && directorEntry?.stampImage ? directorEntry.stampImage : (directorEntry?.changedBy?.digitalSignature || ''),
        dateTime: directorEntry?.changedAt ? formatDateTime(directorEntry.changedAt) : '-'
      },
      {
        authority: 'Finance Authority',
        name: userDisplayName(bill?.approval?.approvedBy),
        status: bill?.approval?.approvedBy ? 'Approved' : (bill?.status === 'paid' ? 'Approved' : 'Pending'),
        signatureUser: bill?.approval?.approvedBy || null,
        dateTime: bill?.approval?.approvedDate ? formatDateTime(bill.approval.approvedDate) : '-'
      }
    ];
  };

  const getSignatureSource = (row) => row?.signaturePath || row?.signatureUser?.digitalSignature || '';

  const handleDownloadPDF = () => {
    if (!bill) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('VENDOR BILL INVOICE', 14, 20);
    doc.text(bill.billNumber, 196, 12, { align: 'right' });
    doc.text(`Status: ${bill.status?.toUpperCase()}`, 196, 20, { align: 'right' });

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    let y = 36;
    doc.setFont('helvetica', 'bold');
    doc.text('VENDOR / SUPPLIER:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(vendorName, 14, y + 5);
    if (bill.vendor?.email) doc.text(bill.vendor.email, 14, y + 10);

    doc.setFont('helvetica', 'bold');
    doc.text('BILL DETAILS:', 130, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Bill #: ${bill.billNumber}`, 130, y + 5);
    doc.text(`Bill Date: ${formatDate(bill.billDate)}`, 130, y + 10);
    doc.text(`Due Date: ${formatDate(bill.dueDate)}`, 130, y + 15);

    y += 28;
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 4;

    const hasItems = normalizedBill.billLines?.length > 0;
    autoTable(doc, {
      startY: y,
      head: [hasItems ? ['#', 'Category / Description', 'Qty', 'Rate', 'Net Amount'] : ['Description', 'Amount']],
      body: hasItems
        ? normalizedBill.billLines.map((it, i) => [
            i + 1,
            it.description || it.itemName || it.category || '',
            it.quantity || 1,
            formatPKR(it.unitPrice || (it.quantity ? it.amount / it.quantity : it.amount) || 0),
            formatPKR(it.amount || 0)
          ])
        : [['Bill Amount', formatPKR(bill.totalAmount)]],
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' }
    });

    y = doc.lastAutoTable.finalY + 8;
    const balance = (bill.totalAmount || 0) - (bill.amountPaid || 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Amount: ${formatPKR(bill.totalAmount)}`, 196, y, { align: 'right' });
    y += 6;
    doc.text(`Amount Paid: ${formatPKR(bill.amountPaid || 0)}`, 196, y, { align: 'right' });
    y += 6;
    doc.text(`Balance Due: ${formatPKR(balance)}`, 196, y, { align: 'right' });

    doc.save(`Bill-${bill.billNumber}.pdf`);
  };

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: '100vh', py: 3 }}>
      {/* Top Action Bar (hidden on print) */}
      <Box
        sx={{
          maxWidth: '210mm',
          mx: 'auto',
          mb: 2,
          p: 2,
          bgcolor: 'white',
          borderRadius: 1,
          boxShadow: 1,
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          '@media print': { display: 'none' }
        }}
      >
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} variant="outlined">
          Back
        </Button>
        <Box display="flex" gap={1}>
          <Button variant="contained" color="primary" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print Bill
          </Button>
        </Box>
      </Box>

      {/* Main Printable Document */}
      <Paper
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: '210mm',
          mx: 'auto',
          backgroundColor: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          borderRadius: 1,
          fontFamily: 'Arial, sans-serif',
          '@media print': {
            p: '8mm 12mm',
            boxShadow: 'none',
            border: 'none',
            maxWidth: '100%',
            mx: 0,
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }
        }}
        className="print-content"
      >
        {/* Document Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5, pb: 2, borderBottom: '2px solid #1e293b' }}>
          <Box>
            <Typography fontWeight={900} sx={{ fontSize: '1.5rem', color: '#1e293b' }}>
              {companyName}
            </Typography>
            <Typography fontWeight={800} color="primary" sx={{ fontSize: '1.15rem', textTransform: 'uppercase', mt: 0.5 }}>
              VENDOR BILL INVOICE
            </Typography>
            {company.ntn && (
              <Typography variant="body2" color="text.secondary">
                <strong>NTN:</strong> {company.ntn} {company.strn ? ` | STRN: ${company.strn}` : ''}
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h6" fontWeight={800} color="primary.main">
              {bill.billNumber}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <strong>Date:</strong> {formatDate(bill.billDate)}
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                label={bill.status?.toUpperCase() || 'DRAFT'}
                size="small"
                color={STATUS_COLOR[bill.status] || 'default'}
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Box>
        </Box>

        {/* Centralized Store / Standard Bill Invoice Body */}
        <CentralizedStoreBillInvoiceBody bill={normalizedBill} showChargesSummary={true} />

        {/* Finance Document Approval Authority Table */}
        <Box sx={{ mt: 2.5, '@media print': { mt: 2, pageBreakInside: 'avoid', breakInside: 'avoid' } }}>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, color: '#1e293b', '@media print': { fontSize: '11px', mb: 0.5 } }}>
            Finance Document Approval Authority
          </Typography>
          <Table
            size="small"
            sx={{
              border: '1.5px solid #334155',
              '& th': {
                bgcolor: '#f1f5f9',
                fontWeight: 800,
                fontSize: 12,
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                py: 0.6,
                px: 1,
                '@media print': { py: 0.4, px: 0.8, fontSize: '10px' }
              },
              '& td': {
                fontSize: 12,
                border: '1px solid #cbd5e1',
                py: 0.6,
                px: 1,
                verticalAlign: 'middle',
                '@media print': { py: 0.4, px: 0.8, fontSize: '10px' }
              }
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '25%' }}>Authority</TableCell>
                <TableCell sx={{ width: '25%' }}>Name</TableCell>
                <TableCell sx={{ width: '25%' }} align="center">Digital Signature</TableCell>
                <TableCell sx={{ width: '25%' }}>Date &amp; Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getApprovalRows().map((row) => (
                <TableRow key={row.authority}>
                  <TableCell sx={{ fontWeight: 800 }}>{row.authority}</TableCell>
                  <TableCell>{row.name || '-'}</TableCell>
                  <TableCell align="center">
                    {getSignatureSource(row) ? (
                      <Box sx={{ maxHeight: 28, display: 'flex', justifyContent: 'center', alignItems: 'center', '& img': { maxHeight: 28, width: 'auto', objectFit: 'contain' } }}>
                        <DigitalSignatureImage userOrPath={getSignatureSource(row)} alt={`${row.authority} signature`} />
                      </Box>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{row.dateTime || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Global CSS for Print Media */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        @media print {
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </Box>
  );
}
