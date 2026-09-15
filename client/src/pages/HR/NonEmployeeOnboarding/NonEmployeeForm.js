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
} from '@mui/material';
import nonEmployeeService from '../../../services/nonEmployeeService';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NonEmployeeForm = ({ open, onClose, onSuccess, editData = null }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    cnic: '',
    phone: '',
    address: '',
    role: 'Housemaid',
    expectedWages: '',
    justification: '',
    assignedHod: '',
    assignedAvp: '',
    requesterSignature: user?.digitalSignature || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || ''),
  });

  React.useEffect(() => {
    if (editData) {
      setFormData({
        firstName: editData.firstName || '',
        lastName: editData.lastName || '',
        cnic: editData.cnic || '',
        phone: editData.phone || '',
        address: editData.address || '',
        role: editData.role || 'Housemaid',
        expectedWages: editData.expectedWages || '',
        justification: editData.justification || '',
        assignedHod: editData.assignedHod?._id || editData.assignedHod || '',
        assignedAvp: editData.assignedAvp?._id || editData.assignedAvp || '',
        requesterSignature: editData.requesterSignature || user?.digitalSignature || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || ''),
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        cnic: '',
        phone: '',
        address: '',
        role: 'Housemaid',
        expectedWages: '',
        justification: '',
        assignedHod: '',
        assignedAvp: '',
        requesterSignature: user?.digitalSignature || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || ''),
      });
    }
  }, [editData, open, user]);

  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/auth/users', { params: { limit: 1000, active: true } });
        setUsers(res.data.data?.users || (Array.isArray(res.data.data) ? res.data.data : []));
      } catch (err) {
        console.error('Failed to fetch users', err);
      }
    };
    if (open) fetchUsers();
  }, [open]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editData) {
        await nonEmployeeService.updateRecord(editData._id, formData);
        toast.success('Record updated successfully');
      } else {
        await nonEmployeeService.createRecord(formData);
        toast.success('Record created and submitted to HOD HR');
      }
      onSuccess();
    } catch (error) {
      toast.error(editData ? 'Failed to update record' : 'Failed to create record');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editData ? 'Edit Non-Employee Record' : 'New Non-Employee Record'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="firstName" 
                label="First Name" 
                fullWidth 
                required 
                value={formData.firstName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="lastName" 
                label="Last Name" 
                fullWidth 
                value={formData.lastName}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="cnic" 
                label="CNIC" 
                fullWidth 
                required 
                value={formData.cnic}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="phone" 
                label="Phone" 
                fullWidth 
                value={formData.phone}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                name="address" 
                label="Address" 
                fullWidth 
                multiline
                rows={2}
                value={formData.address}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="role" 
                label="Role" 
                fullWidth 
                required 
                select
                value={formData.role}
                onChange={handleChange}
              >
                <MenuItem value="Housemaid">Housemaid</MenuItem>
                <MenuItem value="Security Guard">Security Guard</MenuItem>
                <MenuItem value="Gardener">Gardener</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="expectedWages" 
                label="Expected Wages" 
                type="number"
                fullWidth 
                value={formData.expectedWages}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                name="justification" 
                label="Justification / Remarks" 
                fullWidth 
                multiline
                rows={3}
                value={formData.justification}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="assignedHod" 
                label="HOD HR (Approval Authority)" 
                fullWidth 
                required 
                select
                value={formData.assignedHod}
                onChange={handleChange}
              >
                {users.map(u => (
                  <MenuItem key={u.id || u._id} value={u.id || u._id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                name="assignedAvp" 
                label="AVP Taj Fahad Farid (Approval Authority)" 
                fullWidth 
                required 
                select
                value={formData.assignedAvp}
                onChange={handleChange}
              >
                {users.map(u => (
                  <MenuItem key={u.id || u._id} value={u.id || u._id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
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
