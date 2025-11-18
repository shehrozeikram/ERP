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
import AdvancedFinanceDashboard from './pages/Finance/AdvancedFinanceDashboard';
import ChartOfAccounts from './pages/Finance/ChartOfAccounts';
import GeneralLedger from './pages/Finance/GeneralLedger';
import AccountsReceivable from './pages/Finance/AccountsReceivable';
import AccountsPayable from './pages/Finance/AccountsPayable';
import Banking from './pages/Finance/Banking';
import FinancialReports from './pages/Finance/FinancialReports';
import JournalEntryForm from './pages/Finance/JournalEntryForm';
import JournalEntriesList from './pages/Finance/JournalEntriesList';
import ProcurementDashboard from './pages/Procurement/ProcurementDashboard';
import PurchaseOrders from './pages/Procurement/PurchaseOrders';
import Vendors from './pages/Procurement/Vendors';
import Inventory from './pages/Procurement/Inventory';
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
import VehicleDetailsView from './pages/Admin/VehicleManagement/VehicleDetailsView';
import VehicleMaintenanceForm from './pages/Admin/VehicleManagement/VehicleMaintenanceForm';
import VehicleLogBookForm from './pages/Admin/VehicleManagement/VehicleLogBookForm';
import VehicleDashboard from './pages/Admin/VehicleManagement/VehicleDashboard';
import VehicleReports from './pages/Admin/VehicleManagement/VehicleReports';
import VehicleMaintenanceList from './pages/Admin/VehicleManagement/VehicleMaintenanceList';
import VehicleLogBookList from './pages/Admin/VehicleManagement/VehicleLogBookList';
import VehicleLogBookDetailsView from './pages/Admin/VehicleManagement/VehicleLogBookDetailsView';
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
import PaymentSettlement from './pages/Admin/PaymentSettlement/PaymentSettlement';
import SubRoleManagement from './pages/Admin/SubRoleManagement';
import RoleManagement from './pages/Admin/RoleManagement';

// IT Module Components
import ITDashboard from './pages/IT/ITDashboard';
import AssetList from './pages/IT/AssetList';
import AssetForm from './pages/IT/AssetForm';
import AssetAssignment from './pages/IT/AssetAssignment';
import SoftwareList from './pages/IT/SoftwareList';
import SoftwareForm from './pages/IT/SoftwareForm';
import NetworkList from './pages/IT/NetworkList';
import NetworkForm from './pages/IT/NetworkForm';
import VendorList from './pages/IT/VendorList';
import VendorForm from './pages/IT/VendorForm';
import VendorContracts from './pages/IT/VendorContracts';
import PasswordWallet from './pages/IT/PasswordWallet';
import PasswordWalletDashboard from './pages/IT/PasswordWalletDashboard';
import PasswordForm from './pages/IT/PasswordForm';
import ITReports from './pages/IT/Reports';

// Audit Module Components
import AuditDashboard from './pages/Audit/AuditDashboard';
import AuditList from './pages/Audit/AuditList';
import AuditFindings from './pages/Audit/AuditFindings';
import AddAuditFinding from './pages/Audit/AddAuditFinding';
import CorrectiveActions from './pages/Audit/CorrectiveActions';
import AuditTrail from './pages/Audit/AuditTrail';
import AuditReports from './pages/Audit/AuditReports';
import AuditSchedules from './pages/Audit/AuditSchedules';
import AuditForm from './pages/Audit/AuditForm';
import CorrectiveActionForm from './pages/Audit/CorrectiveActionForm';

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
import EmployeeLeaveHistory from './pages/HR/Leaves/EmployeeLeaveHistory';

