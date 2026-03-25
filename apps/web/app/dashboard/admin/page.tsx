'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen, Users, BookMarked, Clock, AlertTriangle, UserPlus,
  Plus, BarChart3, ChevronRight, Activity,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface AdminStats {
  totalBooks: number;
  activeUsers: number;
  currentlyBorrowed: number;
  pendingReservations: number;
  overdueBooks: number;
  newUsersThisWeek: number;
}

interface ActivityItem {
  type: string;
  message: string;
  time: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activityRes] = await Promise.all([
          api.get('/dashboard/admin').catch(() => null),
          api.get('/dashboard/activity').catch(() => null),
        ]);
        if (statsRes?.data) setStats(statsRes.data);
        if (activityRes?.data) setActivities(activityRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const mainStats = [
    { label: 'Total Books', value: stats?.totalBooks ?? 0, icon: BookOpen, gradient: 'from-blue-500 to-blue-600', light: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-500' },
    { label: 'Active Users', value: stats?.activeUsers ?? 0, icon: Users, gradient: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-900/30', color: 'text-emerald-500' },
    { label: 'Currently Borrowed', value: stats?.currentlyBorrowed ?? 0, icon: BookMarked, gradient: 'from-purple-500 to-purple-600', light: 'bg-purple-50 dark:bg-purple-900/30', color: 'text-purple-500' },
  ];

  const alertStats = [
    { label: 'Pending Reservations', value: stats?.pendingReservations ?? 0, icon: Clock, border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', iconBg: 'bg-amber-100 dark:bg-amber-900/40', color: 'text-amber-600 dark:text-amber-400', link: '/dashboard/admin/reservations' },
    { label: 'Overdue Books', value: stats?.overdueBooks ?? 0, icon: AlertTriangle, border: 'border-l-red-500', bg: 'bg-red-50 dark:bg-red-900/20', iconBg: 'bg-red-100 dark:bg-red-900/40', color: 'text-red-600 dark:text-red-400', link: '/dashboard/admin/books' },
    { label: 'New Users This Week', value: stats?.newUsersThisWeek ?? 0, icon: UserPlus, border: 'border-l-green-500', bg: 'bg-green-50 dark:bg-green-900/20', iconBg: 'bg-green-100 dark:bg-green-900/40', color: 'text-green-600 dark:text-green-400', link: '/dashboard/admin/users' },
  ];

  const quickActions = [
    { label: 'Add New Book', icon: Plus, href: '/dashboard/admin/books/new', color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/30', hover: 'hover:border-primary-300 dark:hover:border-primary-700' },
    { label: 'Manage Users', icon: Users, href: '/dashboard/admin/users', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', hover: 'hover:border-blue-300 dark:hover:border-blue-700' },
    { label: 'Reservations', icon: Clock, href: '/dashboard/admin/reservations', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', hover: 'hover:border-amber-300 dark:hover:border-amber-700' },
    { label: 'View Reports', icon: BarChart3, href: '/dashboard/admin/reports', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', hover: 'hover:border-purple-300 dark:hover:border-purple-700' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg animate-slide-up stagger-1"
        style={{ background: 'linear-gradient(135deg,#0d1b2e 0%,#0f2336 60%,#0b1a2b 100%)' }}>
        <div className="absolute inset-0 animate-pulse-slow"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(74,191,191,0.6) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.06 }} />
        <div className="absolute right-0 top-0 h-full w-56 bg-gradient-to-l from-teal-500/20 to-transparent" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm font-medium mb-1">{greeting()}</p>
            <h1 className="text-2xl font-bold">{user?.name?.split(' ')[0] || 'Admin'}</h1>
            <p className="text-gray-400 text-sm mt-1">Here's your library system overview</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-2">
            <span className="px-3 py-1 bg-primary-500/20 border border-primary-500/30 rounded-full text-xs font-medium text-primary-300">
              Administrator
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {mainStats.map((s, i) => (
          <div key={i} className={cn('glass-card glass-card-interactive group p-5 animate-slide-up', `stagger-${i + 1}`)}>
            <div className="flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center ring-1 ring-transparent group-hover:ring-primary-400/30 transition-all', s.light)}>
                <s.icon className={cn('w-6 h-6', s.color)} />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{s.value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alert Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {alertStats.map((s, i) => (
          <Link key={i} href={s.link}
            className={cn('glass-card glass-card-interactive group border-l-4 p-4 animate-slide-up', s.border, `stagger-${i + 1}`)}>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', s.iconBg)}>
                <s.icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            </div>
          </Link>
        ))}
      </div>

      {/* ── Activity + Quick Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Activity Feed */}
        <div className="glass-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <Activity className="w-4 h-4 text-gray-400" />
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Activity</h2>
          </div>
          <div className="p-5">
            {activities.length === 0 ? (
              <div className="text-center py-6">
                <Activity className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-2 bottom-2 w-px bg-gradient-to-b from-teal-400/40 via-teal-400/20 to-transparent" />
                <div className="space-y-4">
                  {activities.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-start gap-4 relative">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white dark:ring-gray-800 z-10',
                        a.type === 'borrow' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-purple-100 dark:bg-purple-900/40'
                      )}>
                        {a.type === 'borrow'
                          ? <BookMarked className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          : <Plus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-snug">{a.message}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {new Date(a.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card">
          <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Quick Actions</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-3">
            {quickActions.map((a, i) => (
              <Link key={i} href={a.href}
                className={cn('glass-card glass-card-interactive group flex flex-col items-center justify-center gap-2 p-4', a.hover)}>
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110', a.bg)}>
                  <a.icon className={cn('w-5 h-5', a.color)} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
