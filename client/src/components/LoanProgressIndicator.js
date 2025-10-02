import React from 'react';
import { 
  LinearProgress, 
  Typography, 
  Card, 
  CardContent, 
  Chip,
  Box,
  Divider
} from '@mui/material';

/**
 * 🏕️ Loan Progress Indicator Component
 * Displays visual progress bars for employee loans
 */

const LoanProgressIndicator = ({ loans, employeeName = '' }) => {
  if (!loans || loans.length === 0) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            🏦 No Active Loans
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'disbursed':
      case 'approved':
        return 'primary';
      case 'completed':
        return 'success';
      case 'overdue':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'PKR 0';
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Card elevation={1}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          🏦 Loan Progress{employeeName && ` - ${employeeName}`}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Total Active Loans:
          </Typography>
          <Chip 
            label={loans.length}
            color="primary"
            size="small"
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {loans.map((loan, index) => (
          <Box key={loan._id || index} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">
                {loan.loanType} Loan
              </Typography>
              <Chip
                label={loan.status}
                color={getStatusColor(loan.status)}
                size="small"
              />
            </Box>

            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body2" color="primary.fontWeightMedium">
                  {loan.progressPercentage || 0}%
                </Typography>
              </Box>
              
              <LinearProgress
                variant="determinate"
                value={loan.progressPercentage || 0}
                sx={{
                  height: 8,
                  borderRadius: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 1,
                    backgroundColor: loan.status === 'Completed' ? '#4caf50' : '#1976d2'
                  }
                }}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Outstanding Balance
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(loan.outstandingBalance)}
                </Typography>
              </Box>
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Monthly Payment
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(loan.monthlyInstallment)}
                </Typography>
              </Box>
            </Box>

            {loan.completedInstallments && (
              <Box sx={{ mt: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Installments: {loan.completedInstallments}/{loan.totalInstallments || loan.loanTerm}
                </Typography>
              </Box>
            )}

            {index < loans.length - 1 && <Divider sx={{ mt: 2 }} />}
          </Box>
        ))}

        <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(0, 0, 0, 0.12)' }}>
          <Typography variant="caption" color="text.secondary" align="center" display="block">
            💡 Progress updates automatically when payroll deductions are processed
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LoanProgressIndicator;
