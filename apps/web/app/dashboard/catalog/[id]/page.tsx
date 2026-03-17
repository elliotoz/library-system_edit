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
  Hash,
  Layers,
  Tag,
  ExternalLink,
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
  const { isAuthenticated } = useAuth();

  const [book, setBook] = useState<BookDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [reservationInfo, setReservationInfo] =
    useState<ReservationInfo | null>(null);
  const [notifyWhenAvailable, setNotifyWhenAvailable] = useState(false);
  const [coverError, setCoverError] = useState(false);

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

        if (reservationInfo) {
          setReservationInfo({
            ...reservationInfo,
            activeReservations: reservationInfo.activeReservations + 1,
            remainingReservations: reservationInfo.remainingReservations - 1,
            canReserve: reservationInfo.remainingReservations - 1 > 0,
          });
        }

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

  const hasCover = book?.coverImageUrl && !coverError;

  // --- Skeleton loader ---
  if (isLoading) {
    return (
      <div className="space-y-0">
        {/* Hero skeleton */}
        <div className="relative -mx-4 -mt-4 mb-8 h-64 animate-pulse bg-gray-200 dark:bg-gray-800 sm:-mx-6 lg:-mx-8" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="-mt-32 aspect-[3/4] animate-pulse rounded-2xl bg-gray-200 shadow-xl dark:bg-gray-700" />
            <div className="h-12 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
            <div className="h-12 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
          </div>
          <div className="space-y-4 lg:col-span-2">
            <div className="h-10 w-3/4 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            <div className="flex gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
              ))}
            </div>
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
            <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <BookOpen className="h-10 w-10 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
          Book not found
        </h3>
        <p className="mb-6 text-gray-500 dark:text-gray-400">
          This book may have been removed or the link is incorrect.
        </p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    );
  }

  // Availability percentage for progress bar
  const availPercent =
    book.totalCopies > 0
      ? Math.round((book.availableCopies / book.totalCopies) * 100)
      : 0;

  return (
    <div className="space-y-0">
      {/* ===== Hero Banner ===== */}
      <div className="relative -mx-4 -mt-4 mb-8 overflow-hidden sm:-mx-6 lg:-mx-8">
        {/* Blurred cover background */}
        {hasCover && (
          <img
            src={book.coverImageUrl!}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          />
        )}
        {/* Gradient overlay */}
        <div
          className={cn(
            'absolute inset-0',
            hasCover
              ? 'bg-gradient-to-b from-gray-900/70 via-gray-900/60 to-gray-50 dark:to-gray-900'
              : 'bg-gradient-to-br from-primary-600 to-primary-800 dark:from-primary-900 dark:to-gray-900'
          )}
        />

        {/* Hero content */}
        <div className="relative px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Catalog
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            {/* Mini cover in hero (mobile-hidden, shown on sm+) */}
            <div className="hidden sm:block">
              <div className="h-32 w-24 overflow-hidden rounded-lg shadow-lg ring-2 ring-white/20">
                {hasCover ? (
                  <img
                    src={book.coverImageUrl!}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setCoverError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary-200 dark:bg-primary-800">
                    <BookOpen className="h-8 w-8 text-primary-500 dark:text-primary-400" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                {book.title}
              </h1>
              <p className="mt-2 text-base text-white/70 sm:text-lg">
                by{' '}
                {book.authors.map((a, i) => (
                  <span key={i}>
                    {i > 0 && <span className="mx-1.5 text-white/40">&middot;</span>}
                    <span className="font-medium text-white/90">{a}</span>
                  </span>
                ))}
              </p>

              {/* Quick badges in hero */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {book.publicationYear && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Calendar className="h-3 w-3" /> {book.publicationYear}
                  </span>
                )}
                {book.category && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Layers className="h-3 w-3" /> {book.category}
                  </span>
                )}
                {book.mainFaculty && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Building className="h-3 w-3" /> {book.mainFaculty.code}
                  </span>
                )}
                {book.isEbookAvailable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/30 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur-sm">
                    <Globe className="h-3 w-3" /> E-book
                  </span>
                )}
                {/* Availability pill */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm',
                    book.isAvailable
                      ? 'bg-green-500/25 text-green-100'
                      : book.totalCopies === 0 && book.isEbookAvailable
                        ? 'bg-blue-500/25 text-blue-100'
                        : 'bg-red-500/25 text-red-100'
                  )}
                >
                  {book.isAvailable ? (
                    <><CheckCircle className="h-3 w-3" /> Available</>
                  ) : book.totalCopies === 0 && book.isEbookAvailable ? (
                    <><Globe className="h-3 w-3" /> E-book Only</>
                  ) : (
                    <><XCircle className="h-3 w-3" /> Unavailable</>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Main Content Grid ===== */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* ===== Left Column — Cover & Actions ===== */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          {/* Large Cover */}
          <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="relative aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/40 dark:to-primary-800/40">
              {hasCover ? (
                <img
                  src={book.coverImageUrl!}
                  alt={book.title}
                  className="h-full w-full object-cover"
                  onError={() => setCoverError(true)}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                  <BookOpen className="h-20 w-20 text-primary-300 dark:text-primary-600" />
                  <span className="max-w-[80%] text-center text-sm font-medium text-primary-400 dark:text-primary-500">
                    {book.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Availability Card ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Availability
            </h3>

            {/* Overall status with progress bar */}
            {book.totalCopies > 0 && (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Physical copies
                  </span>
                  <span
                    className={cn(
                      'font-semibold',
                      book.availableCopies > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {book.availableCopies} / {book.totalCopies}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      availPercent > 50
                        ? 'bg-green-500'
                        : availPercent > 0
                          ? 'bg-amber-500'
                          : 'bg-red-400'
                    )}
                    style={{ width: `${availPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* E-book only status */}
            {book.totalCopies === 0 && book.isEbookAvailable && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                <Globe className="h-4 w-4 shrink-0" />
                Available as e-book only
              </div>
            )}

            {/* No copies at all */}
            {book.totalCopies === 0 && !book.isEbookAvailable && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No copies in the system
              </div>
            )}

            {/* Reservation limit info */}
            {reservationInfo && (
              <div className="mb-4 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Your reservations
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {reservationInfo.activeReservations} /{' '}
                    {reservationInfo.reservationLimit}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      reservationInfo.remainingReservations > 0
                        ? 'bg-primary-500'
                        : 'bg-red-500'
                    )}
                    style={{
                      width: `${Math.round((reservationInfo.activeReservations / reservationInfo.reservationLimit) * 100)}%`,
                    }}
                  />
                </div>
                <p
                  className={cn(
                    'mt-1.5 text-xs',
                    reservationInfo.remainingReservations > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {reservationInfo.remainingReservations > 0
                    ? `${reservationInfo.remainingReservations} reservation(s) remaining`
                    : 'Reservation limit reached'}
                </p>
              </div>
            )}

            {/* Ebook-only: inline read button */}
            {(!book.availability || book.availability.length === 0) &&
              book.isEbookAvailable &&
              book.ebookUrl && (
                <a
                  href={book.ebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
                >
                  <ExternalLink className="h-4 w-4" />
                  Read E-book Online
                </a>
              )}

            {/* Branch selection & Reserve */}
            {book.availability && book.availability.length > 0 && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Pickup Location
                </label>
                <select
                  value={selectedBranch || ''}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  {book.availability.map((a) => (
                    <option
                      key={a.branch.id}
                      value={a.branch.id}
                      disabled={a.available === 0}
                    >
                      {a.branch.name} — {a.available}/{a.total} available
                    </option>
                  ))}
                </select>

                {/* Selected branch chip */}
                {selectedBranchData && (
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-xl p-3 text-sm',
                      selectedBranchData.available > 0
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    )}
                  >
                    {selectedBranchData.available > 0 ? (
                      <>
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        <span>
                          {selectedBranchData.available} cop
                          {selectedBranchData.available > 1 ? 'ies' : 'y'}{' '}
                          at {selectedBranchData.branch.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>None available here</span>
                      </>
                    )}
                  </div>
                )}

                {/* Reserve / Unavailable */}
                {canReserveAtBranch ? (
                  <button
                    onClick={handleReserve}
                    disabled={
                      isReserving || reservationInfo?.canReserve === false
                    }
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
                      isReserving || reservationInfo?.canReserve === false
                        ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                        : 'bg-primary-500 text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 hover:shadow-primary-500/35'
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
                        Reserve This Book
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-200 py-3 text-sm font-semibold text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                    >
                      <XCircle className="h-4 w-4" />
                      Unavailable at This Branch
                    </button>

                    {!notifyWhenAvailable ? (
                      <button
                        onClick={handleNotifyMe}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary-500/30 py-2.5 text-sm font-semibold text-primary-600 transition-all hover:border-primary-500 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                      >
                        <Bell className="h-4 w-4" />
                        Notify Me When Available
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-sm font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        You&apos;ll be notified
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Action Buttons ── */}
          <div className="space-y-3">
            {/* E-book button */}
            {book.isEbookAvailable && book.ebookUrl && (
              <a
                href={book.ebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-600 hover:to-blue-700 hover:shadow-blue-500/30"
              >
                <ExternalLink className="h-4 w-4" />
                Read E-book Online
              </a>
            )}

            {/* E-book no URL */}
            {book.isEbookAvailable && !book.ebookUrl && (
              <div className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-200 py-3 text-sm font-medium text-blue-600 dark:border-blue-800 dark:text-blue-400">
                <BookOpen className="h-4 w-4" />
                E-book Available — Ask Librarian
              </div>
            )}

            {/* AI Study Help */}
            <Link
              href={`/dashboard/ai-assistant?book=${book.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all hover:from-purple-600 hover:to-violet-700 hover:shadow-purple-500/30"
            >
              <Sparkles className="h-4 w-4" />
              Get AI Study Help
            </Link>

            {/* My Reservations */}
            <Link
              href="/dashboard/reservations"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              View My Reservations
            </Link>
          </div>
        </div>

        {/* ===== Right Column — Details ===== */}
        <div className="space-y-6 lg:col-span-2">
          {/* Title (visible on mobile since hero mini-cover is hidden) */}
          <div className="sm:hidden">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {book.title}
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              by {book.authors.join(', ')}
            </p>
          </div>

          {/* Metadata Chips */}
          <div className="flex flex-wrap gap-2">
            {book.pageCount && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                {book.pageCount} pages
              </span>
            )}
            {book.language && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Globe className="h-3.5 w-3.5 text-gray-400" />
                {book.language}
              </span>
            )}
            {book.isbn && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Hash className="h-3.5 w-3.5 text-gray-400" />
                {book.isbn}
              </span>
            )}
            {book.edition && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Layers className="h-3.5 w-3.5 text-gray-400" />
                {book.edition}
              </span>
            )}
            {book.publisher && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <Building className="h-3.5 w-3.5 text-gray-400" />
                {book.publisher}
              </span>
            )}
          </div>

          {/* Description */}
          {book.description && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <FileText className="h-4 w-4" />
                Description
              </h2>
              <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                {book.description}
              </p>
            </div>
          )}

          {/* Subject Tags */}
          {book.subjectTags && book.subjectTags.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Tag className="h-4 w-4" />
                Subjects
              </h2>
              <div className="flex flex-wrap gap-2">
                {book.subjectTags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-primary-200 bg-primary-50 px-3.5 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Campus Availability */}
          {book.availability && book.availability.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <MapPin className="h-4 w-4" />
                Campus Availability
              </h2>
              <div className="space-y-3">
                {book.availability.map((a) => {
                  const branchPercent =
                    a.total > 0
                      ? Math.round((a.available / a.total) * 100)
                      : 0;
                  const isSelected = a.branch.id === selectedBranch;

                  return (
                    <button
                      key={a.branch.id}
                      type="button"
                      onClick={() => setSelectedBranch(a.branch.id)}
                      className={cn(
                        'w-full rounded-xl p-4 text-left transition-all',
                        isSelected
                          ? 'border-2 border-primary-400 bg-primary-50 shadow-sm dark:border-primary-600 dark:bg-primary-900/20'
                          : 'border border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:bg-gray-700'
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {a.branch.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {a.branch.code}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {a.available > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              {a.available} available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <XCircle className="h-3 w-3" />
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Per-branch progress bar */}
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            branchPercent > 50
                              ? 'bg-green-500'
                              : branchPercent > 0
                                ? 'bg-amber-500'
                                : 'bg-red-400'
                          )}
                          style={{ width: `${branchPercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {a.available} of {a.total} copies
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
