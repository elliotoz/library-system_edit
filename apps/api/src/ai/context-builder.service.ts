import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, BorrowStatus, ReservationStatus } from '@prisma/client';

export interface AiContext {
  user: {
    id: string;
    name: string;
    role: Role;
    facultyName: string | null;
    interests: string[];
  };
  borrowPolicy: {
    maxActiveBorrows: number;
    maxBorrowDays: number;
    maxExtensions: number;
    extensionDays: number;
  };
  activeBorrows: {
    count: number;
    items: { title: string; dueAt: Date }[];
  };
  reservations: {
    count: number;
    pending: number;
    readyForPickup: number;
  };
  catalog: {
    totalBooks: number;
    availableCopies: number;
    facultyBooks: number;
    topCategories: string[];
  };
  readingLists: {
    publishedCount: number;
    followedInstructors: number;
    ownListCount: number;
  };
  admin?: {
    pendingReservations: number;
    activeLoans: number;
    overdueLoans: number;
    totalUsers: number;
  };
}

const DEFAULT_POLICY = {
  maxActiveBorrows: 5,
  maxBorrowDays: 14,
  maxExtensions: 2,
  extensionDays: 7,
};

@Injectable()
export class ContextBuilderService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, userRole: Role): Promise<AiContext> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        interests: true,
        faculty: { select: { name: true } },
      },
    });

    const [
      borrowPolicy,
      activeBorrows,
      reservations,
      catalogStats,
      readingListStats,
    ] = await Promise.all([
      this.getBorrowPolicy(userRole),
      this.getActiveBorrows(userId),
      this.getReservations(userId),
      this.getCatalogSnapshot(user.faculty?.name ?? null),
      this.getReadingListSnapshot(userId, userRole),
    ]);

    const ctx: AiContext = {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        facultyName: user.faculty?.name ?? null,
        interests: user.interests,
      },
      borrowPolicy,
      activeBorrows,
      reservations,
      catalog: catalogStats,
      readingLists: readingListStats,
    };

    if (userRole === Role.ADMIN) {
      ctx.admin = await this.getAdminStats();
    }

    return ctx;
  }

  private async getBorrowPolicy(role: Role) {
    const policy = await this.prisma.borrowPolicy.findUnique({ where: { role } });
    if (!policy) return DEFAULT_POLICY;
    return {
      maxActiveBorrows: policy.maxActiveBorrows,
      maxBorrowDays: policy.maxBorrowDays,
      maxExtensions: policy.maxExtensions,
      extensionDays: policy.extensionDays,
    };
  }

  private async getActiveBorrows(userId: string) {
    const borrows = await this.prisma.borrow.findMany({
      where: { userId, status: BorrowStatus.ACTIVE },
      select: {
        dueAt: true,
        bookCopy: { select: { book: { select: { title: true } } } },
      },
      orderBy: { dueAt: 'asc' },
      take: 5,
    });
    const count = await this.prisma.borrow.count({
      where: { userId, status: BorrowStatus.ACTIVE },
    });
    return {
      count,
      items: borrows.map((b) => ({ title: b.bookCopy.book.title, dueAt: b.dueAt })),
    };
  }

  private async getReservations(userId: string) {
    const [count, pending, readyForPickup] = await Promise.all([
      this.prisma.reservation.count({
        where: { userId, status: { in: [ReservationStatus.PENDING, ReservationStatus.READY_FOR_PICKUP] } },
      }),
      this.prisma.reservation.count({
        where: { userId, status: ReservationStatus.PENDING },
      }),
      this.prisma.reservation.count({
        where: { userId, status: ReservationStatus.READY_FOR_PICKUP },
      }),
    ]);
    return { count, pending, readyForPickup };
  }

  private async getCatalogSnapshot(facultyName: string | null) {
    const [totalBooks, availableCopies, categories] = await Promise.all([
      this.prisma.book.count({ where: { isActive: true } }),
      this.prisma.bookCopy.count({ where: { status: 'AVAILABLE' } }),
      this.prisma.book.groupBy({
        by: ['category'],
        where: { isActive: true, category: { not: null } },
        _count: true,
        orderBy: { _count: { category: 'desc' } },
        take: 5,
      }),
    ]);

    let facultyBooks = 0;
    if (facultyName) {
      facultyBooks = await this.prisma.book.count({
        where: { isActive: true, mainFaculty: { name: facultyName } },
      });
    }

    return {
      totalBooks,
      availableCopies,
      facultyBooks,
      topCategories: categories.map((c) => c.category).filter(Boolean) as string[],
    };
  }

  private async getReadingListSnapshot(userId: string, role: Role) {
    const [publishedCount, followedInstructors, ownListCount] = await Promise.all([
      this.prisma.readingList.count({ where: { status: 'PUBLISHED', visibility: { not: 'PRIVATE' } } }),
      this.prisma.instructorFollower.count({ where: { followerId: userId } }),
      role === Role.INSTRUCTOR || role === Role.ADMIN
        ? this.prisma.readingList.count({ where: { ownerId: userId } })
        : Promise.resolve(0),
    ]);
    return { publishedCount, followedInstructors, ownListCount };
  }

  private async getAdminStats() {
    const [pendingReservations, activeLoans, overdueLoans, totalUsers] = await Promise.all([
      this.prisma.reservation.count({ where: { status: ReservationStatus.PENDING } }),
      this.prisma.borrow.count({ where: { status: BorrowStatus.ACTIVE } }),
      this.prisma.borrow.count({ where: { status: BorrowStatus.OVERDUE } }),
      this.prisma.user.count({ where: { isActive: true } }),
    ]);
    return { pendingReservations, activeLoans, overdueLoans, totalUsers };
  }
}
