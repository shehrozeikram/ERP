import api from './api';

// Get all enrollments with pagination and filters
export const getEnrollments = async (params = {}) => {
  try {
    const response = await api.get('/enrollments', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get enrollment by ID
export const getEnrollmentById = async (id) => {
  try {
    const response = await api.get(`/enrollments/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create new enrollment
export const createEnrollment = async (enrollmentData) => {
  try {
    const response = await api.post('/enrollments', enrollmentData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update enrollment
export const updateEnrollment = async (id, enrollmentData) => {
  try {
    const response = await api.put(`/enrollments/${id}`, enrollmentData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete enrollment
export const deleteEnrollment = async (id) => {
  try {
    const response = await api.delete(`/enrollments/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update enrollment status
export const updateEnrollmentStatus = async (id, status) => {
  try {
    const response = await api.put(`/enrollments/${id}/status`, { status });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update enrollment progress
export const updateEnrollmentProgress = async (id, progressData) => {
  try {
    const response = await api.post(`/enrollments/${id}/progress`, progressData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Submit assessment attempt
export const submitAssessment = async (id, assessmentData) => {
  try {
    const response = await api.post(`/enrollments/${id}/assessment`, assessmentData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Submit course rating and review
export const submitRating = async (id, ratingData) => {
  try {
    const response = await api.post(`/enrollments/${id}/rating`, ratingData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get enrollment completion status
export const getCompletionStatus = async (id) => {
  try {
    const response = await api.get(`/enrollments/${id}/completion-status`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Mark enrollment as completed
export const completeEnrollment = async (id) => {
  try {
    const response = await api.post(`/enrollments/${id}/complete`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get enrollment statistics
export const getEnrollmentStats = async () => {
  try {
    const response = await api.get('/enrollments/stats/overview');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get recent enrollments
export const getRecentEnrollments = async (limit = 10) => {
  try {
    const response = await api.get('/enrollments/stats/recent', { params: { limit } });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Format enrollment data for display
export const formatEnrollmentData = (enrollment) => {
  if (!enrollment) return null;

  return {
    ...enrollment,
    statusColor: getEnrollmentStatusColor(enrollment.status),
    statusLabel: enrollment.statusLabel,
    enrollmentTypeLabel: enrollment.enrollmentTypeLabel,
    timeSpentHours: enrollment.timeSpentHours,
    bestAssessmentScore: enrollment.bestAssessmentScore,
    isOverdue: enrollment.isOverdue,
    daysUntilDue: enrollment.daysUntilDue
  };
};

// Get status color for enrollment
export const getEnrollmentStatusColor = (status) => {
  const colors = {
    enrolled: 'info',
    in_progress: 'warning',
    completed: 'success',
    dropped: 'error',
    expired: 'default'
  };
  return colors[status] || 'default';
};

// Get status label for enrollment
export const getEnrollmentStatusLabel = (status) => {
  const labels = {
    enrolled: 'Enrolled',
    in_progress: 'In Progress',
    completed: 'Completed',
    dropped: 'Dropped',
    expired: 'Expired'
  };
  return labels[status] || status;
};

// Get enrollment type label
export const getEnrollmentTypeLabel = (type) => {
  const labels = {
    self_enrolled: 'Self Enrolled',
    assigned: 'Assigned',
    required: 'Required',
    recommended: 'Recommended'
  };
  return labels[type] || type;
};

// Format time spent
export const formatTimeSpent = (minutes) => {
  if (!minutes) return '0 minutes';
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes} minutes`;
  } else if (remainingMinutes === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    return `${hours}h ${remainingMinutes}m`;
  }
};

// Format progress percentage
export const formatProgress = (progress) => {
  if (!progress) return '0%';
  return `${Math.round(progress)}%`;
};

// Format assessment score
export const formatAssessmentScore = (score) => {
  if (score === null || score === undefined) return 'Not attempted';
  return `${score}%`;
};

// Check if enrollment is overdue
export const isEnrollmentOverdue = (enrollment) => {
  if (!enrollment.dueDate) return false;
  if (enrollment.status === 'completed') return false;
  return new Date() > new Date(enrollment.dueDate);
};

// Get days until due
export const getDaysUntilDue = (enrollment) => {
  if (!enrollment.dueDate) return null;
  
  const now = new Date();
  const due = new Date(enrollment.dueDate);
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get days since last access
export const getDaysSinceLastAccess = (enrollment) => {
  if (!enrollment.lastAccessedAt) return null;
  
  const now = new Date();
  const lastAccess = new Date(enrollment.lastAccessedAt);
  const diffTime = now - lastAccess;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get days since enrollment
export const getDaysSinceEnrollment = (enrollment) => {
  if (!enrollment.createdAt) return null;
  
  const now = new Date();
  const enrolled = new Date(enrollment.createdAt);
  const diffTime = now - enrolled;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Calculate completion time
export const calculateCompletionTime = (enrollment) => {
  if (!enrollment.completedAt || !enrollment.startedAt) return null;
  
  const start = new Date(enrollment.startedAt);
  const completed = new Date(enrollment.completedAt);
  const diffTime = completed - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Get best assessment attempt
export const getBestAssessmentAttempt = (enrollment) => {
  if (!enrollment.assessmentAttempts || enrollment.assessmentAttempts.length === 0) {
    return null;
  }
  
  return enrollment.assessmentAttempts.reduce((best, current) => 
    current.score > best.score ? current : best
  );
};

// Get latest assessment attempt
export const getLatestAssessmentAttempt = (enrollment) => {
  if (!enrollment.assessmentAttempts || enrollment.assessmentAttempts.length === 0) {
    return null;
  }
  
  return enrollment.assessmentAttempts.reduce((latest, current) => 
    new Date(current.completedAt) > new Date(latest.completedAt) ? current : latest
  );
};

// Check if enrollment can be completed
export const canCompleteEnrollment = (enrollment) => {
  if (enrollment.status === 'completed') return false;
  if (enrollment.status === 'dropped') return false;
  if (enrollment.status === 'expired') return false;
  return true;
};

// Check if enrollment can be dropped
export const canDropEnrollment = (enrollment) => {
  if (enrollment.status === 'completed') return false;
  if (enrollment.status === 'dropped') return false;
  if (enrollment.status === 'expired') return false;
  return true;
};

// Get enrollment progress status
export const getEnrollmentProgressStatus = (enrollment) => {
  if (enrollment.status === 'completed') return 'completed';
  if (enrollment.status === 'dropped') return 'dropped';
  if (enrollment.status === 'expired') return 'expired';
  if (enrollment.progress === 0) return 'not_started';
  if (enrollment.progress < 25) return 'beginning';
  if (enrollment.progress < 50) return 'quarter';
  if (enrollment.progress < 75) return 'halfway';
  if (enrollment.progress < 100) return 'near_completion';
  return 'completed';
};

// Format due date
export const formatDueDate = (dueDate) => {
  if (!dueDate) return 'No due date';
  
  const date = new Date(dueDate);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return `${Math.abs(diffDays)} days overdue`;
  } else if (diffDays === 0) {
    return 'Due today';
  } else if (diffDays === 1) {
    return 'Due tomorrow';
  } else if (diffDays <= 7) {
    return `Due in ${diffDays} days`;
  } else {
    return date.toLocaleDateString();
  }
};

const enrollmentService = {
  getEnrollments,
  getEnrollmentById,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  updateEnrollmentStatus,
  updateEnrollmentProgress,
  submitAssessment,
  submitRating,
  getCompletionStatus,
  completeEnrollment,
  getEnrollmentStats,
  getRecentEnrollments,
  formatEnrollmentData,
  getEnrollmentStatusColor,
  getEnrollmentStatusLabel,
  getEnrollmentTypeLabel,
  formatTimeSpent,
  formatProgress,
  formatAssessmentScore,
  isEnrollmentOverdue,
  getDaysUntilDue,
  getDaysSinceLastAccess,
  getDaysSinceEnrollment,
  calculateCompletionTime,
  getBestAssessmentAttempt,
  getLatestAssessmentAttempt,
  canCompleteEnrollment,
  canDropEnrollment,
  getEnrollmentProgressStatus,
  formatDueDate
};

export default enrollmentService; 