import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BorrowStatus, ReservationStatus, BookCopyStatus, Role } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getAdminStats() {
    const [totalBooks, activeUsers, currentlyBorrowed, pendingReservations, overdueBooks, newUsersThisWeek] = await Promise.all([
      this.prisma.book.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.borrow.count({ where: { status: BorrowStatus.ACTIVE } }),
      this.prisma.reservation.count({ where: { status: ReservationStatus.PENDING } }),
      this.prisma.borrow.count({ where: { status: BorrowStatus.ACTIVE, dueAt: { lt: new Date() } } }),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    ]);

    return { totalBooks, activeUsers, currentlyBorrowed, pendingReservations, overdueBooks, newUsersThisWeek };
  }

  async getStudentStats(userId: string) {
    const [borrowedBooks, activeReservations, borrowHistory, activeBorrows] = await Promise.all([
      this.prisma.borrow.count({ where: { userId, status: BorrowStatus.ACTIVE } }),
      this.prisma.reservation.count({ where: { userId, status: { in: [ReservationStatus.PENDING, ReservationStatus.READY_FOR_PICKUP] } } }),
      this.prisma.borrow.findMany({ where: { userId, status: BorrowStatus.ACTIVE }, select: { dueAt: true }, orderBy: { dueAt: 'asc' }, take: 1 }),
      // For streak calculation: get all ACTIVE/OVERDUE borrows
      this.prisma.borrow.findMany({
        where: { userId, status: { in: [BorrowStatus.ACTIVE, BorrowStatus.OVERDUE] } },
        select: { borrowedAt: true, returnedAt: true },
      }),
    ]);

    const nextDueDate = borrowHistory[0]?.dueAt;
    const daysUntilDue = nextDueDate ? Math.ceil((new Date(nextDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

    const readingStreak = this.calculateReadingStreak(activeBorrows);

    return { borrowedBooks, activeReservations, daysUntilDue, readingStreak };
  }

  /**
   * Calculate reading streak: consecutive calendar days (backward from today)
   * where the student had at least one active/overdue borrow covering that day.
   */
  private calculateReadingStreak(borrows: { borrowedAt: Date; returnedAt: Date | null }[]): number {
    if (borrows.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    const currentDate = new Date(today);

    while (true) {
      const dayCovered = borrows.some((borrow) => {
        const borrowStart = new Date(borrow.borrowedAt);
        borrowStart.setHours(0, 0, 0, 0);
        // For ACTIVE/OVERDUE, returnedAt is null, so end date is today
        const borrowEnd = borrow.returnedAt ? new Date(borrow.returnedAt) : today;
        borrowEnd.setHours(23, 59, 59, 999);
        return borrowStart <= currentDate && currentDate <= borrowEnd;
      });

      if (dayCovered) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  async getInstructorStats(userId: string) {
    const [borrowedBooks, policy] = await Promise.all([
      this.prisma.borrow.count({ where: { userId, status: BorrowStatus.ACTIVE } }),
      this.prisma.borrowPolicy.findUnique({ where: { role: Role.INSTRUCTOR } }),
    ]);
    return { borrowedBooks, maxBorrowDays: policy?.maxBorrowDays || 30, maxBooks: policy?.maxActiveBorrows || 10 };
  }

  async getStaffStats(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { interests: true } });
    const borrowedBooks = await this.prisma.borrow.count({ where: { userId, status: BorrowStatus.ACTIVE } });
    return { borrowedBooks, interests: user?.interests || [], interestCount: user?.interests?.length || 0 };
  }

  async getRecentActivity() {
    const [recentBorrows, recentBooks, recentUsers, recentReturns, recentReservations] = await Promise.all([
      this.prisma.borrow.findMany({
        take: 5,
        orderBy: { borrowedAt: 'desc' },
        include: { user: { select: { name: true } }, bookCopy: { include: { book: { select: { title: true } } } } },
      }),
      this.prisma.book.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { title: true, createdAt: true } }),
      this.prisma.user.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { name: true, role: true, createdAt: true } }),
      this.prisma.borrow.findMany({
        take: 3,
        where: { status: BorrowStatus.RETURNED, returnedAt: { not: null } },
        orderBy: { returnedAt: 'desc' },
        include: { user: { select: { name: true } }, bookCopy: { include: { book: { select: { title: true } } } } },
      }),
      this.prisma.reservation.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } }, bookCopy: { include: { book: { select: { title: true } } } } },
      }),
    ]);

    const activities = [
      ...recentBorrows.map((b) => ({ type: 'borrow', message: `${b.user.name} borrowed "${b.bookCopy.book.title}"`, time: b.borrowedAt })),
      ...recentBooks.map((b) => ({ type: 'book', message: `New book added: "${b.title}"`, time: b.createdAt })),
      ...recentUsers.map((u) => ({ type: 'user', message: `${u.name} joined as ${u.role.charAt(0) + u.role.slice(1).toLowerCase()}`, time: u.createdAt })),
      ...recentReturns.map((b) => ({ type: 'return', message: `${b.user.name} returned "${b.bookCopy.book.title}"`, time: b.returnedAt! })),
      ...recentReservations.map((r) => ({ type: 'reservation', message: `${r.user.name} reserved "${r.bookCopy.book.title}"`, time: r.createdAt })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

    return activities;
  }

  async getUserDistribution() {
    const [roleCounts, total] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        where: { isActive: true },
        _count: { id: true },
      }),
      this.prisma.user.count({ where: { isActive: true, role: { not: Role.ADMIN } } }),
    ]);

    const order: Role[] = [Role.STUDENT, Role.INSTRUCTOR, Role.STAFF];
    return order.map((role) => {
      const count = roleCounts.find((r) => r.role === role)?._count.id ?? 0;
      const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
      return { role, count, pct };
    });
  }

  async getAiMetrics(period: 'week' | 'month' | 'year') {
    const msMap = { week: 7, month: 30, year: 365 };
    const since = new Date(Date.now() - msMap[period] * 24 * 60 * 60 * 1000);

    const [conversations, totalUsers] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where: { createdAt: { gte: since } },
        include: { messages: { select: { role: true } } },
      }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);

    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const conversationsWithReply = conversations.filter((c) =>
      c.messages.some((m) => m.role === 'assistant'),
    ).length;
    const uniqueUsers = new Set(conversations.map((c) => c.userId)).size;

    const responseRate = totalConversations > 0
      ? Math.round((conversationsWithReply / totalConversations) * 100)
      : 0;
    const avgMessagesPerSession = totalConversations > 0
      ? Math.round((totalMessages / totalConversations) * 10) / 10
      : 0;
    const activeAiUsersPct = totalUsers > 0
      ? Math.round((uniqueUsers / totalUsers) * 100)
      : 0;

    return {
      period,
      totalConversations,
      totalMessages,
      uniqueUsers,
      responseRate,
      avgMessagesPerSession,
      activeAiUsersPct,
    };
  }
}