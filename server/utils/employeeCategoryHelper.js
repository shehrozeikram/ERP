/**
 * Classifies a designation as blue_collar or white_collar based on title and level
 * @param {string} title - Designation title
 * @param {string} level - Designation level
 * @returns {string} 'blue_collar' or 'white_collar'
 */
const classifyDesignationCategory = (title = '', level = '') => {
  const normalizedTitle = title.toLowerCase();
  const normalizedLevel = level?.toLowerCase?.() || '';

  const whiteSpecificTitles = [
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

  if (whiteSpecificTitles.some(item => normalizedTitle === item.toLowerCase())) {
    return 'white_collar';
  }

  const whiteKeywords = ['manager', 'officer', 'engineer', 'specialist', 'analyst', 'head', 'director', 'executive', 'supervisor', 'lead', 'coordinator', 'administrator', 'consultant', 'teacher', 'developer', 'designer', 'architect', 'inspector', 'secretary', 'principal', 'president'];
  const blueKeywords = ['worker', 'technician', 'operator', 'labour', 'labor', 'helper', 'driver', 'mechanic', 'foreman', 'inspector', 'attendant'];

  const isWhiteLevel = ['manager', 'lead', 'senior', 'director', 'executive'].some(keyword => normalizedLevel.includes(keyword));
  const isBlueLevel = ['entry'].some(keyword => normalizedLevel.includes(keyword));

  if (whiteKeywords.some(keyword => normalizedTitle.includes(keyword)) || isWhiteLevel) {
    return 'white_collar';
  }

  if (blueKeywords.some(keyword => normalizedTitle.includes(keyword)) || isBlueLevel) {
    return 'blue_collar';
  }

  return 'white_collar';
};

module.exports = { classifyDesignationCategory };

