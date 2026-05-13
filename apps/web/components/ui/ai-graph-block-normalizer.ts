import { parseGraphSpec } from './ai-graph-parser';

const FENCED_BLOCK_PATTERN = /```[\s\S]*?```/g;

export function normalizeGraphJsonBlocks(markdown: string): string {
  let result = '';
  let lastIndex = 0;

  for (const match of markdown.matchAll(FENCED_BLOCK_PATTERN)) {
    const index = match.index ?? 0;
    result += wrapRawGraphJson(markdown.slice(lastIndex, index));
    result += match[0];
    lastIndex = index + match[0].length;
  }

  result += wrapRawGraphJson(markdown.slice(lastIndex));
  return result;
}

function wrapRawGraphJson(markdown: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < markdown.length) {
    const start = markdown.indexOf('{', cursor);
    if (start === -1) {
      result += markdown.slice(cursor);
      break;
    }

    const end = findJsonObjectEnd(markdown, start);
    if (end === -1) {
      result += markdown.slice(cursor);
      break;
    }

    const candidate = markdown.slice(start, end + 1);
    if (parseGraphSpec(candidate)) {
      result += markdown.slice(cursor, start);
      result += `\n\n\`\`\`graph\n${candidate.trim()}\n\`\`\`\n\n`;
      cursor = end + 1;
    } else {
      result += markdown.slice(cursor, start + 1);
      cursor = start + 1;
    }
  }

  return result;
}

function findJsonObjectEnd(value: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < value.length; i++) {
    const char = value[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}
