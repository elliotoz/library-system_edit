'use client';

import Link from 'next/link';

interface BookCitation {
  title: string;
  catalogLink: string;
  available: boolean;
  copies: string;
}

export function BookCitationCards({ citations }: { citations: BookCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-0.5">
        Books found
      </p>
      {citations.map((c, i) => (
        <Link
          key={i}
          href={c.catalogLink}
          className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.10] hover:border-[#2A9D9D]/40 hover:bg-[#2A9D9D]/5 transition-colors group"
        >
          <span className="text-sm font-medium text-white/90 truncate group-hover:text-[#2A9D9D] transition-colors">
            {c.title}
          </span>
          <span
            className={`text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded-full ${
              c.available
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {c.available ? `✅ ${c.copies}` : '❌ Out'}
          </span>
        </Link>
      ))}
    </div>
  );
}
