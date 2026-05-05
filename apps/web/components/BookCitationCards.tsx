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
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/30">
        Books found
      </p>
      {citations.map((c, i) => (
        <Link
          key={i}
          href={c.catalogLink}
          className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-colors hover:border-[#2A9D9D]/40 hover:bg-[#2A9D9D]/5 dark:border-white/[0.10] dark:bg-white/[0.06]"
        >
          <span className="truncate text-sm font-medium text-slate-800 transition-colors group-hover:text-[#2A9D9D] dark:text-white/90">
            {c.title}
          </span>
          <span
            className={`text-xs font-semibold flex-shrink-0 rounded-full px-2 py-0.5 ${
              c.available
                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
            }`}
          >
            {c.available ? `✅ ${c.copies}` : '❌ Out'}
          </span>
        </Link>
      ))}
    </div>
  );
}
