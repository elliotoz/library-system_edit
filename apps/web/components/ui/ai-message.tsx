'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useEffect, useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { AIGraph } from './ai-graph';
import { AIMermaid } from './ai-mermaid';
import { normalizeMathDelimiters } from './ai-markdown-normalizer';
import { normalizeGraphJsonBlocks } from './ai-graph-block-normalizer';

interface CodeBlockProps {
  language: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-white/[0.06] border-b border-gray-200 dark:border-white/10">
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{language || 'text'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-x-auto max-w-full">
        <SyntaxHighlighter
          language={language || 'text'}
          style={dark ? oneDark : oneLight}
          customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.8rem', background: 'transparent' }}
          wrapLongLines={false}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

interface AIMessageProps {
  content: string;
}

export function AIMessage({ content }: AIMessageProps) {
  const stripped = content.replace(/<!--\s*oz-\w[^>]*-->\n?/g, '');
  const normalizedContent = normalizeMathDelimiters(normalizeGraphJsonBlocks(stripped));

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed ai-message">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || '');
            const lang = match ? match[1] : '';
            const value = String(children).replace(/\n$/, '');
            const isBlock = match !== null || (typeof children === 'string' && String(children).includes('\n'));

            if (lang === 'graph') return <AIGraph raw={value} />;
            if (lang === 'mermaid') return <AIMermaid code={value} />;

            if (isBlock) {
              return <CodeBlock language={lang} value={value} />;
            }
            return (
              <code className="bg-gray-100 dark:bg-white/10 rounded px-1 py-0.5 text-xs font-mono text-pink-600 dark:text-pink-400">
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3">
                <table className="min-w-full text-sm border-collapse">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-gray-200 dark:border-white/20 px-3 py-2 bg-gray-50 dark:bg-white/[0.06] text-left font-semibold">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-gray-200 dark:border-white/20 px-3 py-2">{children}</td>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary-400 pl-4 my-3 text-gray-600 dark:text-gray-400 italic">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 underline hover:no-underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
