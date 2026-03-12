'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { branchesApi } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  openingHours: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  _count?: { bookCopies: number; reservations: number };
}

interface BranchForm {
  name: string;
  code: string;
  address: string;
  openingHours: string;
  contactEmail: string;
  contactPhone: string;
}

const emptyForm: BranchForm = {
  name: '',
  code: '',
  address: '',
  openingHours: '',
  contactEmail: '',
  contactPhone: '',
};

export default function ManageBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const data = await branchesApi.getAll();
      setBranches(data);
    } catch {
      toast.error('Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openCreate = () => {
    setEditingBranch(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      openingHours: branch.openingHours || '',
      contactEmail: branch.contactEmail || '',
      contactPhone: branch.contactPhone || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.address.trim()) {
      toast.error('Name, code, and address are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim(),
        openingHours: form.openingHours.trim() || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        contactPhone: form.contactPhone.trim() || undefined,
      };

      if (editingBranch) {
        await branchesApi.update(editingBranch.id, payload);
        toast.success('Branch updated');
      } else {
        await branchesApi.create(payload);
        toast.success('Branch created');
      }
      setShowModal(false);
      fetchBranches();
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || 'Failed to save branch';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (branch: Branch) => {
    try {
      if (branch.isActive) {
        await branchesApi.deactivate(branch.id);
        toast.success(`${branch.name} deactivated`);
      } else {
        await branchesApi.activate(branch.id);
        toast.success(`${branch.name} activated`);
      }
      fetchBranches();
    } catch {
      toast.error('Failed to update branch status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manage Branches
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Add, edit, and manage library branches
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600"
        >
          <Plus className="h-4 w-4" />
          Add Branch
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        ) : branches.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <p className="text-gray-500">No branches yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Copies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {branches.map((branch) => (
                  <tr
                    key={branch.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {branch.name}
                      </p>
                      {branch.contactEmail && (
                        <p className="text-sm text-gray-500">
                          {branch.contactEmail}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-500">
                      {branch.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {branch.address}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {branch._count?.bookCopies ?? '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          branch.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        )}
                      >
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(branch)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-900/30"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(branch)}
                          className={cn(
                            'rounded-lg p-2',
                            branch.isActive
                              ? 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30'
                              : 'text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30'
                          )}
                          title={
                            branch.isActive ? 'Deactivate' : 'Activate'
                          }
                        >
                          {branch.isActive ? (
                            <XCircle className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingBranch ? 'Edit Branch' : 'Add Branch'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Code *
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value })
                  }
                  placeholder="e.g. MAIN, SOUTH"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Address *
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Opening Hours
                </label>
                <input
                  type="text"
                  value={form.openingHours}
                  onChange={(e) =>
                    setForm({ ...form, openingHours: e.target.value })
                  }
                  placeholder="e.g. Mon-Fri 8:00-20:00"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:ring-2 focus:ring-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : editingBranch
                      ? 'Update'
                      : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
