'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Users,
  BookMarked,
  Clock,
  AlertTriangle,
  UserPlus,
  Plus,
  BarChart3,
  ChevronRight,
  Activity,
  Sparkles,
  Brain,
  ArrowUpRight,
  BellRing,
  ShieldAlert,
  Bot,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import { Spotlight } from '@/components/ui/spotlight';

interface AdminStats {
  totalBooks: number;
  activeUsers: number;
  currentlyBorrowed: number;
  pendingReservations: number;
  overdueBooks: number;
  newUsersThisWeek: number;
}

interface ActivityItem {
  type: string;
  message: string;
  time: string;
}

const CONTAINER_MOTION = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: 'easeOut' as const },
};

function getOpsStatus(pendingReservations: number, overdueBooks: number) {
  const critical = pendingReservations + overdueBooks;
  if (critical >= 20) return { label: 'High attention', tone: 'text-rose-100 bg-rose-400/15 border-rose-300/20' };
  if (critical >= 8) return { label: 'Watch closely', tone: 'text-amber-100 bg-amber-400/15 border-amber-300/20' };
  return { label: 'Stable flow', tone: 'text-emerald-100 bg-emerald-400/15 border-emerald-300/20' };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activityRes] = await Promise.all([
          api.get('/dashboard/admin').catch(() => null),
          api.get('/dashboard/activity').catch(() => null),
        ]);
        if (statsRes?.data) setStats(statsRes.data);
        if (activityRes?.data) setActivities(activityRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 rounded-[28px] bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="h-72 rounded-[28px] bg-gray-200 dark:bg-gray-700" />
          <div className="h-72 rounded-[28px] bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Books',
      value: stats?.totalBooks ?? 0,
      icon: BookOpen,
      iconBg: 'from-sky-400/30 to-blue-500/20',
      iconColor: 'text-sky-600 dark:text-sky-300',
      meta: 'Catalog inventory',
    },
    {
      label: 'Active Users',
      value: stats?.activeUsers ?? 0,
      icon: Users,
      iconBg: 'from-emerald-400/30 to-green-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-300',
      meta: 'Currently using the system',
    },
    {
      label: 'Currently Borrowed',
      value: stats?.currentlyBorrowed ?? 0,
      icon: BookMarked,
      iconBg: 'from-fuchsia-400/25 to-violet-500/15',
      iconColor: 'text-violet-600 dark:text-violet-300',
      meta: 'Active circulation load',
    },
    {
      label: 'Pending Reservations',
      value: stats?.pendingReservations ?? 0,
      icon: Clock,
      href: '/dashboard/admin/reservations',
      accent: 'border-l-amber-400',
      iconBg: 'from-amber-300/35 to-orange-500/15',
      iconColor: 'text-amber-600 dark:text-amber-300',
      meta: 'Needs review',
    },
    {
      label: 'Overdue Books',
      value: stats?.overdueBooks ?? 0,
      icon: AlertTriangle,
      href: '/dashboard/admin/books',
      accent: 'border-l-rose-400',
      iconBg: 'from-rose-300/35 to-red-500/15',
      iconColor: 'text-rose-600 dark:text-rose-300',
      meta: 'Requires follow-up',
    },
    {
      label: 'New Users This Week',
      value: stats?.newUsersThisWeek ?? 0,
      icon: UserPlus,
      href: '/dashboard/admin/users',
      accent: 'border-l-teal-400',
      iconBg: 'from-teal-300/35 to-cyan-500/15',
      iconColor: 'text-teal-600 dark:text-teal-300',
      meta: 'Recent signups',
    },
  ];

  const focusActions = [
    {
      label: 'Manage Reservations',
      description: `${stats?.pendingReservations ?? 0} pending requests waiting for admin review.`,
      href: '/dashboard/admin/reservations',
      icon: BellRing,
      style: 'text-amber-700 dark:text-amber-200',
      surface: 'from-amber-300/20 to-transparent',
    },
    {
      label: 'Review Overdue Loans',
      description: `${stats?.overdueBooks ?? 0} overdue items need outreach or enforcement.`,
      href: '/dashboard/admin/borrows',
      icon: ShieldAlert,
      style: 'text-rose-700 dark:text-rose-200',
      surface: 'from-rose-300/20 to-transparent',
    },
    {
      label: 'Maintain Book Catalog',
      description: 'Create or update records before demand spikes across branches.',
      href: '/dashboard/admin/books/new',
      icon: Plus,
      style: 'text-sky-700 dark:text-sky-200',
      surface: 'from-sky-300/20 to-transparent',
    },
    {
      label: 'Export Reports',
      description: 'Open reporting tools for trends, usage summaries, and audits.',
      href: '/dashboard/admin/reports',
      icon: BarChart3,
      style: 'text-violet-700 dark:text-violet-200',
      surface: 'from-violet-300/20 to-transparent',
    },
  ];

  const aiPrompts = [
    'Summarize reservation backlog by urgency',
    'Show overdue borrowing trends by category',
    'Highlight unusual circulation activity today',
    'Identify user growth changes this week',
  ];

  const criticalCount = (stats?.pendingReservations ?? 0) + (stats?.overdueBooks ?? 0);
  const opsStatus = getOpsStatus(stats?.pendingReservations ?? 0, stats?.overdueBooks ?? 0);

  return (
    <div className="space-y-6">
      <motion.section {...CONTAINER_MOTION}>
        <GlassCard
          liquid
          className="relative overflow-hidden rounded-[30px] border border-white/10 p-6 sm:p-7"
          style={{
            background:
              'linear-gradient(135deg, rgba(4,14,27,0.88) 0%, rgba(10,30,46,0.82) 56%, rgba(7,24,39,0.9) 100%)',
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <Spotlight className="left-[45%] top-[-38%] opacity-100" fill="#5eead4" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_28%),radial-gradient(circle_at_left,rgba(56,189,248,0.12),transparent_24%)]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
            <div className="absolute right-5 top-5 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-teal-200/85">{greeting()}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {user?.name?.split(' ')[0] || 'Admin'} control center
                </h1>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-100/85">
                  Administrator
                </span>
                <span className={cn('rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]', opsStatus.tone)}>
                  {opsStatus.label}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/78 sm:text-base">
                Monitor circulation health, resolve operational risks, and move directly into the highest-priority library workflows.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Reservations</p>
                  <p className="mt-1 text-lg font-semibold text-white">{(stats?.pendingReservations ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Overdue</p>
                  <p className="mt-1 text-lg font-semibold text-white">{(stats?.overdueBooks ?? 0).toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">New users</p>
                  <p className="mt-1 text-lg font-semibold text-white">{(stats?.newUsersThisWeek ?? 0).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Critical Queue</p>
                <p className="mt-2 text-3xl font-semibold text-white">{criticalCount}</p>
                <p className="mt-1 text-xs text-white/60">Pending + overdue items</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.22em] text-white/45">Active Circulation</p>
                <p className="mt-2 text-3xl font-semibold text-white">{(stats?.currentlyBorrowed ?? 0).toLocaleString()}</p>
                <p className="mt-1 text-xs text-white/60">Books currently out</p>
              </div>
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-4 backdrop-blur-md">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Brain className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-[0.22em]">AI Ops</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">Assistant is ready for admin queries</p>
                <p className="mt-1 text-xs text-cyan-100/70">Use summaries and anomaly checks without leaving the dashboard.</p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.35 }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
      >
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          const content = (
            <GlassCard
              liquid={index === 0}
              className={cn(
                'group relative h-full overflow-hidden rounded-[26px] border border-white/10 p-5',
                'transition-transform duration-200 hover:-translate-y-0.5',
                card.accent
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-70" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-white/62">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    {card.value.toLocaleString()}
                  </p>
                  <div className="mt-3 h-px w-12 bg-gradient-to-r from-cyan-400/45 to-transparent" />
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">
                    {card.meta}
                  </p>
                </div>
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br', card.iconBg)}>
                  <Icon className={cn('h-5 w-5', card.iconColor)} />
                </div>
              </div>
              {card.href && (
                <div className="relative mt-5 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-white/65">
                  <span>Open details</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              )}
            </GlassCard>
          );

          return card.href ? (
            <Link key={card.label} href={card.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={card.label}>{content}</div>
          );
        })}
      </motion.section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
        >
          <GlassCard className="overflow-hidden rounded-[30px] border border-white/10">
            <div className="border-b border-black/[0.06] px-5 py-5 dark:border-white/[0.06] sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-cyan-700 dark:text-cyan-200/80">Today&apos;s Focus</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    Priority admin actions
                  </h2>
                </div>
                <Link
                  href="/dashboard/admin/reports"
                  className="glass-button self-start px-4 py-2 text-xs font-semibold sm:text-sm"
                >
                  <BarChart3 className="h-4 w-4" />
                  Open reports
                </Link>
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              {focusActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Link key={action.label} href={action.href} className="block">
                    <GlassCard
                      beams={index === 0}
                      liquid={index === 0}
                      className="group relative h-full overflow-hidden rounded-[24px] border border-white/10 p-5 transition-transform duration-200 hover:-translate-y-1"
                    >
                      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', action.surface)} />
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/10', action.style)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-gray-400 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-white/45" />
                        </div>
                        <div className="mt-4">
                          <span className="rounded-full border border-black/5 bg-white/55 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-gray-500 dark:border-white/10 dark:bg-white/8 dark:text-white/50">
                            {index === 0 ? 'Immediate' : index === 1 ? 'Attention' : index === 2 ? 'Catalog' : 'Reporting'}
                          </span>
                        </div>
                        <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-white">{action.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-white/68">{action.description}</p>
                        <div className="mt-5 text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-white/42">
                          Open workflow
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                );
              })}
            </div>
          </GlassCard>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          className="space-y-6"
        >
          <GlassCard className="overflow-hidden rounded-[30px] border border-white/10">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.06]">
              <div>
                <p className="text-sm text-gray-500 dark:text-white/55">Live activity</p>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Operations feed</h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                <Activity className="h-4 w-4 text-gray-500 dark:text-white/70" />
              </div>
            </div>
            <div className="p-5">
              {activities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center dark:border-white/10">
                  <Activity className="mx-auto h-9 w-9 text-gray-300 dark:text-white/25" />
                  <p className="mt-3 text-sm text-gray-500 dark:text-white/55">No recent activity</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="mb-4 rounded-2xl border border-black/[0.05] bg-black/[0.02] px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-white/35">Feed summary</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-white/68">
                      {activities.length} recent event{activities.length === 1 ? '' : 's'} across circulation and admin activity.
                    </p>
                  </div>
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-400/45 via-cyan-400/20 to-transparent" />
                  <div className="space-y-4">
                    {activities.slice(0, 6).map((item, index) => {
                      const isBorrow = item.type === 'borrow';
                      const tone = isBorrow
                        ? 'bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300'
                        : item.type === 'user'
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300'
                          : 'bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300';

                      return (
                        <div key={`${item.time}-${index}`} className="relative flex items-start gap-4">
                          <div className={cn('relative z-10 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white dark:ring-[#101823]', tone)}>
                            {isBorrow ? <BookMarked className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1 rounded-2xl border border-black/[0.05] bg-white/50 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                            <p className="text-sm leading-6 text-gray-700 dark:text-white/80">{item.message}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-white/35">
                              {new Date(item.time).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard
            liquid
            className="relative overflow-hidden rounded-[30px] border border-cyan-300/15 p-5 sm:p-6"
            style={{
              background:
                'linear-gradient(180deg, rgba(17,58,74,0.18) 0%, rgba(8,19,31,0.06) 100%)',
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_25%),radial-gradient(circle_at_left,rgba(125,211,252,0.14),transparent_20%)]" />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-200">
                    <Bot className="h-4 w-4" />
                    <p className="text-sm font-medium">AI operations assistant</p>
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">Ask for admin insights</h2>
                </div>
                <Link
                  href="/dashboard/ai-assistant"
                  className="glass-button glass-button-primary relative inline-flex items-center justify-center gap-2 overflow-hidden px-4 py-2 text-xs font-semibold sm:text-sm"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-px overflow-hidden"
                    style={{ borderRadius: 'inherit' }}
                  >
                    <div className="beam beam-top" />
                    <div className="beam beam-right" />
                    <div className="beam beam-bottom" />
                    <div className="beam beam-left" />
                  </div>
                  <Sparkles className="relative z-10 h-4 w-4" />
                  <span className="relative z-10">Open AI</span>
                </Link>
              </div>

              <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-white/70">
                Use the assistant to summarize risk, spot anomalies, and move from overview to action without leaving the admin workflow.
              </p>

              <div className="mt-5 space-y-3">
                {aiPrompts.map((prompt) => (
                  <Link
                    key={prompt}
                    href="/dashboard/ai-assistant"
                    className="block rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-gray-700 transition-colors hover:bg-white/15 dark:text-white/82"
                  >
                    {prompt}
                  </Link>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.section>
      </div>
    </div>
  );
}
