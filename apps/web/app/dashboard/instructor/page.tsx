'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen, FileText, Users, Calendar, Plus, ArrowRight,
  Sparkles, Search, ListChecks, Mail, Trash2, UserCircle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { readingListsApi, followersApi } from '@/lib/api';
import { ReadingList } from '@/types';

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

  const [newTitle, setNewTitle] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newSemester, setNewSemester] = useState('Spring 2026');

  const fetchReadingLists = useCallback(async () => {
    try {
      setReadingLists(await readingListsApi.getMyLists());
    } catch {}
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('/api/dashboard/instructor', { credentials: 'include' }).catch(() => null);
        if (statsRes?.ok) setStats(await statsRes.json());
        await fetchReadingLists();
        try {
          const f = await followersApi.getMyFollowing();
          setFollowingCount(f.length);
        } catch {}
        if (user?.id) {
          try {
            const r = await fetch(`/api/users/${user.id}`, { credentials: 'include' });
            if (r.ok) {
              const d = await r.json();
              setHasProfile(!!(d.bio || d.department || d.courses?.length));
            }
          } catch {}
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [fetchReadingLists]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleCreateList = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (isCreating || !newTitle.trim()) return;
    if (status === 'PUBLISHED') {
      toast.error('Cannot publish a reading list with no books. Add books first, then publish from the manage page.');
      return;
    }
    setIsCreating(true);
    try {
      await readingListsApi.create({ title: newTitle, courseCode: newCourseCode || undefined, semester: newSemester || undefined, status });
      toast.success('Reading list created as draft!');
      setShowNewListModal(false);
      setNewTitle(''); setNewCourseCode(''); setNewSemester('Spring 2026');
      await fetchReadingLists();
    } catch { toast.error('Failed to create reading list'); }
    finally { setIsCreating(false); }
  };

  const handleDeleteList = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await readingListsApi.remove(id);
      toast.success('Reading list deleted');
      await fetchReadingLists();
    } catch { toast.error('Failed to delete reading list'); }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Message sent to library admin!');
    setShowContactModal(false);
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
          <button onClick={() => setShowNewListModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> New List
          </button>
        </div>
        <div className="p-5">
          {readingLists.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No reading lists yet</p>
              <button onClick={() => setShowNewListModal(true)}
                className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 transition-colors">
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
            Want to share publications or research papers with students? Contact the library admin to upload your materials.
          </p>
          <button onClick={() => setShowContactModal(true)}
            className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
            Contact Library Admin
          </button>
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

      {/* ── Create New List Modal ── */}
      {showNewListModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Create New Reading List</h3>
              <button onClick={() => setShowNewListModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none">
                ×
              </button>
            </div>
            <form onSubmit={(e) => e.preventDefault()} className="p-6 space-y-4">
              {[
                { label: 'List Title', value: newTitle, onChange: setNewTitle, placeholder: 'e.g., Introduction to Computer Science', required: true },
                { label: 'Course Code (optional)', value: newCourseCode, onChange: setNewCourseCode, placeholder: 'e.g., CS101', required: false },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{f.label}</label>
                  <input type="text" required={f.required} value={f.value} onChange={(e) => f.onChange(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Semester (optional)</label>
                <select value={newSemester} onChange={(e) => setNewSemester(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm">
                  <option>Spring 2026</option>
                  <option>Fall 2025</option>
                  <option>Summer 2026</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNewListModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="button" disabled={isCreating || !newTitle.trim()} onClick={() => handleCreateList('DRAFT')}
                  className="flex-1 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                  {isCreating ? 'Creating…' : 'Save Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Contact Admin Modal ── */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Contact Library Admin</h3>
              <button onClick={() => setShowContactModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none">
                ×
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Subject</label>
                <input type="text" required placeholder="e.g., Request to upload research paper"
                  className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Message</label>
                <textarea required rows={4} placeholder="Describe your request…"
                  className="w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Attachment (optional)</label>
                <input type="file" accept=".pdf,.doc,.docx"
                  className="w-full px-3.5 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowContactModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" /> Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
