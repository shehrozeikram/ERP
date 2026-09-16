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
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import nonEmployeeService from '../../../services/nonEmployeeService';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NonEmployeeForm = ({ open, onClose, onSuccess, editData = null }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  
  const defaultRecord = {
    firstName: '',
    lastName: '',
    cnic: '',
    phone: '',
    address: '',
    role: 'Housemaid',
    expectedWages: '',
    justification: ''
  };

  const [records, setRecords] = useState([{ ...defaultRecord }]);
  const [approvers, setApprovers] = useState({
    assignedHod: '',
    assignedAvp: '',
    assignedChairman: ''
  });

  React.useEffect(() => {
    if (editData) {
      setRecords(editData.employees && editData.employees.length > 0 ? editData.employees : [{
        firstName: editData.firstName || '',
        lastName: editData.lastName || '',
        cnic: editData.cnic || '',
        phone: editData.phone || '',
        address: editData.address || '',
        role: editData.role || 'Housemaid',
        expectedWages: editData.expectedWages || '',
        justification: editData.justification || ''
      }]);
      setApprovers({
        assignedHod: editData.assignedHod?._id || editData.assignedHod || '',
        assignedAvp: editData.assignedAvp?._id || editData.assignedAvp || '',
        assignedChairman: editData.assignedChairman?._id || editData.assignedChairman || ''
      });
    } else {
      setRecords([{ ...defaultRecord }]);
      // Keep existing approver selections
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
          
          const avp = fetchedUsers.find(u => 
            u.position?.toLowerCase() === 'assistant vice president'
          );
          
          const chairman = fetchedUsers.find(u => 
            u.position?.toLowerCase() === 'chairman steering committee'
          );
          
          setApprovers(prev => ({
            ...prev,
            assignedHod: prev.assignedHod || (hod ? hod.id || hod._id : ''),
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
    const newRecords = [...records];
    newRecords[index][field] = value;
    setRecords(newRecords);
  };

  const addRecord = () => {
    setRecords([...records, { ...defaultRecord }]);
  };

  const removeRecord = (index) => {
    if (records.length > 1) {
      const newRecords = records.filter((_, i) => i !== index);
      setRecords(newRecords);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const requesterSignature = user?.digitalSignature || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || '');

      if (editData) {
        const payload = { employees: records, ...approvers, requesterSignature };
        await nonEmployeeService.updateRecord(editData._id, payload);
        toast.success('Record updated successfully');
      } else {
        const payload = { employees: records, ...approvers, requesterSignature };
        await nonEmployeeService.createRecord(payload);
        toast.success(`Successfully created batch record with ${records.length} employee(s) and submitted to HOD HR`);
      }
      onSuccess();
    } catch (error) {
      toast.error(editData ? 'Failed to update record' : 'Failed to create records');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editData ? 'Edit Non-Employee Record' : 'New Non-Employee Record'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          


          <Box mt={3} mb={1} display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Employees</Typography>
            {!editData && (
              <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addRecord}>
                Add Row
              </Button>
            )}
          </Box>

          {records.map((record, index) => (
            <Box key={index} sx={{ mb: 4, p: 2, border: '1px solid #e0e0e0', borderRadius: 2, position: 'relative' }}>
              {records.length > 1 && !editData && (
                <IconButton 
                  color="error" 
                  onClick={() => removeRecord(index)}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  <DeleteIcon />
                </IconButton>
              )}
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Record #{index + 1}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="First Name" 
                    fullWidth 
                    required 
                    value={record.firstName}
                    onChange={(e) => handleRecordChange(index, 'firstName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Last Name" 
                    fullWidth 
                    value={record.lastName}
                    onChange={(e) => handleRecordChange(index, 'lastName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="CNIC" 
                    fullWidth 
                    required 
                    value={record.cnic}
                    onChange={(e) => handleRecordChange(index, 'cnic', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Phone" 
                    fullWidth 
                    value={record.phone}
                    onChange={(e) => handleRecordChange(index, 'phone', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField 
                    label="Address" 
                    fullWidth 
                    multiline
                    rows={2}
                    value={record.address}
                    onChange={(e) => handleRecordChange(index, 'address', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Role" 
                    fullWidth 
                    required 
                    select
                    value={record.role}
                    onChange={(e) => handleRecordChange(index, 'role', e.target.value)}
                  >
                    <MenuItem value="Housemaid">Housemaid</MenuItem>
                    <MenuItem value="Security Guard">Security Guard</MenuItem>
                    <MenuItem value="Gardener">Gardener</MenuItem>
                    <MenuItem value="Other">Other</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField 
                    label="Expected Wages" 
                    type="number"
                    fullWidth 
                    value={record.expectedWages}
                    onChange={(e) => handleRecordChange(index, 'expectedWages', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField 
                    label="Justification / Remarks" 
                    fullWidth 
                    multiline
                    rows={3}
                    value={record.justification}
                    onChange={(e) => handleRecordChange(index, 'justification', e.target.value)}
                  />
                </Grid>
              </Grid>
            </Box>
          ))}

          <Box mt={2}>
            <Typography variant="h6" gutterBottom>Approval Authorities</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField 
                  label="HOD HR" 
                  fullWidth 
                  required 
                  select
                  value={approvers.assignedHod}
                  onChange={(e) => setApprovers({ ...approvers, assignedHod: e.target.value })}
                >
                  {users.map(u => (
                    <MenuItem key={u.id || u._id} value={u.id || u._id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField 
                  label="AVP Taj Fahad Farid" 
                  fullWidth 
                  required 
                  select
                  value={approvers.assignedAvp}
                  onChange={(e) => setApprovers({ ...approvers, assignedAvp: e.target.value })}
                >
                  {users.map(u => (
                    <MenuItem key={u.id || u._id} value={u.id || u._id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField 
                  label="Chairman Steering Committee" 
                  fullWidth 
                  required 
                  select
                  value={approvers.assignedChairman}
                  onChange={(e) => setApprovers({ ...approvers, assignedChairman: e.target.value })}
                >
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
          <Button type="submit" variant="contained" color="primary">{editData ? 'Save Changes' : 'Submit'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default NonEmployeeForm;
