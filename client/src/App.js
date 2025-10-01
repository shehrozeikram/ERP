import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
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
import HRReports from './pages/HR/Reports/HRReports';
import PayrollReport from './pages/HR/Reports/PayrollReport';
import AttendanceReports from './pages/HR/Reports/AttendanceReports';
import Departments from './pages/HR/Departments';
import Payroll from './pages/HR/Payroll';
import PayrollForm from './pages/HR/PayrollForm';
import PayrollDetail from './pages/HR/PayrollDetail';
import EmployeePayrollDetails from './pages/HR/EmployeePayrollDetails';
import AttendanceList from './pages/HR/AttendanceList';
import AttendanceRecord from './pages/HR/AttendanceRecord';
import AttendanceRecordDetail from './pages/HR/AttendanceRecordDetail';
import AttendanceDetail from './pages/HR/AttendanceDetail';
import AttendanceForm from './pages/HR/AttendanceForm';
import AttendanceReport from './pages/HR/AttendanceReport';
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
import VehicleList from './pages/Admin/VehicleManagement/VehicleList';
import VehicleForm from './pages/Admin/VehicleManagement/VehicleForm';
import VehicleDetails from './pages/Admin/VehicleManagement/VehicleDetails';
import GroceryList from './pages/Admin/GroceryManagement/GroceryList';
import GroceryForm from './pages/Admin/GroceryManagement/GroceryForm';
import StockAlerts from './pages/Admin/GroceryManagement/StockAlerts';
import PettyCashDashboard from './pages/Admin/PettyCashManagement/PettyCashDashboard';
import FundForm from './pages/Admin/PettyCashManagement/FundForm';
import ExpenseForm from './pages/Admin/PettyCashManagement/ExpenseForm';
import EventDashboard from './pages/Admin/EventManagement/EventDashboard';
import EventList from './pages/Admin/EventManagement/EventList';
import EventForm from './pages/Admin/EventManagement/EventForm';
import EventDetails from './pages/Admin/EventManagement/EventDetails';
import StaffManagementDashboard from './pages/Admin/StaffManagement/StaffManagementDashboard';
import StaffAssignmentList from './pages/Admin/StaffManagement/StaffAssignmentList';
import StaffAssignmentForm from './pages/Admin/StaffManagement/StaffAssignmentForm';
import LocationManagement from './pages/Admin/StaffManagement/LocationManagement';
import UtilityBillDashboard from './pages/Admin/UtilityBillManagement/UtilityBillDashboard';
import UtilityBillList from './pages/Admin/UtilityBillManagement/UtilityBillList';
import UtilityBillForm from './pages/Admin/UtilityBillManagement/UtilityBillForm';
import UtilityBillDetails from './pages/Admin/UtilityBillManagement/UtilityBillDetails';
import RentalAgreementList from './pages/Admin/RentalAgreements/RentalAgreementList';
import RentalAgreementDetail from './pages/Admin/RentalAgreements/RentalAgreementDetail';
import RentalManagementDashboard from './pages/Admin/RentalManagement/RentalManagementDashboard';
import RentalManagementDetail from './pages/Admin/RentalManagement/RentalManagementDetail';
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
import TalentAcquisition from './pages/HR/TalentAcquisition';
import JobPostings from './pages/HR/JobPostings';
import JobPostingForm from './pages/HR/JobPostingForm';
import Candidates from './pages/HR/Candidates';
import CandidateForm from './pages/HR/CandidateForm';
import ApplicationForm from './pages/HR/ApplicationForm';
import Applications from './pages/HR/Applications';
import CandidateApprovals from './pages/HR/CandidateApprovals';
import ApprovalDetail from './pages/HR/ApprovalDetail';
import TalentAcquisitionReports from './pages/HR/TalentAcquisitionReports';
import LearningManagement from './pages/HR/LearningManagement';
import Courses from './pages/HR/Courses';
import CourseForm from './pages/HR/CourseForm';
import Enrollments from './pages/HR/Enrollments';
import EnrollmentForm from './pages/HR/EnrollmentForm';
import EnrollmentDetail from './pages/HR/EnrollmentDetail';
import LearningReports from './pages/HR/LearningReports';
import TrainingPrograms from './pages/HR/TrainingPrograms';
import TrainingProgramForm from './pages/HR/TrainingProgramForm';
import TrainingProgramDetail from './pages/HR/TrainingProgramDetail';
import OrganizationalDevelopment from './pages/HR/OrganizationalDevelopment';
import OrganizationalChart from './pages/HR/OrganizationalChart';
import JobAnalysis from './pages/HR/JobAnalysis';
import SuccessionPlanning from './pages/HR/SuccessionPlanning';
import JobApplication from './pages/Public/JobApplication';
import PublicApproval from './pages/Public/PublicApproval';
import OfferAcceptance from './pages/Public/OfferAcceptance';
import PublicJoiningDocument from './pages/Public/PublicJoiningDocument';
import PublicEmployeeOnboarding from './pages/Public/PublicEmployeeOnboarding';

