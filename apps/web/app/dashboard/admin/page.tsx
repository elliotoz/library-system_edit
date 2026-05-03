'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen, Users, BookMarked, Clock, AlertTriangle, UserPlus,
  BarChart3, ChevronRight, Activity, ArrowUpRight, BellRing,
  ShieldAlert, GraduationCap, Briefcase, Shield, Brain,
  BookCheck, CalendarClock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

// ── Types ──────────────────────────────────────────────────────────────────────

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

interface UserDistributionRow {
  role: 'STUDENT' | 'INSTRUCTOR' | 'STAFF';
  count: number;
  pct: number;
}

interface AiMetrics {
  period: string;
  totalConversations: number;
  totalMessages: number;
  uniqueUsers: number;
  responseRate: number;
  avgMessagesPerSession: number;
  activeAiUsersPct: number;
}

type AiPeriod = 'week' | 'month' | 'year';

// ── Helpers ────────────────────────────────────────────────────────────────────

const CONTAINER_MOTION = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: 'easeOut' as const },
};

function getOpsStatus(pendingReservations: number, overdueBooks: number) {
  const critical = pendingReservations + overdueBooks;
  if (critical >= 20) return { label: 'High attention', tone: 'text-rose-700 dark:text-rose-100 bg-rose-50 dark:bg-rose-400/15 border-rose-300 dark:border-rose-300/20' };
  if (critical >= 8)  return { label: 'Watch closely', tone: 'text-amber-700 dark:text-amber-100 bg-amber-50 dark:bg-amber-400/15 border-amber-300 dark:border-amber-300/20' };
  return { label: 'Stable flow', tone: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-500/20 border-teal-400 dark:border-teal-500' };
}

const ROLE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  STUDENT:    { label: 'Students',    icon: GraduationCap, color: 'text-sky-500' },
  INSTRUCTOR: { label: 'Instructors', icon: Briefcase,     color: 'text-violet-500' },
  STAFF:      { label: 'Staff',       icon: Shield,        color: 'text-emerald-500' },
};

