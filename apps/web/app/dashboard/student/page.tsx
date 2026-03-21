'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  Clock,
  Flame,
  ArrowRight,
  Sparkles,
  Search,
  BookMarked,
  TrendingUp,
  BadgeDollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { fineApi } from '@/lib/api';

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
  category?: string;
}

interface Borrow {
  id: string;
  dueDate: string;
  status: string;
  isOverdue: boolean;
  daysUntilDue: number;
  book: {
    id: string;
    title: string;
    authors: string[];
  };
}

const BOOK_COLORS = [
  'from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30',
  'from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30',
  'from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30',
  'from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30',
];

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
          const total = fines.filter((f) => f.status === 'PENDING').reduce((sum, f) => sum + f.amount, 0);
          setPendingFineTotal(total);
        }).catch(() => {});

        if (statsRes?.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        if (booksRes?.ok) {
          const booksData = await booksRes.json();
          setRecommendations(booksData.data || []);
        }

        if (borrowsRes?.ok) {
          const borrowsData = await borrowsRes.json();
          setBorrows(borrowsData.filter((b: Borrow) => b.status === 'ACTIVE').slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getBorrowStatus = (borrow: Borrow) => {
    if (borrow.isOverdue) {
      return { label: 'Overdue', className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    }
    if (borrow.daysUntilDue <= 3) {
      return { label: 'Due Soon', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    }
    return { label: 'On Time', className: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {greeting()}, {user?.name?.split(' ')[0] || 'Student'}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Welcome to your library dashboard. Here's what's happening today.
        </p>
      </div>

      {/* Pending Fines Warning */}
      {pendingFineTotal > 0 && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <BadgeDollarSign className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-red-700 dark:text-red-400">Pending fine: ₺{pendingFineTotal}</span>
            <span className="text-red-600 dark:text-red-500 text-sm ml-2">Please settle at the library desk.</span>
          </div>
          <Link href="/dashboard/borrowed" className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline">
            View details
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.borrowedBooks ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Books Borrowed</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.activeReservations ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Reservations</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.daysUntilDue ?? '-'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Days Until Due</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.readingStreak ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Reading Streak</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/catalog"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-md transition-all text-left group"
        >
          <Search className="w-8 h-8 text-primary-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
            Search Catalog
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Browse thousands of books</p>
        </Link>

        <Link
          href="/dashboard/ai-assistant"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-md transition-all text-left group"
        >
          <Sparkles className="w-8 h-8 text-purple-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
            Ask AI Assistant
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Get study help and recommendations</p>
        </Link>

        <Link
          href="/dashboard/reservations"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-amber-200 dark:hover:border-amber-800 hover:shadow-md transition-all text-left group"
        >
          <BookMarked className="w-8 h-8 text-amber-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
            View Reservations
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Check your pending pickups</p>
        </Link>
      </div>

      {/* Recommended Books */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recommended for {user?.facultyName || 'You'}
          </h2>
          <Link
            href="/dashboard/catalog"
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.length > 0 ? (
              recommendations.map((book, index) => (
                <Link
                  key={book.id}
                  href={`/dashboard/catalog/${book.id}`}
                  className="group cursor-pointer block"
                >
                  <div
                    className={cn(
                      'aspect-[3/4] bg-gradient-to-br rounded-lg mb-3 flex items-center justify-center transition-transform group-hover:scale-[1.02]',
                      BOOK_COLORS[index % BOOK_COLORS.length]
                    )}
                  >
                    <BookOpen className="w-12 h-12 text-primary-400 dark:text-primary-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                    {book.authors.join(', ')}
                  </p>
                  <span
                    className={cn(
                      'inline-block mt-2 text-xs px-2 py-1 rounded-full',
                      book.availableCopies > 0
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    )}
                  >
                    {book.availableCopies > 0 ? 'Available' : 'Unavailable'}
                  </span>
                </Link>
              ))
            ) : (
              [1, 2, 3, 4].map((i) => (
                <Link
                  key={i}
                  href="/dashboard/catalog"
                  className="group cursor-pointer block"
                >
                  <div
                    className={cn(
                      'aspect-[3/4] bg-gradient-to-br rounded-lg mb-3 flex items-center justify-center transition-transform group-hover:scale-[1.02]',
                      BOOK_COLORS[(i - 1) % BOOK_COLORS.length]
                    )}
                  >
                    <BookOpen className="w-12 h-12 text-primary-400 dark:text-primary-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                    Introduction to Algorithms
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Thomas H. Cormen</p>
                  <span className="inline-block mt-2 text-xs px-2 py-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                    Available
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Current Borrows */}
      {borrows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Current Borrows</h2>
            <Link
              href="/dashboard/borrowed"
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">
                    Book
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">
                    Due Date
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {borrows.map((borrow) => {
                  const status = getBorrowStatus(borrow);
                  return (
                    <tr key={borrow.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 rounded flex-shrink-0 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-primary-400" />
                          </div>
                          <div>
                            <Link
                              href={`/dashboard/catalog/${borrow.book.id}`}
                              className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                            >
                              {borrow.book.title}
                            </Link>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {borrow.book.authors.join(', ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(borrow.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn('text-xs px-2 py-1 rounded-full font-medium', status.className)}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href="/dashboard/borrowed"
                          className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                        >
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

      {/* Borrow Limit Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Borrow Limit</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">You can borrow up to 5 books at a time</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.borrowedBooks ?? 0}/5
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">books used</p>
          </div>
        </div>
        <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all"
            style={{ width: `${((stats?.borrowedBooks ?? 0) / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
