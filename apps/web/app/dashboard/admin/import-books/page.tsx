'use client';

import { useState } from 'react';
import { Search, Download, BookOpen, ExternalLink, Loader2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { externalBooksApi, NormalizedBook } from '@/lib/api';

type SourceFilter = 'All' | 'OpenLibrary' | 'Gutendex';

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  OpenLibrary: { label: 'Open Library', color: 'bg-blue-100 text-blue-700' },
  Gutendex:    { label: 'Gutendex',      color: 'bg-green-100 text-green-700' },
};

export default function ImportBooksPage() {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<NormalizedBook[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isBulking, setIsBulking]   = useState(false);
  const [filter, setFilter]         = useState<SourceFilter>('All');
  const [imported, setImported]     = useState<Set<string>>(new Set());
  const [importing, setImporting]   = useState<Set<string>>(new Set());

  const bookKey = (b: NormalizedBook) =>
    b.isbn ?? `${b.source}::${b.title}::${b.authors[0] ?? ''}`;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setResults([]);
    try {
      const data = await externalBooksApi.search(query.trim());
      setResults(data);
      if (data.length === 0) toast('No results found. Try a different query.');
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
      setImported((prev) => new Set(prev).add(key));
      toast.success(`"${book.title}" added to the catalog.`);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Import failed.';
      toast.error(msg);
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleBulkImport = async () => {
    setIsBulking(true);
    try {
      const result = await externalBooksApi.bulkImportGutendex();
      toast.success(`Bulk import complete: ${result.imported} added, ${result.skipped} skipped.`, { duration: 6000 });
    } catch {
      toast.error('Bulk import failed. Please try again.');
    } finally {
      setIsBulking(false);
    }
  };

  const visible = filter === 'All'
    ? results
    : results.filter((b) => b.source === filter);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary-500" />
          Import E-Books
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Search Open Library and Gutendex for free e-books and import them directly into the catalog.
        </p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
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
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Search
        </button>
        <button
          type="button"
          onClick={handleBulkImport}
          disabled={isBulking}
          className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {isBulking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Bulk Import Gutendex
        </button>
      </form>

      {/* Source filter */}
      {results.length > 0 && (
        <div className="flex gap-2 mb-5">
          {(['All', 'OpenLibrary', 'Gutendex'] as SourceFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === s
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'All' ? `All (${results.length})` : SOURCE_LABELS[s].label}
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
            const key = bookKey(book);
            const isImported = imported.has(key);
            const isImporting = importing.has(key);
            const src = SOURCE_LABELS[book.source];

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
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${src.color}`}>
                      {src.label}
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
                      ? 'bg-green-50 text-green-600 cursor-default'
                      : 'bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-60'
                  }`}
                >
                  {isImporting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Importing…</>
                  ) : isImported ? (
                    <>✓ Imported</>
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
          <p className="text-xs mt-1">Results are pulled live from Open Library and Gutendex.</p>
        </div>
      )}
    </div>
  );
}
