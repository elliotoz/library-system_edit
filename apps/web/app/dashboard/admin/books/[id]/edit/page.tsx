'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Save,
  Loader2,
  Package,
  FileText,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { extractApiError } from '@/lib/api-error';

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

interface BookDetail {
  id: string;
  title: string;
  authors: string[];
  isbn: string | null;
  description: string | null;
  publisher: string | null;
  publicationYear: number | null;
  edition: string | null;
  pageCount: number | null;
  language: string;
  category: string | null;
  subjectTags: string[];
  coverImageUrl: string | null;
  isEbookAvailable: boolean;
  ebookUrl: string | null;
  pdfUrl: string | null;
  mainFacultyId: string | null;
  totalCopies: number;
  availableCopies: number;
  availability: {
    branch: { id: string; name: string; code: string };
    total: number;
    available: number;
    copies: {
      id: string;
      brandId: string;
      status: string;
      condition: string;
    }[];
  }[];
}

export default function EditBookPage() {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [book, setBook] = useState<BookDetail | null>(null);

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

  // Add copies state
  const [addCopiesBranch, setAddCopiesBranch] = useState('');
  const [addCopiesCount, setAddCopiesCount] = useState(1);
  const [isAddingCopies, setIsAddingCopies] = useState(false);

  // PDF upload state
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [bookRes, branchesRes, facultiesRes, categoriesRes] =
          await Promise.all([
            fetch(`/api/books/${params.id}`, { credentials: 'include' }),
            fetch('/api/books/branches', { credentials: 'include' }),
            fetch('/api/books/faculties', { credentials: 'include' }),
            fetch('/api/books/categories', { credentials: 'include' }),
          ]);

        if (bookRes.ok) {
          const bookData = await bookRes.json();
          setBook(bookData);
          setCurrentPdfUrl(bookData.pdfUrl ?? null);
          setFormData({
            title: bookData.title || '',
            authors: bookData.authors?.join(', ') || '',
            isbn: bookData.isbn || '',
            description: bookData.description || '',
            publisher: bookData.publisher || '',
            publicationYear: bookData.publicationYear?.toString() || '',
            edition: bookData.edition || '',
            pageCount: bookData.pageCount?.toString() || '',
            language: bookData.language || 'English',
            category: bookData.category || '',
            coverImageUrl: bookData.coverImageUrl || '',
            mainFacultyId: bookData.mainFaculty?.id || '',
            subjectTags: bookData.subjectTags?.join(', ') || '',
            isEbookAvailable: bookData.isEbookAvailable || false,
            ebookUrl: bookData.ebookUrl || '',
          });
        } else {
          toast.error('Book not found');
          router.push('/dashboard/admin/books');
        }

        if (branchesRes.ok) setBranches(await branchesRes.json());
        if (facultiesRes.ok) setFaculties(await facultiesRes.json());
        if (categoriesRes.ok) setCategories(await categoriesRes.json());
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load book');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) fetchData();
  }, [params.id, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.authors.trim()) {
      toast.error('At least one author is required');
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
        isbn: formData.isbn.trim() || null,
        description: formData.description.trim() || null,
        publisher: formData.publisher.trim() || null,
        publicationYear: formData.publicationYear
          ? parseInt(formData.publicationYear)
          : null,
        edition: formData.edition.trim() || null,
        pageCount: formData.pageCount ? parseInt(formData.pageCount) : null,
        language: formData.language || 'English',
        category: formData.category || null,
        coverImageUrl: formData.coverImageUrl.trim() || null,
        mainFacultyId: formData.mainFacultyId || null,
        subjectTags: formData.subjectTags
          ? formData.subjectTags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        isEbookAvailable: formData.isEbookAvailable,
        ebookUrl: formData.ebookUrl.trim() || null,
      };

      const response = await fetch(`/api/books/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Book updated successfully!');
        router.push('/dashboard/admin/books');
      } else {
        toast.error(await extractApiError(response, 'Failed to update book'));
      }
    } catch (error) {
      toast.error('Failed to update book');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }
    setIsUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`/api/books/${params.id}/pdf`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentPdfUrl(data.pdfUrl);
        toast.success('PDF uploaded successfully');
      } else {
        toast.error(await extractApiError(response, 'Failed to upload PDF'));
      }
    } catch {
      toast.error('Failed to upload PDF');
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleAddCopies = async () => {
    if (!addCopiesBranch || addCopiesCount < 1) {
      toast.error('Please select a branch and enter number of copies');
      return;
    }

    setIsAddingCopies(true);
    try {
      const response = await fetch(`/api/books/${params.id}/copies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          branchId: addCopiesBranch,
          numberOfCopies: addCopiesCount,
        }),
      });

      if (response.ok) {
        const updatedBook = await response.json();
        setBook(updatedBook);
        toast.success(`Added ${addCopiesCount} copies successfully!`);
        setAddCopiesCount(1);
      } else {
        toast.error(await extractApiError(response, 'Failed to add copies'));
      }
    } catch (error) {
      toast.error('Failed to add copies');
    } finally {
      setIsAddingCopies(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="py-12 text-center">
        <BookOpen className="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900">Book not found</h3>
      </div>
    );
  }

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Book
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Update book details and manage copies
          </p>
        </div>
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
                min="-5000"
                max={new Date().getFullYear()}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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

        {/* Cover & E-book */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Cover & E-book
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
                placeholder="Separate tags with commas"
              />
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

        {/* Book PDF */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Book PDF
          </h2>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handlePdfUpload}
          />
          {currentPdfUrl ? (
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">PDF uploaded</p>
                  <a
                    href={currentPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 underline dark:text-green-400"
                  >
                    View PDF
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isUploadingPdf}
                className="flex items-center gap-2 rounded-lg border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/40"
              >
                {isUploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Replace
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
              <FileText className="mb-2 h-10 w-10 text-gray-400" />
              <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">No PDF attached</p>
              <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">Upload a PDF for AI-powered search and RAG (max 50 MB)</p>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isUploadingPdf}
                className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {isUploadingPdf ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Uploading...</>
                ) : (
                  <><Upload className="h-4 w-4" />Upload PDF</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Current Copies */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Library Copies
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Current copies: {book.totalCopies} total, {book.availableCopies}{' '}
                available
              </p>
            </div>
          </div>

          {/* Current availability */}
          {book.availability && book.availability.length > 0 ? (
            <div className="mb-6 space-y-3">
              {book.availability.map((a) => (
                <div
                  key={a.branch.id}
                  className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {a.branch.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {a.available} available / {a.total} total
                      </p>
                    </div>
                    <div
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium',
                        a.available > 0
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {a.available > 0 ? 'Available' : 'All Borrowed'}
                    </div>
                  </div>
                  {a.copies && a.copies.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {a.copies.map((copy) => (
                        <span
                          key={copy.id}
                          className={cn(
                            'rounded px-2 py-0.5 font-mono text-xs',
                            copy.status === 'AVAILABLE'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : copy.status === 'BORROWED'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          )}
                        >
                          {copy.brandId} ({copy.status})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-6 rounded-lg bg-amber-50 p-4 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              No physical copies in the library
            </div>
          )}

          {/* Add more copies */}
          <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
            <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
              Add More Copies
            </h3>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  Branch
                </label>
                <select
                  value={addCopiesBranch}
                  onChange={(e) => setAddCopiesBranch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
                  Copies
                </label>
                <input
                  type="number"
                  value={addCopiesCount}
                  onChange={(e) =>
                    setAddCopiesCount(parseInt(e.target.value) || 1)
                  }
                  min="1"
                  max="50"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-center text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCopies}
                disabled={isAddingCopies || !addCopiesBranch}
                className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
              >
                {isAddingCopies ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Copies
              </button>
            </div>
          </div>
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
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
