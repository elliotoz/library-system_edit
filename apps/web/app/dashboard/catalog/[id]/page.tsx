'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Building,
  FileText,
  Globe,
  BookMarked,
  Sparkles,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bell,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

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
  ebookUrl?: string;
  mainFaculty: { id: string; name: string; code: string } | null;
  totalCopies: number;
  availableCopies: number;
  isAvailable: boolean;
  availability: {
    branch: { id: string; name: string; code: string };
    total: number;
    available: number;
  }[];
}

interface ReservationInfo {
  activeReservations: number;
  reservationLimit: number;
  remainingReservations: number;
  canReserve: boolean;
}

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [book, setBook] = useState<BookDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [reservationInfo, setReservationInfo] =
    useState<ReservationInfo | null>(null);
  const [notifyWhenAvailable, setNotifyWhenAvailable] = useState(false);

  // Fetch book details
  useEffect(() => {
    const fetchBook = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/books/${params.id}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setBook(data);

          // Auto-select first branch with available copies
          if (data.availability?.length > 0) {
            const branchWithCopies = data.availability.find(
              (a: any) => a.available > 0
            );
            setSelectedBranch(
              branchWithCopies?.branch.id || data.availability[0].branch.id
            );
          }
        }
      } catch (error) {
        console.error('Error fetching book:', error);
        toast.error('Failed to load book details');
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) fetchBook();
  }, [params.id]);

  // Fetch user's reservation info
  useEffect(() => {
    const fetchReservationInfo = async () => {
      if (!isAuthenticated) return;

      try {
        const response = await fetch('/api/reservations/my/info', {
          credentials: 'include',
        });
        if (response.ok) {
          setReservationInfo(await response.json());
        }
      } catch (error) {
        console.error('Error fetching reservation info:', error);
      }
    };

    fetchReservationInfo();
  }, [isAuthenticated]);

  const handleReserve = async () => {
    if (!book || !selectedBranch) return;

    if (!isAuthenticated) {
      toast.error('Please log in to reserve books');
      router.push('/login');
      return;
    }

    if (reservationInfo && !reservationInfo.canReserve) {
      toast.error(
        `You've reached your reservation limit (${reservationInfo.reservationLimit})`
      );
      return;
    }

    setIsReserving(true);
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookId: book.id,
          branchId: selectedBranch,
        }),
      });

      if (response.ok) {
        const reservation = await response.json();
        toast.success(
          <div>
            <p className="font-medium">Reservation submitted!</p>
            <p className="text-sm">Awaiting admin approval</p>
            <p className="text-sm">Pickup at: {reservation.branch.name}</p>
          </div>,
          { duration: 5000 }
        );

        // Update reservation info
        if (reservationInfo) {
          setReservationInfo({
            ...reservationInfo,
            activeReservations: reservationInfo.activeReservations + 1,
            remainingReservations: reservationInfo.remainingReservations - 1,
            canReserve: reservationInfo.remainingReservations - 1 > 0,
          });
        }

        // Refresh book to update availability
        const bookResponse = await fetch(`/api/books/${params.id}`, {
          credentials: 'include',
        });
        if (bookResponse.ok) {
          setBook(await bookResponse.json());
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create reservation');
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Failed to create reservation');
    } finally {
      setIsReserving(false);
    }
  };

  const handleNotifyMe = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to set notifications');
      router.push('/login');
      return;
    }

    setNotifyWhenAvailable(true);
    toast.success("We'll notify you when this book becomes available!", {
      duration: 4000,
    });
  };

  const selectedBranchData = book?.availability?.find(
    (a) => a.branch.id === selectedBranch
  );
  const canReserveAtBranch =
    selectedBranchData && selectedBranchData.available > 0;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="aspect-[3/4] rounded-xl bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-4 lg:col-span-2">
            <div className="h-8 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-32 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="py-12 text-center">
        <BookOpen className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
        <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
          Book not found
        </h3>
        <button
          onClick={() => router.back()}
          className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Catalog
      </button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column - Cover & Actions */}
        <div className="space-y-4">
          {/* Book Cover */}
          <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30">
            {book.coverImageUrl ? (
              <img
                src={book.coverImageUrl}
                alt={book.title}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <BookOpen className="h-24 w-24 text-primary-400 dark:text-primary-500" />
            )}
          </div>

          {/* Availability & Reservation Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
              Availability
            </h3>

            {/* Overall availability status */}
            <div className="mb-4 flex items-center gap-2">
              {book.isAvailable ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {book.availableCopies} of {book.totalCopies} copies available
                  </span>
                </>
              ) : book.totalCopies === 0 && book.isEbookAvailable ? (
                <>
                  <div className="h-3 w-3 rounded-full bg-blue-500" />
                  <span className="font-medium text-blue-700 dark:text-blue-400">
                    E-book available online
                  </span>
                </>
              ) : (
                <>
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <span className="font-medium text-red-700 dark:text-red-400">
                    {book.totalCopies > 0
                      ? `All ${book.totalCopies} copies are currently borrowed`
                      : 'Currently unavailable'}
                  </span>
                </>
              )}
            </div>

            {/* Reservation limit info */}
            {reservationInfo && (
              <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Your reservations:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {reservationInfo.activeReservations} /{' '}
                    {reservationInfo.reservationLimit}
                  </span>
                </div>
                {reservationInfo.remainingReservations > 0 ? (
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                    You can make {reservationInfo.remainingReservations} more
                    reservation(s)
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Reservation limit reached
                  </p>
                )}
              </div>
            )}

            {/* Ebook-only hint — show read button inline when no physical copies */}
            {(!book.availability || book.availability.length === 0) && book.isEbookAvailable && book.ebookUrl && (
              <a
                href={book.ebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white py-2.5 text-sm font-medium transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Read E-book Online
              </a>
            )}

            {/* Branch selection & Reserve button */}
            {book.availability && book.availability.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Pickup Location
                </label>
                <select
                  value={selectedBranch || ''}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {book.availability.map((a) => (
                    <option
                      key={a.branch.id}
                      value={a.branch.id}
                      disabled={a.available === 0}
                    >
                      {a.branch.name} ({a.available}/{a.total} available)
                    </option>
                  ))}
                </select>

                {/* Selected branch info */}
                {selectedBranchData && (
                  <div
                    className={cn(
                      'rounded-lg p-3 text-sm',
                      selectedBranchData.available > 0
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    )}
                  >
                    {selectedBranchData.available > 0 ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>
                          {selectedBranchData.available} cop
                          {selectedBranchData.available > 1 ? 'ies' : 'y'}{' '}
                          available at {selectedBranchData.branch.name}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        <span>No copies available at this location</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Reserve Button */}
                {canReserveAtBranch ? (
                  <button
                    onClick={handleReserve}
                    disabled={
                      isReserving || reservationInfo?.canReserve === false
                    }
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-medium transition-colors',
                      isReserving || reservationInfo?.canReserve === false
                        ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    )}
                  >
                    {isReserving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Reserving...
                      </>
                    ) : (
                      <>
                        <BookMarked className="h-4 w-4" />
                        Reserve Book
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-gray-300 py-2.5 font-medium text-gray-500 dark:bg-gray-600 dark:text-gray-400"
                    >
                      <XCircle className="h-4 w-4" />
                      Unavailable
                    </button>

                    {/* Notify when available */}
                    {!notifyWhenAvailable ? (
                      <button
                        onClick={handleNotifyMe}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-500 py-2.5 font-medium text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                      >
                        <Bell className="h-4 w-4" />
                        Notify Me When Available
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        You'll be notified when available
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* No physical copies warning — only show for non-ebook-only books */}
            {(!book.availability || book.availability.length === 0) && !book.isEbookAvailable && (
              <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">No physical copies in the system</span>
                </div>
              </div>
            )}
          </div>

          {/* E-book Button */}
          {book.isEbookAvailable && book.ebookUrl && (
            <a
              href={book.ebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-3 font-medium text-white transition-all hover:from-blue-600 hover:to-blue-700"
            >
              <BookOpen className="h-5 w-5" />
              Read E-book Online
            </a>
          )}

          {/* E-book Available Badge (no URL) */}
          {book.isEbookAvailable && !book.ebookUrl && (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
              <BookOpen className="h-5 w-5" />
              E-book Available (Ask Librarian)
            </div>
          )}

          {/* AI Study Help Button */}
          <Link
            href={`/dashboard/ai-assistant?book=${book.id}`}
            className="block w-full rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 py-3 text-center font-medium text-white transition-all hover:from-purple-600 hover:to-purple-700"
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5" />
              Get AI Study Help
            </div>
          </Link>

          {/* View My Reservations Link */}
          <Link
            href="/dashboard/reservations"
            className="block w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            View My Reservations
          </Link>
        </div>

        {/* Right Column - Book Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Title & Author */}
          <div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              {book.title}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              by {book.authors.join(', ')}
            </p>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {book.publicationYear && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <div className="mb-1 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">Year</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {book.publicationYear}
                </p>
              </div>
            )}
            {book.pageCount && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <div className="mb-1 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs">Pages</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {book.pageCount}
                </p>
              </div>
            )}
            {book.language && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <div className="mb-1 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Globe className="h-4 w-4" />
                  <span className="text-xs">Language</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {book.language}
                </p>
              </div>
            )}
            {book.mainFaculty && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <div className="mb-1 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Building className="h-4 w-4" />
                  <span className="text-xs">Faculty</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {book.mainFaculty.code}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {book.description && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
                Description
              </h2>
              <p className="leading-relaxed text-gray-600 dark:text-gray-400">
                {book.description}
              </p>
            </div>
          )}

          {/* Book Details */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">
              Book Details
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {book.isbn && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    ISBN
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {book.isbn}
                  </dd>
                </div>
              )}
              {book.publisher && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    Publisher
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {book.publisher}
                  </dd>
                </div>
              )}
              {book.edition && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    Edition
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {book.edition}
                  </dd>
                </div>
              )}
              {book.category && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">
                    Category
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {book.category}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Subject Tags */}
          {book.subjectTags && book.subjectTags.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
                Subject Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {book.subjectTags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Campus Availability */}
          {book.availability && book.availability.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <MapPin className="h-5 w-5" />
                Campus Availability
              </h2>
              <div className="space-y-3">
                {book.availability.map((a) => (
                  <div
                    key={a.branch.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg p-3',
                      a.branch.id === selectedBranch
                        ? 'border border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20'
                        : 'bg-gray-50 dark:bg-gray-700/50'
                    )}
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {a.branch.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {a.branch.code}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.available > 0 ? (
                        <>
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="font-medium text-green-700 dark:text-green-400">
                            {a.available} available
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-500" />
                          <span className="font-medium text-red-700 dark:text-red-400">
                            Unavailable
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
