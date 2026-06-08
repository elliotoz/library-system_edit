'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  Brain,
  CheckCircle2,
  ClipboardList,
  LibraryBig,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

type GuideRole = 'STUDENT' | 'INSTRUCTOR' | 'STAFF' | 'ADMIN';

interface GuideSection {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  items: string[];
}

const roleLabels: Record<GuideRole, string> = {
  STUDENT: 'Student',
  INSTRUCTOR: 'Instructor',
  STAFF: 'Staff',
  ADMIN: 'Admin / Librarian',
};

const roleSections: Record<GuideRole, GuideSection[]> = {
  STUDENT: [
    {
      title: 'Find and use catalog books',
      description: 'Search by title, author, subject, or topic, then open a book page to inspect copies, e-book links, and Study Help.',
      icon: Search,
      items: [
        'Use Book Catalog for title, author, subject, ISBN, and topic searches.',
        'Open a book detail page to see availability and reserve a copy when one is available.',
        'Use My Borrowed Books, Reservations, Borrow History, and Fines to track your account.',
      ],
    },
    {
      title: 'Study Help and OZ AI',
      description: 'Start Study Help from a book detail page when you want OZ to tutor you from that selected book.',
      icon: Brain,
      items: [
        'Ask OZ to teach, quiz, summarize, explain, create roadmaps, generate practice tasks, or build checklists.',
        'Inside a book Study Help session, OZ assumes your question is about the selected book.',
        'To switch books, open Study Help from another book page or clearly mention the full book title.',
      ],
    },
  ],
  INSTRUCTOR: [
    {
      title: 'Course materials and reading lists',
      description: 'Share approved academic materials and use reading lists to guide students through course resources.',
      icon: Upload,
      items: [
        'Submit materials from Instructor Tools so they can be reviewed and made available.',
        'Create reading lists for courses, units, or recommended study paths.',
        'Ask OZ to draft reading-list descriptions and organize books by learning progression.',
      ],
    },
    {
      title: 'Teaching with OZ AI',
      description: 'Use OZ to turn catalog books and uploaded materials into teaching support.',
      icon: ClipboardList,
      items: [
        'Generate quiz questions, practice prompts, and checkpoint questions.',
        'Summarize uploaded materials when they are available to OZ.',
        'Ask for course plans, weekly roadmaps, prerequisites, and student-friendly explanations.',
      ],
    },
  ],
  STAFF: [
    {
      title: 'Professional development',
      description: 'Find books that support your role, department, or personal learning goals.',
      icon: LibraryBig,
      items: [
        'Search the catalog for professional topics, tools, leadership, communication, or technical skills.',
        'Reserve and borrow books using the same catalog and account tools as other library users.',
        'Use OZ for quick summaries, practical recommendations, and simple explanations.',
      ],
    },
    {
      title: 'Ask focused questions',
      description: 'Short, direct prompts usually work best for fast answers.',
      icon: MessageSquareText,
      items: [
        'Ask for beginner-friendly explanations when a topic is unfamiliar.',
        'Ask OZ to compare books or recommend what to read first.',
        'Mention your department or goal when you want role-specific recommendations.',
      ],
    },
  ],
  ADMIN: [
    {
      title: 'Catalog and indexing workflow',
      description: 'Add real books, attach PDFs, and monitor whether OZ can use indexed book content.',
      icon: ShieldCheck,
      items: [
        'Add real books from Manage Books and attach a local book PDF after saving.',
        'Watch AI Index status: pending, processing, indexed, failed, or not applicable.',
        'Use Re-index Books to queue eligible books with PDFs or direct PDF e-book URLs.',
      ],
    },
    {
      title: 'OZ AI for admin decisions',
      description: 'Use OZ to summarize live dashboard data and decide what the librarian should fix first.',
      icon: Sparkles,
      items: [
        'OZ can summarize real dashboard data from the admin snapshot.',
        'OZ can explain indexing health and the current RAG readiness of the catalog.',
        'OZ can check catalog metadata quality and identify books with missing fields.',
        'OZ can provide catalog and edit links for metadata issue books.',
        'OZ can recommend what the librarian should fix first.',
        'If dashboard data is missing, OZ should say what data is unavailable instead of inventing it.',
      ],
    },
  ],
};

