export const GRAPH_COLORS = [
  '#14b8a6',
  '#8b5cf6',
  '#f59e0b',
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#ec4899',
  '#06b6d4',
] as const;

export const SEMANTIC_GRAPH_COLORS: Record<string, string> = {
  Engineering: '#14b8a6',
  Medicine: '#8b5cf6',
  Humanities: '#f59e0b',
  Communication: '#3b82f6',
  Science: '#22c55e',
  'Computer Science': '#06b6d4',
  Business: '#ec4899',
  Law: '#ef4444',
  Students: '#14b8a6',
  Instructors: '#8b5cf6',
  Staff: '#f59e0b',
  Admins: '#ef4444',
  Available: '#22c55e',
  Borrowed: '#3b82f6',
  Overdue: '#ef4444',
  Paid: '#14b8a6',
};

export function colorsForLabels(labels: string[]): string[] {
  return labels.map((label, index) => SEMANTIC_GRAPH_COLORS[label] ?? GRAPH_COLORS[index % GRAPH_COLORS.length]);
}
