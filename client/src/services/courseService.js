import api from './api';

// Get all courses with pagination and filters
export const getCourses = async (params = {}) => {
  try {
    const response = await api.get('/courses', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get course by ID
export const getCourseById = async (id) => {
  try {
    const response = await api.get(`/courses/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Create new course
export const createCourse = async (courseData) => {
  try {
    const response = await api.post('/courses', courseData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update course
export const updateCourse = async (id, courseData) => {
  try {
    const response = await api.put(`/courses/${id}`, courseData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Delete course
export const deleteCourse = async (id) => {
  try {
    const response = await api.delete(`/courses/${id}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Update course status
export const updateCourseStatus = async (id, status) => {
  try {
    const response = await api.put(`/courses/${id}/status`, { status });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get course enrollments
export const getCourseEnrollments = async (courseId, params = {}) => {
  try {
    const response = await api.get(`/courses/${courseId}/enrollments`, { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get course statistics
export const getCourseStats = async () => {
  try {
    const response = await api.get('/courses/stats/overview');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get top performing courses
export const getTopPerformingCourses = async (limit = 10) => {
  try {
    const response = await api.get('/courses/stats/top-performing', { params: { limit } });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Format course data for display
export const formatCourseData = (course) => {
  if (!course) return null;

  return {
    ...course,
    statusColor: getCourseStatusColor(course.status),
    statusLabel: course.statusLabel,
    difficultyLabel: course.difficultyLabel,
    categoryLabel: course.categoryLabel,
    durationHours: course.durationHours,
    enrollmentPercentage: course.enrollmentPercentage
  };
};

// Get status color for course
export const getCourseStatusColor = (status) => {
  const colors = {
    draft: 'default',
    published: 'success',
    archived: 'error',
    maintenance: 'warning'
  };
  return colors[status] || 'default';
};

// Get status label for course
export const getCourseStatusLabel = (status) => {
  const labels = {
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    maintenance: 'Under Maintenance'
  };
  return labels[status] || status;
};

// Get difficulty label
export const getDifficultyLabel = (difficulty) => {
  const labels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert'
  };
  return labels[difficulty] || difficulty;
};

// Get category label
export const getCategoryLabel = (category) => {
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

// Format duration in hours
export const formatDuration = (minutes) => {
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

// Format rating
export const formatRating = (rating) => {
  if (!rating || rating.average === 0) return 'No ratings';
  return `${rating.average.toFixed(1)} (${rating.count} reviews)`;
};

// Check if course is available for enrollment
export const isCourseAvailable = (course) => {
  if (!course) return false;
  if (course.status !== 'published') return false;
  if (!course.isActive) return false;
  if (course.maxEnrollments && course.currentEnrollments >= course.maxEnrollments) return false;
  return true;
};

// Get material type icon
export const getMaterialTypeIcon = (type) => {
  const icons = {
    video: 'PlayCircle',
    document: 'Description',
    presentation: 'Slideshow',
    quiz: 'Quiz',
    assignment: 'Assignment',
    link: 'Link'
  };
  return icons[type] || 'Article';
};

// Get material type label
export const getMaterialTypeLabel = (type) => {
  const labels = {
    video: 'Video',
    document: 'Document',
    presentation: 'Presentation',
    quiz: 'Quiz',
    assignment: 'Assignment',
    link: 'External Link'
  };
  return labels[type] || type;
};

// Format file size
export const formatFileSize = (bytes) => {
  if (!bytes) return 'Unknown size';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// Calculate course completion percentage
export const calculateCompletionPercentage = (completedMaterials, totalMaterials) => {
  if (!totalMaterials || totalMaterials.length === 0) return 0;
  if (!completedMaterials) return 0;
  
  const requiredMaterials = totalMaterials.filter(material => material.isRequired);
  const completedRequired = completedMaterials.filter(material => 
    requiredMaterials.some(req => req._id.toString() === material.materialId.toString())
  );
  
  return Math.round((completedRequired.length / requiredMaterials.length) * 100);
};

const courseService = {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  updateCourseStatus,
  getCourseEnrollments,
  getCourseStats,
  getTopPerformingCourses,
  formatCourseData,
  getCourseStatusColor,
  getCourseStatusLabel,
  getDifficultyLabel,
  getCategoryLabel,
  formatDuration,
  formatRating,
  isCourseAvailable,
  getMaterialTypeIcon,
  getMaterialTypeLabel,
  formatFileSize,
  calculateCompletionPercentage
};

export default courseService; 