import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Avatar,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Link,
  Button
} from '@mui/material';
import {
  Description,
  CheckCircle,
  Schedule,
  Error,
  Archive,
  Send,
  Visibility,
  TrendingUp,
  Person
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import documentTrackingService from '../../services/documentTrackingService';
import evaluationTrackingService from '../../services/evaluationTrackingService';
import dayjs from 'dayjs';

// Stat Card Component
const StatCard = ({ title, value, subtitle, icon, color, onClick }) => (
  <Card 
    sx={{ 
      height: '100%', 
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': onClick ? {
        transform: 'translateY(-4px)',
        boxShadow: 4
      } : {}
    }}
    onClick={onClick}
  >
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={2}>
        <Avatar sx={{ bgcolor: color, color: 'white', width: 56, height: 56 }}>
          {icon}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const DocumentsTrackingDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentMovements, setRecentMovements] = useState([]);
  const [documentsWithMe, setDocumentsWithMe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [evaluationDocs, setEvaluationDocs] = useState([]);

  // Load dashboard data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load stats
      const statsResponse = await documentTrackingService.getDashboardStats();
      setStats(statsResponse.data);

      // Load recent movements
      const movementsResponse = await documentTrackingService.getMyMovements({ limit: 10 });
      setRecentMovements(movementsResponse.data || []);

      // Load documents with me
      const myDocsResponse = await documentTrackingService.getDocuments({
        currentHolder: currentUser?.id,
        limit: 10
      });
      setDocumentsWithMe(myDocsResponse.data || []);

      // Load evaluation tracking
      const evaluationResponse = await evaluationTrackingService.getAll();
      setEvaluationDocs(evaluationResponse.data || []);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  // Status distribution data for chart
  const statusDistribution = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Registered', value: stats.registered || 0, color: '#9e9e9e' },
      { name: 'In Review', value: stats.inReview || 0, color: '#2196f3' },
      { name: 'In Approval', value: stats.inApproval || 0, color: '#ff9800' },
      { name: 'Sent', value: stats.sent || 0, color: '#1976d2' },
      { name: 'Completed', value: stats.completed || 0, color: '#4caf50' },
      { name: 'Archived', value: stats.archived || 0, color: '#9c27b0' },
      { name: 'Missing', value: stats.missing || 0, color: '#f44336' }
    ].filter(item => item.value > 0);
  }, [stats]);

  // Format date
  const formatDate = (date) => {
    if (!date) return '—';
    return dayjs(date).format('DD-MMM-YYYY HH:mm');
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'Registered': 'default',
      'In Review': 'info',
      'In Approval': 'warning',
      'Sent': 'primary',
      'Completed': 'success',
      'Archived': 'secondary',
      'Missing': 'error'
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Documents Tracking Dashboard
          </Typography>
          <Typography color="text.secondary">
            Overview of document management and tracking
          </Typography>
        </Box>
        <Tooltip title="View All Documents">
          <IconButton 
            color="primary" 
            onClick={() => navigate('/documents-tracking')}
            sx={{ bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
          >
            <Visibility />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Documents"
            value={stats?.total || 0}
            subtitle={`${stats?.withMe || 0} with me`}
            icon={<Description />}
            color="primary.main"
            onClick={() => navigate('/documents-tracking')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="In Progress"
            value={(stats?.inReview || 0) + (stats?.inApproval || 0) + (stats?.sent || 0)}
            subtitle="Active documents"
            icon={<Schedule />}
            color="info.main"
            onClick={() => navigate('/documents-tracking?status=In Review')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed"
            value={stats?.completed || 0}
            subtitle={`${stats?.archived || 0} archived`}
            icon={<CheckCircle />}
            color="success.main"
            onClick={() => navigate('/documents-tracking?status=Completed')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Overdue"
            value={stats?.overdue || 0}
            subtitle={`${stats?.missing || 0} missing`}
            icon={<Error />}
            color="error.main"
            onClick={() => navigate('/documents-tracking?status=Missing')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Evaluation Docs"
            value={evaluationDocs.length}
            subtitle={`${evaluationDocs.filter(doc => doc.status !== 'completed').length} active`}
            icon={<Person />}
            color="secondary.main"
            onClick={() => navigate('/documents-tracking/evaluation')}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Status Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status Distribution
              </Typography>
              <Box sx={{ mt: 2 }}>
                {statusDistribution.length > 0 ? (
                  <Stack spacing={1}>
                    {statusDistribution.map((item) => (
                      <Box key={item.name}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="body2">{item.name}</Typography>
                          <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                        </Stack>
                        <Box
                          sx={{
                            height: 8,
                            bgcolor: 'grey.200',
                            borderRadius: 1,
                            overflow: 'hidden'
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: `${(item.value / (stats?.total || 1)) * 100}%`,
                              bgcolor: item.color,
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    No documents found
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Documents With Me */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  Documents With Me
                </Typography>
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => navigate('/documents-tracking?currentHolder=' + currentUser?.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  View All
                </Link>
              </Stack>
              {documentsWithMe.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tracking ID</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {documentsWithMe.slice(0, 5).map((doc) => (
                        <TableRow 
                          key={doc._id} 
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => navigate('/documents-tracking')}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {doc.trackingId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {doc.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={doc.status}
                              size="small"
                              color={getStatusColor(doc.status)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No documents with you
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Evaluation Documents */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  Evaluation & Appraisal Documents
                </Typography>
                <Button variant="text" onClick={() => navigate('/documents-tracking/evaluation')}>
                  View All
                </Button>
              </Stack>
              {evaluationDocs.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No evaluation documents found
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Current Holder</TableCell>
                        <TableCell>Updated</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {evaluationDocs.slice(0, 5).map(doc => (
                        <TableRow key={doc._id} hover>
                          <TableCell>
                            <Typography fontWeight={600}>{doc.employeeName || '—'}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {doc.formType === 'blue_collar' ? 'Blue Collar' : 'White Collar'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={doc.status === 'completed' ? 'success' : doc.status === 'rejected' ? 'error' : 'warning'}
                              label={doc.status?.replace('_', ' ').toUpperCase()}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {doc.currentHolder?.name || 'System'}
                            </Typography>
                            {doc.currentHolder?.designation && (
                              <Typography variant="caption" color="text.secondary">{doc.currentHolder.designation}</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {dayjs(doc.updatedAt).format('DD MMM YYYY')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Movements */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Movements
              </Typography>
              {recentMovements.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Document</TableCell>
                        <TableCell>From</TableCell>
                        <TableCell>To</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentMovements.map((movement) => (
                        <TableRow key={movement._id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {movement.document?.trackingId || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {movement.document?.name || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {movement.fromUser ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Person fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {movement.fromUser.firstName} {movement.fromUser.lastName}
                                </Typography>
                              </Stack>
                            ) : (
                              '—'
                            )}
                            {movement.fromDepartment && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {movement.fromDepartment.name}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {movement.toUser ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Person fontSize="small" color="action" />
                                <Typography variant="body2">
                                  {movement.toUser.firstName} {movement.toUser.lastName}
                                </Typography>
                              </Stack>
                            ) : (
                              '—'
                            )}
                            {movement.toDepartment && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {movement.toDepartment.name}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {movement.reason}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={movement.statusAfter}
                              size="small"
                              color={getStatusColor(movement.statusAfter)}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(movement.timestamp)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No recent movements
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DocumentsTrackingDashboard;


