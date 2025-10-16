import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Alert,
  TablePagination,
  TextField,
  InputAdornment,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  ArrowBack,
  Add,
  MoreVert,
  Visibility,
  VisibilityOff,
  Edit,
  Delete,
  Search,
  Security,
  Lock,
  LockOpen,
  Warning,
  Link,
  Person,
  CalendarToday,
  Category,
  Copy,
  ContentCopy
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

import { itService } from '../../services/itService';
import { PageLoading } from '../../components/LoadingSpinner';

const SecurityLevelChip = ({ level }) => {
  const getLevelColor = (level) => {
    switch (level) {
      case 'Critical': return 'error';
      case 'High': return 'warning';
      case 'Medium': return 'info';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  const getLevelIcon = (level) => {
    switch (level) {
      case 'Critical': return <Warning />;
      case 'High': return <Lock />;
      case 'Medium': return <Security />;
      case 'Low': return <LockOpen />;
      default: return <Security />;
    }
  };

  return (
    <Chip
      icon={getLevelIcon(level)}
      label={level}
      color={getLevelColor(level)}
      size="small"
      variant="filled"
    />
  );
};

const PasswordWallet = () => {
  const navigate = useNavigate();
  const { id: vendorId } = useParams();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPassword, setSelectedPassword] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [decryptedPassword, setDecryptedPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Fetch vendor info
  const { data: vendorData, isLoading: vendorLoading } = useQuery(
    ['it-vendor', vendorId],
    () => itService.getITVendor(vendorId),
    {
      onError: (error) => {
        toast.error('Failed to load vendor information');
        console.error('Vendor error:', error);
      }
    }
  );

  // Fetch passwords
  const { data: passwordsData, isLoading: passwordsLoading, error } = useQuery(
    ['vendor-passwords', vendorId],
    () => itService.getVendorPasswords(vendorId),
    {
      onError: (error) => {
        toast.error('Failed to load passwords');
        console.error('Passwords error:', error);
      }
    }
  );

  // Delete password mutation
  const deletePasswordMutation = useMutation(
    (passwordId) => itService.deletePassword(passwordId),
    {
      onSuccess: () => {
        toast.success('Password deleted successfully');
        queryClient.invalidateQueries(['vendor-passwords']);
        setDeleteDialog(false);
        setSelectedPassword(null);
      },
      onError: (error) => {
        toast.error('Failed to delete password');
        console.error('Delete error:', error);
      }
    }
  );

  // Decrypt password mutation
  const decryptPasswordMutation = useMutation(
    ({ passwordId, masterPassword }) => itService.decryptPassword(passwordId, masterPassword),
    {
      onSuccess: (data) => {
        setDecryptedPassword(data.data.password);
        setShowPassword(true);
        toast.success('Password decrypted successfully');
      },
      onError: (error) => {
        toast.error('Failed to decrypt password');
        console.error('Decrypt error:', error);
      }
    }
  );

  const passwords = passwordsData?.data || [];
  const vendor = vendorData?.data?.vendor;
  const isLoading = vendorLoading || passwordsLoading;

  // Filter passwords based on search term and category
  const filteredPasswords = passwords.filter(password => {
    const matchesSearch = password.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !categoryFilter || password.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Pagination
  const paginatedPasswords = filteredPasswords.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle search
  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  // Handle category filter
  const handleCategoryFilter = (event) => {
    setCategoryFilter(event.target.value);
    setPage(0);
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle menu actions
  const handleMenuOpen = (event, password) => {
    setAnchorEl(event.currentTarget);
    setSelectedPassword(password);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPassword(null);
  };

  // Handle delete confirmation
  const handleDelete = () => {
    if (selectedPassword) {
      deletePasswordMutation.mutate(selectedPassword._id);
    }
  };

  // Handle view password
  const handleViewPassword = () => {
    setViewDialog(true);
    handleMenuClose();
  };

  // Handle decrypt password
  const handleDecryptPassword = (masterPassword) => {
    if (selectedPassword && masterPassword) {
      decryptPasswordMutation.mutate({
        passwordId: selectedPassword._id,
        masterPassword
      });
    }
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Password categories
  const passwordCategories = [
    'Admin Panel',
    'Database Access',
    'Server Credentials',
    'API Keys',
    'VPN Access',
    'Cloud Services',
    'Email Account',
    'Software License',
    'Network Device',
    'Domain/DNS',
    'Payment Gateway',
    'Third Party Service',
    'Other'
  ];

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">
          Failed to load passwords. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center">
          <IconButton onClick={() => navigate('/it/vendors')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4" component="h1">
              Password Wallet
            </Typography>
            {vendor && (
              <Typography variant="subtitle1" color="text.secondary">
                {vendor.vendorName}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate(`/it/vendors/${vendorId}/passwords/new`)}
        >
          Add Password
        </Button>
      </Box>

      {/* Search and Stats */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            placeholder="Search passwords..."
            value={searchTerm}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              onChange={handleCategoryFilter}
              label="Category"
            >
              <MenuItem value="">All Categories</MenuItem>
              {passwordCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Password Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total Passwords
                  </Typography>
                  <Typography variant="h6">
                    {passwords.length}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    High Security
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {passwords.filter(p => p.securityLevel === 'High' || p.securityLevel === 'Critical').length}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Passwords Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Username</TableCell>
                  <TableCell>Security Level</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Expiry Date</TableCell>
                  <TableCell>Last Used</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedPasswords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Box py={4}>
                        <Security sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          No passwords found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {searchTerm || categoryFilter ? 'Try adjusting your search terms' : 'Add your first password to get started'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPasswords.map((password) => (
                    <TableRow key={password._id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {password.title}
                        </Typography>
                        {password.description && (
                          <Typography variant="caption" color="text.secondary">
                            {password.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={password.category}
                          size="small"
                          variant="outlined"
                          icon={<Category />}
                        />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Person sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {password.username}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <SecurityLevelChip level={password.securityLevel} />
                      </TableCell>
                      <TableCell>
                        {password.url ? (
                          <Tooltip title={password.url}>
                            <Box display="flex" alignItems="center" sx={{ cursor: 'pointer' }}>
                              <Link sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                              <Typography 
                                variant="body2" 
                                color="primary"
                                onClick={() => window.open(password.url, '_blank')}
                                sx={{ textDecoration: 'underline', cursor: 'pointer' }}
                              >
                                Open Link
                              </Typography>
                            </Box>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No URL
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {password.expiryDate ? (
                          <Box display="flex" alignItems="center">
                            <CalendarToday sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography 
                              variant="body2"
                              color={password.daysUntilExpiry < 30 ? 'warning.main' : 'text.primary'}
                            >
                              {format(new Date(password.expiryDate), 'MMM dd, yyyy')}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No expiry
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {password.lastUsed ? (
                          <Typography variant="body2">
                            {format(new Date(password.lastUsed), 'MMM dd, yyyy')}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Never used
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, password)}
                          size="small"
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredPasswords.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={handleViewPassword}
        >
          <Visibility sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem
          onClick={() => {
            navigate(`/it/passwords/${selectedPassword?._id}/edit`);
            handleMenuClose();
          }}
        >
          <Edit sx={{ mr: 1 }} />
          Edit Password
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteDialog(true);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete Password
        </MenuItem>
      </Menu>

      {/* View Password Dialog */}
      <Dialog open={viewDialog} onClose={() => setViewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Password Details</DialogTitle>
        <DialogContent>
          {selectedPassword && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    {selectedPassword.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {selectedPassword.description}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Username
                  </Typography>
                  <Box display="flex" alignItems="center">
                    <TextField
                      value={selectedPassword.username}
                      fullWidth
                      size="small"
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => handleCopyToClipboard(selectedPassword.username)}>
                              <ContentCopy />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Category
                  </Typography>
                  <Chip label={selectedPassword.category} size="small" />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Security Level
                  </Typography>
                  <SecurityLevelChip level={selectedPassword.securityLevel} />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Usage Count
                  </Typography>
                  <Typography variant="body2">
                    {selectedPassword.usageCount} times
                  </Typography>
                </Grid>

                {selectedPassword.url && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      URL
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="primary"
                      sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => window.open(selectedPassword.url, '_blank')}
                    >
                      {selectedPassword.url}
                    </Typography>
                  </Grid>
                )}

                {selectedPassword.expiryDate && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Expiry Date
                    </Typography>
                    <Typography 
                      variant="body2"
                      color={selectedPassword.daysUntilExpiry < 30 ? 'warning.main' : 'text.primary'}
                    >
                      {format(new Date(selectedPassword.expiryDate), 'MMM dd, yyyy')}
                      {selectedPassword.daysUntilExpiry < 30 && (
                        <Chip 
                          label={`${selectedPassword.daysUntilExpiry} days left`} 
                          size="small" 
                          color="warning" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                  </Grid>
                )}

                {selectedPassword.tags && selectedPassword.tags.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tags
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {selectedPassword.tags.map((tag, index) => (
                        <Chip key={index} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Grid>
                )}

                {selectedPassword.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body2">
                      {selectedPassword.notes}
                    </Typography>
                  </Grid>
                )}
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Password
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <TextField
                  value={decryptedPassword}
                  fullWidth
                  size="small"
                  type={showPassword ? 'text' : 'password'}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                        <IconButton onClick={() => handleCopyToClipboard(decryptedPassword)}>
                          <ContentCopy />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                {!showPassword && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const masterPassword = prompt('Enter master password:');
                      if (masterPassword) {
                        handleDecryptPassword(masterPassword);
                      }
                    }}
                    disabled={decryptPasswordMutation.isLoading}
                  >
                    {decryptPasswordMutation.isLoading ? 'Decrypting...' : 'Decrypt'}
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Password</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the password "{selectedPassword?.title}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={deletePasswordMutation.isLoading}
          >
            {deletePasswordMutation.isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PasswordWallet;
