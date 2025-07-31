import api from './api';

// Get all candidates with pagination and filters
export const getCandidates = async (params = {}) => {
  try {
    const response = await api.get('/candidates', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get candidate by ID
export const getCandidateById = async (id) => {
  try {
    const response = await api.get(`/candidates/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create new candidate
export const createCandidate = async (candidateData) => {
  try {
    const response = await api.post('/candidates', candidateData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update candidate
export const updateCandidate = async (id, candidateData) => {
  try {
    const response = await api.put(`/candidates/${id}`, candidateData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update candidate status
export const updateCandidateStatus = async (id, status) => {
  try {
    const response = await api.put(`/candidates/${id}/status`, { status });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Add note to candidate
export const addCandidateNote = async (id, content) => {
  try {
    const response = await api.post(`/candidates/${id}/notes`, { content });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete candidate
export const deleteCandidate = async (id) => {
  try {
    const response = await api.delete(`/candidates/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get candidate statistics
export const getCandidateStats = async () => {
  try {
    const response = await api.get('/candidates/stats/overview');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Format candidate data for display
export const formatCandidateData = (candidate) => {
  if (!candidate) return null;

  return {
    ...candidate,
    fullName: candidate.fullName,
    age: candidate.age,
    statusColor: getCandidateStatusColor(candidate.status),
    statusLabel: candidate.statusLabel,
    sourceLabel: candidate.sourceLabel,
    availabilityLabel: candidate.availabilityLabel,
    preferredWorkTypeLabel: candidate.preferredWorkTypeLabel
  };
};

// Get status color for candidate
export const getCandidateStatusColor = (status) => {
  const colors = {
    active: 'info',
    shortlisted: 'warning',
    interviewed: 'primary',
    passed: 'success',
    approval_pending: 'warning',
    approval_in_progress: 'info',
    approved: 'success',
    offered: 'success',
    hired: 'success',
    rejected: 'error',
    withdrawn: 'default'
  };
  return colors[status] || 'default';
};

// Get status label for candidate
export const getCandidateStatusLabel = (status) => {
  const labels = {
    active: 'Active',
    shortlisted: 'Shortlisted',
    interviewed: 'Interviewed',
    passed: 'Passed Interview',
    approval_pending: 'Approval Pending',
    approval_in_progress: 'Approval In Progress',
    approved: 'Approved',
    offered: 'Offered',
    hired: 'Hired',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  };
  return labels[status] || status;
};

// Get source label
export const getSourceLabel = (source) => {
  const labels = {
    website: 'Company Website',
    job_board: 'Job Board',
    referral: 'Employee Referral',
    social_media: 'Social Media',
    recruitment_agency: 'Recruitment Agency',
    direct_application: 'Direct Application',
    other: 'Other'
  };
  return labels[source] || source;
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

// Get preferred work type label
export const getPreferredWorkTypeLabel = (type) => {
  const labels = {
    on_site: 'On-Site',
    remote: 'Remote',
    hybrid: 'Hybrid'
  };
  return labels[type] || type;
};

// Get experience level based on years
export const getExperienceLevel = (years) => {
  if (years < 2) return 'Entry Level';
  if (years < 5) return 'Junior';
  if (years < 8) return 'Mid Level';
  if (years < 12) return 'Senior';
  return 'Lead/Manager';
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

// Calculate age from date of birth
export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Format education for display
export const formatEducation = (education) => {
  if (!education || education.length === 0) return 'No education specified';
  
  return education.map(edu => 
    `${edu.degree} in ${edu.field} from ${edu.institution} (${edu.graduationYear})`
  ).join(', ');
};

// Format work experience for display
export const formatWorkExperience = (experience) => {
  if (!experience || experience.length === 0) return 'No work experience specified';
  
  return experience.map(exp => {
    const endDate = exp.isCurrent ? 'Present' : new Date(exp.endDate).getFullYear();
    return `${exp.position} at ${exp.company} (${new Date(exp.startDate).getFullYear()} - ${endDate})`;
  }).join(', ');
};

// Format skills for display
export const formatSkills = (skills) => {
  if (!skills || skills.length === 0) return 'No skills specified';
  
  return skills.map(skill => 
    `${skill.name} (${skill.level})`
  ).join(', ');
};

// Format languages for display
export const formatLanguages = (languages) => {
  if (!languages || languages.length === 0) return 'No languages specified';
  
  return languages.map(lang => 
    `${lang.language} (${lang.proficiency})`
  ).join(', ');
};

export default {
  getCandidates,
  getCandidateById,
  createCandidate,
  updateCandidate,
  updateCandidateStatus,
  addCandidateNote,
  deleteCandidate,
  getCandidateStats,
  formatCandidateData,
  getCandidateStatusColor,
  getCandidateStatusLabel,
  getSourceLabel,
  getAvailabilityLabel,
  getPreferredWorkTypeLabel,
  getExperienceLevel,
  formatExpectedSalary,
  calculateAge,
  formatEducation,
  formatWorkExperience,
  formatSkills,
  formatLanguages
}; 