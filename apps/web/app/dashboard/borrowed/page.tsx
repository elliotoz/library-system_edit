'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, AlertTriangle, CheckCircle, Clock, RefreshCw, Calendar, BadgeDollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { fineApi, MyFine } from '@/lib/api';
import { extractApiError } from '@/lib/api-error';

interface Borrow {
  id: string;
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  status: 'ACTIVE' | 'RETURNED' | 'OVERDUE';
  extensionCount: number;
  isOverdue: boolean;
  overdueDays: number;
  estimatedFine: number;
  daysUntilDue: number;
  book: {
    id: string;
    title: string;
    authors: string[];
    coverImageUrl?: string;
  };
  branch: {
    id: string;
    name: string;
    code: string;
  };
}

interface BorrowPolicy {
  maxExtensions: number;
  extensionDays: number;
}

export default function BorrowedBooksPage() {
  const [borrows, setBorrows] = useState<Borrow[]>([]);
  const [filteredBorrows, setFilteredBorrows] = useState<Borrow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'returned'>('all');
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<BorrowPolicy>({ maxExtensions: 2, extensionDays: 7 });
  const [pendingFines, setPendingFines] = useState<MyFine[]>([]);

  useEffect(() => {
    fetchBorrows();
    fetchPolicy();
    fineApi.getMyFines().then((fines) => setPendingFines(fines.filter((f) => f.status === 'PENDING'))).catch(() => {});
  }, []);

  useEffect(() => {
    filterBorrows();
  }, [borrows, activeFilter]);

  const fetchBorrows = async () => {
    try {
      const response = await fetch('/api/borrows/my', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setBorrows(data);
      }
    } catch (error) {
      console.error('Error fetching borrows:', error);
      toast.error('Failed to load borrowed books');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPolicy = async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        const user = await response.json();
        // Get policy based on role - default values
        const policies: Record<string, BorrowPolicy> = {
          STUDENT: { maxExtensions: 2, extensionDays: 7 },
          INSTRUCTOR: { maxExtensions: 3, extensionDays: 14 },
          STAFF: { maxExtensions: 3, extensionDays: 14 },
          ADMIN: { maxExtensions: 5, extensionDays: 14 },
        };
        setPolicy(policies[user.role] || policies.STUDENT);
      }
    } catch (error) {
      console.error('Error fetching policy:', error);
    }
  };

  const filterBorrows = () => {
    let filtered = [...borrows];
    if (activeFilter === 'active') {
      filtered = borrows.filter((b) => b.status === 'ACTIVE');
    } else if (activeFilter === 'returned') {
      filtered = borrows.filter((b) => b.status === 'RETURNED');
    }
    setFilteredBorrows(filtered);
  };

  const handleExtend = async (borrowId: string) => {
    setExtendingId(borrowId);
    try {
      const response = await fetch(`/api/borrows/${borrowId}/extend`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const updatedBorrow = await response.json();
        toast.success(`Extended by ${policy.extensionDays} days! New due date: ${new Date(updatedBorrow.dueAt).toLocaleDateString()}`);
        // Refresh borrows
        fetchBorrows();
      } else {
        toast.error(await extractApiError(response, 'Failed to extend borrow'));
      }
    } catch (error) {
      console.error('Error extending borrow:', error);
      toast.error('Failed to extend borrow');
    } finally {
      setExtendingId(null);
    }
  };

  const stats = {
    borrowed: borrows.filter((b) => b.status === 'ACTIVE').length,
    overdue: borrows.filter((b) => b.isOverdue).length,
    returned: borrows.filter((b) => b.status === 'RETURNED').length,
  };

  const getStatusBadge = (borrow: Borrow) => {
    if (borrow.status === 'RETURNED') {
      return { label: 'Returned', className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
    }
    if (borrow.isOverdue) {
      return { label: 'Overdue', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    }
    if (borrow.daysUntilDue <= 3) {
      return { label: 'Due Soon', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
    }
    return { label: 'Active', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Borrowed Books</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your current and past book loans</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.borrowed}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Currently Borrowed</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.overdue}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.returned}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Returned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Policy Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Clock className="w-5 h-5" />
          <span className="font-medium">Your Borrow Policy:</span>
          <span>Up to {policy.maxExtensions} extensions, {policy.extensionDays} days each</span>
        </div>
      </div>

      {/* Pending Fines Banner */}
      {pendingFines.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <BadgeDollarSign className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Pending Fine{pendingFines.length > 1 ? 's' : ''}:</span>
            <span>
              ₺{pendingFines.reduce((sum, f) => sum + Number(f.amount), 0)} outstanding across {pendingFines.length} book{pendingFines.length > 1 ? 's' : ''}.
              Please settle at the library desk.
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'returned'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeFilter === filter
                ? 'bg-primary-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Borrows List */}
      {filteredBorrows.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No books found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {activeFilter === 'all'
              ? "You haven't borrowed any books yet"
              : `No ${activeFilter} borrows`}
          </p>
          <Link
            href="/dashboard/catalog"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Browse Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBorrows.map((borrow) => {
            const status = getStatusBadge(borrow);
            const canExtend = borrow.status === 'ACTIVE' && borrow.extensionCount < policy.maxExtensions;

            return (
              <div
                key={borrow.id}
                className="glass-card p-4 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Book Cover */}
                  <Link href={`/dashboard/catalog/${borrow.book.id}`} className="flex-shrink-0">
                    <div className="w-20 h-28 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 rounded-lg flex items-center justify-center">
                      {borrow.book.coverImageUrl ? (
                        <img
                          src={borrow.book.coverImageUrl}
                          alt={borrow.book.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <BookOpen className="w-8 h-8 text-primary-400" />
                      )}
                    </div>
                  </Link>

                  {/* Book Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/catalog/${borrow.book.id}`}
                      className="text-lg font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      {borrow.book.title}
                    </Link>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {borrow.book.authors.join(', ')}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Borrowed: {new Date(borrow.borrowDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          Due: {new Date(borrow.dueDate).toLocaleDateString()}
                          {borrow.status === 'ACTIVE' && !borrow.isOverdue && (
                            <span className="text-gray-400 dark:text-gray-500">
                              {' '}({borrow.daysUntilDue} days left)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {borrow.isOverdue && borrow.estimatedFine > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 text-red-600 dark:text-red-400">
                        <BadgeDollarSign className="w-4 h-4" />
                        <span className="text-sm font-medium">
                          Estimated fine: ₺{borrow.estimatedFine} ({borrow.overdueDays} day{borrow.overdueDays > 1 ? 's' : ''} overdue)
                        </span>
                      </div>
                    )}

                    {borrow.extensionCount > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                        Extended {borrow.extensionCount} time{borrow.extensionCount > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-3">
                    <span className={cn('px-3 py-1 rounded-full text-xs font-medium', status.className)}>
                      {status.label}
                    </span>

                    {canExtend && (
                      <button
                        onClick={() => handleExtend(borrow.id)}
                        disabled={extendingId === borrow.id}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          extendingId === borrow.id
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-primary-500 text-white hover:bg-primary-600'
                        )}
                      >
                        <RefreshCw className={cn('w-4 h-4', extendingId === borrow.id && 'animate-spin')} />
                        {extendingId === borrow.id ? 'Extending...' : 'Extend'}
                      </button>
                    )}

                    {borrow.status === 'ACTIVE' && borrow.extensionCount >= policy.maxExtensions && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Max extensions reached
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
