'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Bookmark, Sparkles, Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

interface Book {
  id: string;
  title: string;
  authors: string[];
  category?: string;
  availableCopies: number;
}

interface StaffStats {
  borrowedBooks: number;
  interests: string[];
  interestCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Psychology': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Finance': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Self-Improvement': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Technology': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Science': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'default': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const BOOK_COLORS = [
  'from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30',
  'from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30',
  'from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30',
  'from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30',
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

        if (statsRes?.data) {
          setStats(statsRes.data);
        }

        if (booksRes?.data) {
          setRecommendations(booksRes.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {greeting()}, {user?.name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Welcome to your staff dashboard. Here's your library overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.borrowedBooks || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Books Borrowed</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Bookmark className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.interestCount || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Interests Saved</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">AI Suggestions</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">14</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Days Borrow Limit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Books - Now Clickable */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recommended Based on Your Interests
          </h2>
          <Link
            href="/dashboard/catalog"
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium flex items-center gap-1"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendations.length > 0 ? (
              recommendations.map((book, index) => (
                <Link
                  key={book.id}
                  href={`/dashboard/catalog/${book.id}`}
                  className="group cursor-pointer block"
                >
                  <div
                    className={cn(
                      'aspect-[3/4] bg-gradient-to-br rounded-lg mb-3 flex items-center justify-center transition-transform group-hover:scale-[1.02]',
                      BOOK_COLORS[index % BOOK_COLORS.length]
                    )}
                  >
                    <BookOpen className="w-12 h-12 text-primary-400 dark:text-primary-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                    {book.authors.join(', ')}
                  </p>
                  {book.category && (
                    <span
                      className={cn(
                        'inline-block mt-2 text-xs px-2 py-1 rounded-full',
                        CATEGORY_COLORS[book.category] || CATEGORY_COLORS.default
                      )}
                    >
                      {book.category}
                    </span>
                  )}
                </Link>
              ))
            ) : (
              // Fallback placeholder books
              [
                { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', category: 'Psychology' },
                { title: 'The Psychology of Money', author: 'Morgan Housel', category: 'Finance' },
                { title: 'Atomic Habits', author: 'James Clear', category: 'Self-Improvement' },
                { title: 'Influence', author: 'Robert Cialdini', category: 'Psychology' },
              ].map((book, index) => (
                <Link
                  key={index}
                  href="/dashboard/catalog"
                  className="group cursor-pointer block"
                >
                  <div
                    className={cn(
                      'aspect-[3/4] bg-gradient-to-br rounded-lg mb-3 flex items-center justify-center transition-transform group-hover:scale-[1.02]',
                      BOOK_COLORS[index % BOOK_COLORS.length]
                    )}
                  >
                    <BookOpen className="w-12 h-12 text-primary-400 dark:text-primary-500" />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{book.author}</p>
                  <span
                    className={cn(
                      'inline-block mt-2 text-xs px-2 py-1 rounded-full',
                      CATEGORY_COLORS[book.category] || CATEGORY_COLORS.default
                    )}
                  >
                    {book.category}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Assistant Banner - Now Functional */}
      <Link
        href="/dashboard/ai-assistant"
        className="block bg-gradient-to-r from-orange-400 to-orange-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Chat with AI Personal Assistant</h3>
              <p className="text-white/80 text-sm">
                Get personalized book recommendations and learning paths based on your interests
              </p>
            </div>
          </div>
          <button className="px-4 py-2 bg-white text-orange-500 rounded-lg font-medium hover:bg-orange-50 transition-colors group-hover:bg-orange-50">
            Open AI Assistant
          </button>
        </div>
      </Link>

      {/* Quick Actions - STAFF APPROPRIATE (No admin routes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/catalog"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-md transition-all group"
        >
          <BookOpen className="w-8 h-8 text-primary-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
            Search Catalog
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Browse and reserve books</p>
        </Link>

        {/* Changed from admin route to staff's own reservations */}
        <Link
          href="/dashboard/reservations"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-amber-200 dark:hover:border-amber-800 hover:shadow-md transition-all group"
        >
          <Clock className="w-8 h-8 text-amber-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
            My Reservations
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View your reservation status</p>
        </Link>

        <Link
          href="/dashboard/borrowed"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-green-200 dark:hover:border-green-800 hover:shadow-md transition-all group"
        >
          <CheckCircle className="w-8 h-8 text-green-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400">
            My Borrowed Books
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View your current loans</p>
        </Link>
      </div>
    </div>
  );
}
