export const JOB_TITLE_LABELS = {
  superintendent: 'Superintendent',
  assistant_superintendent: 'Assistant Superintendent',
  master_mechanic: 'Master Mechanic',
  operator: 'Operator',
  greenskeeper: 'Greenskeeper',
  landscaper: 'Landscaper',
  mechanic: 'Mechanic',
  office_admin: 'Office Admin',
}

// hasOwn, so a name every object has, like "constructor", is not mistaken for a job title
export function formatJobTitle(jobTitle) {
  return Object.hasOwn(JOB_TITLE_LABELS, jobTitle) ? JOB_TITLE_LABELS[jobTitle] : ''
}