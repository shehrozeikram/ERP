import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Skeleton
} from '@mui/material';
import {
  ReceiptLong as ReceiptIcon,
  FlashOn as ElectricityIcon,
  Business as PropertyIcon,
  People as PeopleIcon,
  Description as InvoiceIcon,
  Assignment as OpenInvoiceIcon,
  MeetingRoom as RentalIcon,
  AttachMoney as SuspenseIcon,
  GridView as SlabsIcon,
  ChevronRight as ArrowIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { fetchAllInvoices } from '../../../services/propertyInvoiceService';
import { fetchProperties as fetchTajProperties } from '../../../services/tajPropertiesService';
import { fetchResidents } from '../../../services/tajResidentsService';
import { fetchProperties as fetchRentalProperties } from '../../../services/tajRentalManagementService';
import { fetchAllDeposits } from '../../../services/tajResidentsService';

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const StatCard = ({ title, value, subValue, icon: Icon, color = 'primary', loading, onClick, href }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (href) navigate(href);
    if (onClick) onClick();
  };
  const isLink = Boolean(href || onClick);

  return (
    <Card
      sx={{
        height: '100%',
        cursor: isLink ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': isLink ? { boxShadow: 4, transform: 'translateY(-2px)' } : {}
      }}
      onClick={isLink ? handleClick : undefined}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box flex={1}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width="60%" height={36} />
            ) : (
              <>
                <Typography variant="h5" fontWeight={700}>
                  {value}
                </Typography>
                {subValue != null && subValue !== '' && (
                  <Typography variant="caption" color="text.secondary">
                    {subValue}
                  </Typography>
                )}
              </>
            )}
          </Box>
          {Icon && (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: `${color}.main`,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon fontSize="medium" />
            </Box>
          )}
        </Stack>
        {isLink && (
          <Stack direction="row" alignItems="center" sx={{ mt: 1.5 }} spacing={0.5}>
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              View details
            </Typography>
            <ArrowIcon sx={{ fontSize: 16 }} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    cam: { totalProperties: 0, totalAmount: 0, totalArrears: 0 },
    electricity: { totalProperties: 0, totalAmount: 0, totalArrears: 0 },
    properties: 0,
    residents: 0,
    rentalProperties: 0,
    invoices: 0,
    openInvoices: 0,
    suspenseTotal: 0,
    suspenseRemaining: 0
  });

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [
        camRes,
        electricityRes,
        invoicesRes,
        propertiesRes,
        residentsRes,
        rentalRes,
        suspenseRes
      ] = await Promise.all([
        api.get('/taj-utilities/cam-charges/current-overview', { params: { page: 1, limit: 1 } }),
        api.get('/taj-utilities/electricity/current-overview', { params: { page: 1, limit: 1 } }),
        fetchAllInvoices({ page: 1, limit: 1 }),
        fetchTajProperties({ page: 1, limit: 1 }),
        fetchResidents({ page: 1, limit: 1 }),
        fetchRentalProperties({ page: 1, limit: 1 }),
        fetchAllDeposits({ page: 1, limit: 10000, suspenseAccount: 'true' }).catch(() => ({ data: { data: { deposits: [] } } }))
      ]);

      const camData = camRes.data?.data || {};
      const elecData = electricityRes.data?.data || {};
      const invPagination = invoicesRes.data?.pagination || {};
      const propData = propertiesRes.data?.data;
      const residentData = residentsRes.data?.data;
      const rentalData = rentalRes.data?.data; // rental API returns { data: array, summary }, no pagination

      const propertiesTotal = propertiesRes.data?.pagination?.total ?? (Array.isArray(propData) ? propData.length : 0);
      const residentsTotal = residentsRes.data?.pagination?.total ?? (Array.isArray(residentData) ? residentData.length : 0);
      const rentalTotal = Array.isArray(rentalData) ? rentalData.length : 0;

      const deposits = suspenseRes.data?.data?.deposits || [];
      const suspenseTotal = deposits.reduce((s, d) => s + (d.amount || 0), 0);
      const suspenseRemaining = deposits.reduce((s, d) => s + (d.remainingAmount ?? d.amount ?? 0), 0);

      let openInvoicesCount = 0;
      try {
        const openRes = await fetchAllInvoices({ page: 1, limit: 1, openInvoices: 'true', paymentStatus: 'unpaid,partial_paid' });
        openInvoicesCount = openRes.data?.pagination?.total ?? 0;
      } catch {
        // ignore
      }

      setStats({
        cam: {
          totalProperties: camData.totalProperties ?? 0,
          totalAmount: camData.totalAmountAllPages ?? camData.totalAmount ?? 0,
          totalArrears: camData.totalArrearsAllPages ?? camData.totalArrears ?? 0
        },
        electricity: {
          totalProperties: elecData.totalProperties ?? 0,
          totalAmount: elecData.totalAmountAllPages ?? elecData.totalAmount ?? 0,
          totalArrears: elecData.totalArrearsAllPages ?? elecData.totalArrears ?? 0
        },
        properties: propertiesTotal,
        residents: residentsTotal,
        rentalProperties: rentalTotal,
        invoices: invPagination.total ?? 0,
        openInvoices: openInvoicesCount,
        suspenseTotal,
        suspenseRemaining
      });
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Taj Utilities & Charges — Dashboard
          </Typography>
          <Typography color="text.secondary">
            Overview of CAM, Electricity, Rentals, Invoices, and more.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={18} /> : null}
          onClick={loadDashboard}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary row */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        Summary
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard
            title="Total Properties"
            value={stats.properties}
            icon={PropertyIcon}
            color="primary"
            loading={loading}
            href="/finance/taj-utilities-charges/taj-properties"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard
            title="Residents"
            value={stats.residents}
            icon={PeopleIcon}
            color="info"
            loading={loading}
            href="/finance/taj-utilities-charges/taj-residents"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard
            title="Total Invoices"
            value={stats.invoices}
            icon={InvoiceIcon}
            color="secondary"
            loading={loading}
            href="/finance/taj-utilities-charges/invoices"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <StatCard
            title="Open Invoices"
            value={stats.openInvoices}
            icon={OpenInvoiceIcon}
            color="warning"
            loading={loading}
            href="/finance/taj-utilities-charges/open-invoices"
          />
        </Grid>
      </Grid>

      {/* CAM & Electricity */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        CAM & Electricity
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <StatCard
            title="CAM Charges — Properties"
            value={stats.cam.totalProperties}
            subValue={`Amount: ${formatCurrency(stats.cam.totalAmount)} • Arrears: ${formatCurrency(stats.cam.totalArrears)}`}
            icon={ReceiptIcon}
            color="success"
            loading={loading}
            href="/finance/taj-utilities-charges/cam-charges"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <StatCard
            title="Electricity — Properties"
            value={stats.electricity.totalProperties}
            subValue={`Amount: ${formatCurrency(stats.electricity.totalAmount)} • Arrears: ${formatCurrency(stats.electricity.totalArrears)}`}
            icon={ElectricityIcon}
            color="warning"
            loading={loading}
            href="/finance/taj-utilities-charges/electricity-bills"
          />
        </Grid>
      </Grid>

      {/* Rental & Others */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        Rental & Accounts
      </Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Rental Properties"
            value={stats.rentalProperties}
            icon={RentalIcon}
            color="info"
            loading={loading}
            href="/finance/taj-utilities-charges/rental-management"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Suspense Account"
            value={formatCurrency(stats.suspenseTotal)}
            subValue={`Remaining: ${formatCurrency(stats.suspenseRemaining)}`}
            icon={SuspenseIcon}
            color="secondary"
            loading={loading}
            href="/finance/taj-utilities-charges/suspense-account"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Charges Slabs"
            icon={SlabsIcon}
            color="primary"
            value="Slabs"
            loading={false}
            href="/finance/taj-utilities-charges/charges-slabs"
          />
        </Grid>
      </Grid>

      {/* Quick links */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
        Quick Links
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }} onClick={() => navigate('/finance/taj-utilities-charges/rental-agreements')}>
            <CardContent sx={{ py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography fontWeight={600}>Rental Agreements</Typography>
              <ArrowIcon />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 3 } }} onClick={() => navigate('/finance/taj-utilities-charges/deposits')}>
            <CardContent sx={{ py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography fontWeight={600}>Deposits</Typography>
              <ArrowIcon />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
