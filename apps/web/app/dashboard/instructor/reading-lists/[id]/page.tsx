'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Plus, Search, Trash2, Save, Eye, EyeOff, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { readingListsApi } from '@/lib/api';
import { ReadingList, ReadingListVisibility, ReadingListStatus } from '@/types';

interface BookSearchResult {
  id: string;
  title: string;
  authors: string[];
  coverImageUrl: string | null;
  isbn: string | null;
}

export default function ManageReadingListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;

  const [list, setList] = useState<ReadingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Edit fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [semester, setSemester] = useState('');
  const [visibility, setVisibility] = useState<ReadingListVisibility>('PUBLIC');
  const [status, setStatus] = useState<ReadingListStatus>('DRAFT');

  // Book search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      const data = await readingListsApi.getById(listId);
      setList(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setCourseCode(data.courseCode || '');
      setSemester(data.semester || '');
      setVisibility(data.visibility);
      setStatus(data.status);
    } catch {
      toast.error('Reading list not found');
      router.push('/dashboard/instructor/reading-lists');
    } finally {
      setIsLoading(false);
    }
  }, [listId, router]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await readingListsApi.update(listId, {
        title,
        description: description || undefined,
        courseCode: courseCode || undefined,
        semester: semester || undefined,
        visibility,
        status,
      });
      toast.success('Reading list updated');
      await fetchList();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to update';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/books?search=${encodeURIComponent(searchQuery)}&pageSize=10`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const books = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setSearchResults(books);
        setHasSearched(true);
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddBook = async (bookId: string) => {
    try {
      await readingListsApi.addItem(listId, { bookId });
      toast.success('Book added');
      setSearchResults((prev) => prev.filter((b) => b.id !== bookId));
      await fetchList();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to add book';
      toast.error(msg);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await readingListsApi.removeItem(listId, itemId);
      toast.success('Book removed');
      await fetchList();
    } catch {
      toast.error('Failed to remove book');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  if (!list) return null;

  const existingBookIds = new Set(list.items.map((item) => item.bookId));

  return (
    <div className="space-y-6">
      <Link href="/dashboard/instructor/reading-lists" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to reading lists
      </Link>

      {/* Details form */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">List Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course Code</label>
            <input
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., CS101"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Semester</label>
            <input
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., Spring 2026"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as ReadingListVisibility)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="PUBLIC">Public</option>
              <option value="FOLLOWERS_ONLY">Followers Only</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReadingListStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Books in list */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Books ({list.items.length})
          </h2>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Book
          </button>
        </div>

        {/* Book search */}
        {showSearch && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search books by title or author..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
            {searchResults.length > 0 ? (
              <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                {searchResults
                  .filter((b) => !existingBookIds.has(b.id))
                  .map((book) => (
                    <div key={book.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        {book.coverImageUrl ? (
                          <img src={book.coverImageUrl} alt={book.title} className="w-8 h-11 object-cover rounded" />
                        ) : (
                          <div className="w-8 h-11 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{book.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{book.authors?.join(', ')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddBook(book.id)}
                        className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-xs hover:bg-green-100 dark:hover:bg-green-900/30"
                      >
                        <Plus className="w-3 h-3 inline mr-1" />Add
                      </button>
                    </div>
                  ))}
              </div>
            ) : hasSearched && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center">No matching books found.</p>
            )}
          </div>
        )}

        {/* Current items */}
        {list.items.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p>No books yet. Add books to this list.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.items.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}</span>
                  {item.book.coverImageUrl ? (
                    <img src={item.book.coverImageUrl} alt={item.book.title} className="w-8 h-11 object-cover rounded" />
                  ) : (
                    <div className="w-8 h-11 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.book.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.book.authors?.join(', ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="Remove from list"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
