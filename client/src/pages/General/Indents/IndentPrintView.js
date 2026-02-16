import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Grid
} from '@mui/material';
import {
  Print as PrintIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import indentService from '../../../services/indentService';
import dayjs from 'dayjs';

const IndentPrintView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [indent, setIndent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadIndent = async () => {
      try {
        setLoading(true);
        const response = await indentService.getIndentById(id);
        setIndent(response.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load indent');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadIndent();
    }
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date) => {
    if (!date) return '';
    return dayjs(date).format('DD/MM/YYYY');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !indent) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Indent not found'}</Alert>
      </Box>
    );
  }

  return (
    <>
      {/* Print Controls - Hidden when printing */}
      <Box sx={{ p: 2, display: 'flex', gap: 2, '@media print': { display: 'none' } }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/general/indents/${id}`)}
        >
          Back
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          Print
        </Button>
      </Box>

      {/* Print Content */}
      <Paper
        sx={{
          p: 4,
          maxWidth: '210mm',
          minHeight: '297mm',
          mx: 'auto',
          backgroundColor: '#fff',
          '@media print': {
            boxShadow: 'none',
            p: 2.5,
            maxWidth: '100%',
            backgroundColor: '#fff'
          }
        }}
      >
        {/* Header Section - Logo and Company Name */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 0, position: 'relative', minHeight: { xs: 150, print: 130 } }}>
          <Box
            component="img"
            src="/images/taj-logo.png"
            alt="Taj Residencia Logo"
            sx={{
              height: { xs: 150, print: 130 },
              width: 'auto',
              objectFit: 'contain',
              position: 'absolute',
              left: 0,
              top: { xs: 10, print: 5 }
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              fontSize: { xs: '1.6rem', print: '1.4rem' },
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              textAlign: 'center'
            }}
          >
            Taj Residencia
          </Typography>
        </Box>

        {/* Document Title */}
        <Typography
          variant="h5"
          fontWeight={700}
          align="center"
          sx={{
            textTransform: 'uppercase',
            mb: 1,
            fontSize: { xs: '1.1rem', print: '0.95rem' },
            letterSpacing: 1.5,
            mt: -4
          }}
        >
          Purchase Request Form
        </Typography>

        {/* Indent Title */}
        {indent.title && (
          <Typography variant="h6" fontWeight={600} align="center" sx={{ mb: 2, fontSize: '1rem' }}>
            {indent.title}
          </Typography>
        )}

        {/* ERP Ref - Single Row (Centered) */}
        <Box sx={{ mb: 1.5, fontSize: '0.9rem', lineHeight: 1.8, textAlign: 'center' }}>
          <Box>
            <Typography component="span" fontWeight={600}>ERP Ref:</Typography>
            <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>
              {indent.erpRef || 'PR #' + (indent.indentNumber?.split('-').pop() || '')}
            </Typography>
          </Box>
        </Box>

        {/* Date, Required Date, Indent No. - Single Row */}
        <Box sx={{ mb: 1.5, fontSize: '0.9rem', lineHeight: 1.8 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
            <Box sx={{ minWidth: '120px' }}>
              <Typography component="span" fontWeight={600}>Date:</Typography>
              <Typography component="span" sx={{ ml: 1 }}>
                {formatDate(indent.requestedDate)}
              </Typography>
            </Box>
            <Box sx={{ minWidth: '150px' }}>
              <Typography component="span" fontWeight={600}>Required Date:</Typography>
              <Typography component="span" sx={{ ml: 1 }}>
                {indent.requiredDate ? formatDate(indent.requiredDate) : '___________'}
              </Typography>
            </Box>
            <Box sx={{ minWidth: '120px' }}>
              <Typography component="span" fontWeight={600}>Indent No.:</Typography>
              <Typography component="span" sx={{ ml: 1 }}>
                {indent.indentNumber || '___________'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Department and Originator - Single Row */}
        <Box sx={{ mb: 3, fontSize: '0.9rem', lineHeight: 1.8 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' }}>
            <Box sx={{ minWidth: '200px' }}>
              <Typography component="span" fontWeight={600}>Department:</Typography>
              <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>
                {indent.department?.name || '___________'}
              </Typography>
            </Box>
            <Box sx={{ minWidth: '200px' }}>
              <Typography component="span" fontWeight={600}>Originator:</Typography>
              <Typography component="span" sx={{ ml: 1, textTransform: 'uppercase' }}>
                {indent.requestedBy?.firstName && indent.requestedBy?.lastName
                  ? `${indent.requestedBy.firstName} ${indent.requestedBy.lastName}`
                  : '___________'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Items Table */}
        <Box sx={{ mb: 3 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #000',
              fontSize: '0.85rem',
              fontFamily: 'Arial, sans-serif'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', border: '1px solid #000' }}>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 700, width: '4%' }}>S#</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '14%' }}>Item Name</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '14%' }}>Item Description</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '10%' }}>Brand</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '8%' }}>Unit</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', fontWeight: 700, width: '6%' }}>Qty.</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', fontWeight: 700, textAlign: 'left', width: '18%' }}>Purpose</th>
                <th style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', fontWeight: 700, width: '10%' }}>Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              {indent.items && indent.items.length > 0 ? (
                indent.items.map((item, index) => (
                  <tr key={index} style={{ border: '1px solid #000' }}>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      {(index + 1).toString().padStart(2, '0')}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.itemName || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.description || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.brand || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.unit || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      {item.quantity ?? '___'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', verticalAlign: 'top' }}>
                      {item.purpose || '___________'}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'right', verticalAlign: 'top' }}>
                      {item.estimatedCost != null ? Number(item.estimatedCost).toFixed(2) : '___________'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ border: '1px solid #000', padding: '10px 8px', textAlign: 'center' }}>
                    No items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>

        {/* Justification */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, fontSize: '0.95rem' }}>
            Justification:
          </Typography>
          <Box
            sx={{
              border: '1px solid #ccc',
              p: 1.5,
              minHeight: '50px',
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6
            }}
          >
            {indent.justification || '___________'}
          </Box>
        </Box>

        {/* Signatures Section */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ border: '1px solid #ccc', p: 1.5, minHeight: '90px', textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1, fontSize: '0.85rem' }}>
                  Sig of Requester:
                </Typography>
                <Box sx={{ mt: 2, minHeight: '35px', fontSize: '0.9rem' }}>
                  {indent.signatures?.requester?.name || '___________'}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ border: '1px solid #ccc', p: 1.5, minHeight: '90px', textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1, fontSize: '0.85rem' }}>
                  Head of Department:
                </Typography>
                <Box sx={{ mt: 2, minHeight: '35px', fontSize: '0.9rem' }}>
                  {indent.signatures?.headOfDepartment?.name || '___________'}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ border: '1px solid #ccc', p: 1.5, minHeight: '90px', textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1, fontSize: '0.85rem' }}>
                  Approved by GM/PD:
                </Typography>
                <Box sx={{ mt: 2, minHeight: '35px', fontSize: '0.9rem' }}>
                  {indent.signatures?.gmPd?.name || '___________'}
                </Box>
                {indent.signatures?.gmPd?.date && (
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block', fontSize: '0.75rem' }}>
                    {formatDate(indent.signatures.gmPd.date)}
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ border: '1px solid #ccc', p: 1.5, minHeight: '90px', textAlign: 'left' }}>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1, fontSize: '0.85rem' }}>
                  SVP/AVP Approval:
                </Typography>
                <Box sx={{ mt: 2, minHeight: '35px', fontSize: '0.9rem' }}>
                  {indent.signatures?.svpAvp?.name || '___________'}
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Distribution Section - Bottom Left */}
        <Box sx={{ mt: 3, pt: 1.5, borderTop: '1px solid #ccc', fontSize: '0.8rem' }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
            <strong>Original:</strong> Procurement
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
            <strong>Green:</strong> Store
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            <strong>Yellow:</strong> For Book Record
          </Typography>
        </Box>
      </Paper>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default IndentPrintView;
