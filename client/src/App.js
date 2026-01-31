import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layout Components
import Layout from './components/Layout/Layout';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import NoChromeLayout from './components/NoChromeLayout';

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
import RentalAgreementsFinance from './pages/Finance/TajUtilities/RentalAgreements';
import RentalAgreementDetailFinance from './pages/Finance/TajUtilities/RentalAgreementDetail';
import RentalManagementFinance from './pages/Finance/TajUtilities/RentalManagement';
import TajProperties from './pages/Finance/TajUtilities/TajProperties';
import TajPropertyDetail from './pages/Finance/TajUtilities/TajPropertyDetail';
import RentalManagementDetailFinance from './pages/Finance/TajUtilities/RentalManagementDetail';
import TajUtilitiesDashboard from './pages/Finance/TajUtilities/Dashboard';
import CAMCharges from './pages/Finance/TajUtilities/CAMCharges';
import Electricity from './pages/Finance/TajUtilities/Electricity';
import ChargesSlabs from './pages/Finance/TajUtilities/ChargesSlabs';
import Invoices from './pages/Finance/TajUtilities/Invoices';
import OpenInvoices from './pages/Finance/TajUtilities/OpenInvoices';
import TajResidents from './pages/Finance/TajUtilities/TajResidents';
import Deposits from './pages/Finance/TajUtilities/Deposits';
import SuspenseAccount from './pages/Finance/TajUtilities/SuspenseAccount';
import TajResidentDetail from './pages/Finance/TajUtilities/TajResidentDetail';
import TajUtilitiesReports from './pages/Finance/TajUtilities/Reports';
import RecoveryAssignments from './pages/Finance/Recovery/RecoveryAssignments';
import RecoveryMembers from './pages/Finance/Recovery/RecoveryMembers';
import CompletedTasks from './pages/Finance/Recovery/CompletedTasks';
import JournalEntryForm from './pages/Finance/JournalEntryForm';
import JournalEntriesList from './pages/Finance/JournalEntriesList';
import ProcurementDashboard from './pages/Procurement/ProcurementDashboard';
import Requisitions from './pages/Procurement/Requisitions';
import RequisitionPrintView from './pages/Procurement/RequisitionPrintView';
import Quotations from './pages/Procurement/Quotations';
import PurchaseOrders from './pages/Procurement/PurchaseOrders';
import ComparativeStatements from './pages/Procurement/ComparativeStatements';
import Vendors from './pages/Procurement/Vendors';
import Inventory from './pages/Procurement/Inventory';
import GoodsReceive from './pages/Procurement/GoodsReceive';
import GoodsIssue from './pages/Procurement/GoodsIssue';
import CostCenters from './pages/Procurement/CostCenters';
import StoreDashboard from './pages/Procurement/Store/StoreDashboard';
import QualityAssurance from './pages/Procurement/Store/QualityAssurance';
import SalesDashboard from './pages/Sales/SalesDashboard';
import SalesOrders from './pages/Sales/SalesOrders';
import SalesCustomers from './pages/Sales/SalesCustomers';
import SalesProducts from './pages/Sales/SalesProducts';
import SalesReports from './pages/Sales/SalesReports';
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
import VehicleLocationList from './pages/Admin/VehicleManagement/VehicleLocationList';
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
import AdminDashboard from './pages/Admin/AdminDashboard';

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
import TajResidenciaDashboard from './pages/TajResidencia/TajResidenciaDashboard';

