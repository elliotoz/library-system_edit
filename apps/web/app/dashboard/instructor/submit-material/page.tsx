'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  Loader2,
  Send,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import { extractApiError } from '@/lib/api-error';

const materialTypes = [
  { value: 'PROFESSOR_PUBLICATION', label: 'Professor Publication' },
  { value: 'RESEARCH_PAPER', label: 'Research Paper' },
  { value: 'COURSE_MATERIAL', label: 'Course Material' },
  { value: 'THESIS', label: 'Thesis' },
];

export default function SubmitMaterialPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    type: 'RESEARCH_PAPER',
    description: '',
    authorName: user?.name || '',
    keywords: '',
    facultyCode: '',
    courseCode: '',
    year: new Date().getFullYear().toString(),
  });

  const [fileInfo, setFileInfo] = useState<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
  } | null>(null);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch('/api/materials/upload', {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });

      if (response.ok) {
        const data = await response.json();
        setFileInfo({
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileSize: data.fileSize,
        });
        toast.success('File uploaded successfully');
      } else {
        toast.error('Failed to upload file');
      }
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.authorName.trim()) {
      toast.error('Author name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        type: formData.type,
        description: formData.description.trim() || undefined,
        authorName: formData.authorName.trim(),
        keywords: formData.keywords
          ? formData.keywords
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean)
          : [],
        facultyCode: formData.facultyCode.trim() || undefined,
        courseCode: formData.courseCode.trim() || undefined,
        year: formData.year ? parseInt(formData.year) : undefined,
        accessLevel: 'PUBLIC',
        // NOT published - requires admin approval
        isPublished: false,
        ...(fileInfo && {
          fileUrl: fileInfo.fileUrl,
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize,
        }),
      };

      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(
          <div>
            <p className="font-medium">Submission received!</p>
            <p className="text-sm">Your material is pending admin approval.</p>
          </div>,
          { duration: 5000 }
        );
        router.push('/dashboard/instructor/my-submissions');
      } else {
        toast.error(await extractApiError(response, 'Failed to submit material'));
      }
    } catch (error) {
      toast.error('Failed to submit material');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/instructor"
          className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Share Your Research
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Submit your research papers, publications, or course materials
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div>
          <p className="font-medium text-blue-800 dark:text-blue-300">
            Submission Review Process
          </p>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Your submission will be reviewed by the library administration.
            You'll receive a notification once it's approved or if any changes
            are needed.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Upload File
          </h2>

          {!fileInfo ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
                isUploading
                  ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                  : 'border-gray-300 hover:border-primary-400 dark:border-gray-600 dark:hover:border-primary-500'
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary-500" />
                  <p className="text-primary-600 dark:text-primary-400">
                    Uploading...
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-3 h-10 w-10 text-gray-400" />
                  <p className="mb-1 text-gray-700 dark:text-gray-300">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    PDF, DOC, DOCX, PPT, PPTX (max 50MB)
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {fileInfo.fileName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(fileInfo.fileSize)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Material Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            Material Details
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
                placeholder="Enter material title"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {materialTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Author Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="authorName"
                value={formData.authorName}
                onChange={handleInputChange}
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="Your name"
              />
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
                placeholder="Brief description of your research or material"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Keywords
              </label>
              <input
                type="text"
                name="keywords"
                value={formData.keywords}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="machine learning, AI, neural networks"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Separate keywords with commas
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Faculty Code
              </label>
              <input
                type="text"
                name="facultyCode"
                value={formData.facultyCode}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="e.g., ENG, MED, LAW"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Course Code
              </label>
              <input
                type="text"
                name="courseCode"
                value={formData.courseCode}
                onChange={handleInputChange}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                placeholder="e.g., CS101, ENG201"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Year
              </label>
              <input
                type="number"
                name="year"
                value={formData.year}
                onChange={handleInputChange}
                min="1900"
                max={new Date().getFullYear()}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href="/dashboard/instructor"
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
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit for Review
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
