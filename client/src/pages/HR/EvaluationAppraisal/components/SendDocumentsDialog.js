import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Stack,
  Tooltip,
  TextField
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  PlaylistAddCheck as SelectAllIcon
} from '@mui/icons-material';
import { evaluationDocumentsService } from '../../../../services/evaluationDocumentsService';
import api from '../../../../services/api';

const SendDocumentsDialog = ({ open, onClose, evaluators = [] }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedEvaluators, setSelectedEvaluators] = useState([]);
  const [formType, setFormType] = useState('blue_collar');
  const [sendAllHODs, setSendAllHODs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [evaluatorDepartmentFilter, setEvaluatorDepartmentFilter] = useState('');

  // Fetch employees when dialog opens
  React.useEffect(() => {
    if (open) {
      const fetchEmployees = async () => {
        try {
          const response = await api.get('/hr/employees?getAll=true');
          if (response.data.success) {
            setEmployees(response.data.data || []);
          }
        } catch (err) {
          console.error('Error fetching employees:', err);
        }
      };
      fetchEmployees();
    }
  }, [open]);

  // Filter employees (exclude evaluators)
  const availableEmployees = useMemo(() => {
    const evaluatorIds = new Set(evaluators.map(e => e._id));
    return employees.filter(emp => !evaluatorIds.has(emp._id));
  }, [employees, evaluators]);
  const filteredEvaluators = useMemo(() => {
    if (!evaluatorDepartmentFilter) return evaluators;
    return evaluators.filter(e => (e.placementDepartment?._id || 'no-dept') === evaluatorDepartmentFilter);
  }, [evaluators, evaluatorDepartmentFilter]);

  const groupedEmployees = useMemo(() => {
    const map = new Map();
    availableEmployees
      .filter(emp => {
        if (!employeeSearch.trim()) return true;
        const term = employeeSearch.toLowerCase();
        const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
        const empId = (emp.employeeId || '').toLowerCase();
        return name.includes(term) || empId.includes(term);
      })
      .forEach(emp => {
        const deptId = emp.placementDepartment?._id || 'no-dept';
        if (!map.has(deptId)) {
          map.set(deptId, {
            id: deptId,
            name: emp.placementDepartment?.name || 'No Department',
            employees: []
          });
        }
        map.get(deptId).employees.push(emp);
      });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableEmployees, employeeSearch]);

  const isEmployeeSelected = (id) => selectedEmployees.some(emp => emp._id === id);

  const toggleEmployee = (employee) => {
    setSelectedEmployees((prev) => {
      const exists = prev.some(emp => emp._id === employee._id);
      if (exists) {
        return prev.filter(emp => emp._id !== employee._id);
      }
      return [...prev, employee];
    });
  };

  const selectDepartmentEmployees = (dept, shouldSelect) => {
    setSelectedEmployees((prev) => {
      if (!shouldSelect) {
        return prev.filter(emp => !dept.employees.some(dEmp => dEmp._id === emp._id));
      }
      const ids = new Set(prev.map(emp => emp._id));
      const merged = [...prev];
      dept.employees.forEach(emp => {
        if (!ids.has(emp._id)) {
          merged.push(emp);
        }
      });
      return merged;
    });
  };

  const handleSend = async () => {
    if (selectedEmployees.length === 0) {
      setError('Please select at least one employee');
      return;
    }

    if (!sendAllHODs && selectedEvaluators.length === 0) {
      setError('Please select at least one evaluator or choose "Send to All HODs"');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const employeeIds = selectedEmployees.map(emp => emp._id);
      let evaluatorIds = [];

      if (sendAllHODs) {
        // Get all HODs from evaluators
        evaluatorIds = evaluators
          .filter(e => e.placementDesignation?.title?.toLowerCase().includes('hod') || 
                      e.placementDesignation?.title?.toLowerCase().includes('head of department'))
          .map(e => e._id);
      } else {
        evaluatorIds = selectedEvaluators.map(e => e._id);
      }

      if (evaluatorIds.length === 0) {
        setError('No evaluators found. Please select evaluators or ensure HODs are available.');
        setLoading(false);
        return;
      }

      const response = await evaluationDocumentsService.sendDocuments({
        employeeIds,
        evaluatorIds,
        formType
      });

      if (response.data.success) {
        const successCount = response.data.results.filter(r => r.emailSent).length;
        setSuccess(`Successfully sent ${successCount} evaluation document(s) to ${evaluatorIds.length} evaluator(s)`);
        
        // Reset form after delay
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setError('Failed to send some documents. Please check the results.');
      }
    } catch (err) {
      console.error('Error sending documents:', err);
      setError(err.response?.data?.error || 'Failed to send evaluation documents');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedEmployees([]);
    setSelectedEvaluators([]);
    setFormType('blue_collar');
    setSendAllHODs(false);
    setEmployeeSearch('');
    setEvaluatorDepartmentFilter('');
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Send Evaluation Documents</Typography>
          <Button onClick={handleClose} size="small">
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Form Type Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="form-type-select-label">Form Type</InputLabel>
          <Select
            labelId="form-type-select-label"
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            label="Form Type"
          >
            <MenuItem value="blue_collar">Blue Collar</MenuItem>
            <MenuItem value="white_collar">White Collar</MenuItem>
          </Select>
        </FormControl>

        <Divider sx={{ my: 2 }} />

        {/* Employee Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            Select Employees to Evaluate
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="Search employees by name or ID..."
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            {groupedEmployees.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No employees match the criteria
              </Typography>
            ) : (
              groupedEmployees.map((dept) => {
                const allSelected = dept.employees.every(emp => isEmployeeSelected(emp._id));
                return (
                  <Accordion key={dept.id} disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Typography fontWeight={600}>
                          {dept.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="small"
                            label={`${dept.employees.length} employee(s)`}
                          />
                          <Tooltip title={allSelected ? 'Deselect all' : 'Select entire department'}>
                            <IconButton
                              size="small"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectDepartmentEmployees(dept, !allSelected);
                              }}
                            >
                              <SelectAllIcon fontSize="small" color={allSelected ? 'success' : 'action'} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Stack spacing={1}>
                        {dept.employees.map(emp => (
                          <Box key={emp._id} sx={{ display: 'flex', alignItems: 'center' }}>
                            <Checkbox
                              checked={isEmployeeSelected(emp._id)}
                              onChange={() => toggleEmployee(emp)}
                            />
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {emp.firstName} {emp.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID: {emp.employeeId || '—'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Stack>
                    </AccordionDetails>
                  </Accordion>
                );
              })
            )}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Selected: {selectedEmployees.length} employee(s)
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Evaluator Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>
            Select Evaluators
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel id="hod-select-label">Send to All HODs</InputLabel>
              <Select
                labelId="hod-select-label"
                value={sendAllHODs ? 'yes' : 'no'}
                onChange={(e) => setSendAllHODs(e.target.value === 'yes')}
                label="Send to All HODs"
              >
                <MenuItem value="no">No - Select Specific Evaluators</MenuItem>
                <MenuItem value="yes">Yes - Send to All HODs</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {!sendAllHODs && (
            <>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel id="evaluator-dept-filter">Filter by Department</InputLabel>
                <Select
                  labelId="evaluator-dept-filter"
                  value={evaluatorDepartmentFilter}
                  label="Filter by Department"
                  onChange={(e) => setEvaluatorDepartmentFilter(e.target.value)}
                >
                  <MenuItem value="">All Departments</MenuItem>
                  {Array.from(
                    new Map(
                      evaluators.map(e => [e.placementDepartment?._id || 'no-dept', e.placementDepartment?.name || 'No Department'])
                    ).entries()
                  ).map(([id, name]) => (
                    <MenuItem key={id} value={id}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel id="evaluators-select-label">Select Evaluators</InputLabel>
                <Select
                  labelId="evaluators-select-label"
                  multiple
                  value={selectedEvaluators}
                  onChange={(e) => setSelectedEvaluators(e.target.value)}
                  label="Select Evaluators"
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((evaluator) => (
                        <Chip
                          key={evaluator._id}
                          label={`${evaluator.firstName} ${evaluator.lastName}`}
                          size="small"
                        />
                      ))}
                    </Box>
                  )}
                >
                  {filteredEvaluators.map((evaluator) => (
                    <MenuItem key={evaluator._id} value={evaluator}>
                      <Checkbox checked={selectedEvaluators.some(e => e._id === evaluator._id)} />
                      <ListItemText
                        primary={`${evaluator.firstName} ${evaluator.lastName}`}
                        secondary={`${evaluator.placementDepartment?.name || 'No Department'} | ${evaluator.email || 'No Email'}`}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {sendAllHODs 
              ? `Will send to all ${evaluators.filter(e => e.placementDesignation?.title?.toLowerCase().includes('hod') || e.placementDesignation?.title?.toLowerCase().includes('head of department')).length} HOD(s)`
              : `Selected: ${selectedEvaluators.length} evaluator(s)`
            }
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSend}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          disabled={loading || selectedEmployees.length === 0 || (!sendAllHODs && selectedEvaluators.length === 0)}
        >
          {loading ? 'Sending...' : 'Send Documents'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SendDocumentsDialog;

