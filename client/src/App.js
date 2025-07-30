import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layout Components
import Layout from './components/Layout/Layout';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';

// Pages
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import HRDashboard from './pages/HR/HRDashboard';
import EmployeeList from './pages/HR/EmployeeList';
import EmployeeForm from './pages/HR/EmployeeForm';
import EmployeeView from './pages/HR/EmployeeView';
import HRReports from './pages/HR/HRReports';
import Departments from './pages/HR/Departments';
import Payroll from './pages/HR/Payroll';
import PayrollForm from './pages/HR/PayrollForm';
import PayrollDetail from './pages/HR/PayrollDetail';
import AttendanceList from './pages/HR/AttendanceList';
import AttendanceForm from './pages/HR/AttendanceForm';
import BiometricIntegration from './pages/HR/BiometricIntegration';
import FinanceDashboard from './pages/Finance/FinanceDashboard';
import AccountList from './pages/Finance/AccountList';
import ProcurementDashboard from './pages/Procurement/ProcurementDashboard';
import SalesDashboard from './pages/Sales/SalesDashboard';
import CRMDashboard from './pages/CRM/CRMDashboard';
import Leads from './pages/CRM/Leads';
import Contacts from './pages/CRM/Contacts';
import Companies from './pages/CRM/Companies';
import Campaigns from './pages/CRM/Campaigns';
import Opportunities from './pages/CRM/Opportunities';
import Reports from './pages/CRM/Reports';
import Profile from './pages/Profile/Profile';
import UserManagement from './pages/Admin/UserManagement';
import DepartmentManagement from './pages/HR/DepartmentManagement';
import PositionManagement from './pages/HR/PositionManagement';
import BankManagement from './pages/HR/BankManagement';
import NotFound from './pages/NotFound/NotFound';
import FBRTaxManagement from './pages/HR/FBRTaxManagement';
import LoanManagement from './pages/HR/LoanManagement';
import LoanForm from './pages/HR/LoanForm';
import LoanDetail from './pages/HR/LoanDetail';
import LoanStatistics from './pages/HR/LoanStatistics';
import FinalSettlementManagement from './pages/HR/FinalSettlementManagement';
import FinalSettlementForm from './pages/HR/FinalSettlementForm';
import FinalSettlementStatistics from './pages/HR/FinalSettlementStatistics';
import FinalSettlementDetail from './pages/HR/FinalSettlementDetail';
import PayslipManagement from './pages/HR/PayslipManagement';
import PayslipForm from './pages/HR/PayslipForm';
import PayslipDetail from './pages/HR/PayslipDetail';
import TalentAcquisition from './pages/HR/TalentAcquisition';
import JobPostings from './pages/HR/JobPostings';
import JobPostingForm from './pages/HR/JobPostingForm';
import Candidates from './pages/HR/Candidates';
import Applications from './pages/HR/Applications';

