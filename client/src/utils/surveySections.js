export const newQuestion = (order = 0) => ({
  key: `q_${Date.now()}_${order}`,
  type: 'text',
  label: '',
  description: '',
  required: false,
  options: [{ label: 'Option 1', value: 'option_1' }],
  min: 1,
  max: 5,
  order
});

export const newSection = (order = 0) => ({
  key: `s_${Date.now()}_${order}`,
  title: '',
  order,
  questions: [newQuestion(0)]
});

export const sortSections = (sections = []) =>
  [...sections].sort((a, b) => (a.order || 0) - (b.order || 0));

export const sortSectionQuestions = (questions = []) =>
  [...questions].sort((a, b) => (a.order || 0) - (b.order || 0));

export const questionsFromSections = (sections = []) =>
  sortSections(sections).flatMap((section) => sortSectionQuestions(section.questions || []));

export const legacyQuestionsToSections = (questions = []) => {
  const sorted = sortSectionQuestions(questions);
  if (!sorted.length) return [newSection(0)];
  return [{
    key: `s_legacy_${Date.now()}`,
    title: 'General',
    order: 0,
    questions: sorted
  }];
};

export const resolveSurveySections = (survey) => {
  if (survey?.sections?.length) return sortSections(survey.sections);
  return legacyQuestionsToSections(survey?.questions || []);
};

export const buildQuestionFlow = (sections = []) => {
  const flow = [];
  sortSections(sections).forEach((section, sectionIndex) => {
    sortSectionQuestions(section.questions || []).forEach((question, questionIndexInSection) => {
      flow.push({
        question,
        section,
        sectionIndex,
        questionIndexInSection
      });
    });
  });
  return flow;
};

export const countSectionQuestions = (sections = []) =>
  questionsFromSections(sections).filter((q) => String(q.label || '').trim()).length;
