import api from './api';

// Get all training programs with pagination and filters
export const getTrainingPrograms = async (params = {}) => {
  try {
    const response = await api.get('/training-programs', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get training program by ID
export const getTrainingProgramById = async (id) => {
  try {
    const response = await api.get(`/training-programs/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create new training program
export const createTrainingProgram = async (programData) => {
  try {
    const response = await api.post('/training-programs', programData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update training program
export const updateTrainingProgram = async (id, programData) => {
  try {
    const response = await api.put(`/training-programs/${id}`, programData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update training program status
export const updateTrainingProgramStatus = async (id, status) => {
  try {
    const response = await api.put(`/training-programs/${id}/status`, { status });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete training program
export const deleteTrainingProgram = async (id) => {
  try {
    const response = await api.delete(`/training-programs/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get training program statistics
export const getTrainingProgramStats = async () => {
  try {
    const response = await api.get('/training-programs/stats/overview');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Format training program data for display
export const formatTrainingProgramData = (program) => {
  if (!program) return null;

  return {
    ...program,
    statusColor: getTrainingProgramStatusColor(program.status),
    statusLabel: program.statusLabel,
    difficultyLabel: program.difficultyLabel,
    categoryLabel: program.categoryLabel,
    durationHours: program.durationHours,
    enrollmentPercentage: program.enrollmentPercentage
  };
};

// Get status color for training program
export const getTrainingProgramStatusColor = (status) => {
  const colors = {
    draft: 'default',
    active: 'success',
    inactive: 'error',
    archived: 'warning'
  };
  return colors[status] || 'default';
};

// Get status label for training program
export const getTrainingProgramStatusLabel = (status) => {
  const labels = {
    draft: 'Draft',
    active: 'Active',
    inactive: 'Inactive',
    archived: 'Archived'
  };
  return labels[status] || status;
};

// Get difficulty label for training program
export const getTrainingProgramDifficultyLabel = (difficulty) => {
  const labels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert'
  };
  return labels[difficulty] || difficulty;
};

// Get category label for training program
export const getTrainingProgramCategoryLabel = (category) => {
  const labels = {
    technical: 'Technical Skills',
    soft_skills: 'Soft Skills',
    leadership: 'Leadership',
    compliance: 'Compliance',
    productivity: 'Productivity',
    safety: 'Safety',
    customer_service: 'Customer Service',
    sales: 'Sales',
    other: 'Other'
  };
  return labels[category] || category;
};

// Format duration for training program
export const formatTrainingProgramDuration = (minutes) => {
  if (!minutes) return '0 hours';
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

// Check if training program is available for enrollment
export const isTrainingProgramAvailable = (program) => {
  if (!program) return false;
  
  // Check if program is active
  if (program.status !== 'active') return false;
  
  // Check if program has reached max enrollments
  if (program.maxEnrollments && program.currentEnrollments >= program.maxEnrollments) {
    return false;
  }
  
  return true;
};

// Calculate completion percentage for training program
export const calculateTrainingProgramCompletionPercentage = (completedCourses, totalCourses) => {
  if (!totalCourses || totalCourses === 0) return 0;
  return Math.round((completedCourses / totalCourses) * 100);
};

// Get target audience display text
export const getTargetAudienceDisplay = (targetAudience) => {
  if (!targetAudience) return 'All employees';
  
  const parts = [];
  
  if (targetAudience.experienceLevel) {
    parts.push(targetAudience.experienceLevel);
  }
  
  if (targetAudience.departments && targetAudience.departments.length > 0) {
    parts.push(`${targetAudience.departments.length} department(s)`);
  }
  
  if (targetAudience.roles && targetAudience.roles.length > 0) {
    parts.push(`${targetAudience.roles.length} role(s)`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'All employees';
};

// Get completion criteria display text
export const getCompletionCriteriaDisplay = (completionCriteria) => {
  if (!completionCriteria) return 'No criteria set';
  
  const parts = [];
  
  if (completionCriteria.requiredCourses) {
    parts.push(`${completionCriteria.requiredCourses} course(s)`);
  }
  
  if (completionCriteria.minimumScore) {
    parts.push(`${completionCriteria.minimumScore}% minimum score`);
  }
  
  if (completionCriteria.timeLimit) {
    parts.push(`${completionCriteria.timeLimit} day(s) time limit`);
  }
  
  return parts.join(', ');
};

export default {
  getTrainingPrograms,
  getTrainingProgramById,
  createTrainingProgram,
  updateTrainingProgram,
  updateTrainingProgramStatus,
  deleteTrainingProgram,
  getTrainingProgramStats,
  formatTrainingProgramData,
  getTrainingProgramStatusColor,
  getTrainingProgramStatusLabel,
  getTrainingProgramDifficultyLabel,
  getTrainingProgramCategoryLabel,
  formatTrainingProgramDuration,
  isTrainingProgramAvailable,
  calculateTrainingProgramCompletionPercentage,
  getTargetAudienceDisplay,
  getCompletionCriteriaDisplay
}; 