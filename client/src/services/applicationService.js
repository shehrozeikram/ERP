import api from './api';

// Get all applications with pagination and filters
export const getApplications = async (params = {}) => {
  try {
    const response = await api.get('/applications', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get application by ID
export const getApplicationById = async (id) => {
  try {
    const response = await api.get(`/applications/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create new application
export const createApplication = async (applicationData) => {
  try {
    const response = await api.post('/applications', applicationData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update application status
export const updateApplicationStatus = async (id, status) => {
  try {
    const response = await api.put(`/applications/${id}/status`, { status });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Schedule interview
export const scheduleInterview = async (id, interviewData) => {
  try {
    const response = await api.post(`/applications/${id}/interviews`, interviewData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update interview
export const updateInterview = async (applicationId, interviewId, interviewData) => {
  try {
    const response = await api.put(`/applications/${applicationId}/interviews/${interviewId}`, interviewData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Assign technical test
export const assignTechnicalTest = async (id, testData) => {
  try {
    const response = await api.post(`/applications/${id}/technical-tests`, testData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update technical test
export const updateTechnicalTest = async (applicationId, testId, testData) => {
  try {
    const response = await api.put(`/applications/${applicationId}/technical-tests/${testId}`, testData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Add note to application
export const addApplicationNote = async (id, content, type = 'general') => {
  try {
    const response = await api.post(`/applications/${id}/notes`, { content, type });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete application
export const deleteApplication = async (id) => {
  try {
    const response = await api.delete(`/applications/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get application statistics
export const getApplicationStats = async () => {
  try {
    const response = await api.get('/applications/stats/overview');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Format application data for display
export const formatApplicationData = (application) => {
  if (!application) return null;

  return {
    ...application,
    statusColor: getApplicationStatusColor(application.status),
    statusLabel: application.statusLabel,
    availabilityLabel: application.availabilityLabel,
    daysSinceApplication: application.daysSinceApplication,
    nextInterview: application.nextInterview,
    latestInterview: application.latestInterview
  };
};

// Get status color for application
export const getApplicationStatusColor = (status) => {
  const colors = {
    applied: 'info',
    screening: 'warning',
    shortlisted: 'primary',
    interview_scheduled: 'warning',
    interviewed: 'primary',
    technical_test: 'warning',
    reference_check: 'info',
    offer_sent: 'success',
    offer_accepted: 'success',
    offer_declined: 'error',
    hired: 'success',
    rejected: 'error',
    withdrawn: 'default'
  };
  return colors[status] || 'default';
};

// Get status label for application
export const getApplicationStatusLabel = (status) => {
  const labels = {
    applied: 'Applied',
    screening: 'Screening',
    shortlisted: 'Shortlisted',
    interview_scheduled: 'Interview Scheduled',
    interviewed: 'Interviewed',
    technical_test: 'Technical Test',
    reference_check: 'Reference Check',
    offer_sent: 'Offer Sent',
    offer_accepted: 'Offer Accepted',
    offer_declined: 'Offer Declined',
    hired: 'Hired',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  };
  return labels[status] || status;
};

// Get availability label
export const getAvailabilityLabel = (availability) => {
  const labels = {
    immediate: 'Immediate',
    '2_weeks': '2 Weeks',
    '1_month': '1 Month',
    '2_months': '2 Months',
    '3_months': '3 Months',
    negotiable: 'Negotiable'
  };
  return labels[availability] || availability;
};

// Get interview type label
export const getInterviewTypeLabel = (type) => {
  const labels = {
    phone: 'Phone Interview',
    video: 'Video Interview',
    in_person: 'In-Person Interview',
    technical: 'Technical Interview',
    panel: 'Panel Interview',
    final: 'Final Interview'
  };
  return labels[type] || type;
};

// Get interview status color
export const getInterviewStatusColor = (status) => {
  const colors = {
    scheduled: 'warning',
    completed: 'success',
    cancelled: 'error',
    rescheduled: 'info'
  };
  return colors[status] || 'default';
};

// Get technical test status color
export const getTechnicalTestStatusColor = (status) => {
  const colors = {
    assigned: 'warning',
    in_progress: 'info',
    completed: 'success',
    expired: 'error'
  };
  return colors[status] || 'default';
};

// Format expected salary
export const formatExpectedSalary = (salary) => {
  if (!salary) return 'Not specified';
  
  const formatter = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return formatter.format(salary);
};

// Calculate days since application
export const calculateDaysSinceApplication = (createdAt) => {
  if (!createdAt) return 0;
  
  const now = new Date();
  const created = new Date(createdAt);
  const diffTime = now - created;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

// Get next interview
export const getNextInterview = (interviews) => {
  if (!interviews || interviews.length === 0) return null;
  
  const upcomingInterviews = interviews.filter(interview => 
    interview.status === 'scheduled' && new Date(interview.scheduledDate) > new Date()
  );
  
  if (upcomingInterviews.length === 0) return null;
  
  return upcomingInterviews.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))[0];
};

// Get latest interview
export const getLatestInterview = (interviews) => {
  if (!interviews || interviews.length === 0) return null;
  
  const completedInterviews = interviews.filter(interview => 
    interview.status === 'completed'
  );
  
  if (completedInterviews.length === 0) return null;
  
  return completedInterviews.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
};

// Format interview feedback
export const formatInterviewFeedback = (feedback) => {
  if (!feedback) return 'No feedback provided';
  
  const ratings = [];
  if (feedback.technicalSkills) ratings.push(`Technical: ${feedback.technicalSkills}/5`);
  if (feedback.communicationSkills) ratings.push(`Communication: ${feedback.communicationSkills}/5`);
  if (feedback.culturalFit) ratings.push(`Cultural Fit: ${feedback.culturalFit}/5`);
  if (feedback.overallRating) ratings.push(`Overall: ${feedback.overallRating}/5`);
  
  return ratings.join(', ');
};

// Format technical test score
export const formatTechnicalTestScore = (score) => {
  if (score === null || score === undefined) return 'Not scored';
  return `${score}%`;
};

export default {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  scheduleInterview,
  updateInterview,
  assignTechnicalTest,
  updateTechnicalTest,
  addApplicationNote,
  deleteApplication,
  getApplicationStats,
  formatApplicationData,
  getApplicationStatusColor,
  getApplicationStatusLabel,
  getAvailabilityLabel,
  getInterviewTypeLabel,
  getInterviewStatusColor,
  getTechnicalTestStatusColor,
  formatExpectedSalary,
  calculateDaysSinceApplication,
  getNextInterview,
  getLatestInterview,
  formatInterviewFeedback,
  formatTechnicalTestScore
}; 