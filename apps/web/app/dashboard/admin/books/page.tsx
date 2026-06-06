'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Brain,
  Loader2,
  FileText,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { extractApiError } from '@/lib/api-error';
import { AdminPageLayout } from '@/components/dashboard/AdminPageLayout';

interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  pdfUrl: string | null;
  ebookUrl: string | null;
  pdfIndexStatus: 'PENDING' | 'PROCESSING' | 'INDEXED' | 'FAILED' | 'NOT_APPLICABLE';
  pdfPageCount: number | null;
  pdfIndexedAt: string | null;
}

const indexStatusConfig: Record<
  Book['pdfIndexStatus'],
  { label: string; className: string; title: string }
> = {
  PENDING: {
    label: 'pending',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    title: 'Waiting to be indexed',
  },
  PROCESSING: {
    label: 'processing',
    className:
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    title: 'PDF indexing is in progress',
  },
  INDEXED: {
    label: 'indexed',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    title: 'PDF content is indexed',
  },
  FAILED: {
    label: 'failed',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    title: 'PDF indexing failed',
  },
  NOT_APPLICABLE: {
    label: 'n/a',
    className:
      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    title: 'No local PDF or direct PDF e-book URL is available',
  },
};

function IndexStatusIcon({ status }: { status: Book['pdfIndexStatus'] }) {
  if (status === 'PROCESSING') return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  if (status === 'INDEXED') return <CheckCircle className="h-3.5 w-3.5" />;
  if (status === 'FAILED') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'PENDING') return <Clock className="h-3.5 w-3.5" />;
  return <X className="h-3.5 w-3.5" />;
}

export default function ManageBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isReindexing, setIsReindexing] = useState(false);

  const fetchBooks = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
      });
      if (search) params.append('search', search);

      const response = await fetch(`/api/books?${params}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setBooks(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching books:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [page]);
  useEffect(() => {
    const debounce = setTimeout(fetchBooks, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleDelete = async (bookId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/books/${bookId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('Book deleted');
        fetchBooks();
      } else {
        toast.error(await extractApiError(response, 'Failed to delete book'));
      }
    } catch {
      toast.error('Failed to delete book');
    }
  };

  const handleReindexBooks = async () => {
    setIsReindexing(true);
    try {
      const response = await fetch('/api/books/admin/reindex-pending-pdfs?limit=25', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json() as { queued?: number };
        toast.success(`Queued ${data.queued ?? 0} book PDFs for indexing`);
        fetchBooks();
      } else {
        toast.error(await extractApiError(response, 'Failed to queue book indexing'));
      }
    } catch {
      toast.error('Failed to queue book indexing');
    } finally {
      setIsReindexing(false);
    }
  };

  return (
    <AdminPageLayout
      title="Manage Books"
      description="Add, edit, and manage library books"
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleReindexBooks}
            disabled={isReindexing}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Brain className="h-4 w-4" />
            {isReindexing ? 'Re-indexing...' : 'Re-index Books'}
          </button>
          <Link
            href="/dashboard/admin/books/new"
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Add Book
          </Link>
        </div>
      }
    >
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
          <input
            type="text"
            placeholder="Search books..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white py-2.5 pl-10 pr-4 focus:ring-2 focus:ring-primary-400"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : books.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-gray-500 dark:text-gray-400">No books found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Book
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    ISBN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Copies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    PDF / E-book
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    AI Index
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/catalog/${book.id}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-primary-600"
                      >
                        {book.title}
                      </Link>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {book.authors.join(', ')}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {book.isbn || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {book.category || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          book.availableCopies > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {book.availableCopies}/{book.totalCopies}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={cn(
                            'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                            book.pdfUrl
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          )}
                          title={book.pdfUrl ? 'Local book PDF is attached' : 'No local book PDF attached'}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {book.pdfUrl ? 'PDF attached' : 'No PDF'}
                        </span>
                        <span
                          className={cn(
                            'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                            book.ebookUrl
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          )}
                          title={book.ebookUrl ? 'E-book URL is set' : 'No e-book URL set'}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {book.ebookUrl ? 'E-book URL' : 'No e-book URL'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={cn(
                            'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                            indexStatusConfig[book.pdfIndexStatus]?.className ||
                              indexStatusConfig.NOT_APPLICABLE.className
                          )}
                          title={
                            indexStatusConfig[book.pdfIndexStatus]?.title ||
                            indexStatusConfig.NOT_APPLICABLE.title
                          }
                        >
                          <IndexStatusIcon status={book.pdfIndexStatus} />
                          {indexStatusConfig[book.pdfIndexStatus]?.label || book.pdfIndexStatus}
                        </span>
                        {book.pdfPageCount ? (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {book.pdfPageCount} pages
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/admin/books/${book.id}/edit`}
                          className="rounded-lg p-2 text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(book.id, book.title)}
                          disabled={book.totalCopies > book.availableCopies}
                          title={
                            book.totalCopies > book.availableCopies
                              ? 'Cannot delete — some copies are currently borrowed or reserved'
                              : 'Delete book'
                          }
                          className="rounded-lg p-2 text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminPageLayout>
  );
}
