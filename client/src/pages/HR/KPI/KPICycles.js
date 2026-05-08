import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  Chip,
  Checkbox,
  ListItemText,
  OutlinedInput,
  FormControl,
  InputLabel,
  Select,
  IconButton,
  Tooltip,
  Autocomplete,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  Add as AddIcon, 
  PlayArrow as PlayIcon, 
  People as PeopleIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Visibility as ViewIcon,
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import moment from 'moment';

const KPICycles = () => {
  const [cycles, setCycles] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [evaluators, setEvaluators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [activeCycle, setActiveCycle] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedEvaluator, setSelectedEvaluator] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    template: '',
    department: '',
    evaluator: '',
    type: 'quarterly',
    period: { startDate: '', endDate: '' }
  });

  const fetchData = async () => {
    try {
      const [cyclesRes, templatesRes, deptsRes, empRes, usersRes] = await Promise.allSettled([
        api.get('/kpi/cycles'),
        api.get('/kpi/templates'),
        api.get('/hr/departments'),
        api.get('/hr/employees'),
        api.get('/auth/users?limit=100')
      ]);

      const cyclesData = cyclesRes.status === 'fulfilled' ? cyclesRes.value.data?.data : [];
      const templatesData = templatesRes.status === 'fulfilled' ? templatesRes.value.data?.data : [];
      const deptsData = deptsRes.status === 'fulfilled' ? deptsRes.value.data?.data : [];
      const rawEmployees = empRes.status === 'fulfilled' ? empRes.value.data?.data : [];
      
      // Ensure unique employees by ID
      const uniqueEmployees = Array.from(new Map(rawEmployees.map(emp => [emp._id, emp])).values());
      
      let usersList = [];
      if (usersRes.status === 'fulfilled') {
        usersList = usersRes.value.data?.data?.users || [];
      }

      // Fallback: If usersList is empty (e.g. no permission), use employees who have a linked user
      if (usersList.length === 0) {
        usersList = uniqueEmployees
          .filter(emp => emp.user)
          .map(emp => ({
            _id: emp.user._id || emp.user,
            firstName: emp.firstName,
            lastName: emp.lastName,
            role: 'Staff'
          }));
      }

      setCycles(cyclesData);
      setTemplates(templatesData);
      setDepartments(deptsData);
      setEmployees(uniqueEmployees);
      setEvaluators(usersList);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group cycles by template
  const groupedCycles = useMemo(() => {
    const groups = {};
    cycles.forEach(cycle => {
      const templateId = cycle.template?._id || 'unassigned';
      const templateTitle = cycle.template?.title || 'No Template Assigned';
      if (!groups[templateId]) {
        groups[templateId] = { title: templateTitle, cycles: [] };
      }
      groups[templateId].cycles.push(cycle);
    });
    return groups;
  }, [cycles]);

  const handleSubmit = async () => {
    try {
      if (!formData.title || !formData.template || !formData.period.startDate || !formData.period.endDate) {
        toast.error('Please fill all required fields');
        return;
      }
      
      const payload = { ...formData };
      if (!payload.department) delete payload.department;

      if (isEditing) {
        await api.put(`/kpi/cycles/${currentId}`, payload);
        toast.success('Cycle updated successfully');
      } else {
        await api.post('/kpi/cycles', payload);
        toast.success('Cycle created successfully');
      }
      
      setOpenDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error saving cycle');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cycle? All associated evaluations will be removed.')) return;
    try {
      await api.delete(`/kpi/cycles/${id}`);
      toast.success('Cycle deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error deleting cycle');
    }
  };

  const handleEdit = (cycle) => {
    setIsEditing(true);
    setIsViewing(false);
    setCurrentId(cycle._id);
    setFormData({
      title: cycle.title,
      template: cycle.template?._id || cycle.template,
      department: cycle.department?._id || cycle.department || '',
      type: cycle.type,
      period: {
        startDate: moment(cycle.period.startDate).format('YYYY-MM-DD'),
        endDate: moment(cycle.period.endDate).format('YYYY-MM-DD')
      }
    });
    setOpenDialog(true);
  };

  const handleView = (cycle) => {
    setIsViewing(true);
    setIsEditing(false);
    setFormData({
      title: cycle.title,
      template: cycle.template?._id || cycle.template,
      department: cycle.department?._id || cycle.department || '',
      type: cycle.type,
      period: {
        startDate: moment(cycle.period.startDate).format('YYYY-MM-DD'),
        endDate: moment(cycle.period.endDate).format('YYYY-MM-DD')
      }
    });
    setOpenDialog(true);
  };

  const handleOpenAssign = (cycle) => {
    setActiveCycle(cycle);
    setSelectedEmployees(cycle.employees || []);
    setOpenAssignDialog(true);
  };

  const handleAssignEmployees = async () => {
    try {
      if (selectedEmployees.length === 0) {
        toast.error('Please select at least one employee');
        return;
      }
      await api.post(`/kpi/cycles/${activeCycle._id}/assign`, {
        employeeIds: selectedEmployees,
        evaluatorId: selectedEvaluator
      });
      toast.success('Employees assigned successfully');
      setOpenAssignDialog(false);
      setSelectedEvaluator('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error assigning employees');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Evaluation Cycles</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => {
            setIsEditing(false);
            setIsViewing(false);
            setFormData({ title: '', template: '', department: '', evaluator: '', type: 'quarterly', period: { startDate: '', endDate: '' } });
            setOpenDialog(true);
          }}
        >
          Initiate Cycle
        </Button>
      </Box>

      {Object.values(groupedCycles).length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">No evaluation cycles found. Initiate one to get started.</Typography>
        </Paper>
      ) : (
        Object.entries(groupedCycles).map(([templateId, group]) => (
          <Accordion key={templateId} defaultExpanded sx={{ mb: 2, borderRadius: '8px !important', overflow: 'hidden', boxShadow: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FolderIcon />
                <Typography variant="h6" sx={{ fontWeight: '600' }}>{group.title}</Typography>
                <Chip label={`${group.cycles.length} Cycles`} size="small" sx={{ bgcolor: 'white', color: 'primary.main', fontWeight: 'bold' }} />
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Cycle Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Period</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Participants</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.cycles.map((cycle) => (
                      <TableRow key={cycle._id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{cycle.title}</Typography>
                          <Typography variant="caption" color="textSecondary">{cycle.type}</Typography>
                        </TableCell>
                        <TableCell>
                          {moment(cycle.period.startDate).format('MMM D, YYYY')} - {moment(cycle.period.endDate).format('MMM D, YYYY')}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PeopleIcon fontSize="small" color="action" />
                            <Typography variant="body2">{cycle.employees?.length || 0} Employees</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={cycle.status} 
                            color={cycle.status === 'active' ? 'success' : 'default'} 
                            variant={cycle.status === 'active' ? 'filled' : 'outlined'}
                            sx={{ textTransform: 'capitalize' }} 
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Tooltip title="Assign Employees">
                              <IconButton size="small" color="secondary" onClick={() => handleOpenAssign(cycle)}><PeopleIcon /></IconButton>
                            </Tooltip>
                            <Tooltip title="View">
                              <IconButton size="small" color="info" onClick={() => handleView(cycle)}><ViewIcon /></IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" color="primary" onClick={() => handleEdit(cycle)}><EditIcon /></IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleDelete(cycle._id)}><DeleteIcon /></IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* CREATE/EDIT/VIEW CYCLE DIALOG */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {isViewing ? 'View KPI Cycle' : isEditing ? 'Edit KPI Cycle' : 'Initiate KPI Cycle'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Cycle Title" 
                required 
                disabled={isViewing}
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Start Date" 
                type="date"
                required 
                disabled={isViewing}
                InputLabelProps={{ shrink: true }}
                value={formData.period.startDate}
                onChange={(e) => setFormData({...formData, period: {...formData.period, startDate: e.target.value}})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="End Date" 
                type="date"
                required 
                disabled={isViewing}
                InputLabelProps={{ shrink: true }}
                value={formData.period.endDate}
                onChange={(e) => setFormData({...formData, period: {...formData.period, endDate: e.target.value}})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="Cycle Type" 
                select
                required
                disabled={isViewing}
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="biannual">Biannual</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
                <MenuItem value="project">Project-Based</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                fullWidth 
                label="KPI Template" 
                select
                required
                disabled={isViewing}
                value={formData.template}
                onChange={(e) => setFormData({...formData, template: e.target.value})}
              >
                {templates.map(t => (
                  <MenuItem key={t._id} value={t._id}>{t.title}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                disabled={isViewing}
                options={employees}
                getOptionLabel={(option) => option ? `${option.firstName} ${option.lastName} (${option.employeeId})` : ''}
                value={employees.find(e => e._id === formData.evaluator) || null}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, evaluator: newValue ? newValue._id : '' });
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Default Evaluator (Manager/HOD)" 
                    helperText="Search and select the manager who will perform reviews for this cycle."
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Target Department (Optional)" 
                select
                disabled={isViewing}
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                helperText={!isViewing && "Leave blank to assign employees from any department manually later."}
              >
                <MenuItem value=""><em>None (Manual Assignment)</em></MenuItem>
                {departments.map(d => (
                  <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            {isViewing ? 'Close' : 'Cancel'}
          </Button>
          {!isViewing && (
            <Button variant="contained" onClick={handleSubmit} startIcon={<SaveIcon />}>
              {isEditing ? 'Update Cycle' : 'Create Cycle'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ASSIGN EMPLOYEES DIALOG */}
      <Dialog open={openAssignDialog} onClose={() => setOpenAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Employees to Cycle</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Assign employees to <strong>{activeCycle?.title}</strong>. This will generate blank evaluation drafts for them to complete.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                size="small" 
                placeholder="Search name..." 
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField 
                fullWidth 
                size="small" 
                select 
                value={empDeptFilter}
                onChange={(e) => setEmpDeptFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">All Departments</MenuItem>
                {departments.map(d => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
          
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => { setEmpSearch(''); setEmpDeptFilter(''); }}>Clear Filters</Button>
            <Button size="small" variant="outlined" onClick={() => {
              const filteredIds = employees
                .filter(emp => {
                  const matchesSearch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(empSearch.toLowerCase());
                  const matchesDept = !empDeptFilter || emp.department === empDeptFilter || emp.department?._id === empDeptFilter;
                  return matchesSearch && matchesDept;
                })
                .map(e => e._id);
              setSelectedEmployees(prev => [...new Set([...prev, ...filteredIds])]);
            }}>Select All Filtered</Button>
            <Button size="small" color="error" onClick={() => setSelectedEmployees([])}>Clear Selection</Button>
          </Box>

          <FormControl fullWidth>
            <InputLabel>Select Employees</InputLabel>
            <Select
              multiple
              value={selectedEmployees}
              onChange={(e) => {
                const value = e.target.value;
                // Ensure unique values even if MUI glitches
                const uniqueValues = typeof value === 'string' ? value.split(',') : [...new Set(value)];
                setSelectedEmployees(uniqueValues);
              }}
              input={<OutlinedInput label="Select Employees" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const emp = employees.find(e => e._id === value);
                    return <Chip key={value} label={emp ? `${emp.firstName} ${emp.lastName}` : value} />;
                  })}
                </Box>
              )}
              MenuProps={{ PaperProps: { style: { maxHeight: 400 } } }}
            >
              {employees
                .filter(emp => {
                  const matchesSearch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(empSearch.toLowerCase());
                  const matchesDept = !empDeptFilter || emp.department === empDeptFilter || emp.department?._id === empDeptFilter;
                  return matchesSearch && matchesDept;
                })
                .map((emp) => (
                <MenuItem key={emp._id} value={emp._id}>
                  <Checkbox checked={selectedEmployees.indexOf(emp._id) > -1} />
                  <ListItemText 
                    primary={`${emp.firstName} ${emp.lastName}`} 
                    secondary={`${emp.position} | ${departments.find(d => d._id === (emp.department?._id || emp.department))?.name || 'No Dept'}`} 
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mt: 3 }}>
            <InputLabel>Designated Evaluator (Manager/HOD)</InputLabel>
            <Select
              value={selectedEvaluator}
              onChange={(e) => setSelectedEvaluator(e.target.value)}
              input={<OutlinedInput label="Designated Evaluator (Manager/HOD)" />}
            >
              <MenuItem value=""><em>Auto-detect from Employee Profile</em></MenuItem>
              {evaluators.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.firstName} {user.lastName} ({user.role})
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
              If left blank, the system will automatically assign the Manager listed on each employee's profile.
            </Typography>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssignDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignEmployees}>Confirm Assignment</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KPICycles;
