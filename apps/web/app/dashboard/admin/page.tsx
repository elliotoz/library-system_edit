// app/dashboard/admin/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, Users, BookMarked, Clock, AlertTriangle, UserPlus, Plus, BarChart3 } from 'lucide-react';
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

interface Activity {
  type: string;
  message: string;
  time: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
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
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const statCards = [
    { label: 'Total Books', value: stats?.totalBooks || 0, icon: BookOpen, color: 'bg-blue-500' },
    { label: 'Active Users', value: stats?.activeUsers || 0, icon: Users, color: 'bg-green-500' },
    { label: 'Currently Borrowed', value: stats?.currentlyBorrowed || 0, icon: BookMarked, color: 'bg-purple-500' },
  ];

  const alertCards = [
    { label: 'Pending Reservations', value: stats?.pendingReservations || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', link: '/dashboard/admin/reservations' },
    { label: 'Overdue Books', value: stats?.overdueBooks || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', link: '/dashboard/admin/books' },
    { label: 'New Users This Week', value: stats?.newUsersThisWeek || 0, icon: UserPlus, color: 'text-green-600', bg: 'bg-green-50', link: '/dashboard/admin/users' },
  ];

  const quickActions = [
    { label: 'Add New Book', icon: Plus, href: '/dashboard/admin/books' },
    { label: 'Manage Users', icon: Users, href: '/dashboard/admin/users' },
    { label: 'Reservations', icon: Clock, href: '/dashboard/admin/reservations' },
    { label: 'View Reports', icon: BarChart3, href: '/dashboard/admin/reports' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name?.split(' ')[0] || 'Admin'}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400">Here's an overview of your library system today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center text-white', stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {alertCards.map((card, i) => (
          <Link key={i} href={card.link} className={cn('rounded-xl border p-6 transition-all hover:shadow-md', card.bg, 'border-transparent dark:bg-opacity-20')}>
            <div className="flex items-center gap-4">
              <card.icon className={cn('w-8 h-8', card.color)} />
              <div>
                <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{card.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activity</p>
            ) : (
              activities.slice(0, 5).map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    activity.type === 'borrow' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                  )}>
                    {activity.type === 'borrow' ? <BookMarked className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{activity.message}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(activity.time).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Admin Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action, i) => (
              <Link key={i} href={action.href} className="flex flex-col items-center justify-center p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-200 dark:hover:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
                <action.icon className="w-6 h-6 text-gray-400 dark:text-gray-500 mb-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