const aiTips = [
  'Use direct words like teach, quiz, summarize, roadmap, explain, practice, and checklist.',
  'If you are inside Study Help, OZ assumes the selected book or material is the context.',
  'To switch books, start Study Help from the new book or clearly mention the full title.',
  'For chapter questions, ask OZ to use indexed content and say whether the result is complete or partial.',
  'If indexing is still pending, wait or ask the librarian/admin to re-index.',
];

const promptExamplesByRole: Record<GuideRole, string[]> = {
  STUDENT: [
    'Teach me [topic] from [book title] at beginner level.',
    'Quiz me on [topic] using indexed book content.',
    'Create a 5-day study roadmap for [book title].',
    'Summarize Chapter [number] from this book.',
    'Explain [topic] step by step and list prerequisites first.',
    'Show me practice tasks and checkpoint questions.',
    'Show me the table of contents from the indexed content and tell me if it is complete or partial.',
  ],
  INSTRUCTOR: [
    'Teach me [topic] from [book title] at beginner level.',
    'Quiz me on [topic] using indexed book content.',
    'Create a 5-day study roadmap for [book title].',
    'Summarize Chapter [number] from this book.',
    'Explain [topic] step by step and list prerequisites first.',
    'Show me practice tasks and checkpoint questions.',
    'Show me the table of contents from the indexed content and tell me if it is complete or partial.',
  ],
  STAFF: [
    'Teach me [topic] from [book title] at beginner level.',
    'Quiz me on [topic] using indexed book content.',
    'Create a 5-day study roadmap for [book title].',
    'Summarize Chapter [number] from this book.',
    'Explain [topic] step by step and list prerequisites first.',
    'Show me practice tasks and checkpoint questions.',
    'Show me the table of contents from the indexed content and tell me if it is complete or partial.',
  ],
  ADMIN: [
    'Summarize current library operations.',
    'Give me an indexing health report.',
    'Check catalog metadata quality.',
    'What should I fix first as librarian?',
    'Show me pending admin actions.',
  ],
};

function getGuideRole(role?: string): GuideRole {
  if (role === 'INSTRUCTOR' || role === 'STAFF' || role === 'ADMIN') return role;
  return 'STUDENT';
}

export default function UserGuidePage() {
  const { user } = useAuth();
  const guideRole = getGuideRole(user?.role);
  const sections = roleSections[guideRole];
  const promptExamples = promptExamplesByRole[guideRole];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Guide</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Learn how to use the library system and OZ AI effectively.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-900/25 dark:text-primary-300">
          <CheckCircle2 className="h-4 w-4" />
          {roleLabels[guideRole]} guide
        </span>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <article
              key={section.title}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{section.title}</h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{section.description}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Prompt examples for OZ AI</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Replace the bracketed text with your book, chapter, or topic.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {promptExamples.map((example) => (
            <div
              key={example}
              className={cn(
                'rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
                example.includes('table of contents') && 'sm:col-span-2',
              )}
            >
              {example}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI usage tips</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Small wording changes can make OZ more reliable.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {aiTips.map((tip) => (
              <li key={tip} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
              <Route className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick links</h2>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/dashboard/catalog"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Open Book Catalog
            </Link>
            <Link
              href="/dashboard/ai-assistant"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Open OZ AI
            </Link>
            {guideRole === 'INSTRUCTOR' && (
              <Link
                href="/dashboard/instructor/submit-material"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Submit Material
              </Link>
            )}
            {guideRole === 'ADMIN' && (
              <Link
                href="/dashboard/admin/books"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Manage Books
              </Link>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
