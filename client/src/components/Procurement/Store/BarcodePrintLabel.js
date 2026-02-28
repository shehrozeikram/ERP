import React, { useRef } from 'react';
import {
  Box, Button, Typography, Dialog, DialogTitle,
  DialogContent, DialogActions, Stack, Divider, Chip, Grid
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import QrCodeIcon from '@mui/icons-material/QrCode';

/**
 * BarcodePrintLabel
 * Renders a printable barcode label for one or more inventory items.
 * Uses CSS print media query — clicking Print opens the browser print dialog
 * with only the label visible.
 *
 * Props:
 *  - open (bool)
 *  - onClose (fn)
 *  - items (array) – [{ itemCode, name, unit, barcode, barcodeType, location }]
 */
const BarcodePrintLabel = ({ open, onClose, items = [] }) => {
  const printRef = useRef(null);

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const win = window.open('', '_blank', 'width=800,height=600');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: #fff; }
            .labels-grid { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; }
            .label {
              border: 1px solid #333;
              border-radius: 4px;
              padding: 8px 10px;
              width: 200px;
              min-height: 120px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              page-break-inside: avoid;
            }
            .label-header { font-size: 9px; color: #666; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
            .label-name { font-size: 11px; font-weight: bold; text-align: center; margin: 4px 0; word-break: break-word; }
            .barcode-text { font-family: monospace; font-size: 10px; letter-spacing: 2px; margin: 4px 0; }
            .barcode-bars { font-size: 36px; font-family: 'Libre Barcode 128', monospace; letter-spacing: 1px; }
            .label-meta { font-size: 8px; color: #555; text-align: center; }
            .location-tag { font-size: 8px; background: #f0f0f0; padding: 2px 5px; border-radius: 3px; margin-top: 3px; }
            @page { size: A4; margin: 10mm; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
        </head>
        <body>
          <div class="labels-grid">
            ${items.map(item => `
              <div class="label">
                <div class="label-header">SGC ERP</div>
                <div class="label-name">${item.name || item.itemCode}</div>
                <div class="barcode-bars">${item.barcode || item.itemCode}</div>
                <div class="barcode-text">${item.barcode || item.itemCode}</div>
                <div class="label-meta">
                  Code: ${item.itemCode} &nbsp;|&nbsp; Unit: ${item.unit || '—'}
                </div>
                ${item.location?.rack || item.location?.shelf || item.location?.bin
                  ? `<div class="location-tag">
                      ${[item.location.rack, item.location.shelf, item.location.bin].filter(Boolean).join(' / ')}
                    </div>`
                  : ''
                }
              </div>
            `).join('')}
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <QrCodeIcon color="primary" />
        Barcode Labels Preview
      </DialogTitle>
      <DialogContent dividers>
        <Box ref={printRef}>
          <Grid container spacing={2}>
            {items.map((item, idx) => (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <Box
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1.5,
                    textAlign: 'center',
                    bgcolor: 'background.paper'
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>
                    SGC ERP
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" sx={{ my: 0.5, lineHeight: 1.3 }}>
                    {item.name || item.itemCode}
                  </Typography>
                  <Box sx={{
                    fontFamily: '"Libre Barcode 128", monospace',
                    fontSize: '2.5rem',
                    lineHeight: 1,
                    my: 0.5,
                    overflow: 'hidden'
                  }}>
                    {item.barcode || item.itemCode}
                  </Box>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                    {item.barcode || item.itemCode}
                  </Typography>
                  <Divider sx={{ my: 0.5 }} />
                  <Typography variant="caption" color="text.secondary">
                    Code: {item.itemCode} &nbsp;|&nbsp; Unit: {item.unit || '—'}
                  </Typography>
                  {(item.location?.rack || item.location?.shelf || item.location?.bin) && (
                    <Box sx={{ mt: 0.5 }}>
                      <Chip
                        label={[item.location.rack, item.location.shelf, item.location.bin].filter(Boolean).join(' / ')}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.65rem', height: 18 }}
                      />
                    </Box>
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
        {items.length === 0 && (
          <Typography color="text.secondary" textAlign="center" py={3}>
            No items to print. Please save the GRN first.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={items.length === 0}
        >
          Print Labels
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BarcodePrintLabel;
