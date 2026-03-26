'use client';

import { useState, useEffect } from 'react';
import { FileDown, FileSpreadsheet, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportsApi } from '@/lib/api';

interface ReportSummary {
  period: { from: string; to: string };
  totalBorrows: number;
  totalReturns: number;
  overdueCount: number;
  pendingReservations: number;
  collectedFines: number;
  topBooks: { title: string; author: string; borrowCount: number }[];
  usersByRole: { role: string; count: number }[];
}

export default function ReportsPage() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    handleGenerate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    if (!from || !to) {
      toast.error('Select both dates');
      return;
    }
    setLoading(true);
    try {
      const data = await reportsApi.getSummary(from, to);
      setSummary(data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    if (!from || !to) {
      toast.error('Select both dates');
      return;
    }
    // Use window.open for cookie-authenticated file download
    window.open(reportsApi.exportUrl(format, from, to), '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Generate and export library operational reports
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 glass-card p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Summary'}
        </button>
        <button
          onClick={() => handleExport('pdf')}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <FileDown className="h-4 w-4" /> Export PDF
        </button>
        <button
          onClick={() => handleExport('excel')}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <FileSpreadsheet className="h-4 w-4" /> Export Excel
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: 'Total Borrows', value: summary.totalBorrows, color: 'text-blue-600' },
              { label: 'Total Returns', value: summary.totalReturns, color: 'text-green-600' },
              { label: 'Overdue', value: summary.overdueCount, color: 'text-red-600' },
              { label: 'Pending Reservations', value: summary.pendingReservations, color: 'text-yellow-600' },
              { label: 'Collected Fines', value: `₺${summary.collectedFines.toFixed(2)}`, color: 'text-emerald-600' },
            ].map((m) => (
              <div
                key={m.label}
                className="glass-card p-4"
              >
                <p className="text-sm text-gray-500 dark:text-gray-400">{m.label}</p>
                <p className={`mt-1 text-2xl font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Top Books */}
          {summary.topBooks.length > 0 && (
            <div className="glass-card">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Top Borrowed Books
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">#</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Title</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Author</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Borrows</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {summary.topBooks.map((book, i) => (
                      <tr key={book.title}>
                        <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{book.title}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{book.author}</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{book.borrowCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users by Role */}
          {summary.usersByRole.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
                Active Users by Role
              </h2>
              <div className="flex flex-wrap gap-4">
                {summary.usersByRole.map((u) => (
                  <div key={u.role} className="rounded-lg bg-gray-50 px-4 py-2 dark:bg-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{u.role}</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{u.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!summary && !loading && (
        <div className="glass-card p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">Select a date range and generate a summary</p>
        </div>
      )}
    </div>
  );
}
