'use client';

import { useState, useEffect } from 'react';
import {
  History,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BorrowHistory {
  id: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  extensionCount: number;
  notes: string | null;
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

export default function BorrowHistoryPage() {
  const [history, setHistory] = useState<BorrowHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
      });

      const response = await fetch(`/api/borrows/history?${params}`, {
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const wasOverdue = (dueAt: string, returnedAt: string | null) => {
    if (!returnedAt) return false;
    return new Date(returnedAt) > new Date(dueAt);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Borrow History
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          View all your past borrowed books
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900/30">
              <History className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Borrowed
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {total}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              No borrow history
            </h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Books you've returned will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                {/* Book Cover */}
                <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
                  {item.book.coverImageUrl ? (
                    <img
                      src={item.book.coverImageUrl}
                      alt={item.book.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Book Info */}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-medium text-gray-900 dark:text-white">
                    {item.book.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {item.book.authors.join(', ')}
                  </p>
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(item.borrowedAt).toLocaleDateString()}
                    </span>
                    <span>→</span>
                    <span>
                      {item.returnedAt
                        ? new Date(item.returnedAt).toLocaleDateString()
                        : 'Not returned'}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex-shrink-0">
                  {wasOverdue(item.dueAt, item.returnedAt) ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Returned Late
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Returned
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

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
      </div>
    </div>
  );
}