// Taj Residencia - Land Acquisition Module Components
import LandAcquisitionDashboard from './pages/TajResidencia/LandAcquisition/LandAcquisitionDashboard';
import LandIdentification from './pages/TajResidencia/LandAcquisition/LandIdentification';
import LandIdentificationList from './pages/TajResidencia/LandAcquisition/LandIdentificationList';
import RecordVerification from './pages/TajResidencia/LandAcquisition/RecordVerification';
import RecordVerificationList from './pages/TajResidencia/LandAcquisition/RecordVerificationList';
import KhasraMapping from './pages/TajResidencia/LandAcquisition/KhasraMapping';
import KhasraMappingList from './pages/TajResidencia/LandAcquisition/KhasraMappingList';
import Demarcation from './pages/TajResidencia/LandAcquisition/Demarcation';
import DemarcationList from './pages/TajResidencia/LandAcquisition/DemarcationList';
import OwnerDueDiligence from './pages/TajResidencia/LandAcquisition/OwnerDueDiligence';
import OwnerDueDiligenceList from './pages/TajResidencia/LandAcquisition/OwnerDueDiligenceList';
import NegotiationBayana from './pages/TajResidencia/LandAcquisition/NegotiationBayana';
import Registry from './pages/TajResidencia/LandAcquisition/Registry';
import Mutation from './pages/TajResidencia/LandAcquisition/Mutation';
import SocietyInternalProcessing from './pages/TajResidencia/LandAcquisition/SocietyInternalProcessing';
import GISMapAlignment from './pages/TajResidencia/LandAcquisition/GISMapAlignment';
import LandConversion from './pages/TajResidencia/LandAcquisition/LandConversion';
import CompensationManagement from './pages/TajResidencia/LandAcquisition/CompensationManagement';
import EncroachmentDispute from './pages/TajResidencia/LandAcquisition/EncroachmentDispute';
import ReportingFramework from './pages/TajResidencia/LandAcquisition/ReportingFramework';
import ComplainsTickets from './pages/TajResidencia/ComplainsTickets';

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
import PreAudit from './pages/Audit/PreAudit';

import DepartmentManagement from './pages/HR/DepartmentManagement';
import PositionManagement from './pages/HR/PositionManagement';
import BankManagement from './pages/HR/BankManagement';
import NotFound from './pages/NotFound/NotFound';

import FBRTaxManagement from './pages/HR/FBRTaxManagement';
import EvaluationDocuments from './pages/HR/EvaluationAppraisal/EvaluationDocuments';
import EvaluationAuthorities from './pages/HR/EvaluationAppraisal/EvaluationAuthorities';
import EvaluationDashboard from './pages/HR/EvaluationAppraisal/EvaluationDashboard';
import DocumentsTracking from './pages/HR/DocumentsTracking';
import DocumentsTrackingDashboard from './pages/DocumentsTracking/DocumentsTrackingDashboard';
import EvaluationTracking from './pages/DocumentsTracking/EvaluationTracking';
import UserTracking from './pages/General/UserTracking';
import IndentsDashboard from './pages/General/Indents/IndentsDashboard';
import IndentsList from './pages/General/Indents/IndentsList';
import IndentForm from './pages/General/Indents/IndentForm';
import IndentDetail from './pages/General/Indents/IndentDetail';
import IndentPrintView from './pages/General/Indents/IndentPrintView';
import Payments from './pages/General/Payments';
import ProjectManagement from './pages/General/ProjectManagement';
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
import PublicEvaluationForm from './pages/Public/PublicEvaluationForm';
import PublicQuotationForm from './pages/Public/PublicQuotationForm';
import RegisterComplaint from './pages/Public/RegisterComplaint';
import MyComplaints from './pages/Public/MyComplaints';
import TajComplaintsPortal from './pages/Public/TajComplaintsPortal';

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

// Shared loading screen component
const LoadingScreen = ({ message = 'Loading SGC ERP System...' }) => (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
    sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
    <Box sx={{ textAlign: 'center', color: 'white' }}>
          <CircularProgress size={60} sx={{ color: 'white', mb: 2 }} />
      <Typography variant="h6">{message}</Typography>
    </Box>
  </Box>
);

