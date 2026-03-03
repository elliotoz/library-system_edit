'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lock, Users } from 'lucide-react';
import { readingListsApi } from '@/lib/api';
import { ReadingList } from '@/types';

export default function ReadingListDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [list, setList] = useState<ReadingList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    readingListsApi
      .getById(id)
      .then(setList)
      .catch(() => setError('Reading list not found or not accessible'))
      .finally(() => setIsLoading(false));
  }, [id]);

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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">{error || 'Not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/reading-lists" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft className="w-4 h-4" /> Back to feed
      </Link>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
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
          <span className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" /> {list._count.items} book{list._count.items !== 1 ? 's' : ''}
          </span>
          {list.courseCode && <span>{list.courseCode}</span>}
          {list.semester && <span>{list.semester}</span>}
        </div>
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
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4"
            >
              <span className="text-sm font-medium text-gray-400 w-6 text-center">{index + 1}</span>
              <div className="w-12 h-16 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                {item.book.coverImageUrl ? (
                  <img src={item.book.coverImageUrl} alt={item.book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-gray-400" />
                  </div>
                )}
              </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