// Public Route Component (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        Loading...
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  const { user, loading } = useAuth();

  // Show loading while checking authentication
  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            color: 'white',
          }}
        >
          <CircularProgress size={60} sx={{ color: 'white', mb: 2 }} />
          <Typography variant="h6">Loading SGC ERP System...</Typography>
        </Box>
      </Box>
    );
  }

  // If user is not authenticated, show only login page
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If user is authenticated, show the full application with layout
  return (
    <Layout>
      <Sidebar />
      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <Header />
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
          <Routes>
            {/* Dashboard */}
            <Route 
              path="/dashboard" 
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} 
            />

            {/* HR Module */}
            <Route 
              path="/hr" 
              element={<ProtectedRoute><HRDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/employees" 
              element={<ProtectedRoute><EmployeeList /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/employees/add" 
              element={<ProtectedRoute><EmployeeForm /></ProtectedRoute>} 
            />
            <Route
                      path="/hr/reports"
        element={<ProtectedRoute><HRReports /></ProtectedRoute>}
            />
            <Route 
              path="/hr/employees/:id" 
              element={<ProtectedRoute><EmployeeView /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/employees/:id/edit" 
              element={<ProtectedRoute><EmployeeForm /></ProtectedRoute>} 
            />
            <Route
              path="/hr/departments"
              element={<ProtectedRoute><Departments /></ProtectedRoute>}
            />
            <Route
              path="/hr/payroll"
              element={<ProtectedRoute><Payroll /></ProtectedRoute>}
            />
            <Route
              path="/hr/payroll/add"
              element={<ProtectedRoute><PayrollForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/payroll/:id"
              element={<ProtectedRoute><PayrollForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/payroll/:id/edit"
              element={<ProtectedRoute><PayrollForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/payroll/view/:id"
              element={<ProtectedRoute><PayrollDetail /></ProtectedRoute>}
            />

            {/* Attendance Routes */}
            <Route
              path="/hr/attendance"
              element={<ProtectedRoute><AttendanceList /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance/add"
              element={<ProtectedRoute><AttendanceForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance/:id"
              element={<ProtectedRoute><AttendanceForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance/edit/:id"
              element={<ProtectedRoute><AttendanceForm /></ProtectedRoute>}
            />

            {/* Biometric Integration Routes */}
            <Route
              path="/hr/biometric"
              element={<ProtectedRoute><BiometricIntegration /></ProtectedRoute>}
            />

            {/* FBR Tax Management Routes */}
            <Route
              path="/hr/fbr-tax"
              element={<ProtectedRoute><FBRTaxManagement /></ProtectedRoute>}
            />

            {/* Loan Management Routes */}
            <Route
              path="/hr/loans"
              element={<ProtectedRoute><LoanManagement /></ProtectedRoute>}
            />
            <Route
              path="/hr/loans/statistics"
              element={<ProtectedRoute><LoanStatistics /></ProtectedRoute>}
            />
            <Route
              path="/hr/loans/new"
              element={<ProtectedRoute><LoanForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/loans/:id"
              element={<ProtectedRoute><LoanDetail /></ProtectedRoute>}
            />
            <Route
              path="/hr/loans/:id/edit"
              element={<ProtectedRoute><LoanForm /></ProtectedRoute>}
            />

            {/* Final Settlement Routes */}
            <Route
              path="/hr/settlements"
              element={<ProtectedRoute><FinalSettlementManagement /></ProtectedRoute>}
            />
            <Route
              path="/hr/settlements/new"
              element={<ProtectedRoute><FinalSettlementForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/settlements/:id"
              element={<ProtectedRoute><FinalSettlementDetail /></ProtectedRoute>}
            />
            <Route
              path="/hr/settlements/:id/edit"
              element={<ProtectedRoute><FinalSettlementForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/settlements/statistics"
              element={<ProtectedRoute><FinalSettlementStatistics /></ProtectedRoute>}
            />

            {/* Payslip Management Routes */}
            <Route
              path="/hr/payslips"
              element={<ProtectedRoute><PayslipManagement /></ProtectedRoute>}
            />
            <Route
              path="/hr/payslips/new"
              element={<ProtectedRoute><PayslipForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/payslips/:id/edit"
              element={<ProtectedRoute><PayslipForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/payslips/:id"
              element={<ProtectedRoute><PayslipDetail /></ProtectedRoute>}
            />

            {/* Talent Acquisition Routes */}
            <Route 
              path="/hr/talent-acquisition" 
              element={<ProtectedRoute><TalentAcquisition /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/job-postings" 
              element={<ProtectedRoute><JobPostings /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/job-postings/new" 
              element={<ProtectedRoute><JobPostingForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/job-postings/:id" 
              element={<ProtectedRoute><JobPostingForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/job-postings/:id/edit" 
              element={<ProtectedRoute><JobPostingForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/candidates" 
              element={<ProtectedRoute><Candidates /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/candidates/new" 
              element={<ProtectedRoute><Candidates /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/candidates/:id" 
              element={<ProtectedRoute><Candidates /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/candidates/:id/edit" 
              element={<ProtectedRoute><Candidates /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications" 
              element={<ProtectedRoute><Applications /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications/new" 
              element={<ProtectedRoute><Applications /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications/:id" 
              element={<ProtectedRoute><Applications /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications/:id/edit" 
              element={<ProtectedRoute><Applications /></ProtectedRoute>} 
            />

            {/* Finance Module */}
            <Route 
              path="/finance" 
              element={<ProtectedRoute><FinanceDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/accounts" 
              element={<ProtectedRoute><AccountList /></ProtectedRoute>} 
            />

            {/* Procurement Module */}
            <Route 
              path="/procurement" 
              element={<ProtectedRoute><ProcurementDashboard /></ProtectedRoute>} 
            />

            {/* Sales Module */}
            <Route 
              path="/sales" 
              element={<ProtectedRoute><SalesDashboard /></ProtectedRoute>} 
            />

            {/* CRM Module */}
            <Route 
              path="/crm" 
              element={<ProtectedRoute><CRMDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/leads" 
              element={<ProtectedRoute><Leads /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/leads/new" 
              element={<ProtectedRoute><Leads /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/leads/:id" 
              element={<ProtectedRoute><Leads /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/leads/:id/edit" 
              element={<ProtectedRoute><Leads /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/contacts" 
              element={<ProtectedRoute><Contacts /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/contacts/new" 
              element={<ProtectedRoute><Contacts /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/contacts/:id" 
              element={<ProtectedRoute><Contacts /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/contacts/:id/edit" 
              element={<ProtectedRoute><Contacts /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/companies" 
              element={<ProtectedRoute><Companies /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/companies/new" 
              element={<ProtectedRoute><Companies /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/companies/:id" 
              element={<ProtectedRoute><Companies /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/companies/:id/edit" 
              element={<ProtectedRoute><Companies /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/campaigns" 
              element={<ProtectedRoute><Campaigns /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/campaigns/new" 
              element={<ProtectedRoute><Campaigns /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/campaigns/:id" 
              element={<ProtectedRoute><Campaigns /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/campaigns/:id/edit" 
              element={<ProtectedRoute><Campaigns /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/opportunities" 
              element={<ProtectedRoute><Opportunities /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/opportunities/new" 
              element={<ProtectedRoute><Opportunities /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/opportunities/:id" 
              element={<ProtectedRoute><Opportunities /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/opportunities/:id/edit" 
              element={<ProtectedRoute><Opportunities /></ProtectedRoute>} 
            />
            <Route 
              path="/crm/reports" 
              element={<ProtectedRoute><Reports /></ProtectedRoute>} 
            />

            {/* Profile */}
            <Route 
              path="/profile" 
              element={<ProtectedRoute><Profile /></ProtectedRoute>} 
            />

            {/* Admin Module */}
            <Route 
              path="/admin/users" 
              element={<ProtectedRoute requiredRole="admin"><UserManagement /></ProtectedRoute>} 
            />

            {/* HR Management Routes */}
            <Route 
              path="/hr/departments/manage" 
              element={<ProtectedRoute><DepartmentManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/positions/manage" 
              element={<ProtectedRoute><PositionManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/banks/manage" 
              element={<ProtectedRoute><BankManagement /></ProtectedRoute>} 
            />

            {/* Default redirects */}
            <Route 
              path="/" 
              element={<Navigate to="/dashboard" replace />} 
            />
            <Route 
              path="/login" 
              element={<Navigate to="/dashboard" replace />} 
            />

            {/* 404 */}
            <Route 
              path="*" 
              element={<NotFound />} 
            />
          </Routes>
        </Box>
      </Box>
    </Layout>
  );
}

export default App; 