// Network error screen component
const NetworkErrorScreen = ({ error, onRetry }) => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
  >
    <Box sx={{ textAlign: 'center', color: 'white', maxWidth: 500, p: 4 }}>
      <Typography variant="h5" gutterBottom>Connection Issue</Typography>
      <Typography variant="body1" sx={{ mb: 3, opacity: 0.9 }}>{error}</Typography>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button
          variant="contained"
          onClick={onRetry}
          sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' } }}
        >
          Retry Connection
        </Button>
        <Button
          variant="outlined"
          onClick={() => window.location.reload()}
          sx={{ borderColor: 'white', color: 'white', '&:hover': { borderColor: 'rgba(255,255,255,0.9)', bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
          Refresh Page
        </Button>
      </Box>
        </Box>
      </Box>
    );

function App() {
  const { user, loading, token, error, retryAuth } = useAuth();

  if (loading) return <LoadingScreen />;
  
  if (!user && token && error?.includes('Connection issue')) {
    return <NetworkErrorScreen error={error} onRetry={retryAuth} />;
  }

  // If user is not authenticated, show login page and public routes
  if (!user) {
    return (
      <NoChromeLayout>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/apply/:affiliateCode" element={<JobApplication />} />
          <Route path="/public-approval/:id" element={<PublicApproval />} />
          <Route path="/candidates/offer/:candidateId" element={<OfferAcceptance />} />
          <Route path="/public-joining-document/:approvalId" element={<PublicJoiningDocument />} />
          <Route path="/public-employee-onboarding/:id" element={<PublicEmployeeOnboarding />} />
          <Route path="/hr/evaluation-appraisal/fill/:id" element={<PublicEvaluationForm />} />
          <Route path="/public-quotation/:token" element={<PublicQuotationForm />} />
          <Route path="/taj-complaints" element={<TajComplaintsPortal />} />
          <Route path="/taj-complaints/register" element={<RegisterComplaint />} />
          <Route path="/taj-complaints/my" element={<MyComplaints />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </NoChromeLayout>
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

            {/* Evaluation & Appraisal Routes */}
            <Route
              path="/hr/evaluation-appraisal/fill/:id"
              element={<PublicEvaluationForm />}
            />
            <Route
              path="/hr/evaluation-appraisal/edit/:id"
              element={<ProtectedRoute><PublicEvaluationForm /></ProtectedRoute>}
            />
            <Route
              path="/hr/evaluation-appraisal/dashboard"
              element={<ProtectedRoute><EvaluationDashboard /></ProtectedRoute>}
            />
            <Route
              path="/hr/evaluation-appraisal/documents"
              element={<ProtectedRoute><EvaluationDocuments /></ProtectedRoute>}
            />
            <Route
              path="/hr/evaluation-appraisal/authorities"
              element={<ProtectedRoute requiredRole="super_admin"><EvaluationAuthorities /></ProtectedRoute>}
            />

            {/* Documents Tracking Routes */}
            <Route
              path="/documents-tracking/dashboard"
              element={<ProtectedRoute><DocumentsTrackingDashboard /></ProtectedRoute>}
            />
            <Route
              path="/documents-tracking/evaluation"
              element={<ProtectedRoute><EvaluationTracking /></ProtectedRoute>}
            />
            <Route
              path="/documents-tracking"
              element={<ProtectedRoute><DocumentsTracking /></ProtectedRoute>}
            />

            {/* Indents Routes */}
            <Route
              path="/general/indents/dashboard"
              element={<ProtectedRoute><IndentsDashboard /></ProtectedRoute>}
            />
            <Route
              path="/general/indents/create"
              element={<ProtectedRoute><IndentForm /></ProtectedRoute>}
            />
            <Route
              path="/general/indents/:id/edit"
              element={<ProtectedRoute><IndentForm /></ProtectedRoute>}
            />
            <Route
              path="/general/indents/:id/print"
              element={<ProtectedRoute><IndentPrintView /></ProtectedRoute>}
            />
            <Route
              path="/general/indents/:id"
              element={<ProtectedRoute><IndentDetail /></ProtectedRoute>}
            />
            <Route
              path="/general/indents"
              element={<ProtectedRoute><IndentsList /></ProtectedRoute>}
            />
            
            <Route
              path="/general/ceo-secretariat/payments"
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><Payments /></ProtectedRoute>}
            />
            <Route
              path="/general/user-tracking"
              element={<ProtectedRoute><UserTracking /></ProtectedRoute>}
            />
            <Route
              path="/general/project-management"
              element={<ProtectedRoute><ProjectManagement /></ProtectedRoute>}
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
            <Route
              path="/finance/taj-utilities-charges"
              element={<Navigate to="/finance/taj-utilities-charges/dashboard" replace />}
            />
            <Route
              path="/finance/taj-utilities-charges/dashboard"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <TajUtilitiesDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/cam-charges"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <CAMCharges />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/electricity-bills"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <Electricity />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/rental-agreements"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <RentalAgreementsFinance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/rental-agreements/:id"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <RentalAgreementDetailFinance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/rental-management"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <RentalManagementFinance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/rental-management/:id"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <RentalManagementDetailFinance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/taj-residents"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <TajResidents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/taj-residents/:id"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <TajResidentDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/taj-properties"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <TajProperties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/taj-properties/:id"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <TajPropertyDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/charges-slabs"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <ChargesSlabs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/invoices"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/open-invoices"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <OpenInvoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/deposits"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <Deposits />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/suspense-account"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <SuspenseAccount />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/taj-utilities-charges/reports"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager", "tcm_manager"]}>
                  <TajUtilitiesReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/recovery"
              element={<Navigate to="/finance/recovery/recovery-assignments" replace />}
            />
            <Route
              path="/finance/recovery/recovery-assignments"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}>
                  <RecoveryAssignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/recovery/recovery-members"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}>
                  <RecoveryMembers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance/recovery/completed-tasks"
              element={
                <ProtectedRoute requiredRole={["super_admin", "admin", "finance_manager"]}>
                  <CompletedTasks />
                </ProtectedRoute>
              }
            />

            {/* Procurement Module */}
            <Route 
              path="/procurement" 
              element={<ProtectedRoute><ProcurementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/requisitions/:id/print"
              element={<ProtectedRoute><RequisitionPrintView /></ProtectedRoute>}
            />
            <Route 
              path="/procurement/requisitions" 
              element={<ProtectedRoute><Requisitions /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/quotations" 
              element={<ProtectedRoute><Quotations /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/comparative-statements" 
              element={<ProtectedRoute><ComparativeStatements /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/purchase-orders" 
              element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/vendors" 
              element={<ProtectedRoute><Vendors /></ProtectedRoute>} 
            />
            {/* Store Submodule Routes */}
            <Route 
              path="/procurement/store" 
              element={<ProtectedRoute><StoreDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/store/quality-assurance" 
              element={<ProtectedRoute><QualityAssurance /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/store/inventory" 
              element={<ProtectedRoute><Inventory /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/store/goods-receive" 
              element={<ProtectedRoute><GoodsReceive /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/store/goods-issue" 
              element={<ProtectedRoute><GoodsIssue /></ProtectedRoute>} 
            />
            <Route 
              path="/procurement/store/cost-center" 
              element={<ProtectedRoute><CostCenters /></ProtectedRoute>} 
            />
            {/* Legacy routes - redirect to new paths */}
            <Route 
              path="/procurement/inventory" 
              element={<Navigate to="/procurement/store/inventory" replace />} 
            />
            <Route 
              path="/procurement/goods-receive" 
              element={<Navigate to="/procurement/store/goods-receive" replace />} 
            />
            <Route 
              path="/procurement/goods-issue" 
              element={<Navigate to="/procurement/store/goods-issue" replace />} 
            />
            <Route 
              path="/procurement/cost-centers" 
              element={<Navigate to="/procurement/store/cost-center" replace />} 
            />

            {/* Sales Module */}
            <Route 
              path="/sales" 
              element={<ProtectedRoute><SalesDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/sales/orders" 
              element={<ProtectedRoute><SalesOrders /></ProtectedRoute>} 
            />
            <Route 
              path="/sales/customers" 
              element={<ProtectedRoute><SalesCustomers /></ProtectedRoute>} 
            />
            <Route 
              path="/sales/products" 
              element={<ProtectedRoute><SalesProducts /></ProtectedRoute>} 
            />
            <Route 
              path="/sales/reports" 
              element={<ProtectedRoute><SalesReports /></ProtectedRoute>} 
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
              path="/admin/dashboard" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "am_admin", "hod_admin", "audit_manager", "finance_manager", "ceo_office", "hr_manager"]}><AdminDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/users" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "appraisal_manager"]}><UserManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/sub-roles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><SubRoleManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/roles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><RoleManagement /></ProtectedRoute>} 
            />
            {/* Vehicle Management Routes */}
            <Route 
              path="/admin/vehicle-management" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/:id/view" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleDetailsView /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/vehicles/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/location" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleLocationList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/maintenance" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleMaintenanceList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/maintenance/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleMaintenanceForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/maintenance/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleMaintenanceForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleLogBookList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleLogBookForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook/:id/view" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleLogBookDetailsView /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/logbook/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleLogBookForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicle-management/reports" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleReports /></ProtectedRoute>} 
            />
            {/* Legacy vehicle routes for backward compatibility */}
            <Route 
              path="/admin/vehicles" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id/view" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleDetailsView /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/vehicles/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><VehicleForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><GroceryList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><GroceryForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/groceries/stock-alerts" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><StockAlerts /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><PettyCashDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/funds/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><FundForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/funds/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><FundForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/expenses/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><ExpenseForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/petty-cash/expenses/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><ExpenseForm /></ProtectedRoute>} 
            />
            
            {/* Event Management Routes */}
            <Route 
              path="/admin/events" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><EventDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/list" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><EventList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><EventForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><EventDetails /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/events/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><EventForm /></ProtectedRoute>} 
            />
            
            {/* Staff Management Routes */}
            <Route 
              path="/admin/staff-management" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><StaffManagementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><StaffAssignmentList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/staff-management/assignments/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><StaffAssignmentForm /></ProtectedRoute>} 
            />
            <Route
              path="/admin/staff-management/locations"
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><LocationManagement /></ProtectedRoute>}
            />


            {/* Utility Bills Management Routes */}
            <Route 
              path="/admin/utility-bills" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><UtilityBillDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/list" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><UtilityBillList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><UtilityBillForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/:id/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><UtilityBillForm /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/utility-bills/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin"]}><UtilityBillDetails /></ProtectedRoute>} 
            />

            {/* Rental Management Routes */}
            <Route 
              path="/admin/rental-agreements" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><RentalAgreementList /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-agreements/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><RentalAgreementDetail /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-management" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><RentalManagementDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/rental-management/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><RentalManagementDetail /></ProtectedRoute>} 
            />

            {/* Payment Settlement Routes */}
            <Route 
              path="/admin/payment-settlement/:action/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><PaymentSettlement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/payment-settlement/:action" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><PaymentSettlement /></ProtectedRoute>} 
            />
            <Route 
              path="/admin/payment-settlement" 
              element={<ProtectedRoute requiredRole={["super_admin", "admin", "hr_manager"]}><PaymentSettlement /></ProtectedRoute>} 
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

            {/* Taj Residencia Routes */}
            <Route 
              path="/taj-residencia" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><TajResidenciaDashboard /></ProtectedRoute>} 
            />
            
            {/* Land Acquisition Routes */}
            <Route 
              path="/taj-residencia/land-acquisition" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><LandAcquisitionDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/land-identification/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><LandIdentification /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/land-identification/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><LandIdentification /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/land-identification" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><LandIdentificationList /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/record-verification/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><RecordVerification /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/record-verification/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><RecordVerification /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/record-verification" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><RecordVerificationList /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/khasra-mapping/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><KhasraMapping /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/khasra-mapping/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><KhasraMapping /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/khasra-mapping" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><KhasraMappingList /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/demarcation/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><Demarcation /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/demarcation/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><Demarcation /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/demarcation" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><DemarcationList /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/owner-due-diligence/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><OwnerDueDiligence /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/owner-due-diligence/:id" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><OwnerDueDiligence /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/owner-due-diligence" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><OwnerDueDiligenceList /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/negotiation-bayana" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><NegotiationBayana /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/registry" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><Registry /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/mutation" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><Mutation /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/society-internal-processing" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><SocietyInternalProcessing /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/gis-map-alignment" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><GISMapAlignment /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/land-conversion" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><LandConversion /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/compensation-management" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><CompensationManagement /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/encroachment-dispute" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><EncroachmentDispute /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/land-acquisition/reporting-framework" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><ReportingFramework /></ProtectedRoute>} 
            />
            <Route 
              path="/taj-residencia/complains-tickets" 
              element={<ProtectedRoute requiredRole={["super_admin", "taj_residencia_manager"]}><ComplainsTickets /></ProtectedRoute>} 
            />

            {/* Audit Module Routes */}
            <Route 
              path="/audit" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><AuditDashboard /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/list" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><AuditList /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "Audit Director"]}><AuditForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/:auditId/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "Audit Director"]}><AuditForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/findings" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><AuditFindings /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/findings/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><AddAuditFinding /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/corrective-actions" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><CorrectiveActions /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/corrective-actions/new" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "Audit Director"]}><CorrectiveActionForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/corrective-actions/:actionId/edit" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "Audit Director"]}><CorrectiveActionForm /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/trail" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "Audit Director"]}><AuditTrail /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/reports" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><AuditReports /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/schedules" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><AuditSchedules /></ProtectedRoute>} 
            />
            <Route 
              path="/audit/pre-audit" 
              element={<ProtectedRoute requiredRole={["super_admin", "audit_manager", "auditor", "Audit Director"]}><PreAudit /></ProtectedRoute>} 
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

            <Route 
              path="/taj-complaints" 
              element={<TajComplaintsPortal />} 
            />
            <Route 
              path="/taj-complaints/register" 
              element={<RegisterComplaint />} 
            />
            <Route 
              path="/taj-complaints/my" 
              element={<MyComplaints />} 
            />

            {/* Public Routes (accessible to authenticated users) */}
            <Route 
              path="/public-quotation/:token" 
              element={
                <NoChromeLayout>
                  <PublicQuotationForm />
                </NoChromeLayout>
              } 
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