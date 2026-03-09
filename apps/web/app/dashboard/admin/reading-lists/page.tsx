'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readingListsApi } from '@/lib/api';
import { ReadingList } from '@/types';

export default function AdminReadingListsPage() {
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readingListsApi
      .getAllForModeration()
      .then(setLists)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reading Lists Moderation</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          All non-archived reading lists across the platform
        </p>
      </div>

      {lists.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No reading lists to moderate.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Owner</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Visibility</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Books</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Updated</th>
              </tr>
            </thead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/reading-lists/${list.id}`}
                      className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      {list.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {list.owner ? (
                      <Link
                        href={`/dashboard/instructors/${list.ownerId}`}
                        className="hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {list.owner.name}
                      </Link>
                    ) : (
                      list.ownerId
                    )}
                  </td>
                  <td className="px-4 py-3">
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
                      {list.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
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
                      {list.visibility === 'FOLLOWERS_ONLY' ? 'Followers' : list.visibility}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{list._count.items}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {new Date(list.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
