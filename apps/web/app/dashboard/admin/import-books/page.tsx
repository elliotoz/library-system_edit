'use client';

import { useState } from 'react';
import { Search, Download, BookOpen, ExternalLink, Loader2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { externalBooksApi, NormalizedBook } from '@/lib/api';

type SourceFilter = 'All' | 'OpenLibrary' | 'Gutendex';

const SOURCE_META: Record<string, { label: string; color: string }> = {
  OpenLibrary: { label: 'Open Library', color: 'bg-blue-100 text-blue-700' },
  Gutendex:    { label: 'Gutendex',      color: 'bg-green-100 text-green-700' },
};

// Unique key per book — matches backend checkExisting logic
const bookKey = (b: NormalizedBook) =>
  b.isbn ?? `${b.source}::${b.title}::${b.authors[0] ?? ''}`;

export default function ImportBooksPage() {
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<NormalizedBook[]>([]);
  const [isSearching, setIsSearching]   = useState(false);
  const [bulkingSource, setBulkingSource] = useState<'gutendex' | 'openlibrary' | null>(null);
  const [filter, setFilter]             = useState<SourceFilter>('All');
  const [imported, setImported]         = useState<Set<string>>(new Set());
  const [importing, setImporting]       = useState<Set<string>>(new Set());

  const markImported = (keys: string[]) => {
    if (keys.length === 0) return;
    setImported((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setResults([]);
    setFilter('All');
    try {
      const data = await externalBooksApi.search(query.trim());
      setResults(data);

      if (data.length === 0) {
        toast('No results found. Try a different query.');
        return;
      }

      // Check which results are already in the database
      const existingKeys = await externalBooksApi.checkExisting(data).catch(() => [] as string[]);
      markImported(existingKeys);
    } catch {
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async (book: NormalizedBook) => {
    const key = bookKey(book);
    setImporting((prev) => new Set(prev).add(key));
    try {
      await externalBooksApi.importBook(book);
      markImported([key]);
      toast.success(`"${book.title}" added to the catalog.`);
    } catch (err: any) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || 'Import failed.';
      if (status === 409) {
        // Already in DB — just mark it
        markImported([key]);
        toast(`"${book.title}" is already in the catalog.`);
      } else {
        toast.error(msg);
      }
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleBulkImport = async (source: 'gutendex' | 'openlibrary') => {
    setBulkingSource(source);
    try {
      const result =
        source === 'gutendex'
          ? await externalBooksApi.bulkImportGutendex()
          : await externalBooksApi.bulkImportOpenLibrary();
      toast.success(
        `Bulk import complete — ${result.imported} added, ${result.skipped} already existed.`,
        { duration: 6000 },
      );
    } catch {
      toast.error('Bulk import failed. Please try again.');
    } finally {
      setBulkingSource(null);
    }
  };

  const visible =
    filter === 'All' ? results : results.filter((b) => b.source === filter);

  const openLibraryCount = results.filter((b) => b.source === 'OpenLibrary').length;
  const gutendexCount    = results.filter((b) => b.source === 'Gutendex').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary-500" />
          Import E-Books
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Search Open Library and Gutendex for free e-books and import them into the catalog.
          Books already in the catalog are marked automatically.
        </p>
      </div>

      {/* Search bar + bulk buttons */}
      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, or subject…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary-400 focus:border-transparent"
              disabled={isSearching}
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {isSearching
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Search className="w-4 h-4" />}
            Search
          </button>
        </form>

        {/* Bulk import buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleBulkImport('openlibrary')}
            disabled={bulkingSource !== null}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {bulkingSource === 'openlibrary'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            Bulk Import Open Library
          </button>
          <button
            onClick={() => handleBulkImport('gutendex')}
            disabled={bulkingSource !== null}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {bulkingSource === 'gutendex'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />}
            Bulk Import Gutendex
          </button>
        </div>
      </div>

      {/* Source filter tabs */}
      {results.length > 0 && (
        <div className="flex gap-2 mb-5">
          {(
            [
              { key: 'All',         label: `All (${results.length})` },
              { key: 'OpenLibrary', label: `Open Library (${openLibraryCount})` },
              { key: 'Gutendex',    label: `Gutendex (${gutendexCount})` },
            ] as { key: SourceFilter; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {isSearching && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-3 animate-pulse">
              <div className="w-full h-40 bg-gray-200 rounded-lg mb-3" />
              <div className="h-4 bg-gray-200 rounded mb-2 w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Results grid */}
      {!isSearching && visible.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visible.map((book) => {
            const key        = bookKey(book);
            const isImported = imported.has(key);
            const isImporting = importing.has(key);
            const meta       = SOURCE_META[book.source];

            return (
              <div
                key={key}
                className="bg-white border border-gray-100 rounded-xl p-3 flex flex-col shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Cover */}
                <div className="w-full h-40 bg-gray-50 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                  {book.coverImageUrl ? (
                    <img
                      src={book.coverImageUrl}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <BookOpen className="w-10 h-10 text-gray-300" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-1">
                    {book.title}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-1 mb-1">
                    {book.authors.length > 0 ? book.authors.join(', ') : 'Unknown author'}
                  </p>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.color}`}>
                      {meta.label}
                    </span>
                    {book.publicationYear && (
                      <span className="text-[10px] text-gray-400">{book.publicationYear}</span>
                    )}
                  </div>
                  {book.ebookUrl && (
                    <a
                      href={book.ebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary-600 hover:underline flex items-center gap-0.5 mb-2"
                    >
                      <ExternalLink className="w-3 h-3" /> Preview
                    </a>
                  )}
                </div>

                {/* Import button */}
                <button
                  onClick={() => handleImport(book)}
                  disabled={isImported || isImporting}
                  className={`w-full mt-1 py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    isImported
                      ? 'bg-green-50 text-green-600 cursor-default border border-green-200'
                      : 'bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-60'
                  }`}
                >
                  {isImporting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Importing…</>
                  ) : isImported ? (
                    <>✓ In Catalog</>
                  ) : (
                    <><Download className="w-3 h-3" /> Import</>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isSearching && results.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Search for books above to get started.</p>
          <p className="text-xs mt-1">
            Or use the bulk import buttons to add 100 books from Open Library or Gutendex at once.
          </p>
        </div>
      )}
    </div>
  );
}
