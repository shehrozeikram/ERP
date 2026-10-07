/**
 * Resolves employee category (white_collar / blue_collar).
 * Prefers stored employeeCategory; falls back to designation title/level.
 */

const WHITE_SPECIFIC_TITLES = [
  '3d visualizer', 'am', 'aso to president', 'advisor', 'architect',
  'assistant vice president', 'autocad operator', 'biology teacher',
  'building inspector', 'cro', 'chemistry teacher', 'clinical instructor',
  'complaint attendant', 'content writer', 'document controller',
  'english teacher', 'graphic designer', 'intern', 'internal auditor',
  'internee', 'islamyat/quran teacher', 'laravel developer',
  'lecturar computer science', 'lecturer', 'lecturer computer science',
  'lecturer-economics', 'librarian',
  'member steering committee', 'montessori', 'montessori teacher',
  'nursing lecturer', 'pak studies & political science',
  'patron-in-chief-education', 'play group teacher', 'president',
  'principal', 'principal law college', 'principal secretary to president',
  'receptionist', 'research assistant', 'research associate',
  'science teacher', 'secretary', 'sharia education & sociology',
  'sr architect', 'teacher', 'teacher it', 'teacher mathematics',
  'teacher pre-school', 'teacher social study', 'urdu teacher',
  'vice principle', 'web developer'
];

const WHITE_KEYWORDS = [
  'manager', 'officer', 'engineer', 'specialist', 'analyst', 'head',
  'director', 'executive', 'supervisor', 'lead', 'coordinator',
  'administrator', 'consultant', 'teacher', 'developer', 'designer',
  'architect', 'inspector', 'secretary', 'principal', 'president'
];

const BLUE_KEYWORDS = [
  'worker', 'technician', 'operator', 'labour', 'labor', 'helper',
  'driver', 'mechanic', 'foreman', 'attendant'
];

export const classifyDesignationCategory = (title = '', level = '') => {
  const normalizedTitle = String(title || '').toLowerCase();
  const normalizedLevel = String(level || '').toLowerCase();

  if (WHITE_SPECIFIC_TITLES.some((item) => normalizedTitle === item)) {
    return 'white_collar';
  }

  const isWhiteLevel = ['manager', 'lead', 'senior', 'director', 'executive']
    .some((keyword) => normalizedLevel.includes(keyword));
  const isBlueLevel = normalizedLevel.includes('entry');

  if (WHITE_KEYWORDS.some((keyword) => normalizedTitle.includes(keyword)) || isWhiteLevel) {
    return 'white_collar';
  }

  if (BLUE_KEYWORDS.some((keyword) => normalizedTitle.includes(keyword)) || isBlueLevel) {
    return 'blue_collar';
  }

  return 'white_collar';
};

/** Normalize stored / inferred category to white_collar | blue_collar | ''. */
export const normalizeEmployeeCategory = (value) => {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'white_collar' || raw === 'whitecollar' || raw === 'white') return 'white_collar';
  if (raw === 'blue_collar' || raw === 'bluecollar' || raw === 'blue') return 'blue_collar';
  return '';
};

/**
 * Resolve category for list filtering.
 * 1) Stored employeeCategory
 * 2) Infer from placementDesignation title/level
 */
export const resolveEmployeeCategory = (employee = {}) => {
  const stored = normalizeEmployeeCategory(employee.employeeCategory);
  if (stored) return stored;

  const designation = employee.placementDesignation;
  if (designation && typeof designation === 'object') {
    return classifyDesignationCategory(designation.title || designation.name, designation.level);
  }

  return '';
};

export const getEmployeeCategoryLabel = (category) => {
  const normalized = normalizeEmployeeCategory(category);
  if (normalized === 'blue_collar') return 'Blue Collar';
  if (normalized === 'white_collar') return 'White Collar';
  return '—';
};
