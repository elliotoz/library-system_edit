'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  ExternalLink,
  BookOpen,
  GraduationCap,
  FileVideo,
  File,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Material {
  id: string;
  title: string;
  type: string;
  description: string | null;
  authorName: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  keywords: string[];
  facultyCode: string | null;
  courseCode: string | null;
  year: number | null;
  accessLevel: string;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
    role: string;
  };
}

const materialTypeLabels: Record<string, string> = {
  PROFESSOR_PUBLICATION: 'Professor Publication',
  RESEARCH_PAPER: 'Research Paper',
  COURSE_MATERIAL: 'Course Material',
  THESIS: 'Thesis',
};

const materialTypeIcons: Record<string, React.ReactNode> = {
  PROFESSOR_PUBLICATION: <BookOpen className="h-5 w-5" />,
  RESEARCH_PAPER: <FileText className="h-5 w-5" />,
  COURSE_MATERIAL: <GraduationCap className="h-5 w-5" />,
  THESIS: <File className="h-5 w-5" />,
};

const materialTypeColors: Record<string, string> = {
  PROFESSOR_PUBLICATION:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  RESEARCH_PAPER:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COURSE_MATERIAL:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  THESIS:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [types, setTypes] = useState<string[]>([]);

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '12',
      });
      if (search) params.append('search', search);
      if (typeFilter) params.append('type', typeFilter);

      const response = await fetch(`/api/materials?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMaterials(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTypes = async () => {
    try {
      const response = await fetch('/api/materials/types', {
        credentials: 'include',
      });
      if (response.ok) {
        setTypes(await response.json());
      }
    } catch (error) {
      console.error('Error fetching types:', error);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [page, typeFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchMaterials, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Academic Materials
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Browse research papers, course materials, and publications
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search materials..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="">All Types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {materialTypeLabels[type] || type}
            </option>
          ))}
        </select>
      </div>

      {/* Materials Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No materials found
          </h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => (
            <div
              key={material.id}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
            >
              {/* Type Badge */}
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                    materialTypeColors[material.type] ||
                      'bg-gray-100 text-gray-700'
                  )}
                >
                  {materialTypeIcons[material.type]}
                  {materialTypeLabels[material.type] || material.type}
                </span>
                {material.year && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {material.year}
                  </span>
                )}
              </div>

              {/* Title & Author */}
              <h3 className="mb-1 line-clamp-2 font-semibold text-gray-900 dark:text-white">
                {material.title}
              </h3>
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                by {material.authorName}
              </p>

              {/* Description */}
              {material.description && (
                <p className="mb-3 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                  {material.description}
                </p>
              )}

              {/* Keywords */}
              {material.keywords && material.keywords.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {material.keywords.slice(0, 3).map((keyword, i) => (
                    <span
                      key={i}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    >
                      {keyword}
                    </span>
                  ))}
                  {material.keywords.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{material.keywords.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Meta Info */}
              <div className="mb-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                {material.facultyCode && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {material.facultyCode}
                  </span>
                )}
                {material.fileSize && (
                  <span>{formatFileSize(material.fileSize)}</span>
                )}
              </div>

              {/* Actions */}
              {material.fileUrl && (
                <a
                  href={material.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                >
                  {material.fileUrl.includes('.pdf') ? (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      View PDF
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download
                    </>
                  )}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-200 p-2 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
