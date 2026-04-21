'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { extractApiError } from '@/lib/api-error';

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  bookId: string | null;
  branchId: string | null;
  createdAt: string;
  readAt: string | null;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  createdAt: string;
  link?: string;
}

function getDisplayType(type: string): 'info' | 'warning' | 'success' | 'error' {
  switch (type) {
    case 'BORROW_DUE_SOON':
    case 'RESERVATION_EXPIRED':
      return 'warning';
    case 'RESERVATION_APPROVED':
    case 'RESERVATION_READY':
    case 'BORROW_CREATED':
    case 'BOOK_AVAILABLE':
    case 'READING_LIST_PUBLISHED':
    case 'READING_LIST_UPDATED':
      return 'success';
    case 'BORROW_OVERDUE':
    case 'RESERVATION_REJECTED':
      return 'error';
    default:
      return 'info';
  }
}

function getNotificationLink(type: string): string | undefined {
  switch (type) {
    case 'RESERVATION_CREATED':
    case 'RESERVATION_APPROVED':
    case 'RESERVATION_READY':
    case 'RESERVATION_REJECTED':
    case 'RESERVATION_EXPIRED':
      return '/dashboard/reservations';
    case 'BORROW_CREATED':
    case 'BORROW_DUE_SOON':
    case 'BORROW_OVERDUE':
      return '/dashboard/borrowed';
    case 'BOOK_AVAILABLE':
      return '/dashboard/catalog';
    default:
      return undefined;
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', { credentials: 'include' });
      if (!response.ok) {
        toast.error(await extractApiError(response, 'Failed to load notifications'));
        return;
      }
      const data = await response.json();
      const mapped: Notification[] = (data.notifications as ApiNotification[]).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: getDisplayType(n.type),
        read: n.read,
        createdAt: n.createdAt,
        link: getNotificationLink(n.type),
      }));
      setNotifications(mapped);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) {
        toast.error(await extractApiError(response, 'Failed to mark as read'));
        return;
      }
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) {
        toast.error(await extractApiError(response, 'Failed to mark all as read'));
        return;
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        toast.error(await extractApiError(response, 'Failed to delete notification'));
        return;
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification deleted');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const clearRead = async () => {
    try {
      const response = await fetch('/api/notifications/clear-read', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        toast.error(await extractApiError(response, 'Failed to clear notifications'));
        return;
      }
      setNotifications((prev) => prev.filter((n) => !n.read));
      toast.success('Read notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const filteredNotifications =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {unreadCount > 0 ? `You have ${unreadCount} unread notifications` : "You're all caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            >
              Mark all as read
            </button>
          )}
          {notifications.some((n) => n.read) && (
            <button
              onClick={clearRead}
              className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear read
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          )}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filter === 'unread'
              ? 'bg-primary-500 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          )}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'unread'
              ? "You've read all your notifications"
              : "You don't have any notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                'glass-card p-4',
                !notification.read && notification.type === 'warning' && 'border-l-4 border-l-amber-400',
                !notification.read && notification.type === 'success' && 'border-l-4 border-l-green-400',
                !notification.read && notification.type === 'error' && 'border-l-4 border-l-red-400',
                !notification.read && notification.type === 'info' && 'border-l-4 border-l-blue-400',
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {notification.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(notification.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      {notification.link && (
                        <a
                          href={notification.link}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          View details
                        </a>
                      )}
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
