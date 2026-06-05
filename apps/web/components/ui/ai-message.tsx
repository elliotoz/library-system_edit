'use client';

import dynamic from 'next/dynamic';

const AIRichMessage = dynamic(
  () => import('./ai-rich-message').then((mod) => ({ default: mod.AIRichMessage })),
  {
    ssr: false,
    loading: () => (
      <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
    ),
  },
);

interface AIMessageProps {
  content: string;
}

export function AIMessage({ content }: AIMessageProps) {
  if (!content) return null;
  return <AIRichMessage content={content} />;
}