// Component to handle role-based redirects
const RoleBasedRedirect = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Get appropriate redirect path based on user role
  const getRedirectPath = (userRole) => {
    switch (userRole) {
      case 'super_admin':
        return '/dashboard';
      case 'admin':
        return '/admin/staff-management';
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

// Public Route Component (redirects to role-appropriate page if already logged in)
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
    // Get appropriate redirect path based on user role
    const getRedirectPath = (userRole) => {
      switch (userRole) {
        case 'super_admin':
          return '/dashboard';
        case 'admin':
          return '/admin/staff-management';
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
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><Dashboard /></ProtectedRoute>} 
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
              element={<ProtectedRoute requiredRole={['super_admin', 'admin', 'hr_manager']}><LeaveManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/leaves/approval" 
              element={<ProtectedRoute requiredRole={['super_admin', 'admin', 'hr_manager']}><LeaveApproval /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/leaves/calendar" 
              element={<ProtectedRoute requiredRole={['super_admin', 'admin', 'hr_manager']}><LeaveCalendar /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/leaves/reports" 
              element={<ProtectedRoute requiredRole={['super_admin', 'admin', 'hr_manager']}><LeaveReports /></ProtectedRoute>} 
            />
            <Route 
              path="/hr/leaves/employee/:employeeId" 
              element={<ProtectedRoute requiredRole={['super_admin', 'admin', 'hr_manager']}><EmployeeLeaveHistory /></ProtectedRoute>} 
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
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><AdvancedFinanceDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/accounts" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><ChartOfAccounts /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/journal-entries" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><JournalEntriesList /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/journal-entries/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><JournalEntryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/journal-entries/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><JournalEntryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/journal-entries/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><JournalEntryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/general-ledger" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><GeneralLedger /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/accounts-receivable" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><AccountsReceivable /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/accounts-payable" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><AccountsPayable /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/banking" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><Banking /></ProtectedRoute>} 
            />
            <Route 
              path="/finance/reports" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}><FinancialReports /></ProtectedRoute>} 
            />

            {/* Procurement Module */}
            <Route 
              path="/procurement" 
              element={<ProtectedRoute><ProcurementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/purchase-orders" 
              element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/vendors" 
              element={<ProtectedRoute><Vendors /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/inventory" 
              element={<ProtectedRoute><Inventory /></ProtectedRoute>} 
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
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><UserManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/sub-roles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><SubRoleManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/roles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><RoleManagement /></ProtectedRoute>} 
            />
            {/* Vehicle Management Routes */}
            <Route 
              path="/admin/vehicle-management" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/:id/view" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleDetailsView /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/maintenance" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleMaintenanceList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/maintenance/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleMaintenanceForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/maintenance/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleMaintenanceForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleLogBookList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleLogBookForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook/:id/view" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleLogBookDetailsView /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleLogBookForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/reports" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleReports /></ProtectedRoute>} 
            />
            {/* Legacy vehicle routes for backward compatibility */}
            <Route 
              path="/admin/vehicles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id/view" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleDetailsView /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><GroceryList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/stock-alerts" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StockAlerts /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><PettyCashDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/funds/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><FundForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/funds/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><FundForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/expenses/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><ExpenseForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/expenses/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><ExpenseForm /></ProtectedRoute>} 
            />
            
            {/* Event Management Routes */}
            <Route 
              path="/admin/events" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><EventDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/list" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><EventList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><EventForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><EventDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><EventForm /></ProtectedRoute>} 
            />
            
            {/* Staff Management Routes */}
            <Route 
              path="/admin/staff-management" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffManagementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffAssignmentList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/locations" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><LocationManagement /></ProtectedRoute>} 
            />

            {/* Utility Bills Management Routes */}
            <Route 
              path="/admin/utility-bills" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><UtilityBillDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/list" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><UtilityBillList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><UtilityBillForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><UtilityBillForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><UtilityBillDetails /></ProtectedRoute>} 
            />

            {/* Rental Management Routes */}
            <Route 
              path="/admin/rental-agreements" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><RentalAgreementList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-agreements/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><RentalAgreementDetail /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-management" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><RentalManagementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-management/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><RentalManagementDetail /></ProtectedRoute>} 
            />

            {/* Payment Settlement Routes */}
            <Route 
              path="/admin/payment-settlement/:action/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><PaymentSettlement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/payment-settlement/:action" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><PaymentSettlement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/payment-settlement" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><PaymentSettlement /></ProtectedRoute>} 
            />

            {/* IT Module Routes */}
            <Route 
              path="/it" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><ITDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/it/assets" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><AssetList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/assets/add" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><AssetForm /></ProtectedRoute>} 
            />
            <Route 
              path="/it/assets/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><AssetList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/assets/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><AssetForm /></ProtectedRoute>} 
            />
            <Route 
              path="/it/assets/:id/assign" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><AssetAssignment /></ProtectedRoute>} 
            />
            
            {/* Software Management Routes */}
            <Route 
              path="/it/software" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><SoftwareList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/software/add" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><SoftwareForm /></ProtectedRoute>} 
            />
            <Route 
              path="/it/software/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><SoftwareList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/software/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><SoftwareForm /></ProtectedRoute>} 
            />
            
            {/* Network Management Routes */}
            <Route 
              path="/it/network" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><NetworkList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/network/add" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><NetworkForm /></ProtectedRoute>} 
            />
            <Route 
              path="/it/network/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><NetworkList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/network/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><NetworkForm /></ProtectedRoute>} 
            />
            
            {/* Vendor Management Routes */}
            <Route 
              path="/it/vendors" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><VendorList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/vendors/add" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><VendorForm /></ProtectedRoute>} 
            />
            <Route 
              path="/it/vendors/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><VendorList /></ProtectedRoute>} 
            />
            <Route 
              path="/it/vendors/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><VendorForm /></ProtectedRoute>} 
            />
        <Route
          path="/it/vendors/:id/contracts"
          element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><VendorContracts /></ProtectedRoute>}
        />
        <Route
          path="/it/vendors/:id/passwords"
          element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><PasswordWallet /></ProtectedRoute>}
        />
        <Route
          path="/it/vendors/:id/passwords/new"
          element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><PasswordForm /></ProtectedRoute>}
        />
        <Route
          path="/it/passwords/:passwordId/edit"
          element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><PasswordForm /></ProtectedRoute>}
        />
        
        {/* Password Wallet Dashboard Routes */}
        <Route
          path="/it/passwords"
          element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><PasswordWalletDashboard /></ProtectedRoute>}
        />
        <Route
          path="/it/passwords/new"
          element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><PasswordForm /></ProtectedRoute>}
        />
            
            {/* IT Reports Routes */}
            <Route 
              path="/it/reports" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "it_manager"]}><ITReports /></ProtectedRoute>} 
            />

            {/* Audit Module Routes */}
            <Route 
              path="/audit" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor"]}><AuditDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/list" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor"]}><AuditList /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager"]}><AuditForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/:auditId/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager"]}><AuditForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/findings" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor"]}><AuditFindings /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/findings/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor"]}><AddAuditFinding /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/corrective-actions" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor"]}><CorrectiveActions /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/corrective-actions/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager"]}><CorrectiveActionForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/corrective-actions/:actionId/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager"]}><CorrectiveActionForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/trail" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager"]}><AuditTrail /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/reports" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor"]}><AuditReports /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/schedules" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor"]}><AuditSchedules /></ProtectedRoute>} 
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