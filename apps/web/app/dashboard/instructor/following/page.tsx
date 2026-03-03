'use client';

import { useEffect, useState } from 'react';
import { Users, UserMinus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { followersApi } from '@/lib/api';
import { FollowedInstructor } from '@/types';

export default function FollowingPage() {
  const [following, setFollowing] = useState<FollowedInstructor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFollowing = async () => {
    try {
      const data = await followersApi.getMyFollowing();
      setFollowing(data);
    } catch {
      toast.error('Failed to load following list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowing();
  }, []);

  const handleUnfollow = async (instructorId: string, name: string) => {
    try {
      await followersApi.unfollow(instructorId);
      toast.success(`Unfollowed ${name}`);
      setFollowing((prev) => prev.filter((f) => f.instructorId !== instructorId));
    } catch {
      toast.error('Failed to unfollow');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/instructor"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Following</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Instructors you follow ({following.length})
          </p>
        </div>
      </div>

      {following.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">You are not following any instructors yet.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Browse the catalog or instructor profiles to follow instructors.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {following.map((entry) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4"
            >
              {entry.instructor.avatarUrl ? (
                <img
                  src={entry.instructor.avatarUrl}
                  alt={entry.instructor.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <span className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                    {entry.instructor.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {entry.instructor.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {entry.instructor.email}
                </p>
              </div>
              <button
                onClick={() => handleUnfollow(entry.instructorId, entry.instructor.name)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <UserMinus className="w-4 h-4" />
                Unfollow
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
