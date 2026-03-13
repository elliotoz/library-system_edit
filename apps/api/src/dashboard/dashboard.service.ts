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
    const [recentBorrows, recentBooks] = await Promise.all([
      this.prisma.borrow.findMany({
        take: 5,
        orderBy: { borrowedAt: 'desc' },
        include: { user: { select: { name: true } }, bookCopy: { include: { book: { select: { title: true } } } } },
      }),
      this.prisma.book.findMany({ take: 3, orderBy: { createdAt: 'desc' }, select: { title: true, createdAt: true } }),
    ]);

    const activities = [
      ...recentBorrows.map((b) => ({ type: 'borrow', message: `${b.user.name} borrowed "${b.bookCopy.book.title}"`, time: b.borrowedAt })),
      ...recentBooks.map((b) => ({ type: 'book', message: `New book added: "${b.title}"`, time: b.createdAt })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 10);

    return activities;
  }
}