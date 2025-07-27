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
import Departments from './pages/HR/Departments';
import Payroll from './pages/HR/Payroll';
import PayrollForm from './pages/HR/PayrollForm';
import AttendanceList from './pages/HR/AttendanceList';
import AttendanceForm from './pages/HR/AttendanceForm';
import BiometricIntegration from './pages/HR/BiometricIntegration';
import FinanceDashboard from './pages/Finance/FinanceDashboard';
import AccountList from './pages/Finance/AccountList';
import ProcurementDashboard from './pages/Procurement/ProcurementDashboard';
import SalesDashboard from './pages/Sales/SalesDashboard';
import CRMDashboard from './pages/CRM/CRMDashboard';
import Profile from './pages/Profile/Profile';
import UserManagement from './pages/Admin/UserManagement';
import NotFound from './pages/NotFound/NotFound';

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
              path="/hr/employees/:id" 
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