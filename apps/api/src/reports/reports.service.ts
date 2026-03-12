import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BorrowStatus, ReservationStatus, FineStatus, Role } from '@prisma/client';

export interface ReportSummary {
  period: { from: string; to: string };
  totalBorrows: number;
  totalReturns: number;
  overdueCount: number;
  pendingReservations: number;
  collectedFines: number;
  topBooks: { title: string; author: string; borrowCount: number }[];
  usersByRole: { role: string; count: number }[];
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(from: Date, to: Date): Promise<ReportSummary> {
    const dateFilter = { gte: from, lte: to };

    const [
      totalBorrows,
      totalReturns,
      overdueCount,
      pendingReservations,
      collectedFinesAgg,
      topBooksRaw,
      usersByRole,
    ] = await Promise.all([
      this.prisma.borrow.count({
        where: { borrowedAt: dateFilter },
      }),
      this.prisma.borrow.count({
        where: { status: BorrowStatus.RETURNED, returnedAt: dateFilter },
      }),
      this.prisma.borrow.count({
        where: {
          status: BorrowStatus.ACTIVE,
          dueAt: { lt: new Date() },
          borrowedAt: dateFilter,
        },
      }),
      this.prisma.reservation.count({
        where: {
          status: ReservationStatus.PENDING,
          createdAt: dateFilter,
        },
      }),
      this.prisma.finePayment.aggregate({
        where: { status: FineStatus.PAID, paidAt: dateFilter },
        _sum: { amount: true },
      }),
      // Top borrowed books in period
      this.prisma.borrow.groupBy({
        by: ['bookCopyId'],
        where: { borrowedAt: dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      // Users by role
      this.prisma.user.groupBy({
        by: ['role'],
        where: { isActive: true },
        _count: { id: true },
      }),
    ]);

    // Resolve book titles for top books
    const topBooks = await this.resolveTopBooks(topBooksRaw);

    return {
      period: { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] },
      totalBorrows,
      totalReturns,
      overdueCount,
      pendingReservations,
      collectedFines: Number(collectedFinesAgg._sum.amount || 0),
      topBooks,
      usersByRole: usersByRole.map((u) => ({
        role: u.role,
        count: u._count.id,
      })),
    };
  }

  private async resolveTopBooks(
    grouped: { bookCopyId: string; _count: { id: number } }[],
  ) {
    if (grouped.length === 0) return [];

    const copies = await this.prisma.bookCopy.findMany({
      where: { id: { in: grouped.map((g) => g.bookCopyId) } },
      include: { book: { select: { title: true, authors: true } } },
    });

    const copyMap = new Map(copies.map((c) => [c.id, c.book]));

    // Aggregate by book (multiple copies of same book)
    const bookMap = new Map<string, { title: string; author: string; borrowCount: number }>();
    for (const g of grouped) {
      const book = copyMap.get(g.bookCopyId);
      if (!book) continue;
      const existing = bookMap.get(book.title);
      if (existing) {
        existing.borrowCount += g._count.id;
      } else {
        bookMap.set(book.title, {
          title: book.title,
          author: book.authors.join(', '),
          borrowCount: g._count.id,
        });
      }
    }

    return Array.from(bookMap.values())
      .sort((a, b) => b.borrowCount - a.borrowCount)
      .slice(0, 10);
  }
}
