'use client';

import React, { useState } from 'react';
import Link from 'next/link';

// ── Syntax highlighting ────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightCode(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const L = lang.toLowerCase();

  const wrap = (cls: string, text: string) => `<span class="${cls}">${text}</span>`;
  const kw = (text: string) => wrap('text-[#c084fc]', text);
  const str = (text: string) => wrap('text-[#86efac]', text);
  const typ = (text: string) => wrap('text-[#7dd3fc]', text);
  const num = (text: string) => wrap('text-[#fb923c]', text);
  const cmt = (text: string) => wrap('text-[#6b7280] italic', text);

  if (['json'].includes(L)) {
    return escaped
      .replace(/("(?:[^"\\]|\\.)*")\s*:/g, (_, k) => `${str(k)}:`)
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, (_, v) => `: ${str(v)}`)
      .replace(/\b(true|false|null)\b/g, (m) => kw(m))
      .replace(/\b(\d+\.?\d*)\b/g, (m) => num(m));
  }

  if (['py', 'python'].includes(L)) {
    return escaped
      .replace(/(#[^\n]*)/g, (m) => cmt(m))
      .replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => str(m))
      .replace(/\b(def|class|import|from|return|if|elif|else|for|while|in|not|and|or|is|True|False|None|with|as|try|except|finally|raise|pass|break|continue|yield|async|await|lambda|del|global|nonlocal)\b/g, (m) => kw(m))
      .replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, (m) => typ(m))
      .replace(/\b(\d+\.?\d*)\b/g, (m) => num(m));
  }

  if (['js', 'ts', 'jsx', 'tsx', 'javascript', 'typescript'].includes(L)) {
    return escaped
      .replace(/(\/\/[^\n]*)/g, (m) => cmt(m))
      .replace(/(\/\*[\s\S]*?\*\/)/g, (m) => cmt(m))
      .replace(/(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => str(m))
      .replace(/\b(const|let|var|function|class|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|void|throw|try|catch|finally|import|export|default|from|async|await|yield|of|in|extends|implements|interface|type|enum|namespace|declare|abstract|override|readonly|private|protected|public|static|super|this)\b/g, (m) => kw(m))
      .replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, (m) => typ(m))
      .replace(/\b(\d+\.?\d*)\b/g, (m) => num(m));
  }

  if (['c', 'cpp', 'c++', 'cc'].includes(L)) {
    return escaped
      .replace(/(\/\/[^\n]*)/g, (m) => cmt(m))
      .replace(/(\/\*[\s\S]*?\*\/)/g, (m) => cmt(m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => str(m))
      .replace(/\b(int|char|float|double|long|short|unsigned|signed|void|bool|auto|const|static|extern|return|if|else|for|while|do|switch|case|break|continue|struct|class|namespace|include|define|ifdef|endif|new|delete|nullptr|true|false|public|private|protected|virtual|override|template|typename)\b/g, (m) => kw(m))
      .replace(/\b(\d+\.?\d*[ulf]*)\b/g, (m) => num(m));
  }

  if (['sql'].includes(L)) {
    return escaped
      .replace(/(--[^\n]*)/g, (m) => cmt(m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => str(m))
      .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|IS|NULL|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|VIEW|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CASCADE|CONSTRAINT|BEGIN|COMMIT|ROLLBACK|TRANSACTION)\b/gi, (m) => kw(m))
      .replace(/\b(\d+\.?\d*)\b/g, (m) => num(m));
  }

  if (['bash', 'sh', 'shell', 'zsh'].includes(L)) {
    return escaped
      .replace(/(#[^\n]*)/g, (m) => cmt(m))
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => str(m))
      .replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|local|echo|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|curl|git|npm|npx|node|python|pip)\b/g, (m) => kw(m))
      .replace(/(\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)/g, (m) => typ(m));
  }

  if (['prisma'].includes(L)) {
    return escaped
      .replace(/(\/\/[^\n]*)/g, (m) => cmt(m))
      .replace(/("(?:[^"\\]|\\.)*")/g, (m) => str(m))
      .replace(/\b(model|enum|datasource|generator|relation|field|@id|@default|@unique|@map|@relation|@db|@updatedAt|@@map|@@index|@@unique|String|Int|Float|Boolean|DateTime|Json|Bytes|Decimal|BigInt|true|false)\b/g, (m) => kw(m))
      .replace(/\b([A-Z][A-Za-z0-9_]*)\b/g, (m) => typ(m));
  }

  return escaped;
}

// ── Language label map ────────────────────────────────────────────────────────

function getLanguageLabel(lang: string): string {
  const map: Record<string, string> = {
    js: 'JavaScript', javascript: 'JavaScript',
    ts: 'TypeScript', typescript: 'TypeScript',
    jsx: 'JSX', tsx: 'TSX',
    py: 'Python', python: 'Python',
    cpp: 'C++', 'c++': 'C++', cc: 'C++',
    c: 'C', java: 'Java', cs: 'C#',
    go: 'Go', rust: 'Rust', rb: 'Ruby',
    php: 'PHP', sql: 'SQL',
    bash: 'Bash/Shell', sh: 'Bash/Shell', shell: 'Bash/Shell', zsh: 'Bash/Shell',
    json: 'JSON', yaml: 'YAML', yml: 'YAML',
    xml: 'XML', html: 'HTML', css: 'CSS',
    scss: 'SCSS', md: 'Markdown', prisma: 'Prisma',
    graphql: 'GraphQL', dockerfile: 'Dockerfile',
  };
  return map[lang.toLowerCase()] || (lang ? lang.toUpperCase() : 'Code');
}

