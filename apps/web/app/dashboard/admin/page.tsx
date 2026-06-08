'use client';

import { type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookMarked,
  BookOpen,
  Clock,
  FileText,
  LibraryBig,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const BAR_COLORS = [
  'bg-cyan-400',
  'bg-teal-400',
  'bg-emerald-400',
  'bg-sky-400',
  'bg-violet-400',
  'bg-fuchsia-400',
  'bg-amber-400',
  'bg-orange-400',
  'bg-rose-400',
  'bg-lime-400',
] as const;

type IndexStatusRow = {
  status: string;
  count: number;
  percentage: number;
};

type FailedBookPreview = {
  id: string;
  title: string;
  authors: string[];
  pdfIndexStatus: string;
  pdfPageCount: number | null;
  chunks: number;
  hasPdfUrl: boolean;
  hasEbookUrl: boolean;
  pdfIndexedAt: string | null;
};

type MetadataIssuePreview = {
  id: string;
  title: string;
  authors: string[];
  missingFields: string[];
  catalogUrl: string;
  adminEditUrl: string;
};

type AdminDashboardSnapshot = {
  commandSummary: {
    totalBooks: number;
    indexedBooks: number;
    indexedBooksPercent: number;
    failedIndexingBooks: number;
    pendingReservations: number;
    overdueBorrows: number;
    pendingMaterials: number;
    activeUsers: number;
  };
  indexingHealth: {
    byStatus: IndexStatusRow[];
    totalChunks: number;
    averageChunksPerIndexedBook: number;
    zeroChunkIndexedBooks: number;
    failedBooksPreview: FailedBookPreview[];
    lastIndexedAt: string | null;
  };
  collectionInsights: {
    booksByFaculty: Array<{ facultyId: string | null; facultyName: string; count: number }>;
    booksByCategory: Array<{ category: string; count: number }>;
    missingMetadata: {
      missingIsbn: number;
      missingDescription: number;
      missingCategory: number;
      missingSubjectTags: number;
      missingFaculty: number;
      missingCoverImage: number;
    };
    metadataIssuesPreview: MetadataIssuePreview[];
    mostBorrowedBooks: Array<{ bookId: string; title: string; borrowCount: number }>;
    mostReservedBooks: Array<{ bookId: string; title: string; reservationCount: number }>;
  };
  materialsOverview: {
    total: number;
    pendingApproval: number;
    approved: number;
    published: number;
    byIndexStatus: Array<{ status: string; count: number }>;
    totalChunks: number;
  };
  aiUsage: {
    conversations: number;
    messages: number;
    activeUsers: number;
    assistantResponseRate: number;
    period: '7d';
  };
  generatedAt: string;
};

type KpiCard = {
  label: string;
  value: string;
  helper: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

function fetchAdminSnapshot(): Promise<AdminDashboardSnapshot> {
  return fetch('/api/dashboard/admin/snapshot', {
    credentials: 'include',
  }).then(async (response) => {
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(body || `Snapshot request failed (${response.status})`);
    }
    return response.json() as Promise<AdminDashboardSnapshot>;
  });
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown author';
  return authors.join(', ');
}

function getStatusTone(status: string): string {
  const normalised = status.toLowerCase();
  if (normalised.includes('fail')) return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
  if (normalised.includes('index')) return 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20';
  if (normalised.includes('pend')) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
  if (normalised.includes('ready')) return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20';
  return 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20';
}

function DonutMetric({
  percentage,
  label,
  value,
  sublabel,
  size = 'lg',
}: {
  percentage: number;
  label: string;
  value: string;
  sublabel?: string;
  size?: 'sm' | 'lg';
}) {
  const safePercentage = Math.max(0, Math.min(100, percentage));
  const dimension = size === 'lg' ? 'h-44 w-44' : 'h-32 w-32';
  const inner = size === 'lg' ? 'h-28 w-28' : 'h-20 w-20';

  return (
    <div className="relative grid place-items-center">
      <div
        className={cn('rounded-full shadow-[0_0_40px_rgba(74,191,191,0.18)]', dimension)}
        style={{
          background: `conic-gradient(var(--primary) ${safePercentage}%, rgba(148,163,184,0.18) 0)`,
        }}
      />
      <div
        className={cn(
          'absolute grid place-items-center rounded-full text-center ring-1 ring-gray-200/80 dark:ring-white/10',
          'bg-white text-gray-900 dark:bg-slate-950 dark:text-white',
          inner,
        )}
      >
        <div>
          <p className={size === 'lg' ? 'text-2xl font-bold' : 'text-xl font-bold'}>{value}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
          {sublabel && <p className="mt-1 text-[11px] text-primary">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}

function UsageBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const percent = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-slate-400">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(value)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function DistributionRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  const percent = max > 0 ? Math.round((count / max) * 100) : 0;

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-gray-800 dark:text-slate-200">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatNumber(count)}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  footer,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <Card className={cn('glass-card gap-0 rounded-3xl border border-gray-200/80 bg-white/80 py-4 text-gray-900 dark:border-white/10 dark:bg-slate-950/70 dark:text-white', className)}>
      <CardHeader className="px-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-300">
                <Icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
            </div>
            {description && <CardDescription className="max-w-3xl">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        {children}
        {footer ? <div className="pt-1">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  const { data: snapshot, error, isLoading, mutate } = useSWR<AdminDashboardSnapshot>(
    user ? `/api/dashboard/admin/snapshot:${user.id}` : null,
    fetchAdminSnapshot,
    { dedupingInterval: 5_000, revalidateOnFocus: true },
  );

  const kpiCards: KpiCard[] = snapshot ? [
    {
      label: 'Total Books',
      value: formatNumber(snapshot.commandSummary.totalBooks),
      helper: 'Catalog inventory',
      href: '/dashboard/admin/books',
      icon: BookOpen,
    },
    {
      label: 'Pending Reservations',
      value: formatNumber(snapshot.commandSummary.pendingReservations),
      helper: 'Waiting for action',
      href: '/dashboard/admin/reservations',
      icon: Clock,
    },
    {
      label: 'Overdue Borrows',
      value: formatNumber(snapshot.commandSummary.overdueBorrows),
      helper: 'Requires follow-up',
      href: '/dashboard/admin/borrows',
      icon: BookMarked,
    },
    {
      label: 'Pending Materials',
      value: formatNumber(snapshot.commandSummary.pendingMaterials),
      helper: 'Awaiting approval',
      href: '/dashboard/admin/materials',
      icon: FileText,
    },
  ] : [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-white/70 dark:border-white/10 dark:bg-white/5" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-3xl border border-gray-200 bg-white/70 dark:border-white/10 dark:bg-white/5" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4">
            <div className="h-[22rem] animate-pulse rounded-3xl border border-gray-200 bg-white/70 dark:border-white/10 dark:bg-white/5" />
            <div className="h-[20rem] animate-pulse rounded-3xl border border-gray-200 bg-white/70 dark:border-white/10 dark:bg-white/5" />
          </div>
          <div className="space-y-4">
            <div className="h-[18rem] animate-pulse rounded-3xl border border-gray-200 bg-white/70 dark:border-white/10 dark:bg-white/5" />
            <div className="h-[14rem] animate-pulse rounded-3xl border border-gray-200 bg-white/70 dark:border-white/10 dark:bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="rounded-3xl border-rose-200 bg-rose-50/60 dark:border-rose-500/20 dark:bg-rose-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-200">
            <AlertTriangle className="h-5 w-5" />
            Could not load the admin snapshot
          </CardTitle>
          <CardDescription className="text-rose-700/80 dark:text-rose-200/80">
            The dashboard snapshot request failed. Reload the page or try again in a moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => void mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/ai-assistant">Open OZ AI</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) {
    return null;
  }

  const indexStatuses = snapshot.indexingHealth.byStatus;
  const maxFaculty = Math.max(1, ...snapshot.collectionInsights.booksByFaculty.map((item) => item.count));
  const maxCategory = Math.max(1, ...snapshot.collectionInsights.booksByCategory.map((item) => item.count));
  const maxMaterials = Math.max(1, ...snapshot.materialsOverview.byIndexStatus.map((item) => item.count));
  const maxUsage = Math.max(
    1,
    snapshot.aiUsage.conversations,
    snapshot.aiUsage.messages,
    snapshot.aiUsage.activeUsers,
  );
  const topBorrowedBooks = snapshot.collectionInsights.mostBorrowedBooks.slice(0, 10);
  const maxBorrowedCount = Math.max(1, ...topBorrowedBooks.map((item) => item.borrowCount));
  const missingMetadataRows = [
    { label: 'ISBN', value: snapshot.collectionInsights.missingMetadata.missingIsbn },
    { label: 'Description', value: snapshot.collectionInsights.missingMetadata.missingDescription },
    { label: 'Category', value: snapshot.collectionInsights.missingMetadata.missingCategory },
    { label: 'Subject tags', value: snapshot.collectionInsights.missingMetadata.missingSubjectTags },
    { label: 'Faculty', value: snapshot.collectionInsights.missingMetadata.missingFaculty },
    { label: 'Cover image', value: snapshot.collectionInsights.missingMetadata.missingCoverImage },
  ];
  const hasMetadataIssues = snapshot.collectionInsights.metadataIssuesPreview.length > 0;
  const hasFailedIndexing = snapshot.indexingHealth.failedBooksPreview.length > 0;
  const noMaterials = snapshot.materialsOverview.total === 0;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-gray-200/80 bg-gradient-to-br from-white via-white to-teal-50/40 p-5 shadow-sm dark:border-white/10 dark:from-slate-950/90 dark:via-slate-950/80 dark:to-teal-500/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              <span>Admin Dashboard</span>
              <span className="h-1 w-1 rounded-full bg-gray-400/60" />
              <span>Live snapshot</span>
              <span className="h-1 w-1 rounded-full bg-gray-400/60" />
              <span>{formatDateTime(snapshot.generatedAt)}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Control center
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void mutate()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/dashboard/admin/reports">
                <BarChart3 className="h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/dashboard/ai-assistant">
                <Sparkles className="h-4 w-4" />
                Open OZ AI
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              aria-label={`Open ${card.label}`}
              className={cn(
                'glass-card glass-card-interactive group rounded-3xl p-4',
                'bg-white/80 text-gray-900 dark:bg-slate-950/70 dark:text-white',
                'border border-gray-200/80 dark:border-white/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{card.value}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{card.helper}</p>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-primary">
                <span>Open</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <SectionCard
            title="Indexing Health"
            description="Use this to understand RAG readiness and which books are searchable today."
            icon={LibraryBig}
            footer={(
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href="/dashboard/admin/books">
                    <BookOpen className="h-4 w-4" />
                    Manage Books
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <Link href="/dashboard/admin/books">
                    <RefreshCw className="h-4 w-4" />
                    Re-index Books
                  </Link>
                </Button>
              </div>
            )}
          >
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              <DonutMetric
                percentage={snapshot.commandSummary.indexedBooksPercent}
                label="Indexed"
                value={`${snapshot.commandSummary.indexedBooksPercent}%`}
                sublabel={`${formatNumber(snapshot.commandSummary.indexedBooks)} books`}
                size="lg"
              />

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SmallStat label="Total chunks" value={formatNumber(snapshot.indexingHealth.totalChunks)} />
                  <SmallStat label="Avg / indexed book" value={snapshot.indexingHealth.averageChunksPerIndexedBook.toFixed(1)} />
                  <SmallStat label="Zero-chunk indexed" value={formatNumber(snapshot.indexingHealth.zeroChunkIndexedBooks)} />
                  <SmallStat label="Last indexed" value={formatDateTime(snapshot.indexingHealth.lastIndexedAt)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Indexing status distribution</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Live counts</p>
                  </div>
                  {indexStatuses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300/80 bg-gray-50/60 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
                      No indexing status records yet.
                    </div>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {indexStatuses.map((row) => (
                        <div key={row.status} className="rounded-2xl border border-gray-200/80 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/[0.04]">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{row.status}</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{row.percentage}%</p>
                          </div>
                          <Progress value={row.percentage} className="mt-2 h-2" />
                          <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">{formatNumber(row.count)} books</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Failed indexing preview</p>
              {hasFailedIndexing ? (
                <div className="space-y-2">
                  {snapshot.indexingHealth.failedBooksPreview.slice(0, 5).map((book) => (
                    <div key={book.id} className="rounded-2xl border border-gray-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{book.title}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{formatAuthors(book.authors)}</p>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0 border', getStatusTone(book.pdfIndexStatus))}>
                          {book.pdfIndexStatus}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-slate-400 sm:grid-cols-4">
                        <span>Chunks: {book.chunks}</span>
                        <span>Pages: {book.pdfPageCount ?? 'n/a'}</span>
                        <span>PDF: {book.hasPdfUrl ? 'yes' : 'no'}</span>
                        <span>E-book: {book.hasEbookUrl ? 'yes' : 'no'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                  All indexed books are healthy. No failed indexing items.
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Collection Insights"
            description="Catalog coverage and distribution across faculty and category."
            icon={BookOpen}
          >
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Books by faculty</p>
                  <span className="text-xs text-gray-500 dark:text-slate-400">Real counts</span>
                </div>
                {snapshot.collectionInsights.booksByFaculty.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300/80 bg-gray-50/60 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
                    No faculty distribution data yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {snapshot.collectionInsights.booksByFaculty.slice(0, 6).map((row) => (
                      <DistributionRow
                        key={`${row.facultyName}-${row.facultyId ?? 'none'}`}
                        label={row.facultyName}
                        count={row.count}
                        max={maxFaculty}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Books by category</p>
                  <span className="text-xs text-gray-500 dark:text-slate-400">Real counts</span>
                </div>
                {snapshot.collectionInsights.booksByCategory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300/80 bg-gray-50/60 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
                    No category distribution data yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {snapshot.collectionInsights.booksByCategory.slice(0, 6).map((row) => (
                      <DistributionRow
                        key={row.category}
                        label={row.category}
                        count={row.count}
                        max={maxCategory}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Missing metadata</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {missingMetadataRows.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-gray-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-slate-950/40"
                    >
                      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                        {row.label}
                      </p>
                      <p className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                        {formatNumber(row.value)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Top Borrowed Books</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Highest-demand titles in the live snapshot.
                  </p>
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Top 10</span>
              </div>

              {topBorrowedBooks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300/80 bg-gray-50/60 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
                  No borrow activity yet.
                </div>
              ) : (
                <div className="grid gap-x-5 gap-y-2 lg:grid-cols-2">
                  {topBorrowedBooks.map((book, index) => {
                    const widthPct = Math.max(8, (book.borrowCount / maxBorrowedCount) * 100);
                    const barColor = BAR_COLORS[index % BAR_COLORS.length];

                    return (
                      <div key={book.bookId} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                              {index + 1}. {book.title}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatNumber(book.borrowCount)}
                          </p>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-gray-200/70 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCard>

          {hasMetadataIssues && (
            <SectionCard
              title="Metadata Issues"
              description="These books need admin attention. Open the catalog page or edit the record directly."
              icon={AlertTriangle}
            >
              <div className="space-y-3">
                {snapshot.collectionInsights.metadataIssuesPreview.slice(0, 10).map((book) => (
                  <article key={book.id} className="rounded-2xl border border-gray-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex flex-col gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{book.title}</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{formatAuthors(book.authors)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {book.missingFields.map((field) => (
                          <Badge key={field} variant="secondary" className="border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200">
                            Missing: {field}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline" className="gap-2">
                          <Link href={book.catalogUrl}>
                            Open catalog page
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" className="gap-2">
                          <Link href={book.adminEditUrl}>
                            Edit book
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          )}

        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <SectionCard
            title="OZ AI Usage"
            description="Last 7 days of assistant usage from the live snapshot."
            icon={Sparkles}
            footer={(
              <Button asChild size="sm" className="w-full gap-2">
                <Link href="/dashboard/ai-assistant">
                  Open OZ AI
                  <Sparkles className="h-4 w-4" />
                </Link>
              </Button>
            )}
          >
            <div className="flex items-start gap-4">
              <DonutMetric
                percentage={snapshot.aiUsage.assistantResponseRate}
                label="Response rate"
                value={`${snapshot.aiUsage.assistantResponseRate}%`}
                sublabel={snapshot.aiUsage.period}
                size="sm"
              />
              <div className="flex-1 space-y-3">
                <UsageBar label="Conversations" value={snapshot.aiUsage.conversations} max={maxUsage} />
                <UsageBar label="Messages" value={snapshot.aiUsage.messages} max={maxUsage} />
                <UsageBar label="Active users" value={snapshot.aiUsage.activeUsers} max={maxUsage} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Materials Overview"
            description="Live totals and indexing state for uploaded materials."
            icon={FileText}
            footer={(
              <Button asChild variant="outline" size="sm" className="w-full gap-2">
                <Link href="/dashboard/admin/materials">
                  Manage Materials
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          >
            {noMaterials ? (
              <div className="rounded-2xl border border-dashed border-gray-300/80 bg-white/70 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
                No materials uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <SmallStat label="Total" value={formatNumber(snapshot.materialsOverview.total)} />
                  <SmallStat label="Pending approval" value={formatNumber(snapshot.materialsOverview.pendingApproval)} />
                  <SmallStat label="Approved" value={formatNumber(snapshot.materialsOverview.approved)} />
                  <SmallStat label="Published" value={formatNumber(snapshot.materialsOverview.published)} />
                  <SmallStat label="Total chunks" value={formatNumber(snapshot.materialsOverview.totalChunks)} />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Material indexing status</p>
                  {snapshot.materialsOverview.byIndexStatus.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-300/80 bg-white/70 p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-400">
                      No material indexing data yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {snapshot.materialsOverview.byIndexStatus.map((row) => (
                        <DistributionRow key={row.status} label={row.status} count={row.count} max={maxMaterials} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

        </aside>
      </section>
    </div>
  );
}
