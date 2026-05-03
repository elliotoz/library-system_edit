'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Plus,
  Check,
  X,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Brain,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Material {
  id: string;
  title: string;
  type: string;
  authorName: string;
  facultyCode: string | null;
  isPublished: boolean;
  isApproved: boolean;
  indexStatus: 'PENDING' | 'PROCESSING' | 'INDEXED' | 'FAILED' | 'NOT_APPLICABLE';
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  byType: { type: string; count: number }[];
}

const materialTypeLabels: Record<string, string> = {
  PROFESSOR_PUBLICATION: 'Publication',
  RESEARCH_PAPER: 'Research',
  COURSE_MATERIAL: 'Course',
  THESIS: 'Thesis',
};

const indexStatusConfig: Record<
  string,
  { label: string; className: string; title: string }
> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    title: 'Waiting to be indexed by AI',
  },
  PROCESSING: {
    label: 'Processing',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    title: 'Currently indexing...',
  },
  INDEXED: {
    label: 'Indexed',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    title: 'Available for AI search',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    title: 'Indexing failed, click Re-index to retry',
  },
  NOT_APPLICABLE: {
    label: 'N/A',
    className:
      'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    title: 'No file to index',
  },
};

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'approved'
  >('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [batchReindexing, setBatchReindexing] = useState(false);

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
        status: statusFilter,
      });
      if (search) params.append('search', search);

      const url = `/api/materials/admin?${params}`;

      const response = await fetch(url, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMaterials(data.data || []);
        setTotalPages(data.meta?.totalPages || 1);
      } else {
        const errorText = await response.text();
        console.error('Response not OK:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/materials/admin/stats', {
        credentials: 'include',
      });
      if (response.ok) {
        setStats(await response.json());
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [page, statusFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchMaterials, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      const response = await fetch(`/api/materials/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });

      if (response.ok) {
        toast.success(approved ? 'Material approved' : 'Material rejected');
        fetchMaterials();
        fetchStats();
      } else {
        toast.error('Failed to update material');
      }
    } catch (error) {
      toast.error('Failed to update material');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return;

    try {
      const response = await fetch(`/api/materials/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Material deleted');
        fetchMaterials();
        fetchStats();
      } else {
        toast.error('Failed to delete material');
      }
    } catch (error) {
      toast.error('Failed to delete material');
    }
  };

  const handleReindex = async (id: string) => {
    setReindexingId(id);
    try {
      const response = await fetch(`/api/materials/${id}/reindex`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Reindexing started');
        fetchMaterials();
        fetchStats();
      } else {
        toast.error('Failed to start reindexing');
      }
    } catch (error) {
      toast.error('Failed to start reindexing');
    } finally {
      setReindexingId(null);
    }
  };

  const handleBatchReindex = async () => {
    setBatchReindexing(true);
    try {
      const response = await fetch('/api/materials/admin/reindex-pending', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Batch reindexing started');
        fetchMaterials();
        fetchStats();
      } else {
        toast.error('Failed to start batch reindexing');
      }
    } catch (error) {
      toast.error('Failed to start batch reindexing');
    } finally {
      setBatchReindexing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manage Materials
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Review, approve, and manage uploaded materials
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBatchReindex}
            disabled={batchReindexing}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Brain className="h-4 w-4" />
            {batchReindexing ? 'Reindexing...' : 'Re-index All'}
          </button>
          <Link
            href="/dashboard/admin/upload"
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            Upload Material
          </Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Pending
            </p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {stats.pending}
            </p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
            <p className="text-sm text-green-600 dark:text-green-400">
              Approved
            </p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">
              {stats.approved}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Types</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.byType.length}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row">
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
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'pending', 'approved'] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
                statusFilter === status
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : materials.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400">
              No materials found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Material
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Submitted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Status
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
                {materials.map((material) => (
                  <tr
                    key={material.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {material.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {material.authorName}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {materialTypeLabels[material.type] || material.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {material.uploadedBy.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {material.uploadedBy.role}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {material.isApproved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                          indexStatusConfig[material.indexStatus]?.className ||
                            'bg-gray-100'
                        )}
                        title={indexStatusConfig[material.indexStatus]?.title}
                      >
                        {material.indexStatus === 'PROCESSING' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : material.indexStatus === 'INDEXED' ? (
                          <CheckCircle className="h-3.5 w-3.5" />
                        ) : material.indexStatus === 'FAILED' ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : material.indexStatus === 'PENDING' ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        {indexStatusConfig[material.indexStatus]?.label ||
                          material.indexStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {!material.isApproved && (
                          <>
                            <button
                              onClick={() => handleApprove(material.id, true)}
                              className="rounded-lg p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleApprove(material.id, false)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {(material.indexStatus === 'PENDING' ||
                          material.indexStatus === 'FAILED') && (
                          <button
                            onClick={() => handleReindex(material.id)}
                            disabled={reindexingId === material.id}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-900/20"
                            title="Re-index for AI search"
                          >
                            <RefreshCw
                              className={cn(
                                'h-4 w-4',
                                reindexingId === material.id && 'animate-spin'
                              )}
                            />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(material.id)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          title="Delete"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3 dark:border-gray-700">
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
    </div>
  );
}
