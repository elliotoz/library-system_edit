'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
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
  ListChecks,
  Building2,
  ShieldCheck,
  DollarSign,
  FileDown,
  Globe,
  Library,
  ChevronRight,
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

interface NavSection {
  label: string;
  items: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
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

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleDarkMode = () => {
    const value = !darkMode;
    setDarkMode(value);
    localStorage.setItem('darkMode', String(value));
    document.documentElement.classList.toggle('dark', value);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const getNavSections = (role: Role): NavSection[] => {
    const sections: NavSection[] = [
      {
        label: 'Library',
        items: [
          { label: 'Dashboard', href: DASHBOARD_ROUTES[role], icon: LayoutDashboard },
          { label: 'Book Catalog', href: '/dashboard/catalog', icon: BookOpen },
          { label: 'Materials', href: '/dashboard/materials', icon: FileText },
          { label: 'Reading Lists', href: '/dashboard/reading-lists', icon: ListChecks },
          { label: 'My Borrowed Books', href: '/dashboard/borrowed', icon: BookMarked },
          { label: 'My Reservations', href: '/dashboard/reservations', icon: Clock },
          { label: 'Borrow History', href: '/dashboard/history', icon: History },
          { label: 'AI Assistant', href: '/dashboard/ai-assistant', icon: Sparkles },
        ],
      },
      {
        label: 'Account',
        items: [
          { label: 'Profile', href: '/dashboard/profile', icon: User },
          { label: 'Settings', href: '/dashboard/settings', icon: Settings },
        ],
      },
    ];

    if (role === 'INSTRUCTOR') {
      sections.push({
        label: 'Instructor Tools',
        items: [
          { label: 'Share Research', href: '/dashboard/instructor/submit-material', icon: Upload },
          { label: 'My Submissions', href: '/dashboard/instructor/my-submissions', icon: FileText },
        ],
      });
    }

    if (role === 'ADMIN') {
      sections.push({
        label: 'Administration',
        items: [
          { label: 'Pending Reservations', href: '/dashboard/admin/reservations', icon: Clock },
          { label: 'Active Borrows', href: '/dashboard/admin/borrows', icon: BookMarked },
          { label: 'Statistics', href: '/dashboard/admin/statistics', icon: BarChart3 },
          { label: 'Manage Books', href: '/dashboard/admin/books', icon: BookOpen },
          { label: 'Manage Users', href: '/dashboard/admin/users', icon: Users },
          { label: 'Upload Materials', href: '/dashboard/admin/upload', icon: Upload },
          { label: 'Manage Materials', href: '/dashboard/admin/materials', icon: FileText },
          { label: 'Reading Lists', href: '/dashboard/admin/reading-lists', icon: ListChecks },
          { label: 'Manage Branches', href: '/dashboard/admin/branches', icon: Building2 },
          { label: 'Borrow Policies', href: '/dashboard/admin/policies', icon: ShieldCheck },
          { label: 'Fine Payments', href: '/dashboard/admin/fines', icon: DollarSign },
          { label: 'Reports', href: '/dashboard/admin/reports', icon: FileDown },
          { label: 'Import E-Books', href: '/dashboard/admin/import-books', icon: Globe },
        ],
      });
    }

    return sections;
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 text-white shadow-lg">
            <Library className="h-6 w-6" />
          </div>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary-400" />
          </div>
        </div>
      </div>
    );
  }

  const navSections = getNavSections(user.role as Role);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Toaster position="top-right" />

        {/* ── Header ── */}
        <header className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
          {/* Left: hamburger + brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 lg:hidden"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link
              href={DASHBOARD_ROUTES[user.role as Role]}
              className="flex items-center gap-2.5"
            >
              <Image
                src="/uskudar-logo.png"
                alt="Üsküdar University"
                width={110}
                height={32}
                className="object-contain dark:brightness-[1.1]"
              />
              <span className="hidden font-semibold text-gray-900 dark:text-white sm:block">
                Library System
              </span>
            </Link>
          </div>

          {/* Right: dark mode + notifications + user */}
          <div className="flex items-center gap-1">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label="Toggle notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1rem))] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/notifications/read-all', {
                              method: 'PATCH',
                              credentials: 'include',
                            });
                            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                          } catch {}
                        }}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8 text-center">
                        <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={async () => {
                            if (!notification.read) {
                              try {
                                await fetch(`/api/notifications/${notification.id}/read`, {
                                  method: 'PATCH',
                                  credentials: 'include',
                                });
                                setNotifications((prev) =>
                                  prev.map((n) => n.id === notification.id ? { ...n, read: true } : n)
                                );
                              } catch {}
                            }
                          }}
                          className={cn(
                            'cursor-pointer border-b border-gray-100 px-4 py-3 transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/50',
                            !notification.read && 'bg-primary-50/60 dark:bg-primary-900/20'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {!notification.read && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                            )}
                            <div className={cn(!notification.read ? '' : 'pl-4')}>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{notification.title}</p>
                              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{notification.message}</p>
                              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                {new Date(notification.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />

            {/* User chip */}
            <div className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full object-cover ring-2 ring-white dark:ring-gray-700" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white ring-2 ring-white dark:ring-gray-700">
                  {getInitials(user.name)}
                </div>
              )}
              <div className="hidden flex-col sm:flex">
                <span className="text-sm font-medium leading-tight text-gray-900 dark:text-white">{user.name}</span>
                <span className={cn('w-fit rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-tight', ROLE_COLORS[user.role as Role])}>
                  {ROLE_LABELS[user.role as Role]}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Mobile backdrop ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={cn(
            'fixed top-16 z-40 flex h-[calc(100vh-4rem)] w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 dark:border-gray-700/60 dark:bg-gray-800',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:translate-x-0'
          )}
        >
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {navSections.map((section) => (
              <div key={section.label} className="mb-5">
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {section.label}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-white'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'h-4 w-4 shrink-0 transition-colors',
                            active
                              ? 'text-primary-500 dark:text-primary-400'
                              : 'text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300'
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {active && (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary-400 dark:text-primary-500" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Logout */}
          <div className="border-t border-gray-200 px-3 py-3 dark:border-gray-700">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Log out
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="pt-16 lg:ml-64">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
