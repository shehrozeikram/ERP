import api from './api';

// Get all job postings with pagination and filters
export const getJobPostings = async (params = {}) => {
  try {
    const response = await api.get('/job-postings', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get job posting by ID
export const getJobPostingById = async (id) => {
  try {
    const response = await api.get(`/job-postings/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create new job posting
export const createJobPosting = async (jobPostingData) => {
  try {
    const response = await api.post('/job-postings', jobPostingData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update job posting
export const updateJobPosting = async (id, jobPostingData) => {
  try {
    const response = await api.put(`/job-postings/${id}`, jobPostingData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Publish job posting
export const publishJobPosting = async (id) => {
  try {
    const response = await api.put(`/job-postings/${id}/publish`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Close job posting
export const closeJobPosting = async (id) => {
  try {
    const response = await api.put(`/job-postings/${id}/close`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Cancel job posting
export const cancelJobPosting = async (id) => {
  try {
    const response = await api.put(`/job-postings/${id}/cancel`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete job posting
export const deleteJobPosting = async (id) => {
  try {
    const response = await api.delete(`/job-postings/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get job posting statistics
export const getJobPostingStats = async () => {
  try {
    const response = await api.get('/job-postings/stats/overview');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Format job posting data for display
export const formatJobPostingData = (jobPosting) => {
  if (!jobPosting) return null;

  return {
    ...jobPosting,
    statusColor: getJobPostingStatusColor(jobPosting.status),
    statusLabel: jobPosting.statusLabel,
    employmentTypeLabel: jobPosting.employmentTypeLabel,
    experienceLevelLabel: jobPosting.experienceLevelLabel,
    educationLevelLabel: jobPosting.educationLevelLabel,
    formattedSalaryRange: jobPosting.formattedSalaryRange,
    deadlineStatus: jobPosting.deadlineStatus,
    daysUntilDeadline: jobPosting.daysUntilDeadline
  };
};

// Get status color for job posting
export const getJobPostingStatusColor = (status) => {
  const colors = {
    draft: 'default',
    published: 'success',
    closed: 'warning',
    cancelled: 'error'
  };
  return colors[status] || 'default';
};

// Get status label for job posting
export const getJobPostingStatusLabel = (status) => {
  const labels = {
    draft: 'Draft',
    published: 'Published',
    closed: 'Closed',
    cancelled: 'Cancelled'
  };
  return labels[status] || status;
};

// Get employment type label
export const getEmploymentTypeLabel = (type) => {
  const labels = {
    full_time: 'Full Time',
    part_time: 'Part Time',
    contract: 'Contract',
    internship: 'Internship',
    temporary: 'Temporary'
  };
  return labels[type] || type;
};

// Get experience level label
export const getExperienceLevelLabel = (level) => {
  const labels = {
    entry: 'Entry Level',
    junior: 'Junior',
    mid: 'Mid Level',
    senior: 'Senior',
    lead: 'Lead',
    manager: 'Manager',
    director: 'Director',
    executive: 'Executive'
  };
  return labels[level] || level;
};

// Get education level label
export const getEducationLevelLabel = (level) => {
  const labels = {
    high_school: 'High School',
    diploma: 'Diploma',
    bachelors: 'Bachelor\'s Degree',
    masters: 'Master\'s Degree',
    phd: 'PhD',
    other: 'Other'
  };
  return labels[level] || level;
};

// Format salary range
export const formatSalaryRange = (salaryRange) => {
  if (!salaryRange) return 'Not specified';
  
  const formatter = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: salaryRange.currency || 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return `${formatter.format(salaryRange.min)} - ${formatter.format(salaryRange.max)}`;
};

// Get deadline status
export const getDeadlineStatus = (applicationDeadline) => {
  if (!applicationDeadline) return 'normal';
  
  const now = new Date();
  const deadline = new Date(applicationDeadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'urgent';
  if (diffDays <= 30) return 'soon';
  return 'normal';
};

// Get days until deadline
export const getDaysUntilDeadline = (applicationDeadline) => {
  if (!applicationDeadline) return 0;
  
  const now = new Date();
  const deadline = new Date(applicationDeadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

export default {
  getJobPostings,
  getJobPostingById,
  createJobPosting,
  updateJobPosting,
  publishJobPosting,
  closeJobPosting,
  cancelJobPosting,
  deleteJobPosting,
  getJobPostingStats,
  formatJobPostingData,
  getJobPostingStatusColor,
  getJobPostingStatusLabel,
  getEmploymentTypeLabel,
  getExperienceLevelLabel,
  getEducationLevelLabel,
  formatSalaryRange,
  getDeadlineStatus,
  getDaysUntilDeadline
}; 