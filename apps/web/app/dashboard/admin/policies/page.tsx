'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { borrowPoliciesApi } from '@/lib/api';
import { BorrowPolicy, ROLE_LABELS, ROLE_COLORS } from '@/types';

interface PolicyForm {
  maxActiveBorrows: number;
  maxBorrowDays: number;
  maxExtensions: number;
  extensionDays: number;
}

export default function ManagePoliciesPage() {
  const [policies, setPolicies] = useState<BorrowPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<BorrowPolicy | null>(null);
  const [form, setForm] = useState<PolicyForm>({
    maxActiveBorrows: 5,
    maxBorrowDays: 14,
    maxExtensions: 2,
    extensionDays: 7,
  });
  const [saving, setSaving] = useState(false);

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const data = await borrowPoliciesApi.getAll();
      setPolicies(data);
    } catch {
      toast.error('Failed to load policies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const openEdit = (policy: BorrowPolicy) => {
    setEditingPolicy(policy);
    setForm({
      maxActiveBorrows: policy.maxActiveBorrows,
      maxBorrowDays: policy.maxBorrowDays,
      maxExtensions: policy.maxExtensions,
      extensionDays: policy.extensionDays,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;

    setSaving(true);
    try {
      await borrowPoliciesApi.update(editingPolicy.role, form);
      toast.success(`${ROLE_LABELS[editingPolicy.role]} policy updated`);
      setEditingPolicy(null);
      fetchPolicies();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to update policy';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Borrow Policies
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Configure borrowing limits per user role
        </p>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : policies.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">No policies configured yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ROLE_COLORS[policy.role]}`}
                >
                  {ROLE_LABELS[policy.role]}
                </span>
                <button
                  onClick={() => openEdit(policy)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/30"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">
                    Max active borrows
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {policy.maxActiveBorrows}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">
                    Max borrow days
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {policy.maxBorrowDays}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">
                    Max extensions
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {policy.maxExtensions}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">
                    Extension days
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {policy.extensionDays}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit {ROLE_LABELS[editingPolicy.role]} Policy
              </h2>
              <button
                onClick={() => setEditingPolicy(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Active Borrows
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxActiveBorrows}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxActiveBorrows: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Borrow Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.maxBorrowDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxBorrowDays: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Extensions
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.maxExtensions}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxExtensions: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Extension Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={form.extensionDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      extensionDays: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPolicy(null)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
