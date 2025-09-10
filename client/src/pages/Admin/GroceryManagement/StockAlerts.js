import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Grid
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Inventory as InventoryIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import groceryService from '../../../services/groceryService';

const StockAlerts = () => {
  const navigate = useNavigate();
  const [lowStockItems, setLowStockItems] = useState([]);
  const [expiredItems, setExpiredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStockAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch low stock items
      const lowStockResponse = await groceryService.getLowStockItems();

      // Fetch expired items
      const expiredResponse = await groceryService.getExpiredItems();

      setLowStockItems(lowStockResponse.data || []);
      setExpiredItems(expiredResponse.data || []);

    } catch (err) {
      setError('Failed to fetch stock alerts');
      console.error('Error fetching stock alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockAlerts();
  }, [fetchStockAlerts]);

  const getStockStatusColor = (currentStock, minStockLevel) => {
    const percentage = (currentStock / minStockLevel) * 100;
    if (percentage <= 20) return 'error';
    if (percentage <= 50) return 'warning';
    return 'success';
  };

  const getStockStatusText = (currentStock, minStockLevel) => {
    const percentage = (currentStock / minStockLevel) * 100;
    if (percentage <= 20) return 'Critical';
    if (percentage <= 50) return 'Low';
    return 'Adequate';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 7 && daysUntilExpiry >= 0;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading stock alerts...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Stock Alerts
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchStockAlerts} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            onClick={() => navigate('/admin/groceries')}
          >
            Back to Groceries
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Low Stock Items */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <WarningIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6" component="h2">
                  Low Stock Items ({lowStockItems.length})
                </Typography>
              </Box>
              
              {lowStockItems.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={3}>
                  No low stock items found. All items are well stocked!
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Current Stock</TableCell>
                        <TableCell>Min Level</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {lowStockItems.map((item) => (
                        <TableRow key={item._id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.itemId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {item.currentStock || 0} {item.unit || 'units'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {item.minStockLevel || 0} {item.unit || 'units'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStockStatusText(item.currentStock, item.minStockLevel)}
                              color={getStockStatusColor(item.currentStock, item.minStockLevel)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              onClick={() => navigate(`/admin/groceries/${item._id}/edit`)}
                            >
                              Update Stock
                            </Button>
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

        {/* Expired/Expiring Items */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ErrorIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="h6" component="h2">
                  Expired/Expiring Items ({expiredItems.length})
                </Typography>
              </Box>
              
              {expiredItems.length === 0 ? (
                <Typography color="text.secondary" textAlign="center" py={3}>
                  No expired or expiring items found. All items are fresh!
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Expiry Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expiredItems.map((item) => (
                        <TableRow key={item._id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {item.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {item.itemId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {item.expiryDate ? formatDate(item.expiryDate) : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {item.expiryDate && (
                              <>
                                {isExpired(item.expiryDate) && (
                                  <Chip
                                    label="Expired"
                                    color="error"
                                    size="small"
                                  />
                                )}
                                {isExpiringSoon(item.expiryDate) && !isExpired(item.expiryDate) && (
                                  <Chip
                                    label="Expiring Soon"
                                    color="warning"
                                    size="small"
                                  />
                                )}
                                {!isExpired(item.expiryDate) && !isExpiringSoon(item.expiryDate) && (
                                  <Chip
                                    label="Fresh"
                                    color="success"
                                    size="small"
                                  />
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              onClick={() => navigate(`/admin/groceries/${item._id}/edit`)}
                            >
                              Update Item
                            </Button>
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
      </Grid>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <InventoryIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {lowStockItems.length}
                  </Typography>
                  <Typography color="text.secondary">
                    Low Stock Items
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ErrorIcon color="error" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {expiredItems.filter(item => item.expiryDate && isExpired(item.expiryDate)).length}
                  </Typography>
                  <Typography color="text.secondary">
                    Expired Items
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingDownIcon color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" component="div">
                    {expiredItems.filter(item => item.expiryDate && isExpiringSoon(item.expiryDate)).length}
                  </Typography>
                  <Typography color="text.secondary">
                    Expiring Soon
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default StockAlerts;
