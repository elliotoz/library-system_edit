'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen, FileText, Users, Calendar, Plus, ArrowRight,
  Sparkles, Search, ListChecks, Trash2, UserCircle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { readingListsApi, followersApi } from '@/lib/api';
import { ReadingList, InstructorFollower } from '@/types';

interface InstructorStats {
  borrowedBooks: number;
  maxBorrowDays: number;
  maxBooks: number;
}

export default function InstructorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [readingLists, setReadingLists] = useState<ReadingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [followingCount, setFollowingCount] = useState(0);
  const [followers, setFollowers] = useState<InstructorFollower[]>([]);
  const [hasProfile, setHasProfile] = useState(false);

  const fetchReadingLists = useCallback(async () => {
    try {
      setReadingLists(await readingListsApi.getMyLists());
    } catch {}
  }, []);

  const fetchProfileCompletion = useCallback(async (userId: string) => {
    try {
      const r = await fetch(`/api/users/${userId}`, { credentials: 'include' });
      if (r.ok) {
        const d = await r.json();
        setHasProfile(!!(d.bio || d.department || d.courses?.length));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('/api/dashboard/instructor', { credentials: 'include' }).catch(() => null);
        if (statsRes?.ok) setStats(await statsRes.json());
        await fetchReadingLists();
        try {
          const [following, myFollowers] = await Promise.all([
            followersApi.getMyFollowing(),
            followersApi.getMyFollowers(),
          ]);
          setFollowingCount(following.length);
          setFollowers(myFollowers);
        } catch {}
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [fetchReadingLists]);

  useEffect(() => {
    if (user?.id) {
      fetchProfileCompletion(user.id);
    }
  }, [fetchProfileCompletion, user?.id]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleNewList = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newList = await readingListsApi.create({ title: 'Untitled Reading List', status: 'DRAFT', visibility: 'PRIVATE' });
      router.push(`/dashboard/instructor/reading-lists/${newList.id}`);
    } catch {
      toast.error('Failed to create reading list');
      setIsCreating(false);
    }
  };

  const handleDeleteList = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await readingListsApi.remove(id);
      toast.success('Reading list deleted');
      await fetchReadingLists();
    } catch { toast.error('Failed to delete reading list'); }
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
    { label: 'Reading Lists', value: readingLists.length, icon: FileText, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-l-green-500' },
    { label: 'Following', value: followingCount, icon: Users, href: '/dashboard/instructor/following', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-l-purple-500' },
    { label: 'Days Borrow Limit', value: stats?.maxBorrowDays ?? 30, icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-l-amber-500' },
  ];

  const quickActions = [
    { href: '/dashboard/catalog', icon: Search, label: 'Search Catalog', desc: 'Find books for your courses', color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-900/30', hover: 'hover:border-primary-300 dark:hover:border-primary-700' },
    { href: '/dashboard/ai-assistant', icon: Sparkles, label: 'AI Assistant', desc: 'Advanced academic support', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30', hover: 'hover:border-purple-300 dark:hover:border-purple-700' },
    { href: '/dashboard/instructor/reading-lists', icon: ListChecks, label: 'Reading Lists', desc: 'Update course materials', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30', hover: 'hover:border-green-300 dark:hover:border-green-700' },
    { href: '/dashboard/instructor/following', icon: Users, label: 'Following', desc: 'Instructors you follow', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/30', hover: 'hover:border-indigo-300 dark:hover:border-indigo-700' },
    { href: '/dashboard/profile', icon: UserCircle, label: hasProfile ? 'Manage Profile' : 'Create Profile', desc: hasProfile ? 'Update your public profile' : 'Add bio and courses', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30', hover: 'hover:border-rose-300 dark:hover:border-rose-700' },
  ];

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 p-6 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm font-medium mb-1">{greeting()}</p>
            <h1 className="text-2xl font-bold">
              {user?.name ? `Dr. ${user.name.split(' ').pop()}` : 'Professor'}
            </h1>
            <p className="text-indigo-200 text-sm mt-1">Manage your courses and academic resources</p>
          </div>
          <span className="hidden sm:block px-3 py-1 bg-white/15 rounded-full text-xs font-medium backdrop-blur-sm">
            Instructor
          </span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => {
          const inner = (
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', s.bg)}>
                <s.icon className={cn('w-5 h-5', s.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            </div>
          );
          return s.href ? (
            <Link key={i} href={s.href} className={cn('glass-card glass-card-interactive p-4 border-l-4', s.border)}>
              {inner}
            </Link>
          ) : (
            <div key={i} className={cn('glass-card p-4 border-l-4', s.border)}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* ── Course Reading Lists ── */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <h2 className="font-semibold text-gray-900 dark:text-white">Course Reading Lists</h2>
          <button onClick={handleNewList} disabled={isCreating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-60">
            <Plus className="w-3.5 h-3.5" /> {isCreating ? 'Creating…' : 'New List'}
          </button>
        </div>
        <div className="p-5">
          {readingLists.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No reading lists yet</p>
              <button onClick={handleNewList} disabled={isCreating}
                className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 transition-colors disabled:opacity-60">
                Create your first reading list
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {readingLists.map((list) => (
                <div key={list.id}
                  className="group rounded-xl border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-sm p-4 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight line-clamp-1">{list.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {list._count.items} book{list._count.items !== 1 ? 's' : ''}
                        {list.semester && ` · ${list.semester}`}
                        {list.courseCode && ` · ${list.courseCode}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={cn('px-2 py-0.5 text-[11px] rounded-full font-medium',
                        list.status === 'PUBLISHED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400')}>
                        {list.status || 'DRAFT'}
                      </span>
                      <span className={cn('px-2 py-0.5 text-[11px] rounded-full font-medium',
                        list.visibility === 'PUBLIC' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : list.visibility === 'FOLLOWERS_ONLY' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400')}>
                        {list.visibility === 'FOLLOWERS_ONLY' ? 'Followers' : list.visibility || 'PUBLIC'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <Link href={`/dashboard/instructor/reading-lists/${list.id}`}
                      className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1">
                      Manage <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button onClick={() => handleDeleteList(list.id, list.title)}
                      className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Share Research Banner ── */}
      <div className="flex items-start gap-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5">
        <div className="w-11 h-11 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Share Your Research</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Submit publications or research papers for library review. Once approved, they appear in Academic Materials for students.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/dashboard/instructor/submit-material"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
              Submit Research →
            </Link>
            <Link href="/dashboard/instructor/my-submissions"
              className="px-3 py-1.5 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-xs font-medium transition-colors">
              View My Submissions
            </Link>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href}
            className={cn('glass-card glass-card-interactive group flex items-center gap-4 p-4')}>
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110', a.bg)}>
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

      {/* ── Followers / Following Widget ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Your Followers ({followers.length})
          </h3>
          {followers.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No one is following you yet.</p>
          ) : (
            <ul className="space-y-2">
              {followers.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center gap-3">
                  {f.follower.avatarUrl ? (
                    <img src={f.follower.avatarUrl} alt={f.follower.name}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary-600 dark:text-primary-400">
                      {f.follower.name[0]}
                    </div>
                  )}
                  <span className="text-sm text-gray-700 dark:text-white/80 truncate">{f.follower.name}</span>
                  <span className="text-xs text-gray-400 capitalize ml-auto flex-shrink-0">{f.follower.role.toLowerCase()}</span>
                </li>
              ))}
              {followers.length > 5 && (
                <li className="text-xs text-primary-500 dark:text-primary-400">
                  +{followers.length - 5} more
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            You Follow ({followingCount})
          </h3>
          {followingCount === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              You are not following any instructors yet.
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You are following {followingCount} instructor{followingCount !== 1 ? 's' : ''}.
            </p>
          )}
          <Link href="/dashboard/instructor/following"
            className="mt-3 block text-xs text-primary-600 dark:text-primary-400 hover:underline">
            Manage following →
          </Link>
        </div>
      </div>


    </div>
  );
}
