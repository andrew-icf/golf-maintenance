export const JOB_TITLE_LABELS = {
  superintendent: 'Superintendent',
  assistant_superintendent: 'Assistant Superintendent',
  master_mechanic: 'Master Mechanic',
  operator: 'Operator',
  gardener: 'Gardener',
  landscaper: 'Landscaper',
  mechanic: 'Mechanic',
  office_admin: 'Office Admin',
}

export function formatJobTitle(jobTitle) {
  return JOB_TITLE_LABELS[jobTitle] || ''
}