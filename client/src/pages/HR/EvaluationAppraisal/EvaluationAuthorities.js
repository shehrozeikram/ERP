import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Alert,
  Chip,
  Tabs,
  Tab,
  Button,
  Skeleton
} from '@mui/material';
import { Search as SearchIcon, Send as SendIcon } from '@mui/icons-material';
import api from '../../../services/api';
import AuthorityStatsCards from './components/AuthorityStatsCards';
import AuthorityTable from './components/AuthorityTable';
import SendDocumentsDialog from './components/SendDocumentsDialog';
import DesignationSummary from './components/DesignationSummary';
import { filterByDesignation, filterBySearch, DESIGNATION_FILTERS } from './utils/employeeFilters';
import { TableSkeleton } from './components/SkeletonLoader';
import Level0AuthoritiesManager from './components/Level0AuthoritiesManager';

const EvaluationAuthorities = () => {
  const [allEmployees, setAllEmployees] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [designationSummary, setDesignationSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [designationLoading, setDesignationLoading] = useState(true);
  const [error, setError] = useState(null);
  const [designationError, setDesignationError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  // Fetch all employees
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/hr/employees?getAll=true');
      const result = response.data;
      
      if (result.success) {
        setAllEmployees(result.data || []);
      } else {
        setError(result.message || 'Failed to fetch employees');
        setAllEmployees([]);
      }
    } catch (error) {
      setError('Failed to connect to server');
      setAllEmployees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDesignations = useCallback(async () => {
    try {
      setDesignationLoading(true);
      setDesignationError(null);

      const response = await api.get('/hr/employees/designations/test?includeSamples=false&sampleLimit=0');
      const result = response.data;

      if (result.success) {
        setDesignations(result.data || []);
        setDesignationSummary(result.summary || null);
      } else {
        setDesignationError(result.message || 'Failed to fetch designations');
        setDesignations([]);
        setDesignationSummary(null);
      }
    } catch (error) {
      setDesignationError('Failed to load designation list');
      setDesignations([]);
      setDesignationSummary(null);
    } finally {
      setDesignationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchDesignations();
  }, [fetchEmployees, fetchDesignations]);

  // Get employees based on active tab
  const getEmployeesByTab = useMemo(() => {
    const filterConfig = activeTab === 0 ? DESIGNATION_FILTERS.HOD : DESIGNATION_FILTERS.LINE_MANAGER;
    return filterByDesignation(allEmployees, filterConfig.include, filterConfig.exclude);
  }, [allEmployees, activeTab]);

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    return filterBySearch(getEmployeesByTab, searchTerm);
  }, [getEmployeesByTab, searchTerm]);

  const currentLabel = useMemo(() => {
    if (activeTab === 0) return 'HOD';
    return 'Manager';
  }, [activeTab]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
        <Box display="flex" gap={2} mb={3}>
          <Skeleton variant="rectangular" width={120} height={36} sx={{ borderRadius: 2 }} />
          <Skeleton variant="rectangular" width={150} height={36} sx={{ borderRadius: 1 }} />
        </Box>
        <TableSkeleton rows={8} columns={5} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600 }}>
          Evaluation & Appraisal - Authorities
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            label={`${filteredEmployees.length} ${currentLabel}${filteredEmployees.length !== 1 ? 's' : ''}`}
            color="primary"
            sx={{ fontSize: '1rem', height: '36px' }}
          />
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setSendDialogOpen(true)}
            disabled={filteredEmployees.length === 0}
          >
            Send Documents
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="HOD (Head of Department)" />
        <Tab label="Managers & Above" />
        <Tab label="Level 0 Approvers" />
      </Tabs>

      {activeTab === 2 ? (
        <Level0AuthoritiesManager />
      ) : (
        <>
          {/* Statistics Cards */}
          <AuthorityStatsCards employees={filteredEmployees} label={currentLabel} />

          {/* Search Bar */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search by name, employee ID, department, or designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ bgcolor: 'background.paper' }}
            />
          </Box>

          {/* Employees Table */}
          <AuthorityTable
            employees={filteredEmployees}
            searchTerm={searchTerm}
            label={currentLabel}
          />

          {/* Designation Summary */}
          <Box sx={{ mt: 4 }}>
            <DesignationSummary
              loading={designationLoading}
              error={designationError}
              designations={designations}
              summary={designationSummary}
            />
          </Box>

          {/* Send Documents Dialog */}
          <SendDocumentsDialog
            open={sendDialogOpen}
            onClose={() => setSendDialogOpen(false)}
            evaluators={filteredEmployees}
          />
        </>
      )}
    </Box>
  );
};

export default EvaluationAuthorities;

