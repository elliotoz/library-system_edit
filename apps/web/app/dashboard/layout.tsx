'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  Clock,
  Sparkles,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Users,
  Upload,
  Moon,
  Sun,
  FileText,
  History,
  BarChart3,
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { cn, getInitials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/AuthGuard';
import { Role, ROLE_LABELS, ROLE_COLORS, DASHBOARD_ROUTES } from '@/types';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications?limit=10', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications);
        }
      } catch {}
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    const value = !darkMode;
    setDarkMode(value);
    localStorage.setItem('darkMode', String(value));
    document.documentElement.classList.toggle('dark', value);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const getNavItems = (role: Role) => {
    const common = [
      {
        label: 'Dashboard',
        href: DASHBOARD_ROUTES[role],
        icon: LayoutDashboard,
      },
      { label: 'Book Catalog', href: '/dashboard/catalog', icon: BookOpen },
      { label: 'Materials', href: '/dashboard/materials', icon: FileText },
      {
        label: 'My Borrowed Books',
        href: '/dashboard/borrowed',
        icon: BookMarked,
      },
      {
        label: 'My Reservations',
        href: '/dashboard/reservations',
        icon: Clock,
      },
      {
        label: 'Borrow History',
        href: '/dashboard/history',
        icon: History,
      },
      {
        label: 'AI Assistant',
        href: '/dashboard/ai-assistant',
        icon: Sparkles,
      },
    ];

    const account = [
      { label: 'Profile', href: '/dashboard/profile', icon: User },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ];

    const instructor =
      role === 'INSTRUCTOR'
        ? [
            {
              label: 'Share Research',
              href: '/dashboard/instructor/submit-material',
              icon: Upload,
            },
            {
              label: 'My Submissions',
              href: '/dashboard/instructor/my-submissions',
              icon: FileText,
            },
          ]
        : [];

    const admin =
      role === 'ADMIN'
        ? [
            {
              label: 'Pending Reservations',
              href: '/dashboard/admin/reservations',
              icon: Clock,
            },
            {
              label: 'Active Borrows',
              href: '/dashboard/admin/borrows',
              icon: BookMarked,
            },
            {
              label: 'Statistics',
              href: '/dashboard/admin/statistics',
              icon: BarChart3,
            },
            {
              label: 'Manage Books',
              href: '/dashboard/admin/books',
              icon: BookOpen,
            },
            {
              label: 'Manage Users',
              href: '/dashboard/admin/users',
              icon: Users,
            },
            {
              label: 'Upload Materials',
              href: '/dashboard/admin/upload',
              icon: Upload,
            },
            {
              label: 'Manage Materials',
              href: '/dashboard/admin/materials',
              icon: FileText,
            },
            {
              label: 'System Settings',
              href: '/dashboard/admin/settings',
              icon: Settings,
            },
          ]
        : [];

    return { common, account, instructor, admin };
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const navItems = getNavItems(user.role as Role);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Toaster position="top-right" />

        {/* Header */}
        <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b bg-white px-4 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X /> : <Menu />}
            </button>
            <Link
              href={DASHBOARD_ROUTES[user.role as Role]}
              className="font-semibold"
            >
              Library System
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleDarkMode} aria-label="Toggle dark mode">
              {darkMode ? <Sun /> : <Moon />}
            </button>

            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                aria-label="Toggle notifications"
                className="relative rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between border-b border-gray-200 p-3 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/notifications/read-all', {
                              method: 'PATCH',
                              credentials: 'include',
                            });
                            setNotifications((prev) =>
                              prev.map((n) => ({ ...n, read: true }))
                            );
                          } catch {}
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={async () => {
                            if (!notification.read) {
                              try {
                                await fetch(
                                  `/api/notifications/${notification.id}/read`,
                                  {
                                    method: 'PATCH',
                                    credentials: 'include',
                                  }
                                );
                                setNotifications((prev) =>
                                  prev.map((n) =>
                                    n.id === notification.id
                                      ? { ...n, read: true }
                                      : n
                                  )
                                );
                              } catch {}
                            }
                          }}
                          className={cn(
                            'cursor-pointer border-b border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50',
                            !notification.read &&
                              'bg-primary-50 dark:bg-primary-900/20'
                          )}
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            {new Date(
                              notification.createdAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-white">
                {getInitials(user.name)}
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  ROLE_COLORS[user.role as Role]
                )}
              >
                {ROLE_LABELS[user.role as Role]}
              </span>
            </div>
          </div>
        </header>

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed top-16 z-40 h-full w-64 bg-white p-4 dark:bg-gray-800',
            sidebarOpen ? 'left-0' : '-left-64',
            'lg:left-0'
          )}
        >
          {[
            navItems.common,
            navItems.instructor,
            navItems.account,
            navItems.admin,
          ].map(
            (group, i) =>
              group.length > 0 && (
                <div key={i} className="mb-6 space-y-1">
                  {group.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                        isActive(item.href)
                          ? 'bg-primary-100 text-primary-700'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )
          )}

          <button
            onClick={logout}
            className="mt-auto flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </aside>

        <main className="pt-16 lg:ml-64">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
