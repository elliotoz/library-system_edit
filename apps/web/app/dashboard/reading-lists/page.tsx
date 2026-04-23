'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { BookOpen, Lock, Users, FileText, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readingListsApi } from '@/lib/api';
import { ReadingList } from '@/types';

export default function ReadingListsFeedPage() {
  const [lists, setLists] = useState<ReadingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    readingListsApi
      .getFeed()
      .then(setLists)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reading Lists</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Discover reading lists published by instructors
        </p>
      </div>

      {isAdmin && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-300">
            As an administrator, you can moderate all reading lists from the{' '}
            <Link href="/dashboard/admin/reading-lists" className="font-semibold underline">
              Admin Reading Lists Dashboard
            </Link>
            .
          </p>
        </div>
      )}

      {!isAdmin && (
        <>
          {lists.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No reading lists available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lists.map((list) => (
                <div
                  key={list.id}
                  className="glass-card glass-card-interactive p-5"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/dashboard/reading-lists/${list.id}`}
                        className="font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {list.title}
                      </Link>
                      {!list.locked && list.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {list.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {list.locked && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                          <Lock className="w-3 h-3" /> Followers only
                        </span>
                      )}
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded-full font-medium',
                          list.visibility === 'PUBLIC'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}
                      >
                        {list.visibility === 'PUBLIC' ? 'Public' : 'Followers'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    {list.owner && (
                      <>
                        <Link
                          href={`/dashboard/instructors/${list.ownerId}`}
                          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {list.owner.name}
                        </Link>
                        <Link
                          href={`/dashboard/instructors/${list.ownerId}`}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          View Profile <ArrowRight className="w-3 h-3" />
                        </Link>
                      </>
                    )}
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {list._count.items} book{list._count.items !== 1 ? 's' : ''}
                    </span>
                    {!list.locked && list.courseCode && <span>{list.courseCode}</span>}
                    {!list.locked && list.semester && <span>{list.semester}</span>}
                  </div>

                  {!list.locked && list.items.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-hidden">
                      {list.items.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="flex-shrink-0 w-10 h-14 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden"
                        >
                          {item.book.coverImageUrl ? (
                            <img
                              src={item.book.coverImageUrl}
                              alt={item.book.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400 p-0.5 text-center leading-tight">
                              {item.book.title.slice(0, 20)}
                            </div>
                          )}
                        </div>
                      ))}
                      {list._count.items > 4 && (
                        <div className="flex-shrink-0 w-10 h-14 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500">
                          +{list._count.items - 4}
                        </div>
                      )}
                    </div>
                  )}

                  {list.locked && (
                    <div className="mt-3 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Follow this instructor to view list contents.{' '}
                        <Link
                          href={`/dashboard/instructors/${list.ownerId}`}
                          className="underline font-medium"
                        >
                          View profile
                        </Link>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
