import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Alert,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { evaluationDocumentsService } from '../../../services/evaluationDocumentsService';
import DepartmentCard from './components/DepartmentCard';
import DocumentViewer from './components/DocumentViewer';
import { DashboardSkeleton } from './components/SkeletonLoader';

const EvaluationDashboard = () => {
  const [groupedData, setGroupedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState('');
  const [groupBy, setGroupBy] = useState('department');
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [assignedApprovalLevels, setAssignedApprovalLevels] = useState([]);

  // Fetch user's assigned approval levels
  const fetchAssignedLevels = useCallback(async () => {
    try {
      const response = await evaluationDocumentsService.getAssignedApprovalLevels();
      if (response.data?.success) {
        const levels = response.data.data.assignedLevels || [];
        setAssignedApprovalLevels(levels.map(l => l.level));
      }
    } catch (err) {
      console.error('Error fetching assigned approval levels:', err);
      // Don't show error, just set empty array (user might not have any assignments)
      setAssignedApprovalLevels([]);
    }
  }, []);


  // Fetch grouped documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (formTypeFilter) params.formType = formTypeFilter;
      if (groupBy) params.groupBy = groupBy;
      
      const response = await evaluationDocumentsService.getGroupedByDepartment(params);
      setGroupedData(response.data || []);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load evaluation documents');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, formTypeFilter, groupBy]);

  useEffect(() => {
    fetchAssignedLevels();
    fetchDocuments();
  }, [fetchAssignedLevels, fetchDocuments]);

  // Filter documents by search term
  const filteredData = useMemo(() => {
    let data = groupedData;

    // Apply search filter
    if (!searchTerm.trim()) return data;

    const search = searchTerm.toLowerCase();
    return data
      .map(group => ({
      ...group,
      documents: group.documents.filter(doc => {
        const employeeName = `${doc.employee?.firstName || ''} ${doc.employee?.lastName || ''}`.toLowerCase();
        const employeeId = (doc.employee?.employeeId || '').toLowerCase();
        const departmentName = (group.department?.name || '').toLowerCase();
        const projectName = (group.project?.name || '').toLowerCase();
        const hodName = group.hod ? `${group.hod.firstName} ${group.hod.lastName}`.toLowerCase() : '';
        
        return employeeName.includes(search) ||
          employeeId.includes(search) ||
          departmentName.includes(search) ||
          projectName.includes(search) ||
          hodName.includes(search);
      })
      }))
      .filter(group => group.documents.length > 0);
  }, [groupedData, searchTerm]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalDocs = filteredData.reduce((sum, group) => sum + group.documents.length, 0);
    const statusCounts = filteredData.reduce((acc, group) => {
      group.documents.forEach(doc => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
      });
      return acc;
    }, {});

    return {
      totalDepartments: filteredData.length,
      totalProjects: filteredData.length,
      totalGroups: filteredData.length,
      totalDocuments: totalDocs,
      draft: statusCounts.draft || 0,
      inProgress: statusCounts.in_progress || 0,
      submitted: statusCounts.submitted || 0,
      completed: statusCounts.completed || 0
    };
  }, [filteredData]);

  const handleViewDocument = useCallback((document) => {
    setSelectedDocument(document);
    setViewerOpen(true);
  }, []);

  const handleCloseViewer = useCallback(() => {
    setViewerOpen(false);
    setSelectedDocument(null);
  }, []);

  const handleDocumentUpdate = useCallback(() => {
    // Refresh documents after approval/rejection
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDeleteDepartment = useCallback((deletedDepartmentId) => {
    // Remove the deleted department from the list
    setGroupedData(prev => prev.filter(group => group.department?._id !== deletedDepartmentId));
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Evaluation & Appraisal Dashboard
      </Typography>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <TextField
          placeholder={`Search by employee, ${groupBy === 'project' ? 'project' : 'department'}, or HOD...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ flexGrow: 1, minWidth: 300 }}
        />
        
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="submitted">Submitted</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="archived">Archived</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Form Type</InputLabel>
          <Select
            value={formTypeFilter}
            onChange={(e) => setFormTypeFilter(e.target.value)}
            label="Form Type"
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="blue_collar">Blue Collar</MenuItem>
            <MenuItem value="white_collar">White Collar</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Group By</InputLabel>
          <Select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            label="Group By"
          >
            <MenuItem value="department">Department</MenuItem>
            <MenuItem value="project">Project</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Statistics */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <Chip
          label={`Total ${groupBy === 'project' ? 'Projects' : 'Departments'}: ${statistics.totalGroups}`}
          color="primary"
          variant="outlined"
        />
        <Chip
          label={`Total Documents: ${statistics.totalDocuments}`}
          color="secondary"
          variant="outlined"
        />
        <Chip
          label={`Draft: ${statistics.draft}`}
          color="default"
          variant="outlined"
        />
        <Chip
          label={`In Progress: ${statistics.inProgress}`}
          color="warning"
          variant="outlined"
        />
        <Chip
          label={`Submitted: ${statistics.submitted}`}
          color="info"
          variant="outlined"
        />
        <Chip
          label={`Completed: ${statistics.completed}`}
          color="success"
          variant="outlined"
        />
      </Box>

      {/* Department Cards */}
      {filteredData.length === 0 ? (
        <Alert severity="info">
          No evaluation documents found. Documents will appear here once they are created and submitted.
        </Alert>
      ) : (
        filteredData.map((group) => (
          <DepartmentCard
            key={group.project?._id || group.department?._id || 'no-group'}
            department={group.department}
            project={group.project}
            hod={group.hod}
            documents={group.documents}
            onViewDocument={handleViewDocument}
            onDocumentUpdate={handleDocumentUpdate}
            assignedApprovalLevels={assignedApprovalLevels}
            onDeleteDepartment={handleDeleteDepartment}
          />
        ))
      )}

      {/* Document Viewer Dialog */}
      {selectedDocument && (
        <DocumentViewer
          open={viewerOpen}
          document={selectedDocument}
          onClose={handleCloseViewer}
          canEdit={false}
          onDocumentUpdate={handleDocumentUpdate}
          assignedApprovalLevels={assignedApprovalLevels}
        />
      )}
    </Box>
  );
};

export default EvaluationDashboard;

