'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  FileText,
  Users,
  Calendar,
  Plus,
  ArrowRight,
  Sparkles,
  Search,
  ListChecks,
  Mail,
  Trash2,
  UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { readingListsApi, followersApi } from '@/lib/api';
import { ReadingList, FollowedInstructor } from '@/types';

interface InstructorStats {
  borrowedBooks: number;
  maxBorrowDays: number;
  maxBooks: number;
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [readingLists, setReadingLists] = useState<ReadingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);

  // Form state for new list
  const [newTitle, setNewTitle] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newSemester, setNewSemester] = useState('Spring 2026');

  const fetchReadingLists = useCallback(async () => {
    try {
      const lists = await readingListsApi.getMyLists();
      setReadingLists(lists);
    } catch {
      // Silently fail — lists section will show empty state
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('/api/dashboard/instructor', { credentials: 'include' }).catch(() => null);

        if (statsRes?.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        await fetchReadingLists();

        // Fetch following count
        try {
          const followingData = await followersApi.getMyFollowing();
          setFollowingCount(followingData.length);
        } catch {
          // Non-critical — leave count at 0
        }

        // Check if instructor public profile fields are filled
        if (user?.id) {
          try {
            const profileRes = await fetch(`/api/users/${user.id}`, { credentials: 'include' });
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              setHasProfile(!!(profileData.bio || profileData.department || (profileData.courses && profileData.courses.length > 0)));
            }
          } catch {
            // Non-critical
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [fetchReadingLists]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleContactAdmin = () => {
    setShowContactModal(true);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Message sent to library admin!');
    setShowContactModal(false);
  };

  const handleCreateList = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (isCreating || !newTitle.trim()) return;
    if (status === 'PUBLISHED') {
      toast.error('Cannot publish a reading list with no books. Add books first, then publish from the manage page.');
      return;
    }
    setIsCreating(true);
    try {
      await readingListsApi.create({
        title: newTitle,
        courseCode: newCourseCode || undefined,
        semester: newSemester || undefined,
        status,
      });
      toast.success('Reading list created as draft!');
      setShowNewListModal(false);
      setNewTitle('');
      setNewCourseCode('');
      setNewSemester('Spring 2026');
      await fetchReadingLists();
    } catch {
      toast.error('Failed to create reading list');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteList = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await readingListsApi.remove(id);
      toast.success('Reading list deleted');
      await fetchReadingLists();
    } catch {
      toast.error('Failed to delete reading list');
    }
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
          {greeting()}, {user?.name ? `Dr. ${user.name.split(' ').pop()}` : 'Professor'}! 👋
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Welcome to your instructor dashboard. Manage your courses and access academic resources.
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
              <FileText className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{readingLists.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Course Reading Lists</p>
            </div>
          </div>
        </div>

        <Link href="/dashboard/instructor/following" className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {followingCount}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Following</p>
            </div>
          </div>
        </Link>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.maxBorrowDays || 30}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Days Borrow Limit</p>
            </div>
          </div>
        </div>
      </div>

      {/* Course Reading Lists */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Course Reading Lists</h2>
          <button
            onClick={() => setShowNewListModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Create New List
          </button>
        </div>
        <div className="p-5">
          {readingLists.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No reading lists yet</p>
              <button
                onClick={() => setShowNewListModal(true)}
                className="mt-3 text-primary-600 dark:text-primary-400 hover:underline"
              >
                Create your first reading list
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {readingLists.map((list) => (
                <div
                  key={list.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-primary-200 dark:hover:border-primary-800 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{list.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {list._count.items} book{list._count.items !== 1 ? 's' : ''}
                        {list.semester ? ` • ${list.semester}` : ''}
                        {list.courseCode ? ` • ${list.courseCode}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full font-medium',
                          list.status === 'PUBLISHED'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : list.status === 'DRAFT'
                            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        )}
                      >
                        {list.status || 'DRAFT'}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full font-medium',
                          list.visibility === 'PUBLIC'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : list.visibility === 'FOLLOWERS_ONLY'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        )}
                      >
                        {list.visibility === 'FOLLOWERS_ONLY' ? 'Followers' : list.visibility || 'PUBLIC'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                    <Link
                      href={`/dashboard/instructor/reading-lists/${list.id}`}
                      className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      Manage List <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => handleDeleteList(list.id, list.title)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Share Research Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Share Your Research</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Want to share your publications or research papers with students? Contact the library admin to upload your materials.
            </p>
            <button
              onClick={handleContactAdmin}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Contact Library Admin
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/dashboard/catalog"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-md transition-all group"
        >
          <Search className="w-8 h-8 text-primary-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
            Search Catalog
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Find books for your courses</p>
        </Link>

        <Link
          href="/dashboard/ai-assistant"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-md transition-all group"
        >
          <Sparkles className="w-8 h-8 text-purple-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
            AI Academic Assistant
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Advanced teaching support</p>
        </Link>

        <Link
          href="/dashboard/instructor/reading-lists"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-green-200 dark:hover:border-green-800 hover:shadow-md transition-all group"
        >
          <ListChecks className="w-8 h-8 text-green-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400">
            Manage Reading Lists
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update course materials</p>
        </Link>

        <Link
          href="/dashboard/instructor/following"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-amber-200 dark:hover:border-amber-800 hover:shadow-md transition-all group"
        >
          <Users className="w-8 h-8 text-amber-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
            Following
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Instructors you follow</p>
        </Link>

        <Link
          href="/dashboard/profile"
          className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md transition-all group"
        >
          <UserCircle className="w-8 h-8 text-indigo-500 mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {hasProfile ? 'Manage Profile' : 'Create Profile'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {hasProfile ? 'Update your public profile' : 'Add bio, department & courses'}
          </p>
        </Link>
      </div>

      {/* Create New List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Reading List
            </h3>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  List Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Introduction to Computer Science"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Course Code (optional)
                </label>
                <input
                  type="text"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., CS101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Semester (optional)
                </label>
                <select
                  value={newSemester}
                  onChange={(e) => setNewSemester(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="Spring 2026">Spring 2026</option>
                  <option value="Fall 2025">Fall 2025</option>
                  <option value="Summer 2026">Summer 2026</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewListModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreating || !newTitle.trim()}
                  onClick={() => handleCreateList('DRAFT')}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  disabled={isCreating || !newTitle.trim()}
                  onClick={() => handleCreateList('PUBLISHED')}
                  className="px-4 py-2 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50 text-sm"
                  title="Add books first, then publish"
                >
                  Publish Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Admin Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Contact Library Admin
            </h3>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Request to upload research paper"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Describe your request..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Attachment (Optional)
                </label>
                <input
                  type="file"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  accept=".pdf,.doc,.docx"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
