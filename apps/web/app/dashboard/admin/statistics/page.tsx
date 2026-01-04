'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Users,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stats {
  totalBorrows: number;
  activeBorrows: number;
  overdueBorrows: number;
  thisMonthBorrows: number;
  lastMonthBorrows: number;
  percentChange: number;
  mostBorrowed: { book: any; count: number }[];
  trends: { month: string; borrowed: number; returned: number }[];
}

interface BorrowRecord {
  id: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: string;
  notes: string | null;
  isOverdue: boolean;
  overdueDays: number;
  estimatedFine: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    studentId: string | null;
    staffId: string | null;
  };
  book: {
    id: string;
    title: string;
    authors: string[];
    coverImageUrl: string | null;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
}

const roleLabels: Record<string, string> = {
  STUDENT: 'Student',
  INSTRUCTOR: 'Instructor',
  ADMIN: 'Admin',
  STAFF: 'Staff',
};

const roleColors: Record<string, string> = {
  STUDENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INSTRUCTOR:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  STAFF: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export default function AdminStatisticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<BorrowRecord[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // History filters
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/borrows/admin/statistics', {
        credentials: 'include',
      });
      if (response.ok) {
        setStats(await response.json());
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
      });
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/borrows/admin/history?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
        setTotal(data.meta?.total || 0);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [page, roleFilter, statusFilter]);

  const handleFilterChange = (type: 'role' | 'status', value: string) => {
    if (type === 'role') setRoleFilter(value);
    else setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Borrow Statistics
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Overview of borrowing activity and trends
        </p>
      </div>

      {/* Stats Cards */}
      {isLoadingStats ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : (
        stats && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Borrows
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {stats.totalBorrows}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                    <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Active
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {stats.activeBorrows}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Overdue
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {stats.overdueBorrows}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'rounded-lg p-2',
                      stats.percentChange >= 0
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    )}
                  >
                    {stats.percentChange >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      This Month
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {stats.thisMonthBorrows}
                      <span
                        className={cn(
                          'ml-2 text-sm font-normal',
                          stats.percentChange >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {stats.percentChange >= 0 ? '+' : ''}
                        {stats.percentChange}%
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Most Borrowed Books */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Most Borrowed Books
              </h2>
              <div className="space-y-3">
                {stats.mostBorrowed.map((item, index) => (
                  <div
                    key={item.book.id}
                    className="flex items-center gap-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900 dark:text-white">
                        {item.book.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.book.authors?.join(', ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-600 dark:text-primary-400">
                        {item.count}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        borrows
                      </p>
                    </div>
                  </div>
                ))}
                {stats.mostBorrowed.length === 0 && (
                  <p className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No borrow data available
                  </p>
                )}
              </div>
            </div>

            {/* Monthly Trends */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Monthly Trends
              </h2>
              <div className="space-y-2">
                {stats.trends.map((trend) => {
                  const maxBorrowed = Math.max(
                    ...stats.trends.map((t) => t.borrowed),
                    1
                  );
                  const percentage = (trend.borrowed / maxBorrowed) * 100;

                  return (
                    <div key={trend.month} className="flex items-center gap-4">
                      <span className="w-20 text-sm text-gray-500 dark:text-gray-400">
                        {trend.month}
                      </span>
                      <div className="flex-1">
                        <div className="h-6 rounded-full bg-gray-100 dark:bg-gray-700">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-12 text-right text-sm font-medium text-gray-900 dark:text-white">
                        {trend.borrowed}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )
      )}

      {/* Borrow History Section */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Borrow History ({total} records)
            </h2>
            <div className="flex flex-wrap gap-2">
              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => handleFilterChange('role', e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Users</option>
                <option value="STUDENT">Students</option>
                <option value="INSTRUCTOR">Instructors</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admins</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="RETURNED">Returned</option>
              </select>
            </div>
          </div>
        </div>

        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              No borrow records found
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Book
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Borrowed
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Due / Returned
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {history.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {record.user.name}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium',
                                roleColors[record.user.role]
                              )}
                            >
                              {roleLabels[record.user.role]}
                            </span>
                            {record.user.studentId && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {record.user.studentId}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-[200px] truncate font-medium text-gray-900 dark:text-white">
                          {record.book.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {record.branch.name}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(record.borrowedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {record.status === 'RETURNED' ? (
                          <span className="text-green-600 dark:text-green-400">
                            {new Date(record.returnedAt!).toLocaleDateString()}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              record.isOverdue
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-500 dark:text-gray-400'
                            )}
                          >
                            {new Date(record.dueAt).toLocaleDateString()}
                            {record.isOverdue &&
                              ` (${record.overdueDays}d late)`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {record.status === 'RETURNED' ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Returned
                          </span>
                        ) : record.isOverdue ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
