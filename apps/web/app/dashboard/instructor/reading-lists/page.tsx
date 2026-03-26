'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readingListsApi } from '@/lib/api';
import { ReadingList } from '@/types';

export default function ManageReadingListsPage() {
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readingListsApi
      .getMyLists()
      .then(setLists)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/instructor" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Reading Lists</h1>
        </div>
        <Link
          href="/dashboard/instructor"
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New List
        </Link>
      </div>

      {lists.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No reading lists yet. Create one from the dashboard.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/dashboard/instructor/reading-lists/${list.id}`}
              className="block glass-card glass-card-interactive p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{list.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {list._count.items} book{list._count.items !== 1 ? 's' : ''}
                    {list.semester ? ` · ${list.semester}` : ''}
                    {list.courseCode ? ` · ${list.courseCode}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
