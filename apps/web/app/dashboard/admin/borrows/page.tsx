'use client';

import { useState, useEffect } from 'react';
import {
  BookOpen,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Search,
  RefreshCw,
  DollarSign,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Borrow {
  id: string;
  borrowedAt: string;
  dueAt: string;
  extensionCount: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    studentId?: string;
    staffId?: string;
  };
  book: {
    id: string;
    title: string;
    authors: string[];
    coverImageUrl?: string;
  };
  bookCopy: {
    id: string;
    brandId: string;
    condition: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
  isOverdue: boolean;
  overdueDays: number;
  estimatedFine: number;
  daysUntilDue: number;
}

interface Stats {
  active: number;
  overdue: number;
  returned: number;
  totalPotentialFines: number;
  fineRatePerDay: number;
}

export default function AdminBorrowsPage() {
  const [borrows, setBorrows] = useState<Borrow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'active'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [borrowsRes, statsRes] = await Promise.all([
        fetch('/api/borrows/admin/active', { credentials: 'include' }),
        fetch('/api/borrows/stats', { credentials: 'include' }),
      ]);

      if (borrowsRes.ok) setBorrows(await borrowsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load borrows');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReturn = async (borrowId: string) => {
    setProcessingId(borrowId);
    try {
      const response = await fetch(`/api/borrows/${borrowId}/return`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.wasOverdue) {
          toast.success(
            <div>
              <p className="font-medium">Book returned!</p>
              <p className="text-sm">
                Overdue fine: ₺{result.fine} ({result.overdueDays} days)
              </p>
            </div>,
            { duration: 5000 }
          );
        } else {
          toast.success('Book returned successfully!');
        }
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to return book');
      }
    } catch (error) {
      toast.error('Failed to return book');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredBorrows = borrows.filter((borrow) => {
    // Filter by status
    if (filter === 'overdue' && !borrow.isOverdue) return false;
    if (filter === 'active' && borrow.isOverdue) return false;

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        borrow.book.title.toLowerCase().includes(query) ||
        borrow.user.name.toLowerCase().includes(query) ||
        borrow.user.email.toLowerCase().includes(query) ||
        borrow.bookCopy.brandId.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const overdueCount = borrows.filter((b) => b.isOverdue).length;
  const activeCount = borrows.filter((b) => !b.isOverdue).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Active Borrows & Returns
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Manage borrowed books and process returns
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.active || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Active
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                {stats?.overdue || 0}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">Overdue</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-800">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                {stats?.returned || 0}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Returned (Total)
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-800">
              <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                ₺{stats?.totalPotentialFines || 0}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Pending Fines
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {[
            { value: 'all', label: `All (${borrows.length})` },
            { value: 'overdue', label: `Overdue (${overdueCount})` },
            { value: 'active', label: `On Time (${activeCount})` },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as typeof filter)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                filter === f.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by book, user, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 sm:w-80"
          />
        </div>
      </div>

      {/* Borrows List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex gap-4">
                <div className="h-20 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredBorrows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <Package className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
            No active borrows
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {filter !== 'all'
              ? 'No borrows match the selected filter'
              : 'All books have been returned'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBorrows.map((borrow) => (
            <div
              key={borrow.id}
              className={cn(
                'rounded-xl border bg-white p-4 dark:bg-gray-800',
                borrow.isOverdue
                  ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                {/* Book Info */}
                <div className="flex flex-1 gap-4">
                  <div className="flex h-20 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30">
                    {borrow.book.coverImageUrl ? (
                      <img
                        src={borrow.book.coverImageUrl}
                        alt={borrow.book.title}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <BookOpen className="h-6 w-6 text-primary-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 font-medium text-gray-900 dark:text-white">
                        {borrow.book.title}
                      </h3>
                      {borrow.isOverdue && (
                        <span className="flex-shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {borrow.book.authors.join(', ')}
                    </p>

                    {/* Copy Info */}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span className="rounded bg-gray-100 px-2 py-1 font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {borrow.bookCopy.brandId}
                      </span>
                      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <MapPin className="h-3 w-3" />
                        {borrow.branch.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-shrink-0 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50 lg:w-56">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {borrow.user.name}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                    {borrow.user.email}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                      {borrow.user.role}
                    </span>
                    {(borrow.user.studentId || borrow.user.staffId) && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {borrow.user.studentId || borrow.user.staffId}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dates & Actions */}
                <div className="flex flex-col gap-2 lg:w-48">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 dark:text-gray-400">
                      Borrowed:{' '}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {new Date(borrow.borrowedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      borrow.isOverdue
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    <span>Due: </span>
                    <span className="font-medium">
                      {new Date(borrow.dueAt).toLocaleDateString()}
                    </span>
                  </div>

                  {borrow.isOverdue && (
                    <div className="rounded bg-red-100 px-2 py-1 text-center text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {borrow.overdueDays} days overdue • Fine: ₺
                      {borrow.estimatedFine}
                    </div>
                  )}

                  {!borrow.isOverdue && borrow.daysUntilDue <= 3 && (
                    <div className="rounded bg-amber-100 px-2 py-1 text-center text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Due in {borrow.daysUntilDue} day
                      {borrow.daysUntilDue !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Return Button */}
                <div className="flex-shrink-0">
                  <button
                    onClick={() => handleReturn(borrow.id)}
                    disabled={processingId === borrow.id}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-lg px-6 py-2.5 font-medium transition-colors disabled:opacity-50 lg:w-auto',
                      borrow.isOverdue
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    )}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {processingId === borrow.id
                      ? 'Processing...'
                      : borrow.isOverdue
                        ? `Return (₺${borrow.estimatedFine} fine)`
                        : 'Mark Returned'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
