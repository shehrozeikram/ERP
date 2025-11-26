// Evaluation Categories
export const evaluationCategories = [
  { name: 'Job Knowledge', totalMarks: 5 },
  { name: 'Work Quality', totalMarks: 5 },
  { name: 'Productivity', totalMarks: 5 },
  { name: 'Dependability', totalMarks: 5 },
  { name: 'Initiative', totalMarks: 5 },
  { name: 'Innovation', totalMarks: 5 },
  { name: 'Attitude', totalMarks: 5 },
  { name: 'Punctuality', totalMarks: 5 },
  { name: 'Convincing Power', totalMarks: 5 },
  { name: 'Self-Motivation', totalMarks: 5 }
];

export const whiteCollarProfessionalAttributes = [
  { name: 'Technical Competence', totalMarks: 5 },
  { name: 'Problem Solving', totalMarks: 5 },
  { name: 'Communication Skills', totalMarks: 5 },
  { name: 'Leadership', totalMarks: 5 },
  { name: 'Planning & Organizing', totalMarks: 5 },
  { name: 'Decision Making', totalMarks: 5 },
  { name: 'Quality of Work', totalMarks: 5 },
  { name: 'Job Knowledge', totalMarks: 5 },
  { name: 'Innovation & Creativity', totalMarks: 5 },
  { name: 'Professional Development', totalMarks: 5 }
];

export const whiteCollarPersonalAttributes = [
  { 
    name: 'Initiative', 
    totalMarks: 5,
    description: 'Has ability to start and complete tasks by solving job related problems without depending on others and without waiting for instruction?'
  },
  { 
    name: 'Efficiency Orientation', 
    totalMarks: 5,
    description: 'An awareness not only for doing things more quickly or inexpensively but trying to do things better. An underlying concern to do a job better than it had been done before.'
  },
  { 
    name: 'Result Orientation', 
    totalMarks: 5,
    description: 'Has tendency to set specific goals and to commit oneself to self-imposed standards of achievement. Can be dependent upon to complete jobs on agreed completion time.'
  },
  { 
    name: 'Cooperation / Teamwork', 
    totalMarks: 5,
    description: 'Helps others as a team player to achieve departmental goals. Constructively, addresses negative influences. Responds to others\' needs and requisitions in time. Always open to help members of other departments.'
  },
  { 
    name: 'Emotional Stability', 
    totalMarks: 5,
    description: 'Performs very well under-stress, frustration, and in a situation of conflict.'
  },
  { 
    name: 'Punctuality', 
    totalMarks: 5,
    description: 'Maintains satisfactory and good attendance.'
  },
  { 
    name: 'Discipline', 
    totalMarks: 5,
    description: 'Respect and follow the company rules & Regulations. Promotes and maintain the good discipline with team and other departments also.'
  },
  { 
    name: 'Sense of Responsibility', 
    totalMarks: 5,
    description: 'Has strong sense of responsibility towards work ethics & professionalism.'
  },
  { 
    name: 'Adaptability', 
    totalMarks: 5,
    description: 'Ability to adapt to changing work environments and requirements.'
  },
  { 
    name: 'Integrity', 
    totalMarks: 5,
    description: 'Demonstrates honesty, ethical behavior, and trustworthiness in all work-related activities.'
  }
];

// Overall Result Options
export const overallResultOptions = [
  { value: 'poor', label: 'Poor', percentage: '50%-60%' },
  { value: 'average', label: 'Average', percentage: '61%-70%' },
  { value: 'good', label: 'Good', percentage: '71%-80%' },
  { value: 'very_good', label: 'Very Good', percentage: '81%-90%' },
  { value: 'outstanding', label: 'Outstanding', percentage: '91%-100%' }
];

// Marks Description
export const marksDescription = [
  { value: 1, label: 'Poor' },
  { value: 2, label: 'Average' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Very Good' },
  { value: 5, label: 'Outstanding' }
];

// Helper function to initialize scores
export const initializeScores = (categories) => {
  return categories.reduce((acc, category) => {
    acc[category.name] = { score: '', comments: '' };
    return acc;
  }, {});
};

