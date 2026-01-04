'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Grid, List, BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  const [availability, setAvailability] = useState<'all' | 'available' | 'unavailable'>('all');
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Book Catalog</h1>
        <p className="text-gray-500 mt-1">Browse and search our collection of {meta?.total || 0} books</p>
      </div>

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
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button onClick={() => setViewMode('grid')} className={cn('p-2.5', viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400')}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={cn('p-2.5', viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400')}>
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
                <select value={availability} onChange={(e) => { setAvailability(e.target.value as any); setPage(1); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                  <option value="all">All Books</option>
                  <option value="available">Available Only</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [f, o] = e.target.value.split('-'); setSortBy(f); setSortOrder(o as any); setPage(1); }} className="w-full px-3 py-2 border border-gray-200 rounded-lg">
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="aspect-[3/4] bg-gray-200 rounded-lg mb-4" />
              <div className="h-4 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No books found</h3>
          <p className="text-gray-500 mb-4">Try adjusting your search or filters</p>
          <button onClick={clearFilters} className="text-primary-600 hover:text-primary-700 font-medium">Clear all filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map((book) => (
            <Link key={book.id} href={`/dashboard/catalog/${book.id}`} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-primary-200 transition-all group">
              <div className="aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mb-4 flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-primary-400" />
              </div>
              <h3 className="font-medium text-gray-900 group-hover:text-primary-600 line-clamp-2 mb-1">{book.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-1 mb-2">{book.authors.join(', ')}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-xs px-2 py-1 rounded-full font-medium', book.isAvailable ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                  {book.isAvailable ? `${book.availableCopies} Available` : 'Unavailable'}
                </span>
                {book.mainFaculty && <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{book.mainFaculty.code}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(page - 1)} disabled={!meta.hasPreviousPage} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="px-4 py-2">Page {page} of {meta.totalPages}</span>
          <button onClick={() => setPage(page + 1)} disabled={!meta.hasNextPage} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
