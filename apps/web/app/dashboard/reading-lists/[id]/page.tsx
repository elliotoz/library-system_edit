'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lock, Users, UserPlus, UserMinus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { readingListsApi, followersApi } from '@/lib/api';
import { ReadingList } from '@/types';
import { useAuth } from '@/hooks/useAuth';

export default function ReadingListDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [list, setList] = useState<ReadingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    readingListsApi
      .getById(id)
      .then((data) => {
        setList(data);
        // Fetch follow status for non-self owners
        if (data.owner && user && data.ownerId !== user.id) {
          followersApi
            .isFollowing(data.ownerId)
            .then((status) => setIsFollowing(status.isFollowing))
            .catch(() => {});
        }
      })
      .catch(() => setError('Reading list not found or not accessible'))
      .finally(() => setIsLoading(false));
  }, [id, user]);

  const handleToggleFollow = async () => {
    if (!list?.owner || isToggling) return;
    setIsToggling(true);
    try {
      if (isFollowing) {
        await followersApi.unfollow(list.ownerId);
        setIsFollowing(false);
        toast.success(`Unfollowed ${list.owner.name}`);
      } else {
        await followersApi.follow(list.ownerId);
        setIsFollowing(true);
        toast.success(`Following ${list.owner.name}`);
      }
    } catch {
      toast.error(isFollowing ? 'Failed to unfollow' : 'Failed to follow');
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/reading-lists" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="w-4 h-4" /> Back to feed
        </Link>
        <div className="glass-card p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">{error || 'Not found'}</p>
        </div>
      </div>
    );
  }

  const isSelf = user?.id === list.ownerId;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/reading-lists" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft className="w-4 h-4" /> Back to feed
      </Link>

      <div className="glass-card p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{list.title}</h1>
        {list.description && (
          <p className="text-gray-500 dark:text-gray-400 mt-2">{list.description}</p>
        )}
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
          {list.owner && (
            <Link
              href={`/dashboard/instructors/${list.ownerId}`}
              className="flex items-center gap-1 hover:text-primary-600"
            >
              <Users className="w-4 h-4" /> {list.owner.name}
            </Link>
          )}
          {list.owner && (
            <Link
              href={`/dashboard/instructors/${list.ownerId}`}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              View Profile
            </Link>
          )}
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" /> {list._count.items} book{list._count.items !== 1 ? 's' : ''}
          </span>
          {list.courseCode && <span>{list.courseCode}</span>}
          {list.semester && <span>{list.semester}</span>}
        </div>
        {/* Inline follow/unfollow button (non-self only) */}
        {list.owner && !isSelf && (
          <div className="mt-4">
            <button
              onClick={handleToggleFollow}
              disabled={isToggling}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                isFollowing
                  ? 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'bg-primary-500 text-white hover:bg-primary-600'
              )}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="w-4 h-4" /> Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Follow
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {list.locked ? (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-6 flex items-center gap-3">
          <Lock className="w-6 h-6 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">Content locked</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              This reading list is for followers only.{' '}
              <Link href={`/dashboard/instructors/${list.ownerId}`} className="underline font-medium">
                Follow this instructor
              </Link>{' '}
              to unlock the book list.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {list.items.map((item, index) => (
            <div
              key={item.id}
              className="glass-card p-4 flex items-center gap-4"
            >
              <span className="text-sm font-medium text-gray-400 w-6 text-center">{index + 1}</span>
              <Link
                href={`/dashboard/catalog/${item.book.id}`}
                className="w-12 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0 block"
              >
                {item.book.coverImageUrl ? (
                  <img src={item.book.coverImageUrl} alt={item.book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-gray-400" />
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/dashboard/catalog/${item.book.id}`}
                  className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                >
                  {item.book.title}
                </Link>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {item.book.authors.join(', ')}
                </p>
                {item.notes && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{item.notes}</p>
                )}
              </div>
              <Link
                href={`/dashboard/catalog/${item.book.id}`}
                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open in Catalog</span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
