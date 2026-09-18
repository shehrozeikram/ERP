import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, CircularProgress
} from '@mui/material';
import api from '../../services/authService';

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

const ManualSalaryForm = ({ open, onClose, onRefresh, editData }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    empId: '',
    name: '',
    designation: '',
    project: '',
    doj: '',
    basicSalary: 0,
    foodAllowance: 0,
    grossSalary: 0,
    incomeTax: 0,
    netPayable: 0,
    remarks: ''
  });

  useEffect(() => {
    if (editData) {
      setFormData({
        ...editData,
        basicSalary: editData.basicSalary || 0,
        houseRentAllowance: editData.houseRentAllowance || 0,
        medicalAllowance: editData.medicalAllowance || 0,
        conveyanceAllowance: editData.conveyanceAllowance || 0,
        vehicleAllowance: editData.vehicleAllowance || 0,
        fuelAllowance: editData.fuelAllowance || 0,
        foodAllowance: editData.foodAllowance || 0,
        specialAllowance: editData.specialAllowance || 0,
        otherAllowance: editData.otherAllowance || 0,
        grossSalary: editData.grossSalary || 0,
        incomeTax: editData.incomeTax || 0,
        netPayable: editData.netPayable || 0
      });
    } else {
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        empId: '',
        name: '',
        designation: '',
        project: '',
        doj: '',
        basicSalary: 0,
        houseRentAllowance: 0,
        medicalAllowance: 0,
        conveyanceAllowance: 0,
        vehicleAllowance: 0,
        fuelAllowance: 0,
        foodAllowance: 0,
        specialAllowance: 0,
        otherAllowance: 0,
        grossSalary: 0,
        incomeTax: 0,
        netPayable: 0,
        remarks: ''
      });
    }
  }, [editData, open]);

  // Auto-calculate grossSalary and netPayable
  useEffect(() => {
    const basic = Number(formData.basicSalary) || 0;
    const hr = Number(formData.houseRentAllowance) || 0;
    const med = Number(formData.medicalAllowance) || 0;
    const conv = Number(formData.conveyanceAllowance) || 0;
    const veh = Number(formData.vehicleAllowance) || 0;
    const fuel = Number(formData.fuelAllowance) || 0;
    const food = Number(formData.foodAllowance) || 0;
    const spec = Number(formData.specialAllowance) || 0;
    const oth = Number(formData.otherAllowance) || 0;
    const tax = Number(formData.incomeTax) || 0;
    
    const gross = basic + hr + med + conv + veh + fuel + food + spec + oth;
    
    setFormData(prev => ({
      ...prev,
      grossSalary: gross,
      netPayable: gross - tax
    }));
  }, [
    formData.basicSalary, formData.houseRentAllowance, formData.medicalAllowance,
    formData.conveyanceAllowance, formData.vehicleAllowance, formData.fuelAllowance,
    formData.foodAllowance, formData.specialAllowance, formData.otherAllowance,
    formData.incomeTax
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editData) {
        await api.put(`/hr/manual-salary/${editData._id}`, formData);
      } else {
        await api.post('/hr/manual-salary', formData);
      }
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error saving manual salary:', error);
      alert('Failed to save record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editData ? 'Edit' : 'Create'} Manual Salary Entry</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Month"
                name="month"
                value={formData.month}
                onChange={handleChange}
                SelectProps={{ native: true }}
                required
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="number"
                fullWidth
                label="Year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Emp ID"
                name="empId"
                value={formData.empId}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Designation"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Project"
                name="project"
                value={formData.project}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Joining"
                name="doj"
                placeholder="e.g. 01-Nov-23"
                value={formData.doj}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Remarks / Bank Acct"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12}>
              <hr />
              <strong>Financials</strong>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Basic Salary"
                name="basicSalary"
                value={formData.basicSalary}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="House Rent"
                name="houseRentAllowance"
                value={formData.houseRentAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Medical Allow."
                name="medicalAllowance"
                value={formData.medicalAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Conveyance Allow."
                name="conveyanceAllowance"
                value={formData.conveyanceAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Vehicle Allow."
                name="vehicleAllowance"
                value={formData.vehicleAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Fuel Allow."
                name="fuelAllowance"
                value={formData.fuelAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Food Allow."
                name="foodAllowance"
                value={formData.foodAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Special Allow."
                name="specialAllowance"
                value={formData.specialAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Other Allow."
                name="otherAllowance"
                value={formData.otherAllowance}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Gross Salary (Auto)"
                name="grossSalary"
                value={formData.grossSalary}
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Income Tax"
                name="incomeTax"
                value={formData.incomeTax}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                type="number"
                fullWidth
                label="Net Payable (Auto)"
                name="netPayable"
                value={formData.netPayable}
                disabled
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ManualSalaryForm;
