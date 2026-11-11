// Case workflow stages and their colours — one source for every chart, so a stage
// always has the same colour everywhere ("colour follows the entity").
//
// Colours come from the validated categorical palette, in this exact order
// (workflow order). Checked with the dataviz validator:
//   light: all checks pass (worst adjacent colour-blind ΔE 7.2 → needs gaps + labels;
//          Unassigned pink is < 3:1 on white → always shown with a text label)
//   dark:  all checks pass
// Never reorder or recolour without re-running the validator.

export const STAGES = [
  { key: 'unassigned', label: 'Unassigned', light: '#e87ba4', dark: '#d55181' },
  { key: 'field',      label: 'In field',   light: '#2a78d6', dark: '#3987e5' },
  { key: 'review',     label: 'In review',  light: '#eb6834', dark: '#d95926' },
  { key: 'returned',   label: 'Returned',   light: '#6250d6', dark: '#9085e9' },
  { key: 'approved',   label: 'Approved',   light: '#008300', dark: '#008300' },
  { key: 'rejected',   label: 'Rejected',   light: '#e34948', dark: '#e66767' },
];

const isUnassigned = (c) => !c.assignedEngineerId || c.assignedEngineerId === 'UNASSIGNED';

export function stageOf(c) {
  if (c.status === 'Approved') return 'approved';
  if (c.status === 'Rejected') return 'rejected';
  if (c.status === 'Returned') return 'returned';
  if (isUnassigned(c)) return 'unassigned';
  if (c.status === 'Reviewing' || c.status === 'Completed') return 'review';
  return 'field';
}

// Single-hue for magnitude-only bars (e.g. ranked banks)
export const MAGNITUDE = { light: '#2a78d6', dark: '#3987e5' };
