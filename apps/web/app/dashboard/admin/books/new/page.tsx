'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Plus, Trash2, Save, Loader2, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { aiApi } from '@/lib/api';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
}

interface Faculty {
  id: string;
  name: string;
  code: string;
  bookCount: number;
}

interface BranchCopy {
  branchId: string;
  numberOfCopies: number;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1024;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl.split(',')[1]); // strip "data:image/jpeg;base64,"
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AddBookPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    authors: '',
    isbn: '',
    description: '',
    publisher: '',
    publicationYear: '',
    edition: '',
    pageCount: '',
    language: 'English',
    category: '',
    coverImageUrl: '',
    mainFacultyId: '',
    subjectTags: '',
    isEbookAvailable: false,
    ebookUrl: '',
  });

  const [branchCopies, setBranchCopies] = useState<BranchCopy[]>([
    { branchId: '', numberOfCopies: 0 },
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [branchesRes, facultiesRes, categoriesRes] = await Promise.all([
          fetch('/api/books/branches', { credentials: 'include' }),
          fetch('/api/books/faculties', { credentials: 'include' }),
          fetch('/api/books/categories', { credentials: 'include' }),
        ]);

        if (branchesRes.ok) {
          const data = await branchesRes.json();
          setBranches(data);
          // Auto-select first branch
          if (data.length > 0) {
            setBranchCopies([{ branchId: data[0].id, numberOfCopies: 0 }]);
          }
        }
        if (facultiesRes.ok) setFaculties(await facultiesRes.json());
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleAddBranch = () => {
    const unusedBranch = branches.find(
      (b) => !branchCopies.some((bc) => bc.branchId === b.id)
    );
    if (unusedBranch) {
      setBranchCopies([
        ...branchCopies,
        { branchId: unusedBranch.id, numberOfCopies: 0 },
      ]);
    } else {
      toast.error('All branches have been added');
    }
  };

  const handleRemoveBranch = (index: number) => {
    if (branchCopies.length > 1) {
      setBranchCopies(branchCopies.filter((_, i) => i !== index));
    }
  };

  const handleBranchCopyChange = (
    index: number,
    field: 'branchId' | 'numberOfCopies',
    value: string | number
  ) => {
    const updated = [...branchCopies];
    updated[index] = { ...updated[index], [field]: value };
    setBranchCopies(updated);
  };

  const handleScanCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const base64 = await compressImage(file);
      const result = await aiApi.scanCover(base64);
      const filled: string[] = [];
      setFormData((prev) => {
        const next = { ...prev };
        if (result.title) { next.title = result.title; filled.push('title'); }
        if (result.authors) { next.authors = result.authors; filled.push('authors'); }
        if (result.isbn) { next.isbn = result.isbn; filled.push('ISBN'); }
        if (result.publisher) { next.publisher = result.publisher; filled.push('publisher'); }
        if (result.publicationYear) { next.publicationYear = String(result.publicationYear); filled.push('year'); }
        return next;
      });
      if (filled.length > 0) {
        toast.success(`Cover scanned — filled: ${filled.join(', ')}. Please review before saving.`);
      } else {
        toast('Cover scanned but no data could be extracted. Please fill in manually.', { icon: '⚠️' });
      }
    } catch {
      toast.error('Cover scan failed. Please fill in manually.');
    } finally {
      setIsScanning(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.authors.trim()) {
      toast.error('At least one author is required');
      return;
    }
    const totalCopies = branchCopies.reduce(
      (sum, bc) => sum + (bc.numberOfCopies || 0),
      0
    );
    if (totalCopies === 0 && !formData.isEbookAvailable) {
      toast.error('Please add at least one physical copy or enable e-book');
      return;
    }
    if (
      totalCopies > 0 &&
      branchCopies.some((bc) => bc.numberOfCopies > 0 && !bc.branchId)
    ) {
      toast.error('Please select a branch for all copies');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        authors: formData.authors
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        isbn: formData.isbn.trim() || undefined,
        description: formData.description.trim() || undefined,
        publisher: formData.publisher.trim() || undefined,
        publicationYear: formData.publicationYear
          ? parseInt(formData.publicationYear)
          : undefined,
        edition: formData.edition.trim() || undefined,
        pageCount: formData.pageCount
          ? parseInt(formData.pageCount)
          : undefined,
        language: formData.language || 'English',
        category: formData.category || undefined,
        coverImageUrl: formData.coverImageUrl.trim() || undefined,
        mainFacultyId: formData.mainFacultyId || undefined,
        subjectTags: formData.subjectTags
          ? formData.subjectTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        isEbookAvailable: formData.isEbookAvailable,
        ebookUrl: formData.ebookUrl.trim() || undefined,
        branches: branchCopies
          .filter((bc) => bc.numberOfCopies > 0 && bc.branchId)
          .map((bc) => ({
            branchId: bc.branchId,
            numberOfCopies: bc.numberOfCopies,
          })),
      };

      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const book = await response.json();
        toast.success('Book added successfully!');
        router.push('/dashboard/admin/books');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to add book');
      }
    } catch (error) {
      toast.error('Failed to add book');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCopies = branchCopies.reduce(
    (sum, bc) => sum + (bc.numberOfCopies || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin/books"
          className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add New Book
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Add a new book to the library catalog
          </p>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleScanCover}
        />
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          disabled={isScanning}
          className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40"
        >
          {isScanning ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Scanning...</>
          ) : (
            <><ScanLine className="h-4 w-4" />Scan Cover</>
          )}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Basic Information
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Enter book title"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Authors <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="authors"
                value={formData.authors}
                onChange={handleInputChange}
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Author names (comma-separated)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Separate multiple authors with commas
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                ISBN
              </label>
              <input
                type="text"
                name="isbn"
                value={formData.isbn}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="978-0-123456-78-9"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="Reference">Reference</option>
                <option value="Textbook">Textbook</option>
                <option value="Fiction">Fiction</option>
                <option value="Non-Fiction">Non-Fiction</option>
                <option value="Research">Research</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Brief description of the book"
              />
            </div>
          </div>
        </div>

        {/* Publication Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Publication Details
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Publisher
              </label>
              <input
                type="text"
                name="publisher"
                value={formData.publisher}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Publisher name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Publication Year
              </label>
              <input
                type="number"
                name="publicationYear"
                value={formData.publicationYear}
                onChange={handleInputChange}
                min="-500"
                max={new Date().getFullYear()}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="2024"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Edition
              </label>
              <input
                type="text"
                name="edition"
                value={formData.edition}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="1st Edition"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Page Count
              </label>
              <input
                type="number"
                name="pageCount"
                value={formData.pageCount}
                onChange={handleInputChange}
                min="1"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="350"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Language
              </label>
              <select
                name="language"
                value={formData.language}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="English">English</option>
                <option value="Turkish">Turkish</option>
                <option value="German">German</option>
                <option value="French">French</option>
                <option value="Spanish">Spanish</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Faculty
              </label>
              <select
                name="mainFacultyId"
                value={formData.mainFacultyId}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Select faculty</option>
                {faculties.map((faculty) => (
                  <option key={faculty.id} value={faculty.id}>
                    {faculty.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cover & Tags */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Cover & Tags
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Cover Image URL
              </label>
              <input
                type="url"
                name="coverImageUrl"
                value={formData.coverImageUrl}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="https://example.com/cover.jpg"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subject Tags
              </label>
              <input
                type="text"
                name="subjectTags"
                value={formData.subjectTags}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="programming, algorithms, data structures"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Separate tags with commas
              </p>
            </div>

            <div className="flex items-center gap-4 md:col-span-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  name="isEbookAvailable"
                  checked={formData.isEbookAvailable}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  E-book available
                </span>
              </label>
            </div>

            {formData.isEbookAvailable && (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  E-book URL
                </label>
                <input
                  type="url"
                  name="ebookUrl"
                  value={formData.ebookUrl}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="https://example.com/ebook.pdf"
                />
              </div>
            )}
          </div>
        </div>

        {/* Library Copies */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Library Copies
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add copies to one or more branches
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {totalCopies}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total copies
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {branchCopies.map((bc, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
              >
                <div className="min-w-[200px] flex-1">
                  <select
                    value={bc.branchId}
                    onChange={(e) =>
                      handleBranchCopyChange(index, 'branchId', e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Select branch</option>
                    {branches.map((branch) => (
                      <option
                        key={branch.id}
                        value={branch.id}
                        disabled={branchCopies.some(
                          (b, i) => i !== index && b.branchId === branch.id
                        )}
                      >
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500 dark:text-gray-400">
                    Copies:
                  </label>
                  <input
                    type="number"
                    value={bc.numberOfCopies}
                    onChange={(e) =>
                      handleBranchCopyChange(
                        index,
                        'numberOfCopies',
                        parseInt(e.target.value) || 0
                      )
                    }
                    min="0"
                    max="50"
                    className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                {branchCopies.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBranch(index)}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {branchCopies.length < branches.length && (
            <button
              type="button"
              onClick={handleAddBranch}
              className="mt-3 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              <Plus className="h-4 w-4" />
              Add another branch
            </button>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/dashboard/admin/books"
            className="rounded-lg border border-gray-200 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Add Book
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
