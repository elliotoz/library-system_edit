'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Check, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { finePaymentsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FinePayment {
  id: string;
  status: 'PENDING' | 'PAID' | 'WAIVED';
  amount: string;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; name: string; email: string };
  borrow: {
    id: string;
    bookCopy: { book: { id: string; title: string } };
  };
  paidBy: { id: string; name: string } | null;
}

interface Totals {
  pending: { count: number; total: number };
  paid: { count: number; total: number };
  waived: { count: number; total: number };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  WAIVED: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export default function ManageFinesPage() {
  const [fines, setFines] = useState<FinePayment[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [finesData, totalsData] = await Promise.all([
        finePaymentsApi.getAll({
          status: statusFilter || undefined,
          page,
          pageSize,
        }),
        finePaymentsApi.getTotals(),
      ]);
      setFines(finesData.fines);
      setTotal(finesData.total);
      setTotals(totalsData);
    } catch {
      toast.error('Failed to load fines');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, page]);

  const handleMarkPaid = async (id: string) => {
    try {
      await finePaymentsApi.markPaid(id);
      toast.success('Fine marked as paid');
      fetchData();
    } catch {
      toast.error('Failed to mark fine as paid');
    }
  };

  const handleWaive = async (id: string) => {
    const note = prompt('Reason for waiving (optional):');
    try {
      await finePaymentsApi.waive(id, note || undefined);
      toast.success('Fine waived');
      fetchData();
    } catch {
      toast.error('Failed to waive fine');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Fine Payments
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Track and manage overdue fines
        </p>
      </div>

      {/* Totals Cards */}
      {totals && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              ₺{totals.pending.total.toFixed(2)}
            </p>
            <p className="text-xs text-yellow-500">{totals.pending.count} records</p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm text-green-600 dark:text-green-400">Collected</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              ₺{totals.paid.total.toFixed(2)}
            </p>
            <p className="text-xs text-green-500">{totals.paid.count} records</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Waived</p>
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
              ₺{totals.waived.total.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400">{totals.waived.count} records</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'PENDING', 'PAID', 'WAIVED'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              statusFilter === s
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : fines.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <DollarSign className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">No fine records found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Book</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {fines.map((fine) => (
                <tr key={fine.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{fine.user.name}</p>
                    <p className="text-xs text-gray-500">{fine.user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {fine.borrow.bookCopy.book.title}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    ₺{Number(fine.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[fine.status])}>
                      {fine.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(fine.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {fine.status === 'PENDING' ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleMarkPaid(fine.id)}
                          className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                          title="Mark Paid"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleWaive(fine.id)}
                          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Waive"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {fine.paidBy ? `by ${fine.paidBy.name}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} total records</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="flex items-center px-2 text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
