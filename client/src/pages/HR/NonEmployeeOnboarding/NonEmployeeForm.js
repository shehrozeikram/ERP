import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  IconButton,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import nonEmployeeService from '../../../services/nonEmployeeService';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const emptyCandidate = () => ({
  name: '',
  cnic: '',
  designation: '',
  departmentSubject: '',
  project: '',
  location: '',
  currentPackageMonthly: '',
  tentativeDoj: '',
  remark: ''
});

const toDateInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const normalizeFromEdit = (emp = {}) => ({
  name: emp.name || [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || '',
  cnic: emp.cnic || '',
  designation: emp.designation || emp.role || '',
  departmentSubject: emp.departmentSubject || emp.department || '',
  project: emp.project || '',
  location: emp.location || '',
  currentPackageMonthly: emp.currentPackageMonthly ?? emp.expectedWages ?? '',
  tentativeDoj: toDateInput(emp.tentativeDoj),
  remark: emp.remark || emp.justification || ''
});

const NonEmployeeForm = ({ open, onClose, onSuccess, editData = null }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([emptyCandidate()]);
  const [approvers, setApprovers] = useState({
    assignedHod: '',
    assignedSrDirector: '',
    assignedAvp: '',
    assignedChairman: ''
  });

  React.useEffect(() => {
    if (editData) {
      const lines = editData.employees?.length
        ? editData.employees.map(normalizeFromEdit)
        : [normalizeFromEdit(editData)];
      setRecords(lines);
      setApprovers({
        assignedHod: editData.assignedHod?._id || editData.assignedHod || '',
        assignedSrDirector: editData.assignedSrDirector?._id || editData.assignedSrDirector || '',
        assignedAvp: editData.assignedAvp?._id || editData.assignedAvp || '',
        assignedChairman: editData.assignedChairman?._id || editData.assignedChairman || ''
      });
    } else {
      setRecords([emptyCandidate()]);
    }
  }, [editData, open, user]);

  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/auth/users', { params: { limit: 1000, active: true, dropdown: true } });
        const fetchedUsers = res.data.data?.users || (Array.isArray(res.data.data) ? res.data.data : []);
        setUsers(fetchedUsers);

        if (!editData) {
          const hod = fetchedUsers.find(u =>
            u.department?.toLowerCase() === 'human resource' &&
            u.position?.toLowerCase() === 'general manager'
          );
          const srDirector = fetchedUsers.find(u => {
            const full = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
            return full === 'hamza tanveer'
              || (full.includes('hamza') && full.includes('tanveer'));
          });
          const avp = fetchedUsers.find(u =>
            u.position?.toLowerCase() === 'assistant vice president'
          );
          const chairman = fetchedUsers.find(u =>
            u.position?.toLowerCase() === 'chairman steering committee'
          );

          setApprovers(prev => ({
            ...prev,
            assignedHod: prev.assignedHod || (hod ? hod.id || hod._id : ''),
            assignedSrDirector: prev.assignedSrDirector || (srDirector ? srDirector.id || srDirector._id : ''),
            assignedAvp: prev.assignedAvp || (avp ? avp.id || avp._id : ''),
            assignedChairman: prev.assignedChairman || (chairman ? chairman.id || chairman._id : '')
          }));
        }
      } catch (err) {
        console.error('Failed to fetch users', err);
      }
    };
    if (open) fetchUsers();
  }, [open, editData]);

  const handleRecordChange = (index, field, value) => {
    const next = [...records];
    next[index] = { ...next[index], [field]: value };
    setRecords(next);
  };

  const addRecord = () => setRecords([...records, emptyCandidate()]);

  const removeRecord = (index) => {
    if (records.length > 1) {
      setRecords(records.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const requesterSignature = user?.digitalSignature
        || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '');

      const employees = records.map((r) => ({
        name: String(r.name || '').trim(),
        cnic: String(r.cnic || '').trim(),
        designation: String(r.designation || '').trim(),
        departmentSubject: String(r.departmentSubject || '').trim(),
        project: String(r.project || '').trim(),
        location: String(r.location || '').trim(),
        currentPackageMonthly: String(r.currentPackageMonthly ?? '').trim(),
        tentativeDoj: r.tentativeDoj || null,
        remark: String(r.remark || '').trim()
      }));

      const payload = { employees, ...approvers, requesterSignature };
      if (editData) {
        await nonEmployeeService.updateRecord(editData._id, payload);
        toast.success('Record updated successfully');
      } else {
        await nonEmployeeService.createRecord(payload);
        toast.success(`Batch submitted with ${employees.length} candidate(s) to HOD HR`);
      }
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || (editData ? 'Failed to update record' : 'Failed to create records'));
      console.error(error);
    }
  };

  const cellSx = { py: 0.75, px: 0.75, verticalAlign: 'top' };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>{editData ? 'Edit New-Hiring Approval' : 'New-Hiring Approval'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={700}>
              Candidates recommended for hiring
            </Typography>
            <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addRecord}>
              Add Row
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={cellSx}><b>Name</b></TableCell>
                  <TableCell sx={cellSx}><b>CNIC/Passport No.</b></TableCell>
                  <TableCell sx={cellSx}><b>Designation</b></TableCell>
                  <TableCell sx={cellSx}><b>Department/Subject</b></TableCell>
                  <TableCell sx={cellSx}><b>Project</b></TableCell>
                  <TableCell sx={cellSx}><b>Location</b></TableCell>
                  <TableCell sx={cellSx} align="right"><b>Current Package Monthly</b></TableCell>
                  <TableCell sx={cellSx}><b>Tentative DOJ</b></TableCell>
                  <TableCell sx={cellSx}><b>Remark</b></TableCell>
                  <TableCell sx={cellSx} width={48} />
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Name"
                        value={record.name}
                        onChange={(e) => handleRecordChange(index, 'name', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="CNIC / Passport"
                        value={record.cnic}
                        onChange={(e) => handleRecordChange(index, 'cnic', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Designation"
                        value={record.designation}
                        onChange={(e) => handleRecordChange(index, 'designation', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Department / Subject"
                        value={record.departmentSubject}
                        onChange={(e) => handleRecordChange(index, 'departmentSubject', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Project"
                        value={record.project}
                        onChange={(e) => handleRecordChange(index, 'project', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Location"
                        value={record.location}
                        onChange={(e) => handleRecordChange(index, 'location', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="e.g. 80000 or As per negotiation"
                        value={record.currentPackageMonthly}
                        onChange={(e) => handleRecordChange(index, 'currentPackageMonthly', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        type="date"
                        InputLabelProps={{ shrink: true }}
                        value={record.tentativeDoj}
                        onChange={(e) => handleRecordChange(index, 'tentativeDoj', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="Remark"
                        value={record.remark}
                        onChange={(e) => handleRecordChange(index, 'remark', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={cellSx}>
                      {records.length > 1 && (
                        <IconButton color="error" size="small" onClick={() => removeRecord(index)} title="Remove row">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box mt={2}>
            <Typography variant="h6" gutterBottom>Approval Authorities</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="HOD HR"
                  fullWidth
                  select
                  value={approvers.assignedHod}
                  onChange={(e) => setApprovers({ ...approvers, assignedHod: e.target.value })}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {users.map(u => (
                    <MenuItem key={u.id || u._id} value={u.id || u._id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="AVP Taj Fahad Farid"
                  fullWidth
                  select
                  value={approvers.assignedAvp}
                  onChange={(e) => setApprovers({ ...approvers, assignedAvp: e.target.value })}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {users.map(u => (
                    <MenuItem key={u.id || u._id} value={u.id || u._id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Chairman Steering Committee"
                  fullWidth
                  select
                  value={approvers.assignedChairman}
                  onChange={(e) => setApprovers({ ...approvers, assignedChairman: e.target.value })}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {users.map(u => (
                    <MenuItem key={u.id || u._id} value={u.id || u._id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Sr Director Hamza Tanveer"
                  fullWidth
                  select
                  value={approvers.assignedSrDirector}
                  onChange={(e) => setApprovers({ ...approvers, assignedSrDirector: e.target.value })}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {users.map(u => (
                    <MenuItem key={u.id || u._id} value={u.id || u._id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">
            {editData ? 'Save Changes' : 'Submit'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default NonEmployeeForm;
