'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Grid, List, BookOpen, ChevronLeft, ChevronRight, X, Laptop } from 'lucide-react';
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

/** Returns the badge props for a book based on physical copy + ebook state */
function availabilityBadge(book: Book): { label: string; className: string } {
  if (book.availableCopies > 0) {
    return {
      label: `${book.availableCopies} Available`,
      className: 'bg-green-50 text-green-700',
    };
  }
  if (book.totalCopies === 0 && book.isEbookAvailable) {
    return {
      label: 'E-book Only',
      className: 'bg-blue-50 text-blue-700',
    };
  }
  return {
    label: 'Unavailable',
    className: 'bg-red-50 text-red-700',
  };
}

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

  const BookCover = ({ book, className }: { book: Book; className: string }) => (
    <div className={cn('overflow-hidden rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center', className)}>
      {book.coverImageUrl ? (
        <img
          src={book.coverImageUrl}
          alt={book.title}
          className="h-full w-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <BookOpen className="w-10 h-10 text-primary-400" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Book Catalog</h1>
        <p className="text-gray-500 mt-1">Browse and search our collection of {meta?.total || 0} books</p>
      </div>

      {/* Search + filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, author, or ISBN..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors',
                showFilters ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
            >
              <Filter className="w-4 h-4" /> Filters
              {hasActiveFilters && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
            </button>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('p-2.5 transition-colors', viewMode === 'grid' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:bg-gray-50')}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn('p-2.5 transition-colors', viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:bg-gray-50')}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Faculty</label>
                <select value={selectedFaculty} onChange={(e) => { setSelectedFaculty(e.target.value); setPage(1); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                  <option value="">All Faculties</option>
                  {faculties.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.bookCount})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                <select value={availability} onChange={(e) => { setAvailability(e.target.value as AvailabilityFilter); setPage(1); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                  <option value="all">All Books</option>
                  <option value="available">Available (Physical Copy)</option>
                  <option value="ebook-only">E-book Only</option>
                  <option value="unavailable">Unavailable (All Borrowed)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [f, o] = e.target.value.split('-'); setSortBy(f); setSortOrder(o as 'asc' | 'desc'); setPage(1); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                  <option value="title-asc">Title (A–Z)</option>
                  <option value="title-desc">Title (Z–A)</option>
                  <option value="year-desc">Newest First</option>
                  <option value="year-asc">Oldest First</option>
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <div className="mt-4 flex justify-end">
                <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                  <X className="w-4 h-4" /> Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-gray-500">Showing {books.length} of {meta?.total || 0} books</p>

      {/* Loading skeleton */}
      {isLoading && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="aspect-[3/4] bg-gray-200 rounded-lg mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {isLoading && viewMode === 'list' && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse flex gap-4">
              <div className="w-12 h-16 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && books.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No books found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
          <button onClick={clearFilters} className="text-primary-600 hover:text-primary-700 font-medium">Clear all filters</button>
        </div>
      )}

      {/* Grid view */}
      {!isLoading && books.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map((book) => {
            const badge = availabilityBadge(book);
            return (
              <Link key={book.id} href={`/dashboard/catalog/${book.id}`} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-primary-200 transition-all group flex flex-col">
                <div className="aspect-[2/3] w-full mb-4">
                  <BookCover book={book} className="w-full h-full" />
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-primary-600 line-clamp-2 mb-1">{book.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-1 mb-2">{book.authors.join(', ') || 'Unknown author'}</p>
                <div className="flex items-center gap-2 flex-wrap mt-auto">
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', badge.className)}>
                    {badge.label}
                  </span>
                  {book.isEbookAvailable && book.totalCopies > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-700 flex items-center gap-1">
                      <Laptop className="w-3 h-3" /> E-book
                    </span>
                  )}
                  {book.mainFaculty && <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{book.mainFaculty.code}</span>}
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
              <Link key={book.id} href={`/dashboard/catalog/${book.id}`} className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-md hover:border-primary-200 transition-all group flex items-center gap-4">
                {/* Thumbnail */}
                <BookCover book={book} className="w-12 h-16 shrink-0" />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 group-hover:text-primary-600 truncate">{book.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{book.authors.join(', ') || 'Unknown author'}</p>
                  {book.description && (
                    <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{book.description}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
                  <span className={cn('text-xs px-2 py-1 rounded-full font-medium', badge.className)}>
                    {badge.label}
                  </span>
                  {book.isEbookAvailable && book.totalCopies > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-50 text-blue-700 flex items-center gap-1">
                      <Laptop className="w-3 h-3" /> E-book
                    </span>
                  )}
                  {book.mainFaculty && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{book.mainFaculty.code}</span>
                  )}
                  {book.publicationYear && (
                    <span className="text-xs text-gray-400">{book.publicationYear}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(page - 1)} disabled={!meta.hasPreviousPage} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 py-2 text-sm">Page {page} of {meta.totalPages}</span>
          <button onClick={() => setPage(page + 1)} disabled={!meta.hasNextPage} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
