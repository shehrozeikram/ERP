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
  InputLabel,
  Card,
  CardContent,
  Grid,
  Divider,
  Avatar,
  Paper,
  alpha,
  useTheme
} from '@mui/material';
import {
  Search as SearchIcon,
  Send as SendIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  AccessTime as AccessTimeIcon,
  TrendingUp as TrendingUpIcon,
  Group as GroupIcon
} from '@mui/icons-material';
import { evaluationDocumentsService } from '../../../services/evaluationDocumentsService';
import DepartmentCard from './components/DepartmentCard';
import DocumentViewer from './components/DocumentViewer';
import { DashboardSkeleton } from './components/SkeletonLoader';
import EvaluationCharts from './components/EvaluationCharts';

const EvaluationDashboard = () => {
  const theme = useTheme();
  const [groupedData, setGroupedData] = useState([]);
  const [allDocumentsGrouped, setAllDocumentsGrouped] = useState([]); // All documents for public General Information
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
      // Backend now returns { filtered: [...], allDocuments: [...] }
      const responseData = response.data || {};
      if (responseData.filtered && responseData.allDocuments) {
        // New format: has both filtered and all documents
        setGroupedData(responseData.filtered);
        setAllDocumentsGrouped(responseData.allDocuments);
      } else {
        // Old format: just array of filtered documents (backward compatibility)
        setGroupedData(responseData.filtered || responseData || []);
        setAllDocumentsGrouped(responseData.allDocuments || responseData || []);
      }
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

  // Calculate statistics for chips (filtered for user's view)
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
      sent: statusCounts.sent || 0,
      inProgress: statusCounts.in_progress || 0,
      submitted: statusCounts.submitted || 0,
      completed: statusCounts.completed || 0
    };
  }, [filteredData]);

  // Calculate public general statistics from ALL documents (allDocumentsGrouped) for General Information section
  const publicStatistics = useMemo(() => {
    const dataSource = allDocumentsGrouped.length > 0 ? allDocumentsGrouped : groupedData;
    const totalDocs = dataSource.reduce((sum, group) => sum + group.documents.length, 0);
    const statusCounts = dataSource.reduce((acc, group) => {
      group.documents.forEach(doc => {
        acc[doc.status] = (acc[doc.status] || 0) + 1;
      });
      return acc;
    }, {});

    return {
      sent: statusCounts.sent || 0,
      submitted: statusCounts.submitted || 0,
      completed: statusCounts.completed || 0
    };
  }, [allDocumentsGrouped, groupedData]);

  // Calculate comprehensive statistics - using groupedData for public/general information
  // This shows ALL documents in the system, not filtered by user permissions
  const approvalStats = useMemo(() => {
    const levelCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const approverMap = new Map();
    const level0ApproverMap = new Map(); // All Level 0 approvers with their document counts
    const level0PendingApproverMap = new Map(); // Level 0 approvers holding pending documents
    const evaluatorMap = new Map(); // Evaluator statistics
    const departmentMap = new Map(); // Department statistics
    const projectMap = new Map(); // Project statistics
    const formTypeCounts = { blue_collar: 0, white_collar: 0 };
    const approvalStatusCounts = { pending: 0, in_progress: 0, approved: 0, rejected: 0 };
    const level0StatusCounts = { pending: 0, approved: 0, rejected: 0, not_required: 0 };
    const recentActivity = { sent: 0, submitted: 0, completed: 0 };
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Use allDocumentsGrouped (all documents, unfiltered) for public general information
    // This ensures everyone sees the same statistics
    const dataSource = allDocumentsGrouped.length > 0 ? allDocumentsGrouped : groupedData;
    dataSource.forEach(group => {
      group.documents.forEach(doc => {
        // Count by approval level
        if (doc.currentApprovalLevel !== null && doc.currentApprovalLevel !== undefined) {
          const level = doc.currentApprovalLevel;
          if (level >= 0 && level <= 4) {
            levelCounts[level] = (levelCounts[level] || 0) + 1;
          }
        }

        // Count ALL Level 0 approvers (not just pending)
        if (doc.level0Approvers && doc.level0Approvers.length > 0) {
          doc.level0Approvers.forEach(approver => {
            const approverName = approver.assignedUser 
              ? `${approver.assignedUser.firstName || ''} ${approver.assignedUser.lastName || ''}`.trim()
              : approver.approverName || 'Unknown';
            const approverId = approver.assignedUser?._id?.toString() || approver.assignedUser?.toString() || approverName;
            
            // Count all documents assigned to this Level 0 approver
            if (!level0ApproverMap.has(approverId)) {
              level0ApproverMap.set(approverId, { name: approverName, count: 0 });
            }
            level0ApproverMap.get(approverId).count += 1;

            // Count pending documents held by this Level 0 approver
            // Only count if document is at Level 0 and this approver's status is still pending
            if (doc.currentApprovalLevel === 0 && approver.status === 'pending') {
              if (!level0PendingApproverMap.has(approverId)) {
                level0PendingApproverMap.set(approverId, { name: approverName, count: 0 });
              }
              level0PendingApproverMap.get(approverId).count += 1;
            }
          });
        }

        // Count by approver (Level 0) - pending only for current approvers
        if (doc.currentApprovalLevel === 0 && doc.level0Approvers && doc.level0Approvers.length > 0) {
          doc.level0Approvers.forEach(approver => {
            if (approver.status === 'pending') {
              const approverName = approver.assignedUser 
                ? `${approver.assignedUser.firstName || ''} ${approver.assignedUser.lastName || ''}`.trim()
                : approver.approverName || 'Unknown';
              const count = approverMap.get(approverName) || 0;
              approverMap.set(approverName, count + 1);
            }
          });
        }

        // Count by approver (Level 1-4)
        if (doc.currentApprovalLevel >= 1 && doc.approvalLevels && doc.approvalLevels.length > 0) {
          const currentLevelEntry = doc.approvalLevels.find(level => 
            level.level === doc.currentApprovalLevel && level.status === 'pending'
          );
          if (currentLevelEntry) {
            const approverName = currentLevelEntry.approverName || 
              (currentLevelEntry.approver 
                ? `${currentLevelEntry.approver.firstName || ''} ${currentLevelEntry.approver.lastName || ''}`.trim()
                : 'Unknown');
            const count = approverMap.get(approverName) || 0;
            approverMap.set(approverName, count + 1);
          }
        }

        // Count evaluator statistics (sent vs submitted)
        if (doc.evaluator) {
          const evaluatorName = doc.evaluator.firstName && doc.evaluator.lastName
            ? `${doc.evaluator.firstName} ${doc.evaluator.lastName}`.trim()
            : doc.evaluator.name || 'Unknown';
          const evaluatorId = doc.evaluator._id?.toString() || doc.evaluator.toString() || evaluatorName;
          
          if (!evaluatorMap.has(evaluatorId)) {
            evaluatorMap.set(evaluatorId, {
              name: evaluatorName,
              sent: 0,
              submitted: 0
            });
          }
          
          const evaluatorStats = evaluatorMap.get(evaluatorId);
          if (doc.status === 'sent' || doc.status === 'in_progress' || doc.status === 'submitted' || doc.status === 'completed') {
            evaluatorStats.sent += 1;
          }
          if (doc.status === 'submitted' || doc.status === 'completed') {
            evaluatorStats.submitted += 1;
          }
        }

        // Count by form type
        if (doc.formType) {
          formTypeCounts[doc.formType] = (formTypeCounts[doc.formType] || 0) + 1;
        }

        // Count by approval status
        if (doc.approvalStatus) {
          approvalStatusCounts[doc.approvalStatus] = (approvalStatusCounts[doc.approvalStatus] || 0) + 1;
        }

        // Count by Level 0 approval status
        if (doc.level0ApprovalStatus) {
          level0StatusCounts[doc.level0ApprovalStatus] = (level0StatusCounts[doc.level0ApprovalStatus] || 0) + 1;
        }

        // Count by department
        if (doc.department) {
          const deptName = doc.department.name || 'Unknown Department';
          const deptId = doc.department._id?.toString() || deptName;
          if (!departmentMap.has(deptId)) {
            departmentMap.set(deptId, { name: deptName, count: 0 });
          }
          departmentMap.get(deptId).count += 1;
        }

        // Count by project
        if (doc.project) {
          const projectName = doc.project.name || 'Unknown Project';
          const projectId = doc.project._id?.toString() || projectName;
          if (!projectMap.has(projectId)) {
            projectMap.set(projectId, { name: projectName, count: 0 });
          }
          projectMap.get(projectId).count += 1;
        } else if (doc.employee?.placementProject) {
          const projectName = doc.employee.placementProject.name || 'Unknown Project';
          const projectId = doc.employee.placementProject._id?.toString() || projectName;
          if (!projectMap.has(projectId)) {
            projectMap.set(projectId, { name: projectName, count: 0 });
          }
          projectMap.get(projectId).count += 1;
        }

        // Recent activity (last 7 days)
        if (doc.sentAt && new Date(doc.sentAt) >= sevenDaysAgo) {
          recentActivity.sent += 1;
        }
        if (doc.submittedAt && new Date(doc.submittedAt) >= sevenDaysAgo) {
          recentActivity.submitted += 1;
        }
        if (doc.completedAt && new Date(doc.completedAt) >= sevenDaysAgo) {
          recentActivity.completed += 1;
        }
      });
    });

    // Convert approver map to sorted array
    const approverList = Array.from(approverMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Convert Level 0 approver map to sorted array
    const level0ApproverList = Array.from(level0ApproverMap.values())
      .sort((a, b) => b.count - a.count);

    // Convert Level 0 pending approver map to sorted array (approvers holding documents)
    const level0PendingApproverList = Array.from(level0PendingApproverMap.values())
      .sort((a, b) => b.count - a.count);

    // Convert evaluator map to sorted array
    const evaluatorList = Array.from(evaluatorMap.values())
      .filter(e => e.sent > 0) // Only show evaluators who have received documents
      .sort((a, b) => b.sent - a.sent);

    // Convert department map to sorted array
    const departmentList = Array.from(departmentMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 departments

    // Convert project map to sorted array
    const projectList = Array.from(projectMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 projects

    // Calculate performance metrics
    const totalSent = statistics.sent + statistics.in_progress + statistics.submitted + statistics.completed;
    const submissionRate = totalSent > 0 ? ((statistics.submitted + statistics.completed) / totalSent * 100).toFixed(1) : 0;
    const completionRate = statistics.submitted > 0 ? (statistics.completed / statistics.submitted * 100).toFixed(1) : 0;

    return {
      levelCounts,
      approverList,
      level0ApproverList,
      level0PendingApproverList,
      evaluatorList,
      formTypeCounts,
      approvalStatusCounts,
      level0StatusCounts,
      departmentList,
      projectList,
      recentActivity,
      submissionRate,
      completionRate
    };
  }, [allDocumentsGrouped, groupedData]); // Use allDocumentsGrouped for public general information

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

      {/* General Information Section - Always visible for all users - Compact Design */}
      <Card 
        sx={{ 
          mb: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          borderRadius: 2,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Box 
            display="flex" 
            alignItems="center" 
            mb={2}
            sx={{
              pb: 1.5,
              borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
            }}
          >
            <Avatar 
              sx={{ 
                mr: 1.5, 
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                width: 40,
                height: 40
              }}
            >
              <AssessmentIcon fontSize="small" />
            </Avatar>
            <Typography variant="h6" fontWeight="bold" color="primary">
              General Information
            </Typography>
          </Box>
            
            <Grid container spacing={2}>
              {/* Status Information - Compact */}
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.03)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                    borderRadius: 1.5,
                    height: '100%'
                  }}
                >
                  <Box display="flex" alignItems="center" mb={1.5}>
                    <SendIcon fontSize="small" sx={{ color: theme.palette.info.main, mr: 1 }} />
                    <Typography variant="body2" fontWeight="600" color="text.primary">
                      Status
                    </Typography>
                  </Box>
                  <Box display="flex" flexDirection="column" gap={1}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">Sent</Typography>
                      <Typography variant="body2" fontWeight="bold" color="info.main">
                        {publicStatistics.sent}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">Submitted</Typography>
                      <Typography variant="body2" fontWeight="bold" color="primary.main">
                        {publicStatistics.submitted}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption" color="text.secondary">Completed</Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {publicStatistics.completed}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {/* Approval Level Information - Compact */}
              <Grid item xs={12} sm={6} md={3}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.15)}`,
                    borderRadius: 1.5,
                    height: '100%'
                  }}
                >
                  <Box display="flex" alignItems="center" mb={1.5}>
                    <AssessmentIcon fontSize="small" sx={{ color: theme.palette.secondary.main, mr: 1 }} />
                    <Typography variant="body2" fontWeight="600" color="text.primary">
                      By Level
                    </Typography>
                  </Box>
                  <Box display="flex" flexDirection="column" gap={0.75}>
                    {[0, 1, 2, 3, 4].map(level => {
                      const count = approvalStats.levelCounts[level] || 0;
                      if (count === 0) return null;
                      const levelColor = level === 0 ? theme.palette.grey[600] : level <= 2 ? theme.palette.warning.main : theme.palette.info.main;
                      return (
                        <Box 
                          key={level} 
                          display="flex" 
                          justifyContent="space-between" 
                          alignItems="center"
                        >
                          <Chip 
                            label={`L${level}`} 
                            size="small" 
                            sx={{
                              bgcolor: alpha(levelColor, 0.1),
                              color: levelColor,
                              border: `1px solid ${alpha(levelColor, 0.3)}`,
                              fontWeight: 600,
                              height: 24,
                              fontSize: '0.7rem'
                            }}
                            variant="outlined"
                          />
                          <Typography variant="caption" fontWeight="bold" sx={{ color: levelColor }}>
                            {count}
                          </Typography>
                        </Box>
                      );
                    })}
                    {Object.values(approvalStats.levelCounts).every(count => count === 0) && (
                      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                        No documents
                      </Typography>
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Level 0 Approvers Information - Compact */}
              {approvalStats.level0ApproverList.length > 0 && (
                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.grey[500], 0.06)} 0%, ${alpha(theme.palette.grey[500], 0.02)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                      borderRadius: 1.5
                    }}
                  >
                    <Box display="flex" alignItems="center" mb={1.5}>
                      <PersonIcon fontSize="small" sx={{ color: theme.palette.grey[700], mr: 1 }} />
                      <Typography variant="body2" fontWeight="600" color="text.primary">
                        L0 Approvers
                      </Typography>
                    </Box>
                    <Box display="flex" flexWrap="wrap" gap={0.75}>
                      {approvalStats.level0ApproverList.slice(0, 6).map((approver, index) => (
                        <Chip
                          key={index}
                          label={`${approver.name}: ${approver.count}`}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.grey[500], 0.08),
                            border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                            fontWeight: 500,
                            fontSize: '0.7rem',
                            height: 24,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.grey[500], 0.12),
                            }
                          }}
                          variant="outlined"
                        />
                      ))}
                      {approvalStats.level0ApproverList.length > 6 && (
                        <Chip
                          label={`+${approvalStats.level0ApproverList.length - 6} more`}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.grey[500], 0.08),
                            border: `1px solid ${alpha(theme.palette.grey[500], 0.2)}`,
                            fontSize: '0.7rem',
                            height: 24
                          }}
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Level 0 Approvers Holding Pending Documents - Compact */}
              {approvalStats.level0PendingApproverList.length > 0 && (
                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.12)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
                      border: `2px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                      borderRadius: 1.5
                    }}
                  >
                    <Box display="flex" alignItems="center" mb={1}>
                      <AccessTimeIcon fontSize="small" sx={{ color: theme.palette.warning.dark, mr: 1 }} />
                      <Typography variant="body2" fontWeight="600" color="warning.dark">
                        L0 Pending
                      </Typography>
                    </Box>
                    <Box display="flex" flexWrap="wrap" gap={0.75}>
                      {approvalStats.level0PendingApproverList.slice(0, 6).map((approver, index) => (
                        <Chip
                          key={index}
                          label={`${approver.name}: ${approver.count}`}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.warning.main, 0.15),
                            border: `1.5px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                            color: theme.palette.warning.dark,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            height: 24,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.warning.main, 0.2),
                            }
                          }}
                          variant="outlined"
                        />
                      ))}
                      {approvalStats.level0PendingApproverList.length > 6 && (
                        <Chip
                          label={`+${approvalStats.level0PendingApproverList.length - 6}`}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.warning.main, 0.15),
                            border: `1.5px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                            color: theme.palette.warning.dark,
                            fontSize: '0.7rem',
                            height: 24
                          }}
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Pending Approvers Information - Compact */}
              {approvalStats.approverList.length > 0 && (
                <Grid item xs={12} sm={6} md={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      borderRadius: 1.5
                    }}
                  >
                    <Box display="flex" alignItems="center" mb={1.5}>
                      <PersonIcon fontSize="small" sx={{ color: theme.palette.primary.main, mr: 1 }} />
                      <Typography variant="body2" fontWeight="600" color="text.primary">
                        Pending Approvers
                      </Typography>
                    </Box>
                    <Box display="flex" flexWrap="wrap" gap={0.75}>
                      {approvalStats.approverList.slice(0, 6).map((approver, index) => (
                        <Chip
                          key={index}
                          label={`${approver.name}: ${approver.count}`}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            color: theme.palette.primary.dark,
                            fontWeight: 500,
                            fontSize: '0.7rem',
                            height: 24,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.12),
                            }
                          }}
                          variant="outlined"
                        />
                      ))}
                      {approvalStats.approverList.length > 6 && (
                        <Chip
                          label={`+${approvalStats.approverList.length - 6} more`}
                          size="small"
                          sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            fontSize: '0.7rem',
                            height: 24
                          }}
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Evaluator/Submitter Information - Compact */}
              {approvalStats.evaluatorList.length > 0 && (
                <Grid item xs={12}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                      borderRadius: 1.5
                    }}
                  >
                    <Box display="flex" alignItems="center" mb={1.5}>
                      <PersonIcon fontSize="small" sx={{ color: theme.palette.secondary.main, mr: 1 }} />
                      <Typography variant="body2" fontWeight="600" color="text.primary">
                        Evaluators/Submitters
                      </Typography>
                    </Box>
                    <Grid container spacing={1}>
                      {approvalStats.evaluatorList.slice(0, 6).map((evaluator, index) => (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              bgcolor: alpha(theme.palette.secondary.main, 0.05),
                              border: `1px solid ${alpha(theme.palette.secondary.main, 0.15)}`,
                              transition: 'all 0.2s',
                              '&:hover': {
                                bgcolor: alpha(theme.palette.secondary.main, 0.08),
                              }
                            }}
                          >
                            <Typography variant="caption" fontWeight="600" noWrap sx={{ display: 'block', mb: 0.5 }}>
                              {evaluator.name}
                            </Typography>
                            <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                              <Typography variant="caption" color="text.secondary">S:</Typography>
                              <Typography variant="caption" fontWeight="bold" color="secondary.main">
                                {evaluator.sent}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">| Sub:</Typography>
                              <Typography variant="caption" fontWeight="bold" color="success.main">
                                {evaluator.submitted}
                              </Typography>
                              {evaluator.sent > evaluator.submitted && (
                                <>
                                  <Typography variant="caption" color="text.secondary">| P:</Typography>
                                  <Typography variant="caption" fontWeight="bold" color="warning.main">
                                    {evaluator.sent - evaluator.submitted}
                                  </Typography>
                                </>
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                      {approvalStats.evaluatorList.length > 6 && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', mt: 0.5 }}>
                            +{approvalStats.evaluatorList.length - 6} more evaluators
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                </Grid>
              )}

              {/* Recent Activity (Last 7 Days) - Compact */}
              {(approvalStats.recentActivity.sent > 0 || 
                approvalStats.recentActivity.submitted > 0 || 
                approvalStats.recentActivity.completed > 0) && (
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)} 0%, ${alpha(theme.palette.info.main, 0.03)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                      borderRadius: 1.5,
                      height: '100%'
                    }}
                  >
                    <Box display="flex" alignItems="center" mb={1.5}>
                      <AccessTimeIcon fontSize="small" sx={{ color: theme.palette.info.main, mr: 1 }} />
                      <Typography variant="body2" fontWeight="600" color="text.primary">
                        Recent (7d)
                      </Typography>
                    </Box>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {approvalStats.recentActivity.sent > 0 && (
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">Sent</Typography>
                          <Typography variant="body2" fontWeight="bold" color="info.main">
                            {approvalStats.recentActivity.sent}
                          </Typography>
                        </Box>
                      )}
                      {approvalStats.recentActivity.submitted > 0 && (
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">Submitted</Typography>
                          <Typography variant="body2" fontWeight="bold" color="primary.main">
                            {approvalStats.recentActivity.submitted}
                          </Typography>
                        </Box>
                      )}
                      {approvalStats.recentActivity.completed > 0 && (
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">Completed</Typography>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {approvalStats.recentActivity.completed}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              )}

              {/* Top Departments & Projects - Compact Combined */}
              {(approvalStats.departmentList.length > 0 || approvalStats.projectList.length > 0) && (
                <Grid item xs={12} sm={6} md={3}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.03)} 100%)`,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                      borderRadius: 1.5,
                      height: '100%'
                    }}
                  >
                    <Box display="flex" alignItems="center" mb={1.5}>
                      <GroupIcon fontSize="small" sx={{ color: theme.palette.primary.main, mr: 1 }} />
                      <Typography variant="body2" fontWeight="600" color="text.primary">
                        Top Lists
                      </Typography>
                    </Box>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {approvalStats.departmentList.slice(0, 3).map((dept, index) => (
                        <Box key={`dept-${index}`} display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '60%' }}>
                            {dept.name}
                          </Typography>
                          <Typography variant="caption" fontWeight="bold" color="primary.main">
                            {dept.count}
                          </Typography>
                        </Box>
                      ))}
                      {approvalStats.projectList.slice(0, 2).map((project, index) => (
                        <Box key={`proj-${index}`} display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '60%' }}>
                            {project.name}
                          </Typography>
                          <Typography variant="caption" fontWeight="bold" color="secondary.main">
                            {project.count}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Paper>
                </Grid>
              )}

            </Grid>
          </CardContent>
        </Card>

      {/* Charts Section */}
      {filteredData.length > 0 && (
        <EvaluationCharts groupedData={filteredData} />
      )}

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

