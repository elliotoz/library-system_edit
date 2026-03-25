'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Grid, List, BookOpen, ChevronLeft, ChevronRight, X, Laptop, Library } from 'lucide-react';
import { LiquidGlassSearch } from '@/components/ui/liquid-glass-search';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { cn } from '@/lib/utils';

interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn: string | null;
  description: string | null;
  publicationYear: number | null;
  category: string | null;
  coverImageUrl: string | null;
  subjectTags: string[];
  mainFaculty: { id: string; name: string; code: string } | null;
  totalCopies: number;
  availableCopies: number;
  isAvailable: boolean;
  isEbookAvailable: boolean;
  ebookUrl: string | null;
}

interface Faculty {
  id: string;
  name: string;
  code: string;
  bookCount: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

type AvailabilityFilter = 'all' | 'available' | 'unavailable' | 'ebook-only';

/** Returns the badge props for a book based on physical copy + ebook state.
 *  An e-book is always accessible — a book should only show "Unavailable"
 *  when it has no digital format AND all physical copies are borrowed. */
function availabilityBadge(book: Book): { label: string; className: string } {
  if (book.availableCopies > 0) {
    return {
      label: `${book.availableCopies} Available`,
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
  }
  if (book.isEbookAvailable) {
    return {
      label: book.totalCopies === 0 ? 'E-book Only' : 'E-book Available',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
  }
  return {
    label: 'Unavailable',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
}

/** Spine-style placeholder for books without a cover image */
const BookCoverPlaceholder = ({ title }: { title: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary-400 to-primary-600 p-3">
    <BookOpen className="h-10 w-10 text-white/80" />
    <p className="line-clamp-3 text-center text-xs font-medium leading-tight text-white/90">{title}</p>
  </div>
);

export default function CatalogPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [facultiesRes, categoriesRes] = await Promise.all([
          fetch('/api/books/faculties', { credentials: 'include' }),
          fetch('/api/books/categories', { credentials: 'include' }),
        ]);
        if (facultiesRes.ok) setFaculties(await facultiesRes.json());
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
      } catch (error) {
        console.error('Error fetching filters:', error);
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    const fetchBooks = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ page: page.toString(), pageSize: '12', sortBy, sortOrder });
        if (search) params.append('search', search);
        if (selectedFaculty) params.append('facultyId', selectedFaculty);
        if (selectedCategory) params.append('category', selectedCategory);
        if (availability !== 'all') params.append('availability', availability);

        const response = await fetch(`/api/books?${params}`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setBooks(data.data);
          setMeta(data.meta);
        }
      } catch (error) {
        console.error('Error fetching books:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchBooks, 300);
    return () => clearTimeout(debounce);
  }, [search, selectedFaculty, selectedCategory, availability, sortBy, sortOrder, page]);

  const clearFilters = () => {
    setSearch(''); setSelectedFaculty(''); setSelectedCategory('');
    setAvailability('all'); setSortBy('title'); setSortOrder('asc'); setPage(1);
  };

  const hasActiveFilters = search || selectedFaculty || selectedCategory || availability !== 'all';

  const facultyLabel = faculties.find((f) => f.id === selectedFaculty)?.name;
  const availabilityLabel: Record<AvailabilityFilter, string> = {
    all: '',
    available: 'Available',
    'ebook-only': 'E-book Only',
    unavailable: 'Unavailable',
  };

  // Build visible page range for pagination
  const paginationPages = (() => {
    if (!meta) return [];
    const total = meta.totalPages;
    const cur = page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (cur > 3) pages.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  })();

  const BookCover = ({ book, className }: { book: Book; className: string }) => (
    <div className={cn('overflow-hidden rounded-lg', className)}>
      {book.coverImageUrl ? (
        <img
          src={book.coverImageUrl}
          alt={book.title}
          className="h-full w-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <BookCoverPlaceholder title={book.title} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-sm">
              <Library className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Book Catalog</h1>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Browse and search our collection
          </p>
        </div>
        {meta && (
          <span className="mt-1 rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
            {meta.total.toLocaleString()} books
          </span>
        )}
      </div>

      {/* Search + filter bar — liquid glass chrome */}
      <div className="glass-chrome rounded-2xl p-4" style={{ borderRadius: 20 }}>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex-1">
            <LiquidGlassSearch
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="Search by title, author, or ISBN…"
              chips={[
                ...(facultyLabel ? [{ label: facultyLabel, onRemove: () => { setSelectedFaculty(''); setPage(1); } }] : []),
                ...(selectedCategory ? [{ label: selectedCategory, onRemove: () => { setSelectedCategory(''); setPage(1); } }] : []),
                ...(availability !== 'all' ? [{ label: availabilityLabel[availability], onRemove: () => { setAvailability('all'); setPage(1); } }] : []),
              ]}
              className="w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <LiquidGlassButton
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters ? 'primary' : 'secondary'}
              className="flex items-center gap-2 text-sm"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && <span className="h-2 w-2 rounded-full bg-teal-400" />}
            </LiquidGlassButton>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-2.5 transition-colors', viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')}
                aria-label="Grid view"
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-2.5 transition-colors', viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Faculty</label>
                <select value={selectedFaculty} onChange={(e) => { setSelectedFaculty(e.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600">
                  <option value="">All Faculties</option>
                  {faculties.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.bookCount})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Category</label>
                <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600">
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Availability</label>
                <select value={availability} onChange={(e) => { setAvailability(e.target.value as AvailabilityFilter); setPage(1); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600">
                  <option value="all">All Books</option>
                  <option value="available">Available (Physical Copy)</option>
                  <option value="ebook-only">E-book Only</option>
                  <option value="unavailable">Unavailable (All Borrowed)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sort By</label>
                <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [f, o] = e.target.value.split('-'); setSortBy(f); setSortOrder(o as 'asc' | 'desc'); setPage(1); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600">
                  <option value="title-asc">Title (A–Z)</option>
                  <option value="title-desc">Title (Z–A)</option>
                  <option value="year-desc">Newest First</option>
                  <option value="year-asc">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Active:</span>
            {search && (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                "{search}"
                <button onClick={() => { setSearch(''); setPage(1); }} className="ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedFaculty && facultyLabel && (
              <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                {facultyLabel}
                <button onClick={() => { setSelectedFaculty(''); setPage(1); }} className="ml-0.5 text-primary-400 hover:text-primary-600"><X className="h-3 w-3" /></button>
              </span>
            )}
            {selectedCategory && (
              <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                {selectedCategory}
                <button onClick={() => { setSelectedCategory(''); setPage(1); }} className="ml-0.5 text-primary-400 hover:text-primary-600"><X className="h-3 w-3" /></button>
              </span>
            )}
            {availability !== 'all' && (
              <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                {availabilityLabel[availability]}
                <button onClick={() => { setAvailability('all'); setPage(1); }} className="ml-0.5 text-primary-400 hover:text-primary-600"><X className="h-3 w-3" /></button>
              </span>
            )}
            <button onClick={clearFilters} className="text-xs text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-200">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results count */}
      {!isLoading && meta && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing <span className="font-medium text-gray-700 dark:text-gray-300">{books.length}</span> of{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{meta.total}</span> books
        </p>
      )}

      {/* Loading skeleton — grid */}
      {isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-4 aspect-[2/3] rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="mb-2 h-4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      )}

      {/* Loading skeleton — list */}
      {isLoading && viewMode === 'list' && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex animate-pulse gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="h-16 w-12 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && books.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <BookOpen className="mx-auto mb-4 h-14 w-14 text-gray-300 dark:text-gray-600" />
          <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-white">No books found</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
          <button onClick={clearFilters} className="rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400">
            Clear all filters
          </button>
        </div>
      )}

      {/* Grid view */}
      {!isLoading && books.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => {
            const badge = availabilityBadge(book);
            return (
              <Link
                key={book.id}
                href={`/dashboard/catalog/${book.id}`}
                className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-700"
              >
                <div className="mb-4 aspect-[2/3] w-full overflow-hidden rounded-lg">
                  <BookCover book={book} className="h-full w-full" />
                </div>
                <h3 className="mb-1 line-clamp-2 font-semibold text-gray-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                  {book.title}
                </h3>
                <p className="mb-3 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">
                  {book.authors.join(', ') || 'Unknown author'}
                </p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>
                    {badge.label}
                  </span>
                  {book.isEbookAvailable && book.totalCopies > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Laptop className="h-3 w-3" /> E-book
                    </span>
                  )}
                  {book.mainFaculty && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      {book.mainFaculty.code}
                    </span>
                  )}
                  {book.publicationYear && (
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                      {book.publicationYear}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* List view */}
      {!isLoading && books.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {books.map((book) => {
            const badge = availabilityBadge(book);
            return (
              <Link
                key={book.id}
                href={`/dashboard/catalog/${book.id}`}
                className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-primary-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-700"
              >
                <BookCover book={book} className="h-16 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-gray-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {book.title}
                  </h3>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                    {book.authors.join(', ') || 'Unknown author'}
                  </p>
                  {book.description && (
                    <p className="line-clamp-1 mt-0.5 text-xs text-gray-400 dark:text-gray-500">{book.description}</p>
                  )}
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', badge.className)}>
                    {badge.label}
                  </span>
                  {book.isEbookAvailable && book.totalCopies > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Laptop className="h-3 w-3" /> E-book
                    </span>
                  )}
                  {book.mainFaculty && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                      {book.mainFaculty.code}
                    </span>
                  )}
                  {book.publicationYear && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">{book.publicationYear}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => setPage(page - 1)}
            disabled={!meta.hasPreviousPage}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>

          {paginationPages.map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-sm text-gray-400">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                className={cn(
                  'h-9 w-9 rounded-lg text-sm font-medium transition-colors',
                  page === p
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => setPage(page + 1)}
            disabled={!meta.hasNextPage}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
