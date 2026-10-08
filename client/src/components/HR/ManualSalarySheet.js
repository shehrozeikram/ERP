import React, { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, CircularProgress, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControlLabel, Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon
} from '@mui/icons-material';
import manualSalaryService from '../../services/manualSalaryService';
import ManualSalaryForm from './ManualSalaryForm';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return 'Rs 0';
  return `Rs ${amount.toLocaleString()}`;
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const statusColor = (status) => {
  switch (status) {
    case 'Pending HOD HR': return 'warning';
    case 'Pending AVP': return 'info';
    case 'Forwarded to CEO': return 'secondary';
    case 'Approved by CEO':
    case 'Pending Finance': return 'warning';
    case 'Payment Pending': return 'info';
    case 'Paid': return 'success';
    case 'Rejected by CEO':
    case 'Returned': return 'error';
    default: return 'default';
  }
};

const sameId = (a, b) => String(a?._id || a || '') === String(b || '');

const ManualSalarySheet = ({ manualSalaries, loading, onRefresh }) => {
  const { user } = useAuth();
  const userId = user?.id || user?._id;
  const [exportLoading, setExportLoading] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: 'approve', record: null });
  const [comments, setComments] = useState('');
  const [agree, setAgree] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  const canActOn = (row) => {
    const status = row.workflowStatus || 'Pending HOD HR';
    if (status === 'Pending HOD HR' && sameId(row.assignedHod, userId)) return 'HOD';
    if (status === 'Pending AVP' && sameId(row.assignedAvp, userId)) return 'AVP';
    return null;
  };

  const canEdit = (row) => {
    const status = row.workflowStatus || 'Pending HOD HR';
    return ['Pending HOD HR', 'Draft', 'Returned', 'Rejected by CEO'].includes(status);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await manualSalaryService.remove(id);
      onRefresh();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error(error.response?.data?.message || 'Failed to delete record');
    }
  };

  const openAction = (type, record) => {
    setActionDialog({ open: true, type, record });
    setComments('');
    setAgree(false);
  };

  const handleActionSubmit = async () => {
    const { type, record } = actionDialog;
    if (!agree) {
      toast.error('Please confirm the checkbox');
      return;
    }
    if (type === 'reject' && !comments.trim()) {
      toast.error('Please provide comments for rejection');
      return;
    }
    const role = canActOn(record);
    if (!role) {
      toast.error('You are not the current approver');
      return;
    }
    const signature = user?.digitalSignature
      || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '');
    const payload = { comments, signature };
    try {
      setActionLoading(true);
      if (type === 'approve') {
        if (role === 'HOD') await manualSalaryService.approveByHOD(record._id, payload);
        else await manualSalaryService.approveByAVP(record._id, payload);
        toast.success('Approved successfully');
      } else {
        if (role === 'HOD') await manualSalaryService.rejectByHOD(record._id, payload);
        else await manualSalaryService.rejectByAVP(record._id, payload);
        toast.success('Returned / rejected');
      }
      setActionDialog({ open: false, type: 'approve', record: null });
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (month, year, records, monthName) => {
    try {
      setExportLoading(`${month}-${year}`);

      const jsPDF = (await import('jspdf')).default;
      await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

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
        r.workflowStatus || '',
        r.remarks || ''
      ]);

      const totalNet = records.reduce((sum, r) => sum + (r.netPayable || 0), 0);

      tableData.push([
        { content: 'Total', colSpan: 17, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCurrency(totalNet), styles: { fontStyle: 'bold', fillColor: [255, 255, 0] } },
        '',
        ''
      ]);

      doc.autoTable({
        startY: 30,
        head: [['Sr.', 'Emp ID', 'Name', 'Designation', 'Project', 'DOJ', 'Basic Salary', 'House Rent', 'Medical Allow.', 'Conv. Allow.', 'Vehicle Allow.', 'Fuel Allow.', 'Food Allow.', 'Special Allow.', 'Other Allow.', 'Gross Salary', 'Income Tax', 'Net Payable', 'Status', 'Remarks']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' }
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
            <Box>
              <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                Manual Salary Processing
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Approval: GM HR → AVP Taj Fahad Farid → CEO
              </Typography>
            </Box>
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
            groupedSalaries.map((group) => (
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
                        <TableCell>Status</TableCell>
                        <TableCell align="right" sx={{ bgcolor: 'yellow', fontWeight: 'bold' }}>Net Payable</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {group.records.map((row, index) => {
                        const actRole = canActOn(row);
                        return (
                          <TableRow key={row._id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{row.empId}</TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{row.designation}</TableCell>
                            <TableCell>{row.project}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={row.workflowStatus || 'Pending HOD HR'}
                                color={statusColor(row.workflowStatus)}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: '#fffde7' }}>
                              {formatCurrency(row.netPayable)}
                            </TableCell>
                            <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                              {actRole && (
                                <>
                                  <IconButton size="small" color="success" title="Approve" onClick={() => openAction('approve', row)}>
                                    <ApproveIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" title="Reject / Return" onClick={() => openAction('reject', row)}>
                                    <RejectIcon fontSize="small" />
                                  </IconButton>
                                </>
                              )}
                              {canEdit(row) && (
                                <IconButton size="small" color="primary" onClick={() => { setEditData(row); setFormOpen(true); }}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                              {canEdit(row) && (
                                <IconButton size="small" color="error" onClick={() => handleDelete(row._id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow sx={{ bgcolor: 'grey.300' }}>
                        <TableCell colSpan={6} align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'yellow' }}>{formatCurrency(group.totalNet)}</TableCell>
                        <TableCell />
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

      <Dialog open={actionDialog.open} onClose={() => setActionDialog({ open: false, type: 'approve', record: null })} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog.type === 'approve' ? 'Approve' : 'Reject / Return'} Manual Salary — {actionDialog.record?.name}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            sx={{ mt: 1 }}
          />
          <FormControlLabel
            control={<Checkbox checked={agree} onChange={(e) => setAgree(e.target.checked)} />}
            label={actionDialog.type === 'approve' ? 'I confirm this approval' : 'I confirm this rejection / return'}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog({ open: false, type: 'approve', record: null })}>Cancel</Button>
          <Button
            variant="contained"
            color={actionDialog.type === 'approve' ? 'success' : 'error'}
            disabled={actionLoading}
            onClick={handleActionSubmit}
          >
            {actionLoading ? <CircularProgress size={22} /> : (actionDialog.type === 'approve' ? 'Approve' : 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ManualSalarySheet;
