'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  AlertCircle,
  Calendar,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Reservation {
  id: string;
  status:
    | 'PENDING'
    | 'READY_FOR_PICKUP'
    | 'COLLECTED'
    | 'CANCELLED'
    | 'EXPIRED';
  createdAt: string;
  expiresAt: string | null;
  pickupDeadline: string | null;
  book: {
    id: string;
    title: string;
    authors: string[];
    coverImageUrl: string | null;
  };
  branch: { id: string; name: string; code: string; address?: string };
}

const statusConfig = {
  PENDING: {
    label: 'Pending Approval',
    description: 'Waiting for admin to approve your reservation',
    color:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Clock,
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    description: 'Your book is ready! Visit the library to collect it',
    color:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: Package,
  },
  COLLECTED: {
    label: 'Collected',
    description: 'You have picked up this book',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: CheckCircle,
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'This reservation was cancelled',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    icon: XCircle,
  },
  EXPIRED: {
    label: 'Expired',
    description: 'This reservation has expired',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertCircle,
  },
};

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/reservations/my', {
        credentials: 'include',
      });
      if (response.ok) setReservations(await response.json());
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCancel = async (reservationId: string) => {
    setCancellingId(reservationId);
    try {
      const response = await fetch(
        `/api/reservations/${reservationId}/cancel`,
        {
          method: 'PATCH',
          credentials: 'include',
        }
      );
      if (response.ok) {
        toast.success('Reservation cancelled');
        fetchReservations();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to cancel');
      }
    } catch (error) {
      toast.error('Failed to cancel reservation');
    } finally {
      setCancellingId(null);
    }
  };

  const filteredReservations = reservations.filter((r) => {
    if (filter === 'active')
      return ['PENDING', 'READY_FOR_PICKUP'].includes(r.status);
    if (filter === 'completed')
      return ['COLLECTED', 'CANCELLED', 'EXPIRED'].includes(r.status);
    return true;
  });

  const stats = {
    active: reservations.filter((r) =>
      ['PENDING', 'READY_FOR_PICKUP'].includes(r.status)
    ).length,
    ready: reservations.filter((r) => r.status === 'READY_FOR_PICKUP').length,
    collected: reservations.filter((r) => r.status === 'COLLECTED').length,
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const hoursLeft =
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) return { text: 'Overdue!', urgent: true };
    if (hoursLeft < 24)
      return { text: `${Math.round(hoursLeft)} hours left`, urgent: true };
    return { text: `${Math.ceil(hoursLeft / 24)} days left`, urgent: false };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Reservations
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Track your book reservation requests
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.active}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Active Reservations
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.ready}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ready for Pickup
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.collected}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Collected
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ready for Pickup Alert */}
      {stats.ready > 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-start gap-3">
            <Package className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                {stats.ready} book(s) ready for pickup!
              </p>
              <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                Visit your selected campus library with your student/staff ID to
                collect your books.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors',
              filter === f
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Reservations List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse glass-card p-4"
            >
              <div className="flex gap-4">
                <div className="h-28 w-20 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="glass-card py-12 text-center">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
            No reservations
          </h3>
          <p className="mb-4 text-gray-500 dark:text-gray-400">
            {filter === 'all'
              ? "You haven't made any reservations yet"
              : `No ${filter} reservations`}
          </p>
          <Link
            href="/dashboard/catalog"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
          >
            <BookOpen className="h-4 w-4" />
            Browse Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReservations.map((reservation) => {
            const config = statusConfig[reservation.status];
            const StatusIcon = config.icon;
            const timeRemaining =
              reservation.status === 'READY_FOR_PICKUP' &&
              reservation.pickupDeadline
                ? getTimeRemaining(reservation.pickupDeadline)
                : null;

            return (
              <div
                key={reservation.id}
                className={cn(
                  'rounded-xl border bg-white p-4 dark:bg-gray-800',
                  reservation.status === 'READY_FOR_PICKUP'
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
                    : 'border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* Book Cover */}
                  <Link
                    href={`/dashboard/catalog/${reservation.book.id}`}
                    className="flex-shrink-0"
                  >
                    <div className="flex h-28 w-20 items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30">
                      {reservation.book.coverImageUrl ? (
                        <img
                          src={reservation.book.coverImageUrl}
                          alt={reservation.book.title}
                          className="h-full w-full rounded-lg object-cover"
                        />
                      ) : (
                        <BookOpen className="h-8 w-8 text-primary-400" />
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/catalog/${reservation.book.id}`}
                      className="hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      <h3 className="line-clamp-1 font-medium text-gray-900 dark:text-white">
                        {reservation.book.title}
                      </h3>
                    </Link>
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      {reservation.book.authors.join(', ')}
                    </p>

                    {/* Status Description */}
                    <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                      {config.description}
                    </p>

                    <div className="flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <MapPin className="h-4 w-4" />
                        <span>{reservation.branch.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Reserved:{' '}
                          {new Date(reservation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Pickup Deadline */}
                    {reservation.status === 'READY_FOR_PICKUP' &&
                      reservation.pickupDeadline && (
                        <div
                          className={cn(
                            'mt-2 inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium',
                            timeRemaining?.urgent
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          )}
                        >
                          <AlertCircle className="h-4 w-4" />
                          Pickup by:{' '}
                          {new Date(
                            reservation.pickupDeadline
                          ).toLocaleString()}{' '}
                          ({timeRemaining?.text})
                        </div>
                      )}
                  </div>

                  {/* Status & Actions */}
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
                        config.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </span>

                    {['PENDING', 'READY_FOR_PICKUP'].includes(
                      reservation.status
                    ) && (
                      <button
                        onClick={() => handleCancel(reservation.id)}
                        disabled={cancellingId === reservation.id}
                        className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {cancellingId === reservation.id
                          ? 'Cancelling...'
                          : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
