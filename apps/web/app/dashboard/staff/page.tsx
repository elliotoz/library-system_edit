'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, Bookmark, Sparkles, Clock, ArrowRight,
  CheckCircle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Book {
  id: string;
  title: string;
  authors: string[];
  category?: string;
  availableCopies: number;
  coverImageUrl?: string | null;
}

interface StaffStats {
  borrowedBooks: number;
  interests: string[];
  interestCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Psychology':       'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Finance':          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Self-Improvement': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Technology':       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Science':          'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'default':          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const BOOK_GRADIENTS = [
  'from-purple-400 to-purple-600',
  'from-emerald-400 to-emerald-600',
  'from-blue-400 to-blue-600',
  'from-amber-400 to-amber-600',
];

export default function StaffDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, booksRes] = await Promise.all([
          api.get('/dashboard/staff').catch(() => null),
          api.get('/books?pageSize=4').catch(() => null),
        ]);
        if (statsRes?.data) setStats(statsRes.data);
        if (booksRes?.data) setRecommendations(booksRes.data.data || []);
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  const statCards = [
    { label: 'Books Borrowed', value: stats?.borrowedBooks ?? 0, icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-l-blue-500' },
    { label: 'Interests Saved', value: stats?.interestCount ?? 0, icon: Bookmark, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-l-green-500' },
    { label: 'AI Suggestions', value: 12, icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-l-purple-500' },
    { label: 'Days Borrow Limit', value: 14, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-l-amber-500' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-700 p-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-emerald-100 text-sm font-medium mb-1">{greeting()}</p>
            <h1 className="text-2xl font-bold">{user?.name?.split(' ')[0] || 'Staff'}</h1>
            <p className="text-emerald-200 text-sm mt-1">Welcome to your staff dashboard</p>
          </div>
          <span className="hidden sm:block px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
            Library Staff
          </span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className={cn('glass-card p-4 border-l-4', s.border)}>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
                <s.icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Recommended Books ── */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h2 className="font-semibold text-gray-900 dark:text-white">Recommended Based on Your Interests</h2>
          <Link href="/dashboard/catalog"
            className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(recommendations.length > 0
              ? recommendations
              : [
                  { id: '1', title: 'Thinking, Fast and Slow', authors: ['Daniel Kahneman'], category: 'Psychology', availableCopies: 1 },
                  { id: '2', title: 'The Psychology of Money', authors: ['Morgan Housel'], category: 'Finance', availableCopies: 0 },
                  { id: '3', title: 'Atomic Habits', authors: ['James Clear'], category: 'Self-Improvement', availableCopies: 2 },
                  { id: '4', title: 'Influence', authors: ['Robert Cialdini'], category: 'Psychology', availableCopies: 1 },
                ]
            ).map((book, i) => (
              <Link key={book.id} href={recommendations.length > 0 ? `/dashboard/catalog/${book.id}` : '/dashboard/catalog'} className="group block">
                <div className={cn('relative aspect-[3/4] rounded-xl mb-3 overflow-hidden transition-all group-hover:shadow-lg group-hover:-translate-y-0.5', !book.coverImageUrl && cn('flex flex-col items-center justify-center bg-gradient-to-br p-3', BOOK_GRADIENTS[i % 4]))}>
                  {book.coverImageUrl ? (
                    <img src={book.coverImageUrl} alt={book.title} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <BookOpen className="w-10 h-10 text-white/80 mb-2" />
                      <p className="text-white/70 text-[10px] text-center line-clamp-3">{book.title}</p>
                    </>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary-600 transition-colors">{book.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{book.authors.join(', ')}</p>
                {book.category && (
                  <span className={cn('inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full', CATEGORY_COLORS[book.category] || CATEGORY_COLORS.default)}>
                    {book.category}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Assistant Banner ── */}
      <Link href="/dashboard/ai-assistant"
        className="group flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-primary-500 to-primary-700 p-5 shadow-sm hover:shadow-md hover:from-primary-600 hover:to-primary-800 transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Personal Assistant</h3>
            <p className="text-white/70 text-sm mt-0.5">Get personalized recommendations based on your interests</p>
          </div>
        </div>
        <span className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white text-primary-600 rounded-lg text-sm font-medium group-hover:bg-primary-50 transition-colors flex-shrink-0">
          Open Assistant <ChevronRight className="w-4 h-4" />
        </span>
      </Link>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/dashboard/catalog', icon: BookOpen, label: 'Search Catalog', desc: 'Browse and reserve books', color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/30', hover: 'hover:border-primary-300 dark:hover:border-primary-700' },
          { href: '/dashboard/reservations', icon: Clock, label: 'My Reservations', desc: 'View your reservation status', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', hover: 'hover:border-amber-300 dark:hover:border-amber-700' },
          { href: '/dashboard/borrowed', icon: CheckCircle, label: 'Borrowed Books', desc: 'View your current loans', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', hover: 'hover:border-green-300 dark:hover:border-green-700' },
        ].map((a) => (
          <Link key={a.href} href={a.href}
            className="glass-card glass-card-interactive group flex items-center gap-4 p-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110', a.bg)}>
              <a.icon className={cn('w-5 h-5', a.color)} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{a.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 ml-auto flex-shrink-0 group-hover:text-gray-500 transition-colors" />
          </Link>
        ))}
      </div>

    </div>
  );
}
