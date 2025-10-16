import React, { useState, useEffect } from 'react';
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
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  alpha,
  useTheme,
  Avatar,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  AccountBalance as AccountBalanceIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

const JournalEntriesList = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  const fetchJournalEntries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/finance/journal-entries?limit=20&page=1');
      if (response.data.success) {
        setEntries(response.data.data.entries || []);
        setPagination(response.data.data.pagination || {});
      }
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      setError('Failed to fetch journal entries');
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentIcon = (department) => {
    const iconMap = {
      'hr': <PeopleIcon />,
      'admin': <AdminIcon />,
      'procurement': <ShoppingCartIcon />,
      'sales': <BusinessIcon />,
      'finance': <AccountBalanceIcon />,
      'audit': <SecurityIcon />,
      'general': <AccountBalanceIcon />
    };
    return iconMap[department] || <AccountBalanceIcon />;
  };

  const getDepartmentColor = (department) => {
    const colorMap = {
      'hr': 'primary',
      'admin': 'secondary',
      'procurement': 'warning',
      'sales': 'success',
      'finance': 'info',
      'audit': 'error',
      'general': 'default'
    };
    return colorMap[department] || 'default';
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'draft': 'warning',
      'posted': 'success',
      'reversed': 'error',
      'cancelled': 'default'
    };
    return colorMap[status] || 'default';
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Journal Entries...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              <AccountBalanceIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                Journal Entries
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Manage all journal entries and accounting transactions
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/finance/journal-entries/new')}
          >
            New Entry
          </Button>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Entries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {pagination.totalCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Posted Entries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                {entries.filter(entry => entry.status === 'posted').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Draft Entries
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                {entries.filter(entry => entry.status === 'draft').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Journal Entries Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Entry Number</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry._id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(entry.date)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {entry.entryNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {entry.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.department?.toUpperCase() || 'GENERAL'} 
                        size="small" 
                        color={getDepartmentColor(entry.department)}
                        icon={getDepartmentIcon(entry.department)}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="textSecondary">
                        {entry.module?.toUpperCase() || 'GENERAL'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {formatPKR(entry.totalDebits)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={entry.status?.toUpperCase() || 'DRAFT'} 
                        size="small" 
                        color={getStatusColor(entry.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            onClick={() => navigate(`/finance/journal-entries/${entry._id}`)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Entry">
                          <IconButton 
                            size="small" 
                            onClick={() => navigate(`/finance/journal-entries/${entry._id}/edit`)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {entries.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="textSecondary">
                No journal entries found
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Create your first journal entry to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/finance/journal-entries/new')}
              >
                Create First Entry
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default JournalEntriesList;
