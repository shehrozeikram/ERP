// Utility functions for filtering employees by designation

export const filterByDesignation = (employees, designationKeywords, excludeKeywords = []) => {
  return employees.filter(emp => {
    const designation = (
      emp.placementDesignation?.title ||
      emp.placementDesignation ||
      emp.designation ||
      ''
    ).toLowerCase();
    
    // First check if it matches any exclusion keywords
    if (excludeKeywords.some(keyword => designation.includes(keyword.toLowerCase()))) {
      return false;
    }
    
    // Then check if it matches any inclusion keywords
    return designationKeywords.some(keyword => designation.includes(keyword.toLowerCase()));
  });
};

export const filterBySearch = (employees, searchTerm) => {
  if (!searchTerm.trim()) return employees;
  
  const search = searchTerm.toLowerCase();
  return employees.filter(emp => {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
    const department = (emp.placementDepartment?.name || emp.placementDepartment || '').toLowerCase();
    const designation = (emp.placementDesignation?.title || emp.placementDesignation || '').toLowerCase();
    const employeeId = (emp.employeeId || '').toLowerCase();
    
    return name.includes(search) ||
      department.includes(search) ||
      designation.includes(search) ||
      employeeId.includes(search);
  });
};

// Designation filter configurations
export const DESIGNATION_FILTERS = {
  HOD: {
    include: ['hod', 'head of department'],
    exclude: []
  },
  LINE_MANAGER: {
    include: [
      'line manager',
      'manager',
      'senior manager',
      'general manager',
      'deputy manager',
      'project manager',
      'department manager',
      'operations manager',
      'director',
      'senior director',
      'executive director',
      'vice president',
      'vp',
      'ceo',
      'chief executive',
      'chief',
      'president',
      'head',
      'lead'
    ],
    exclude: ['assistant manager', 'asst. manager', 'asst manager']
  }
};