// ── CodeBlock component ───────────────────────────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#1a1b26] my-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#16161e] border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          {/* Code bracket icon */}
          <svg className="w-4 h-4 text-[#7dd3fc]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <span className="text-sm font-semibold text-white/90 font-mono">{getLanguageLabel(lang)}</span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
            copied ? 'text-emerald-400' : 'text-white/50 hover:text-white/90 hover:bg-white/10'
          }`}
        >
          {copied ? (
            <>
              {/* Check icon */}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              {/* Clipboard icon */}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code body */}
      <pre className="overflow-x-auto p-4 m-0 text-sm leading-relaxed font-mono">
        <code
          className="font-mono text-[#cdd6f4]"
          dangerouslySetInnerHTML={{ __html: highlightCode(code, lang) }}
        />
      </pre>
    </div>
  );
}

// ── Inline text renderer ──────────────────────────────────────────────────────

function renderInlineText(text: string): React.ReactNode[] {
  // Split on inline code, bold, italic, and markdown links
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-teal-700 dark:text-[#86efac] text-[0.85em] font-mono border border-gray-200 dark:border-white/10">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} className="font-semibold text-gray-900 dark:text-white">{renderInlineText(part.slice(2, -2))}</strong>;
    }
    if (/^\*[^*]+\*$/.test(part)) {
      return <em key={i} className="italic text-gray-600 dark:text-gray-200">{renderInlineText(part.slice(1, -1))}</em>;
    }
    // Markdown link [label](href)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith('/');
      if (isInternal) {
        return (
          <Link
            key={i}
            href={href}
            className="text-[#2A9D9D] underline underline-offset-2 hover:text-[#4bbfbf] transition-colors"
          >
            {label}
          </Link>
        );
      }
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#2A9D9D] underline underline-offset-2 hover:text-[#4bbfbf] transition-colors"
        >
          {label}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Text block renderer ───────────────────────────────────────────────────────

function renderTextBlock(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    if (listType === 'ul') {
      nodes.push(
        <ul key={key++} className="my-2 space-y-1 pl-5">
          {listItems}
        </ul>,
      );
    } else {
      nodes.push(
        <ol key={key++} className="my-2 space-y-1 pl-5 list-decimal">
          {listItems}
        </ol>,
      );
    }
    listItems = [];
    listType = null;
  };

  for (const line of lines) {
    // Blank line
    if (line.trim() === '') {
      flushList();
      nodes.push(<br key={key++} />);
      continue;
    }
    // ### heading
    if (/^###\s/.test(line)) {
      flushList();
      nodes.push(
        <h3 key={key++} className="text-base font-semibold text-gray-900 dark:text-white mt-4 mb-1">
          {renderInlineText(line.slice(4))}
        </h3>,
      );
      continue;
    }
    // ## heading
    if (/^##\s/.test(line)) {
      flushList();
      nodes.push(
        <h2 key={key++} className="text-lg font-bold text-gray-900 dark:text-white mt-5 mb-2">
          {renderInlineText(line.slice(3))}
        </h2>,
      );
      continue;
    }
    // # heading
    if (/^#\s/.test(line)) {
      flushList();
      nodes.push(
        <h1 key={key++} className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-2">
          {renderInlineText(line.slice(2))}
        </h1>,
      );
      continue;
    }
    // Bullet list
    if (/^[-*]\s/.test(line)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(
        <li key={key++} className="flex gap-2 text-gray-700 dark:text-gray-100">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2A9D9D] flex-shrink-0" />
          <span>{renderInlineText(line.replace(/^[-*]\s/, ''))}</span>
        </li>,
      );
      continue;
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(
        <li key={key++} className="text-gray-700 dark:text-gray-100 ml-1">
          {renderInlineText(line.replace(/^\d+\.\s/, ''))}
        </li>,
      );
      continue;
    }
    // Regular line
    flushList();
    nodes.push(
      <span key={key++} className="text-gray-700 dark:text-gray-100 leading-relaxed block">
        {renderInlineText(line)}
      </span>,
    );
  }

  flushList();
  return <>{nodes}</>;
}

// ── Main exported function ────────────────────────────────────────────────────

export function renderMessage(content: string): React.ReactNode {
  const segments: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segKey = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      segments.push(<span key={segKey++}>{renderTextBlock(textBefore)}</span>);
    }
    // The code block
    segments.push(
      <CodeBlock key={segKey++} lang={match[1] || ''} code={match[2].trimEnd()} />,
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last code block
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    segments.push(<span key={segKey++}>{renderTextBlock(remaining)}</span>);
  }

  return <>{segments}</>;
}
