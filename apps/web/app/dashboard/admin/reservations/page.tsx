'use client';

import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  BookOpen,
  MapPin,
  User,
  Package,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Reservation {
  id: string;
  status: string;
  createdAt: string;
  pickupDeadline?: string;
  user: { id: string; name: string; email: string; role: string };
  book: {
    id: string;
    title: string;
    authors: string[];
    coverImageUrl?: string;
  };
  branch: { id: string; name: string; code: string };
}

type TabType = 'pending' | 'ready';

export default function AdminReservationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [pendingReservations, setPendingReservations] = useState<Reservation[]>(
    []
  );
  const [readyReservations, setReadyReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchReservations = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, readyRes] = await Promise.all([
        fetch('/api/reservations/pending', { credentials: 'include' }),
        fetch('/api/reservations/ready', { credentials: 'include' }),
      ]);

      if (pendingRes.ok) setPendingReservations(await pendingRes.json());
      if (readyRes.ok) setReadyReservations(await readyRes.json());
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error('Failed to load reservations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/reservations/${id}/approve`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('Reservation approved! User has 2 days to pick up.');
        fetchReservations();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve reservation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/reservations/${id}/reject`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (response.ok) {
        toast.success('Reservation rejected');
        fetchReservations();
      } else {
        toast.error('Failed to reject reservation');
      }
    } catch (error) {
      toast.error('Failed to reject reservation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCollect = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/reservations/${id}/collect`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(
          <div>
            <p className="font-medium">Book collected successfully!</p>
            <p className="text-sm">
              Due date: {new Date(result.borrow.dueAt).toLocaleDateString()}
            </p>
          </div>,
          { duration: 5000 }
        );
        fetchReservations();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to mark as collected');
      }
    } catch (error) {
      toast.error('Failed to mark as collected');
    } finally {
      setProcessingId(null);
    }
  };

  const getDeadlineStatus = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const hoursLeft =
      (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) {
      return {
        label: 'Overdue',
        color: 'text-red-600 bg-red-50 dark:bg-red-900/20',
      };
    }
    if (hoursLeft < 24) {
      return {
        label: 'Due Today',
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
      };
    }
    return {
      label: `${Math.ceil(hoursLeft / 24)} days left`,
      color: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    };
  };

  const reservations =
    activeTab === 'pending' ? pendingReservations : readyReservations;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manage Reservations
        </h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Approve pending requests and process book pickups
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-800">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                {pendingReservations.length}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Pending Approval
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-800">
              <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                {readyReservations.length}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Ready for Pickup
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'pending'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          )}
        >
          Pending Approval ({pendingReservations.length})
        </button>
        <button
          onClick={() => setActiveTab('ready')}
          className={cn(
            'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'ready'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          )}
        >
          Ready for Pickup ({readyReservations.length})
        </button>
      </div>

      {/* Reservations List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex gap-4">
                <div className="h-20 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-300 dark:text-green-600" />
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
            {activeTab === 'pending' ? 'All caught up!' : 'No pickups waiting'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {activeTab === 'pending'
              ? 'No pending reservations to process'
              : 'No books waiting to be collected'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((reservation) => {
            const deadlineStatus =
              activeTab === 'ready' && reservation.pickupDeadline
                ? getDeadlineStatus(reservation.pickupDeadline)
                : null;

            return (
              <div
                key={reservation.id}
                className={cn(
                  'rounded-xl border bg-white p-4 dark:bg-gray-800',
                  activeTab === 'ready'
                    ? 'border-green-200 dark:border-green-800'
                    : 'border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex flex-1 gap-4">
                    {/* Book Cover */}
                    <div className="flex h-20 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30">
                      {reservation.book.coverImageUrl ? (
                        <img
                          src={reservation.book.coverImageUrl}
                          alt={reservation.book.title}
                          className="h-full w-full rounded-lg object-cover"
                        />
                      ) : (
                        <BookOpen className="h-6 w-6 text-primary-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 font-medium text-gray-900 dark:text-white">
                        {reservation.book.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {reservation.book.authors.join(', ')}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <User className="h-4 w-4" />
                          <span>{reservation.user.name}</span>
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                            {reservation.user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <MapPin className="h-4 w-4" />
                          <span>{reservation.branch.name}</span>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400 dark:text-gray-500">
                        <span>
                          Requested:{' '}
                          {new Date(reservation.createdAt).toLocaleString()}
                        </span>
                        {activeTab === 'ready' &&
                          reservation.pickupDeadline && (
                            <span
                              className={cn(
                                'rounded px-2 py-0.5',
                                deadlineStatus?.color
                              )}
                            >
                              Pickup by:{' '}
                              {new Date(
                                reservation.pickupDeadline
                              ).toLocaleString()}{' '}
                              ({deadlineStatus?.label})
                            </span>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 md:flex-col">
                    {activeTab === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleApprove(reservation.id)}
                          disabled={processingId === reservation.id}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 disabled:opacity-50 md:flex-none"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(reservation.id)}
                          disabled={processingId === reservation.id}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 px-4 py-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 md:flex-none"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleCollect(reservation.id)}
                        disabled={processingId === reservation.id}
                        className="flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-6 py-2 text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                      >
                        <Package className="h-4 w-4" />
                        Mark as Collected
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
