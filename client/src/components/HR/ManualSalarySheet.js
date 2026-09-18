import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, CircularProgress, Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import api from '../../services/authService';
import ManualSalaryForm from './ManualSalaryForm';

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return 'Rs 0';
  return `Rs ${amount.toLocaleString()}`;
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ManualSalarySheet = ({ manualSalaries, loading, onRefresh }) => {
  const [exportLoading, setExportLoading] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);

  // Group salaries by month and year
  const groupedSalaries = useMemo(() => {
    if (!manualSalaries || manualSalaries.length === 0) return [];
    
    const groups = manualSalaries.reduce((acc, salary) => {
      const key = `${salary.month}-${salary.year}`;
      if (!acc[key]) {
        acc[key] = {
          month: salary.month,
          year: salary.year,
          monthName: months[salary.month - 1],
          records: [],
          totalNet: 0
        };
      }
      acc[key].records.push(salary);
      acc[key].totalNet += salary.netPayable || 0;
      return acc;
    }, {});

    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [manualSalaries]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await api.delete(`/hr/manual-salary/${id}`);
      onRefresh();
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete record');
    }
  };

  const handleExport = async (month, year, records, monthName) => {
    try {
      setExportLoading(`${month}-${year}`);
      
      const jsPDF = (await import('jspdf')).default;
      await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Add Company Header
      doc.setFontSize(18);
      doc.setTextColor(0, 51, 102);
      doc.text('SARDAR GROUP OF COMPANIES', doc.internal.pageSize.width / 2, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      doc.text(`Manual Salary Sheet - ${monthName} ${year}`, doc.internal.pageSize.width / 2, 22, { align: 'center' });

      const tableData = records.map((r, i) => [
        i + 1,
        r.empId || '',
        r.name || '',
        r.designation || '',
        r.project || '',
        r.doj || '',
        formatCurrency(r.basicSalary),
        formatCurrency(r.houseRentAllowance),
        formatCurrency(r.medicalAllowance),
        formatCurrency(r.conveyanceAllowance),
        formatCurrency(r.vehicleAllowance),
        formatCurrency(r.fuelAllowance),
        formatCurrency(r.foodAllowance),
        formatCurrency(r.specialAllowance),
        formatCurrency(r.otherAllowance),
        formatCurrency(r.grossSalary),
        formatCurrency(r.incomeTax),
        formatCurrency(r.netPayable),
        r.remarks || ''
      ]);

      const totalNet = records.reduce((sum, r) => sum + (r.netPayable || 0), 0);
      
      tableData.push([
        { content: 'Total', colSpan: 17, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(totalNet), styles: { fontStyle: 'bold', fillColor: [255, 255, 0] } },
        ''
      ]);

      doc.autoTable({
        startY: 30,
        head: [['Sr.', 'Emp ID', 'Name', 'Designation', 'Project', 'DOJ', 'Basic Salary', 'House Rent', 'Medical Allow.', 'Conv. Allow.', 'Vehicle Allow.', 'Fuel Allow.', 'Food Allow.', 'Special Allow.', 'Other Allow.', 'Gross Salary', 'Income Tax', 'Net Payable', 'Remarks']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'right' },
          12: { halign: 'right' },
          13: { halign: 'right' },
          14: { halign: 'right' },
          15: { halign: 'right' },
          16: { halign: 'right' },
          17: { halign: 'right', fontStyle: 'bold', fillColor: [255, 253, 231] }
        }
      });

      doc.save(`Manual_Salary_Sheet_${monthName}_${year}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF');
    } finally {
      setExportLoading(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
              Manual Salary Processing
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => { setEditData(null); setFormOpen(true); }}
            >
              Add Entry
            </Button>
          </Box>

          {groupedSalaries.length > 0 ? (
            groupedSalaries.map(group => (
              <Box key={`${group.month}-${group.year}`} sx={{ mb: 5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {group.monthName} {group.year}
                  </Typography>
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="small"
                    startIcon={exportLoading === `${group.month}-${group.year}` ? <CircularProgress size={16} /> : <PdfIcon />}
                    onClick={() => handleExport(group.month, group.year, group.records, group.monthName)}
                  >
                    Export Sheet
                  </Button>
                </Box>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'grey.100' }}>
                      <TableRow>
                        <TableCell>Sr. No</TableCell>
                        <TableCell>Emp ID</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Designation</TableCell>
                        <TableCell>Project</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>DOJ</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Basic Salary</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>House Rent</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Medical Allow.</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Conv. Allow.</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Vehicle Allow.</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Fuel Allow.</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Food Allow.</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Special Allow.</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Other Allow.</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Gross Salary</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Income Tax</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Net Payable</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Remarks / Bank Acct</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.records.map((row, index) => (
                        <TableRow key={row._id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{row.empId}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.designation}</TableCell>
                          <TableCell>{row.project}</TableCell>
                          <TableCell>{row.doj}</TableCell>
                          <TableCell align="right">{formatCurrency(row.basicSalary)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.houseRentAllowance)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.medicalAllowance)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.conveyanceAllowance)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.vehicleAllowance)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.fuelAllowance)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.foodAllowance)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.specialAllowance)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.otherAllowance)}</TableCell>
                          <TableCell align="right" sx={{ bgcolor: '#f5f5f5' }}>{formatCurrency(row.grossSalary)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.incomeTax)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#fffde7' }}>{formatCurrency(row.netPayable)}</TableCell>
                          <TableCell>{row.remarks}</TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="primary" onClick={() => { setEditData(row); setFormOpen(true); }}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleDelete(row._id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow sx={{ bgcolor: 'grey.300' }}>
                        <TableCell colSpan={16} align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'yellow' }}>{formatCurrency(group.totalNet)}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="textSecondary">
                No manual salaries found.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      
      <ManualSalaryForm 
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onRefresh={onRefresh}
        editData={editData}
      />
    </Box>
  );
};

export default ManualSalarySheet;
