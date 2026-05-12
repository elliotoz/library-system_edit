'use client';

import { useEffect, useRef, useState } from 'react';

interface AIMermaidProps {
  code: string;
}

export function AIMermaid({ code }: AIMermaidProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = document.documentElement.classList.contains('dark');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDark ? 'dark' : 'default',
        });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          // svg from mermaid.render is sanitized output — safe to set as innerHTML
          ref.current.innerHTML = svg;
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <pre className="bg-gray-100 dark:bg-white/[0.06] rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-gray-600 dark:text-gray-400 my-3">
        {code}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="my-3 flex justify-center overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10 p-3 bg-white dark:bg-transparent"
    />
  );
}
