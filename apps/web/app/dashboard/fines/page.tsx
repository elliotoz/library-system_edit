'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DollarSign, BookOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fineApi, MyFine } from '@/lib/api';

const STATUS_CONFIG: Record<
  MyFine['status'],
  { label: string; color: string }
> = {
  PENDING: {
    label: 'Unpaid',
    color:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  PAID: {
    label: 'Paid',
    color:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  WAIVED: {
    label: 'Waived',
    color:
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
};

export default function MyFinesPage() {
  const [fines, setFines] = useState<MyFine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fineApi
      .getMyFines()
      .then(setFines)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const pendingTotal = fines
    .filter((f) => f.status === 'PENDING')
    .reduce((sum, f) => sum + Number(f.amount), 0);

  const paidTotal = fines
    .filter((f) => f.status === 'PAID')
    .reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Fines
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Your fine history and payment status
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <DollarSign className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₺{pendingTotal.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Outstanding
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₺{paidTotal.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Paid
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending notice */}
      {pendingTotal > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-900/20">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            You have ₺{pendingTotal.toFixed(2)} in outstanding fines. Please
            settle at the library desk with your student/staff ID.
          </p>
        </div>
      )}

      {/* Fine list */}
      {isLoading ? (
        <div className="glass-card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : fines.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No fines
          </h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Your fine record is clear.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {fines.map((fine) => {
            const config = STATUS_CONFIG[fine.status];
            return (
              <div key={fine.id} className="glass-card p-4">
                <div className="flex items-center gap-4">
                  {/* Book thumbnail */}
                  <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30">
                    {fine.borrow.bookCopy.book.coverImageUrl ? (
                      <img
                        src={fine.borrow.bookCopy.book.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="h-4 w-4 text-primary-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/catalog/${fine.borrow.bookCopy.book.id}`}
                      className="block truncate font-medium text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                    >
                      {fine.borrow.bookCopy.book.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      Due: {new Date(fine.borrow.dueAt).toLocaleDateString()}
                      {fine.borrow.returnedAt &&
                        ` · Returned: ${new Date(fine.borrow.returnedAt).toLocaleDateString()}`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Fine issued:{' '}
                      {new Date(fine.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Amount + status */}
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      ₺{Number(fine.amount).toFixed(2)}
                    </p>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        config.color
                      )}
                    >
                      {config.label}
                    </span>
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