const ACTIVITY_TONE: Record<string, { bg: string; initial: string }> = {
  borrow:      { bg: 'bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300',       initial: 'B' },
  return:      { bg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300', initial: 'R' },
  user:        { bg: 'bg-teal-100 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300',   initial: 'U' },
  book:        { bg: 'bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300', initial: 'A' },
  reservation: { bg: 'bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300', initial: 'RS' },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { user } = useAuth();

  const [stats, setStats]                   = useState<AdminStats | null>(null);
  const [activities, setActivities]         = useState<ActivityItem[]>([]);
  const [userDist, setUserDist]             = useState<UserDistributionRow[]>([]);
  const [aiMetrics, setAiMetrics]           = useState<AiMetrics | null>(null);
  const [aiPeriod, setAiPeriod]             = useState<AiPeriod>('week');
  const [isLoading, setIsLoading]           = useState(true);
  const [aiLoading, setAiLoading]           = useState(false);

  // Initial load — stats, activity, user distribution, AI metrics (week)
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [statsRes, activityRes, distRes, aiRes] = await Promise.all([
          api.get('/dashboard/admin').catch(() => null),
          api.get('/dashboard/activity').catch(() => null),
          api.get('/dashboard/admin/user-distribution').catch(() => null),
          api.get('/dashboard/admin/ai-metrics?period=week').catch(() => null),
        ]);
        if (statsRes?.data)    setStats(statsRes.data);
        if (activityRes?.data) setActivities(activityRes.data);
        if (distRes?.data)     setUserDist(distRes.data);
        if (aiRes?.data)       setAiMetrics(aiRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Refetch AI metrics when period tab changes
  const fetchAiMetrics = useCallback(async (period: AiPeriod) => {
    setAiLoading(true);
    try {
      const res = await api.get(`/dashboard/admin/ai-metrics?period=${period}`);
      if (res?.data) setAiMetrics(res.data);
    } catch { /* keep previous data */ }
    finally { setAiLoading(false); }
  }, []);

  const handlePeriodChange = (period: string) => {
    const p = period as AiPeriod;
    setAiPeriod(p);
    fetchAiMetrics(p);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-36 rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-gray-200 dark:bg-gray-700" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-72 rounded-2xl bg-gray-200 dark:bg-gray-700" />)}
        </div>
        <div className="h-64 rounded-2xl bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  const opsStatus = getOpsStatus(stats?.pendingReservations ?? 0, stats?.overdueBooks ?? 0);

  const kpiCards = [
    { label: 'Total Books',            value: stats?.totalBooks ?? 0,            icon: BookOpen,     iconBg: 'bg-sky-400/15',    iconColor: 'text-sky-600 dark:text-sky-300',       meta: 'Catalog inventory' },
    { label: 'Active Users',           value: stats?.activeUsers ?? 0,           icon: Users,        iconBg: 'bg-emerald-400/15', iconColor: 'text-emerald-600 dark:text-emerald-300', meta: 'Currently using the system' },
    { label: 'Currently Borrowed',     value: stats?.currentlyBorrowed ?? 0,     icon: BookMarked,   iconBg: 'bg-violet-400/15', iconColor: 'text-violet-600 dark:text-violet-300', meta: 'Active circulation load' },
    { label: 'Pending Reservations',   value: stats?.pendingReservations ?? 0,   icon: Clock,        iconBg: 'bg-amber-400/15',  iconColor: 'text-amber-600 dark:text-amber-300',   meta: 'Needs review',         href: '/dashboard/admin/reservations' },
    { label: 'Overdue Books',          value: stats?.overdueBooks ?? 0,          icon: AlertTriangle, iconBg: 'bg-rose-400/15',  iconColor: 'text-rose-600 dark:text-rose-300',     meta: 'Requires follow-up',  href: '/dashboard/admin/borrows' },
    { label: 'New Users This Week',    value: stats?.newUsersThisWeek ?? 0,      icon: UserPlus,     iconBg: 'bg-teal-400/15',   iconColor: 'text-teal-600 dark:text-teal-300',     meta: 'Recent signups',      href: '/dashboard/admin/users' },
  ];

  const focusActions = [
    {
      label: 'Manage Reservations',
      description: `${stats?.pendingReservations ?? 0} pending requests waiting for admin review.`,
      href: '/dashboard/admin/reservations',
      icon: BellRing, badge: 'Immediate',
      badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-400/15 dark:text-amber-300 dark:border-amber-400/20',
      iconBg: 'bg-amber-400/15', iconColor: 'text-amber-600 dark:text-amber-300',
    },
    {
      label: 'Review Overdue Loans',
      description: `${stats?.overdueBooks ?? 0} overdue items need outreach or enforcement.`,
      href: '/dashboard/admin/borrows',
      icon: ShieldAlert, badge: 'Attention',
      badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-400/15 dark:text-rose-300 dark:border-rose-400/20',
      iconBg: 'bg-rose-400/15', iconColor: 'text-rose-600 dark:text-rose-300',
    },
  ];

  // AI metrics display rows — all derived from real API data
  const aiRows = aiMetrics ? [
    {
      label: 'Response Rate',
      value: aiMetrics.responseRate,
      display: `${aiMetrics.responseRate}%`,
      progress: aiMetrics.responseRate,
    },
    {
      label: 'Avg Messages / Session',
      value: aiMetrics.avgMessagesPerSession,
      display: aiMetrics.avgMessagesPerSession.toFixed(1),
      progress: Math.min(aiMetrics.avgMessagesPerSession * 10, 100),
    },
    {
      label: 'Active AI Users',
      value: aiMetrics.activeAiUsersPct,
      display: `${aiMetrics.activeAiUsersPct}%`,
      progress: aiMetrics.activeAiUsersPct,
    },
  ] : [];

  return (
    <div className="space-y-6">

      {/* 1 — Hero banner */}
      <motion.section {...CONTAINER_MOTION}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{greeting()}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                {user?.name?.split(' ')[0] || 'Admin'} control center
              </h1>
              <span className="rounded-full border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-gray-700 dark:text-gray-300">
                Administrator
              </span>
              <span className={cn('rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]', opsStatus.tone)}>
                {opsStatus.label}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-400 sm:text-base">
              Monitor circulation health, resolve operational risks, and move directly into the highest-priority library workflows.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.35 }} className="flex flex-wrap gap-3">
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/admin/users"><UserPlus className="h-4 w-4" />Manage Users</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/admin/books"><BookOpen className="h-4 w-4" />Manage Books</Link></Button>
        <Button asChild size="sm"><Link href="/dashboard/admin/reports"><BarChart3 className="h-4 w-4" />Reports</Link></Button>
      </motion.div>

      {/* 2 — KPI cards */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.35 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((card, index) => {
          const cardEl = (
            <Card className="group hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-3xl font-bold mt-2">{card.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{card.meta}</p>
                  </div>
                  <div className={cn('p-2.5 rounded-xl', card.iconBg)}>
                    <card.icon className={cn('h-5 w-5', card.iconColor)} />
                  </div>
                </div>
                {card.href && (
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <span>View details</span><ChevronRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
          return card.href
            ? <Link key={`${card.label}-${index}`} href={card.href} className="block">{cardEl}</Link>
            : <div key={`${card.label}-${index}`}>{cardEl}</div>;
        })}
      </motion.section>

      {/* 3 — Three-column section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Priority Actions */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Priority Actions</CardTitle>
              <CardDescription>Immediate operational attention required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {focusActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.label} href={action.href} className="block">
                    <div className="group flex items-start gap-4 rounded-xl border p-4 hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer">
                      <div className={cn('p-2.5 rounded-xl shrink-0', action.iconBg)}>
                        <Icon className={cn('h-5 w-5', action.iconColor)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{action.label}</p>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-5">{action.description}</p>
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{action.badge}</Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* User Distribution — real data */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.35 }} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">User Distribution</CardTitle>
              <CardDescription>
                {userDist.length > 0
                  ? `${userDist.reduce((s, r) => s + r.count, 0).toLocaleString()} active users across all roles`
                  : 'Active users by role'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {userDist.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No user data available</p>
              ) : (
                userDist.map((row) => {
                  const meta = ROLE_META[row.role];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <div key={row.role} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={cn('h-4 w-4', meta.color)} />
                          <span className="text-sm font-medium">{meta.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{row.count.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground">{row.pct}%</span>
                        </div>
                      </div>
                      <Progress value={row.pct} className="h-2" />
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Performance — real data */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.35 }} className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">AI Performance</CardTitle>
              </div>
              <CardDescription>Real OZ AI usage metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={aiPeriod} onValueChange={handlePeriodChange}>
                <TabsList className="w-full mb-4">
                  {(['week', 'month', 'year'] as const).map((p) => (
                    <TabsTrigger key={p} value={p} className="flex-1 capitalize">{p}</TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={aiPeriod} className="mt-0">
                  {aiLoading ? (
                    <div className="space-y-4 animate-pulse">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {aiRows.map((row) => (
                        <div key={row.label} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{row.label}</span>
                            <span className="text-sm font-semibold">{row.display}</span>
                          </div>
                          <Progress value={row.progress} className="h-2" />
                        </div>
                      ))}

                      {/* Summary stats */}
                      {aiMetrics && (
                        <div className="pt-3 mt-3 border-t grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-lg font-bold">{aiMetrics.totalConversations}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Chats</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{aiMetrics.totalMessages}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Messages</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{aiMetrics.uniqueUsers}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Users</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 4 — Activity feed — real data with all event types */}
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30, duration: 0.35 }}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Activity Feed</CardTitle>
                <CardDescription className="mt-1">
                  {activities.length > 0
                    ? `${activities.length} recent event${activities.length === 1 ? '' : 's'} across borrows, reservations, and user registrations`
                    : 'No recent activity recorded'}
                </CardDescription>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center">
                <Activity className="mx-auto h-9 w-9 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.slice(0, 8).map((item, index) => {
                  const tone = ACTIVITY_TONE[item.type] ?? ACTIVITY_TONE.book;
                  return (
                    <motion.div
                      key={`${item.time}-${index}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * index }}
                      className="flex items-start gap-3"
                    >
                      <Avatar className="size-8 shrink-0">
                        <AvatarFallback className={cn('text-xs font-semibold', tone.bg)}>
                          {tone.initial}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-xl border px-4 py-3">
                        <p className="text-sm leading-6 text-foreground">{item.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(item.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
