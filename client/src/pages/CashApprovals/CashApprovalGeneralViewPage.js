import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Skeleton } from '@mui/material';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import CashApprovalGeneralDetailShell from '../../components/CashApprovals/CashApprovalGeneralDetailShell';
import { isGeneralModuleCashApproval } from '../../components/CashApprovals/cashApprovalGeneralDocumentUtils';

/**
 * Shared read-only General cash approval document view (audit, CEO, finance links).
 */
const CashApprovalGeneralViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ca, setCa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const from = searchParams.get('from') || '';

  const load = useCallback(async () => {
    const response = await api.get(`/cash-approvals/${id}`);
    const data = response.data?.success ? response.data.data : response.data;
    if (!data) throw new Error('Cash approval not found');
    if (!isGeneralModuleCashApproval(data)) {
      throw new Error('This view is only for General module cash approvals');
    }
    setCa(data);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await load();
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load cash approval');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const handleBack = () => {
    if (from === 'pre-audit' || from === 'audit') {
      navigate('/audit/pre-audit');
      return;
    }
    if (from === 'ceo' || from === 'payments') {
      navigate('/general/ceo-secretariat/payments');
      return;
    }
    navigate(-1);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="text" width="30%" height={48} />
        <Skeleton variant="rectangular" height={620} sx={{ mt: 2 }} />
      </Box>
    );
  }

  if (error || !ca) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Cash approval not found'}</Alert>
        <Button sx={{ mt: 2 }} onClick={handleBack}>
          Back
        </Button>
      </Box>
    );
  }

  return (
    <CashApprovalGeneralDetailShell
      ca={ca}
      onBack={handleBack}
      backLabel={
        from === 'pre-audit' || from === 'audit'
          ? 'Back to Pre-Audit'
          : from === 'ceo' || from === 'payments'
            ? 'Back to CEO Payments'
            : 'Back'
      }
    />
  );
};

export default CashApprovalGeneralViewPage;
