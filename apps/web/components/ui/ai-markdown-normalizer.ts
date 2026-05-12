const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;

export function normalizeMathDelimiters(markdown: string): string {
  return transformOutsideFencedBlocks(markdown, normalizeInlineSegments);
}

function transformOutsideFencedBlocks(
  markdown: string,
  transform: (value: string) => string,
): string {
  let result = '';
  let lastIndex = 0;

  for (const match of markdown.matchAll(FENCED_BLOCK_PATTERN)) {
    const index = match.index ?? 0;
    result += transform(markdown.slice(lastIndex, index));
    result += match[0];
    lastIndex = index + match[0].length;
  }

  result += transform(markdown.slice(lastIndex));
  return result;
}

function normalizeInlineSegments(markdown: string): string {
  const parts = markdown.split(/(`[^`]*`)/g);
  return parts
    .map((part) => {
      if (part.startsWith('`') && part.endsWith('`')) return part;
      return normalizeLatexDelimiters(part);
    })
    .join('');
}

function normalizeLatexDelimiters(markdown: string): string {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, content: string) => `$$${content}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, content: string) => `$${content}$`);
}
