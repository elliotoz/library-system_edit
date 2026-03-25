'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, Calendar, Clock, Flame, ArrowRight, Sparkles,
  Search, BookMarked, TrendingUp, BadgeDollarSign, Laptop,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { fineApi } from '@/lib/api';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';

interface StudentStats {
  borrowedBooks: number;
  activeReservations: number;
  daysUntilDue: number | null;
  readingStreak: number;
}

interface Book {
  id: string;
  title: string;
  authors: string[];
  availableCopies: number;
  totalCopies: number;
  isEbookAvailable: boolean;
  category?: string;
}

interface Borrow {
  id: string;
  dueDate: string;
  status: string;
  isOverdue: boolean;
  daysUntilDue: number;
  book: { id: string; title: string; authors: string[] };
}

const BOOK_GRADIENTS = [
  'from-teal-400 to-teal-600',
  'from-blue-400 to-blue-600',
  'from-purple-400 to-purple-600',
  'from-amber-400 to-amber-600',
];

function bookAvailabilityBadge(book: Book) {
  if (book.availableCopies > 0)
    return { label: 'Available', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  if (book.isEbookAvailable)
    return { label: 'E-book', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
  return { label: 'Unavailable', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [borrows, setBorrows] = useState<Borrow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingFineTotal, setPendingFineTotal] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, booksRes, borrowsRes] = await Promise.all([
          fetch('/api/dashboard/student', { credentials: 'include' }).catch(() => null),
          fetch('/api/books?pageSize=4', { credentials: 'include' }).catch(() => null),
          fetch('/api/borrows/my', { credentials: 'include' }).catch(() => null),
        ]);

        fineApi.getMyFines().then((fines) => {
          const total = fines.filter((f) => f.status === 'PENDING').reduce((sum, f) => sum + Number(f.amount), 0);
          setPendingFineTotal(total);
        }).catch(() => {});

        if (statsRes?.ok) setStats(await statsRes.json());
        if (booksRes?.ok) { const d = await booksRes.json(); setRecommendations(d.data || []); }
        if (borrowsRes?.ok) { const d = await borrowsRes.json(); setBorrows(d.filter((b: Borrow) => b.status === 'ACTIVE').slice(0, 5)); }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getBorrowStatus = (b: Borrow) => {
    if (b.isOverdue) return { label: 'Overdue', dot: 'bg-red-500', className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    if (b.daysUntilDue <= 3) return { label: 'Due Soon', dot: 'bg-amber-500', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: 'On Time', dot: 'bg-green-500', className: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  };

  const borrowPct = Math.min(((stats?.borrowedBooks ?? 0) / 5) * 100, 100);
  const borrowColor = borrowPct >= 80 ? 'from-red-400 to-red-600' : borrowPct >= 50 ? 'from-amber-400 to-amber-500' : 'from-primary-400 to-primary-600';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 p-6 text-white shadow-lg animate-slide-up stagger-1">
        <div className="absolute inset-0 animate-pulse-slow"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.1 }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-primary-100 text-sm font-medium mb-1">{greeting()}</p>
            <h1 className="text-2xl font-bold">{user?.name?.split(' ')[0] || 'Student'}</h1>
            <p className="text-primary-200 text-sm mt-1">Welcome to your library dashboard</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2">
            <span className="px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
              Student
            </span>
            {user?.facultyName && (
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-primary-100">
                {user.facultyName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Pending Fines ── */}
      {pendingFineTotal > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
            <BadgeDollarSign className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Pending fine: ₺{pendingFineTotal}</p>
            <p className="text-xs text-red-600/70 dark:text-red-500/70">Please settle at the library desk</p>
          </div>
          <Link href="/dashboard/borrowed" className="text-xs font-medium text-red-700 dark:text-red-400 hover:text-red-800 whitespace-nowrap flex items-center gap-1">
            View <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Books Borrowed', value: stats?.borrowedBooks ?? 0, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-l-blue-500' },
          { label: 'Reservations', value: stats?.activeReservations ?? 0, icon: Calendar, color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/30', border: 'border-l-primary-500' },
          { label: 'Days Until Due', value: stats?.daysUntilDue ?? '—', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-l-amber-500' },
          { label: 'Reading Streak', value: stats?.readingStreak ?? 0, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-l-orange-500' },
        ].map((s, i) => (
          <div key={i} className={cn('glass-card border-l-4 p-4 animate-slide-up', s.border, `stagger-${i + 1}`)}>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
                <s.icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/dashboard/catalog', icon: Search, label: 'Search Catalog', desc: 'Browse thousands of books', color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/30', hover: 'hover:border-primary-300 dark:hover:border-primary-700' },
          { href: '/dashboard/ai-assistant', icon: Sparkles, label: 'AI Assistant', desc: 'Get study help & recommendations', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', hover: 'hover:border-purple-300 dark:hover:border-purple-700' },
          { href: '/dashboard/reservations', icon: BookMarked, label: 'Reservations', desc: 'Check your pending pickups', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', hover: 'hover:border-amber-300 dark:hover:border-amber-700' },
        ].map((a) => (
          <Link key={a.href} href={a.href}
            className={cn('glass-card glass-card-interactive group flex items-center gap-4 p-4', a.hover)}>
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110', a.bg)}>
              <a.icon className={cn('w-5 h-5', a.color)} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{a.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto flex-shrink-0 group-hover:text-gray-500 transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Recommended Books ── */}
      <div className="glass-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Recommended for {user?.facultyName || 'You'}
          </h2>
          <Link href="/dashboard/catalog"
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(recommendations.length > 0 ? recommendations : Array(4).fill(null)).map((book, i) => {
              if (!book) return (
                <Link key={i} href="/dashboard/catalog" className="group block">
                  <div className={cn('relative aspect-[3/4] rounded-xl mb-3 flex flex-col items-center justify-center bg-gradient-to-br p-3 transition-all group-hover:shadow-lg group-hover:-translate-y-0.5 overflow-hidden', BOOK_GRADIENTS[i % 4])}>
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    <BookOpen className="w-10 h-10 text-white/80 mb-2" />
                    <p className="text-white/70 text-[10px] text-center">Introduction to Algorithms</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary-600 transition-colors">Introduction to Algorithms</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Thomas Cormen</p>
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Available</span>
                </Link>
              );
              const badge = bookAvailabilityBadge(book);
              return (
                <Link key={book.id} href={`/dashboard/catalog/${book.id}`} className="group block">
                  <div className={cn('relative aspect-[3/4] rounded-xl mb-3 flex flex-col items-center justify-center bg-gradient-to-br p-3 transition-all group-hover:shadow-lg group-hover:-translate-y-0.5 overflow-hidden', BOOK_GRADIENTS[i % 4])}>
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                    <BookOpen className="w-10 h-10 text-white/80 mb-2" />
                    <p className="text-white/70 text-[10px] text-center line-clamp-3">{book.title}</p>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary-600 transition-colors">{book.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{book.authors.join(', ')}</p>
                  <span className={cn('inline-flex items-center gap-1 mt-1.5 text-[11px] px-2 py-0.5 rounded-full', badge.className)}>
                    {badge.label === 'E-book' && <Laptop className="w-3 h-3" />}
                    {badge.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Current Borrows Table ── */}
      {borrows.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <h2 className="font-semibold text-gray-900 dark:text-white">Current Borrows</h2>
            <Link href="/dashboard/borrowed"
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-black/[0.02] dark:bg-white/[0.03]">
                  <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">Book</th>
                  <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3 hidden sm:table-cell">Due</th>
                  <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-5 py-3 hidden md:table-cell">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {borrows.map((borrow) => {
                  const st = getBorrowStatus(borrow);
                  return (
                    <tr key={borrow.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-11 rounded bg-gradient-to-br from-primary-400 to-primary-600 flex-shrink-0 flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-white/80" />
                          </div>
                          <div className="min-w-0">
                            <Link href={`/dashboard/catalog/${borrow.book.id}`}
                              className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 line-clamp-1 text-sm">
                              {borrow.book.title}
                            </Link>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{borrow.book.authors.join(', ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-gray-400 hidden sm:table-cell whitespace-nowrap">
                        {new Date(borrow.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium', st.className)}>
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <Link href="/dashboard/borrowed"
                          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700">
                          Extend
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Borrow Limit ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Borrow Limit</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Up to 5 books at a time</p>
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {stats?.borrowedBooks ?? 0}<span className="text-gray-400 dark:text-gray-500 text-base font-normal">/5</span>
          </p>
        </div>
        <div className="h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
          <div className={cn('h-full bg-gradient-to-r rounded-full transition-all duration-700', borrowColor)}
            style={{ width: `${borrowPct}%`, transitionDelay: '350ms' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <span key={n} className="text-[10px] text-gray-400 dark:text-gray-600">{n}</span>
          ))}
        </div>
      </div>

    </div>
  );
}
