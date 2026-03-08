'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lock, Users, UserPlus, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { readingListsApi, followersApi } from '@/lib/api';
import { InstructorProfile } from '@/types';
import { useAuth } from '@/hooks/useAuth';

export default function InstructorProfilePage() {
  const params = useParams();
  const instructorId = params.id as string;
  const { user } = useAuth();
  const [profile, setProfile] = useState<InstructorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState('');

  const fetchProfile = async () => {
    try {
      const data = await readingListsApi.getInstructorProfile(instructorId);
      setProfile(data);
    } catch {
      setError('Instructor not found');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [instructorId]);

  const handleToggleFollow = async () => {
    if (!profile || isToggling) return;
    setIsToggling(true);
    try {
      if (profile.isFollowing) {
        await followersApi.unfollow(instructorId);
        toast.success(`Unfollowed ${profile.instructor.name}`);
      } else {
        await followersApi.follow(instructorId);
        toast.success(`Following ${profile.instructor.name}`);
      }
      await fetchProfile();
    } catch {
      toast.error(profile.isFollowing ? 'Failed to unfollow' : 'Failed to follow');
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/reading-lists" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">{error || 'Not found'}</p>
        </div>
      </div>
    );
  }

  const isSelf = user?.id === instructorId;
  const { instructor } = profile;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/reading-lists" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft className="w-4 h-4" /> Back to feed
      </Link>

      {/* Instructor header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-5">
        {instructor.avatarUrl ? (
          <img src={instructor.avatarUrl} alt={instructor.name} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <span className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
              {instructor.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{instructor.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{instructor.email}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            <Users className="w-3.5 h-3.5 inline mr-1" />
            {profile.followersCount} follower{profile.followersCount !== 1 ? 's' : ''}
            {' · '}
            {profile.readingLists.length} reading list{profile.readingLists.length !== 1 ? 's' : ''}
          </p>
        </div>
        {!isSelf && (
          <button
            onClick={handleToggleFollow}
            disabled={isToggling}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
              profile.isFollowing
                ? 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            )}
          >
            {profile.isFollowing ? (
              <>
                <UserMinus className="w-4 h-4" /> Unfollow
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Follow
              </>
            )}
          </button>
        )}
      </div>

      {/* Bio, Department, Courses */}
      {(instructor.bio || instructor.department || (instructor.courses && instructor.courses.length > 0)) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          {instructor.bio && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">About</h3>
              <p className="text-gray-900 dark:text-white">{instructor.bio}</p>
            </div>
          )}
          {instructor.department && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Department</h3>
              <p className="text-gray-900 dark:text-white">{instructor.department}</p>
            </div>
          )}
          {instructor.courses && instructor.courses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Courses</h3>
              <div className="flex flex-wrap gap-2">
                {instructor.courses.map((course) => (
                  <span
                    key={course}
                    className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                  >
                    {course}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reading lists */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reading Lists</h2>
        {profile.readingLists.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No reading lists published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.readingLists.map((list) => (
              <div
                key={list.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <Link
                    href={`/dashboard/reading-lists/${list.id}`}
                    className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                  >
                    {list.title}
                  </Link>
                  {list.locked && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 ml-2">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>
                {!list.locked && list.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{list.description}</p>
                )}
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span>{list._count.items} book{list._count.items !== 1 ? 's' : ''}</span>
                  {!list.locked && list.courseCode && <span>{list.courseCode}</span>}
                  {!list.locked && list.semester && <span>{list.semester}</span>}
                </div>
                {list.locked && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Follow to unlock content
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