// Increment Management Pages
import IncrementList from './pages/Increments/IncrementList';
import CreateIncrement from './pages/Increments/CreateIncrement';
import IncrementHistory from './pages/Increments/IncrementHistory';
import IncrementDetail from './pages/Increments/IncrementDetail';

// Leave Management Pages
import LeaveManagement from './pages/HR/Leaves/LeaveManagement';
import LeaveApproval from './pages/HR/Leaves/LeaveApproval';
import LeaveCalendar from './pages/HR/Leaves/LeaveCalendar';
import LeaveReports from './pages/HR/Leaves/LeaveReports';

// Component to handle role-based redirects
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Get appropriate redirect path based on user role
  const getRedirectPath = (userRole) => {
    switch (userRole) {
      case 'admin':
        return '/dashboard';
      case 'hr_manager':
        return '/hr';
      case 'finance_manager':
        return '/finance';
      case 'procurement_manager':
        return '/procurement';
      case 'sales_manager':
        return '/sales';
      case 'crm_manager':
        return '/crm';
      case 'employee':
        return '/profile';
      default:
        return '/profile';
    }
  };
  
  const redirectPath = getRedirectPath(user.role);
  return <Navigate to={redirectPath} replace />;
};

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

  // If user is not authenticated, show login page and public routes
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/apply/:affiliateCode" element={<JobApplication />} />
        <Route path="/public-approval/:id" element={<PublicApproval />} />
        <Route path="/candidates/offer/:candidateId" element={<OfferAcceptance />} />
        <Route path="/public-joining-document/:approvalId" element={<PublicJoiningDocument />} />
        <Route path="/public-employee-onboarding/:id" element={<PublicEmployeeOnboarding />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If user is authenticated, show the full application with layout
  return (
    <DataProvider>
      <Layout>
        <Sidebar />
        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <Header />
          <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
            <Routes>
            {/* Dashboard */}
            <Route 
              path="/dashboard" 
              element={<ProtectedRoute requiredRole="admin"><Dashboard /></ProtectedRoute>} 
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
              path="/hr/reports/payroll/:reportType"
              element={<ProtectedRoute><PayrollReport /></ProtectedRoute>}
            />
            <Route
              path="/hr/reports/attendance/:reportType"
              element={<ProtectedRoute><AttendanceReports /></ProtectedRoute>}
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
            <Route
              path="/hr/payroll/view/employee/:employeeId"
              element={<ProtectedRoute><EmployeePayrollDetails /></ProtectedRoute>}
            />

            {/* Attendance Routes */}
            <Route
              path="/hr/attendance/employee/:employeeId/detail"
              element={<ProtectedRoute><AttendanceDetail /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance/add"
              element={<ProtectedRoute><AttendanceForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance/:id/edit"
              element={<ProtectedRoute><AttendanceForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance/:id"
              element={<ProtectedRoute><AttendanceForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance"
              element={<ProtectedRoute><AttendanceList /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance-record"
              element={<ProtectedRoute><AttendanceRecord /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance-record/:employeeId"
              element={<ProtectedRoute><AttendanceRecordDetail /></ProtectedRoute>}
            />
            <Route
              path="/hr/attendance/report"
              element={<ProtectedRoute><AttendanceReport /></ProtectedRoute>}
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

            {/* Increment Management Routes */}
            <Route 
              path="/hr/increments" 
              element={<ProtectedRoute><IncrementList /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/increments/create" 
              element={<ProtectedRoute><CreateIncrement /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/increments/history" 
              element={<ProtectedRoute><IncrementHistory /></ProtectedRoute>} 
            />

            {/* Leave Management Routes */}
            <Route 
              path="/hr/leaves" 
              element={<ProtectedRoute><LeaveManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/leaves/approval" 
              element={<ProtectedRoute requiredRole={['admin', 'hr_manager']}><LeaveApproval /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/leaves/calendar" 
              element={<ProtectedRoute><LeaveCalendar /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/leaves/reports" 
              element={<ProtectedRoute requiredRole={['admin', 'hr_manager']}><LeaveReports /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/increments/:id" 
              element={<ProtectedRoute><IncrementDetail /></ProtectedRoute>} 
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
              element={<ProtectedRoute><CandidateForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/candidates/:id" 
              element={<ProtectedRoute><CandidateForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/candidates/:id/edit" 
              element={<ProtectedRoute><CandidateForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications" 
              element={<ProtectedRoute><Applications /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications/new" 
              element={<ProtectedRoute><ApplicationForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications/:id" 
              element={<ProtectedRoute><ApplicationForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/applications/:id/edit" 
              element={<ProtectedRoute><ApplicationForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/talent-acquisition/reports" 
              element={<ProtectedRoute><TalentAcquisitionReports /></ProtectedRoute>} 
            />

            {/* Candidate Approval Routes */}
            <Route 
              path="/hr/candidate-approvals" 
              element={<ProtectedRoute><CandidateApprovals /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/approvals/:id" 
              element={<ProtectedRoute><ApprovalDetail /></ProtectedRoute>} 
            />
            {/* Public Approval Route for Email Links */}
            <Route 
              path="/approvals/:id" 
              element={<ApprovalDetail />} 
            />

            {/* Learning & Development Module */}
            <Route 
              path="/hr/learning" 
              element={<ProtectedRoute><LearningManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/courses" 
              element={<ProtectedRoute><Courses /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/courses/new" 
              element={<ProtectedRoute><CourseForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/courses/:id" 
              element={<ProtectedRoute><CourseForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/courses/:id/edit" 
              element={<ProtectedRoute><CourseForm /></ProtectedRoute>} 
            />

            {/* Enrollment Routes */}
            <Route 
              path="/hr/learning/enrollments" 
              element={<ProtectedRoute><Enrollments /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/enrollments/new" 
              element={<ProtectedRoute><EnrollmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/enrollments/:id" 
              element={<ProtectedRoute><EnrollmentDetail /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/enrollments/:id/edit" 
              element={<ProtectedRoute><EnrollmentForm /></ProtectedRoute>} 
            />

            {/* Learning Reports */}
            <Route 
              path="/hr/learning/reports" 
              element={<ProtectedRoute><LearningReports /></ProtectedRoute>} 
            />

            {/* Training Programs Routes */}
            <Route 
              path="/hr/learning/programs" 
              element={<ProtectedRoute><TrainingPrograms /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/programs/new" 
              element={<ProtectedRoute><TrainingProgramForm /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/programs/:id" 
              element={<ProtectedRoute><TrainingProgramDetail /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/learning/programs/:id/edit" 
              element={<ProtectedRoute><TrainingProgramForm /></ProtectedRoute>} 
            />

            {/* Organizational Development Routes */}
            <Route 
              path="/hr/organizational-development" 
              element={<ProtectedRoute><OrganizationalDevelopment /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/organizational-development/org-chart" 
              element={<ProtectedRoute><OrganizationalChart /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/organizational-development/job-analysis" 
              element={<ProtectedRoute><JobAnalysis /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/organizational-development/succession" 
              element={<ProtectedRoute><SuccessionPlanning /></ProtectedRoute>} 
            />

            {/* Public Application Route - Handled in unauthenticated section */}

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
            <Route 
              path="/admin/vehicles" 
              element={<ProtectedRoute requiredRole="admin"><VehicleList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/new" 
              element={<ProtectedRoute requiredRole="admin"><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id" 
              element={<ProtectedRoute requiredRole="admin"><VehicleDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id/edit" 
              element={<ProtectedRoute requiredRole="admin"><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries" 
              element={<ProtectedRoute requiredRole="admin"><GroceryList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/new" 
              element={<ProtectedRoute requiredRole="admin"><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/:id" 
              element={<ProtectedRoute requiredRole="admin"><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/:id/edit" 
              element={<ProtectedRoute requiredRole="admin"><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/stock-alerts" 
              element={<ProtectedRoute requiredRole="admin"><StockAlerts /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash" 
              element={<ProtectedRoute requiredRole="admin"><PettyCashDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/funds/new" 
              element={<ProtectedRoute requiredRole="admin"><FundForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/funds/:id/edit" 
              element={<ProtectedRoute requiredRole="admin"><FundForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/expenses/new" 
              element={<ProtectedRoute requiredRole="admin"><ExpenseForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/expenses/:id/edit" 
              element={<ProtectedRoute requiredRole="admin"><ExpenseForm /></ProtectedRoute>} 
            />
            
            {/* Event Management Routes */}
            <Route 
              path="/admin/events" 
              element={<ProtectedRoute requiredRole="admin"><EventDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/list" 
              element={<ProtectedRoute requiredRole="admin"><EventList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/new" 
              element={<ProtectedRoute requiredRole="admin"><EventForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/:id" 
              element={<ProtectedRoute requiredRole="admin"><EventDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/:id/edit" 
              element={<ProtectedRoute requiredRole="admin"><EventForm /></ProtectedRoute>} 
            />
            
            {/* Staff Management Routes */}
            <Route 
              path="/admin/staff-management" 
              element={<ProtectedRoute requiredRole="admin"><StaffManagementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments" 
              element={<ProtectedRoute requiredRole="admin"><StaffAssignmentList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/new" 
              element={<ProtectedRoute requiredRole="admin"><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/:id" 
              element={<ProtectedRoute requiredRole="admin"><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/:id/edit" 
              element={<ProtectedRoute requiredRole="admin"><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/locations" 
              element={<ProtectedRoute requiredRole="admin"><LocationManagement /></ProtectedRoute>} 
            />

            {/* Utility Bills Management Routes */}
            <Route 
              path="/admin/utility-bills" 
              element={<ProtectedRoute requiredRole="admin"><UtilityBillDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/list" 
              element={<ProtectedRoute requiredRole="admin"><UtilityBillList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/new" 
              element={<ProtectedRoute requiredRole="admin"><UtilityBillForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/:id/edit" 
              element={<ProtectedRoute requiredRole="admin"><UtilityBillForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/:id" 
              element={<ProtectedRoute requiredRole="admin"><UtilityBillDetails /></ProtectedRoute>} 
            />

            {/* Rental Management Routes */}
            <Route 
              path="/admin/rental-agreements" 
              element={<ProtectedRoute requiredRole="admin"><RentalAgreementList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-agreements/:id" 
              element={<ProtectedRoute requiredRole="admin"><RentalAgreementDetail /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-management" 
              element={<ProtectedRoute requiredRole="admin"><RentalManagementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-management/:id" 
              element={<ProtectedRoute requiredRole="admin"><RentalManagementDetail /></ProtectedRoute>} 
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
              element={<RoleBasedRedirect />} 
            />
            <Route 
              path="/login" 
              element={<RoleBasedRedirect />} 
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
    </DataProvider>
    );
}

export default App; 