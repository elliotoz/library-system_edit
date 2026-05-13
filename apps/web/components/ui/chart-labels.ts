const MAX_DISPLAY_LABEL_LENGTH = 28;
const TRUNCATED_LABEL_LENGTH = 25;
const SEMANTIC_SEPARATORS = [' - ', ':', '*', '|', '(', '['];

export function simplifyChartLabel(label: string): string {
  const trimmed = label.trim().replace(/\s+/g, ' ');
  const simplified = semanticPrefix(trimmed);
  return truncateLabel(simplified);
}

export function simplifyChartLabels(labels: string[]): string[] {
  return labels.map(simplifyChartLabel);
}

function semanticPrefix(label: string): string {
  const matches = SEMANTIC_SEPARATORS
    .map((separator) => ({ separator, index: label.indexOf(separator) }))
    .filter((match) => match.index > 0)
    .sort((a, b) => a.index - b.index);

  const first = matches[0];
  if (!first) return label;

  const candidate = label.slice(0, first.index).trim();
  return candidate.length >= 3 ? candidate : label;
}

function truncateLabel(label: string): string {
  if (label.length <= MAX_DISPLAY_LABEL_LENGTH) return label;
  return `${label.slice(0, TRUNCATED_LABEL_LENGTH).trimEnd()}...`;
}
