import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BorrowStatus, BookCopyStatus, FineStatus, Role } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";

// Fine rate per day (in your currency)
const FINE_RATE_PER_DAY = 5; // e.g., ₺5 or $0.50 per day

@Injectable()
export class BorrowsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService
  ) {}

  async findMyBorrows(userId: string) {
    const borrows = await this.prisma.borrow.findMany({
      where: { userId },
      include: {
        bookCopy: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
              },
            },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { borrowedAt: "desc" },
      take: 50,
    });

    return borrows.map((borrow) => {
      const now = new Date();
      const dueDate = new Date(borrow.dueAt);
      const isOverdue = borrow.status === BorrowStatus.ACTIVE && dueDate < now;
      const overdueDays = isOverdue
        ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: borrow.id,
        borrowDate: borrow.borrowedAt,
        dueDate: borrow.dueAt,
        returnDate: borrow.returnedAt,
        status: borrow.status,
        extensionCount: borrow.extensionCount,
        book: borrow.bookCopy.book,
        branch: borrow.bookCopy.branch,
        isOverdue,
        overdueDays,
        estimatedFine: overdueDays * FINE_RATE_PER_DAY,
        daysUntilDue: Math.ceil(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      };
    });
  }

  async findActiveBorrows(userId: string) {
    return this.prisma.borrow.findMany({
      where: { userId, status: BorrowStatus.ACTIVE },
      include: {
        bookCopy: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
              },
            },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  // Admin: Get all active and overdue borrows
  async findAllActiveBorrowsForAdmin() {
    const borrows = await this.prisma.borrow.findMany({
      where: {
        status: BorrowStatus.ACTIVE,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            studentId: true,
            staffId: true,
          },
        },
        bookCopy: {
          include: {
            book: {
              select: {
                id: true,
                title: true,
                authors: true,
                coverImageUrl: true,
              },
            },
            branch: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ dueAt: "asc" }],
    });

    const now = new Date();

    return borrows.map((borrow) => {
      const dueDate = new Date(borrow.dueAt);
      const isOverdue = dueDate < now;
      const overdueDays = isOverdue
        ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: borrow.id,
        borrowedAt: borrow.borrowedAt,
        dueAt: borrow.dueAt,
        extensionCount: borrow.extensionCount,
        user: borrow.user,
        book: borrow.bookCopy.book,
        bookCopy: {
          id: borrow.bookCopy.id,
          brandId: borrow.bookCopy.brandId,
          condition: borrow.bookCopy.condition,
        },
        branch: borrow.bookCopy.branch,
        isOverdue,
        overdueDays,
        estimatedFine: overdueDays * FINE_RATE_PER_DAY,
        daysUntilDue: Math.ceil(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      };
    });
  }

  async findAllBorrows(query: {
    status?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;

    const [borrows, total] = await Promise.all([
      this.prisma.borrow.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          bookCopy: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  authors: true,
                  coverImageUrl: true,
                },
              },
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { borrowedAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.borrow.count({ where }),
    ]);

    return {
      data: borrows,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async extendBorrow(borrowId: string, userId: string, userRole: Role) {
    const borrow = await this.prisma.borrow.findUnique({
      where: { id: borrowId },
      include: { user: true, bookCopy: { include: { book: true } } },
    });

    if (!borrow) throw new NotFoundException("Borrow not found");
    if (userRole !== Role.ADMIN && borrow.userId !== userId) {
      throw new BadRequestException("You can only extend your own borrows");
    }
    if (borrow.status !== BorrowStatus.ACTIVE) {
      throw new BadRequestException("Can only extend active borrows");
    }

    // Check if overdue - cannot extend overdue books
    if (new Date(borrow.dueAt) < new Date()) {
      throw new BadRequestException(
        "Cannot extend overdue books. Please return the book first."
      );
    }

    const policy = await this.prisma.borrowPolicy.findUnique({
      where: { role: borrow.user.role },
    });
    if (policy && borrow.extensionCount >= policy.maxExtensions) {
      throw new BadRequestException(
        `Maximum extensions (${policy.maxExtensions}) reached`
      );
    }

    const newDueDate = new Date(borrow.dueAt);
    newDueDate.setDate(newDueDate.getDate() + (policy?.extensionDays || 7));

    const updated = await this.prisma.borrow.update({
      where: { id: borrowId },
      data: { dueAt: newDueDate, extensionCount: borrow.extensionCount + 1 },
      include: { bookCopy: { include: { book: true } } },
    });

    return updated;
  }

  async returnBook(borrowId: string) {
    const borrow = await this.prisma.borrow.findUnique({
      where: { id: borrowId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        bookCopy: { include: { book: true } },
      },
    });

    if (!borrow) throw new NotFoundException("Borrow not found");
    if (borrow.status === BorrowStatus.RETURNED) {
      throw new BadRequestException("Book already returned");
    }

    const now = new Date();
    const dueDate = new Date(borrow.dueAt);
    const isOverdue = dueDate < now;
    const overdueDays = isOverdue
      ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const fine = overdueDays * FINE_RATE_PER_DAY;

    // Use transaction to update borrow, book copy, and create fine if overdue
    const txOps: any[] = [
      this.prisma.borrow.update({
        where: { id: borrowId },
        data: {
          status: BorrowStatus.RETURNED,
          returnedAt: now,
          notes:
            fine > 0 ? `Overdue fine: ₺${fine} (${overdueDays} days)` : null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          bookCopy: { include: { book: true, branch: true } },
        },
      }),
      this.prisma.bookCopy.update({
        where: { id: borrow.bookCopyId },
        data: { status: BookCopyStatus.AVAILABLE },
      }),
    ];

    if (fine > 0) {
      txOps.push(
        this.prisma.finePayment.upsert({
          where: { borrowId },
          create: {
            borrowId,
            userId: borrow.user.id,
            amount: fine,
            status: FineStatus.PAID,
          paidAt: now,
          },
          update: {
            amount: fine,
            status: FineStatus.PAID,
            paidAt: now,
          },
        }),
      );
    }

    const [updatedBorrow] = await this.prisma.$transaction(txOps);

    // Send notification to user
    await this.notificationsService.create({
      userId: borrow.user.id,
      type: "SYSTEM",
      title: "Book Returned Successfully",
      message:
        fine > 0
          ? `"${borrow.bookCopy.book.title}" has been returned. Overdue fine: ₺${fine} (${overdueDays} days late).`
          : `"${borrow.bookCopy.book.title}" has been returned. Thank you!`,
      bookId: borrow.bookCopy.book.id,
    });

    return {
      id: updatedBorrow.id,
      status: updatedBorrow.status,
      returnedAt: updatedBorrow.returnedAt,
      book: updatedBorrow.bookCopy.book,
      branch: updatedBorrow.bookCopy.branch,
      user: updatedBorrow.user,
      wasOverdue: isOverdue,
      overdueDays,
      fine,
    };
  }

  async getBorrowStats() {
    const now = new Date();

    const [active, overdue, returned, totalFines] = await Promise.all([
      this.prisma.borrow.count({ where: { status: BorrowStatus.ACTIVE } }),
      this.prisma.borrow.count({
        where: { status: BorrowStatus.ACTIVE, dueAt: { lt: now } },
      }),
      this.prisma.borrow.count({ where: { status: BorrowStatus.RETURNED } }),
      // Calculate total potential fines from overdue books
      this.prisma.borrow.findMany({
        where: { status: BorrowStatus.ACTIVE, dueAt: { lt: now } },
        select: { dueAt: true },
      }),
    ]);

    const totalPotentialFines = totalFines.reduce((sum, borrow) => {
      const overdueDays = Math.ceil(
        (now.getTime() - new Date(borrow.dueAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return sum + overdueDays * FINE_RATE_PER_DAY;
    }, 0);

    return {
      active,
      overdue,
      returned,
      totalPotentialFines,
      fineRatePerDay: FINE_RATE_PER_DAY,
    };
  }

  // User: Get borrow history (returned books)
  async findMyHistory(
    userId: string,
    query: { page?: number; pageSize?: number }
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    const where = {
      userId,
      status: BorrowStatus.RETURNED,
    };

    const [borrows, total] = await Promise.all([
      this.prisma.borrow.findMany({
        where,
        include: {
          bookCopy: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  authors: true,
                  coverImageUrl: true,
                },
              },
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { returnedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.borrow.count({ where }),
    ]);

    return {
      data: borrows.map((borrow) => ({
        id: borrow.id,
        borrowedAt: borrow.borrowedAt,
        dueAt: borrow.dueAt,
        returnedAt: borrow.returnedAt,
        extensionCount: borrow.extensionCount,
        notes: borrow.notes,
        book: borrow.bookCopy.book,
        branch: borrow.bookCopy.branch,
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // Admin: Get all borrow history with filters (including role filter)
  async findAllHistory(query: {
    page?: number;
    pageSize?: number;
    userId?: string;
    bookId?: string;
    role?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;

    const where: any = {};

    // Status filter (default to all if not specified)
    if (query.status && query.status !== "all") {
      where.status = query.status;
    }

    if (query.userId) where.userId = query.userId;
    if (query.bookId) where.bookCopy = { bookId: query.bookId };

    // Role filter
    if (query.role && query.role !== "all") {
      where.user = { role: query.role };
    }

    // Date range filter
    if (query.startDate || query.endDate) {
      where.borrowedAt = {};
      if (query.startDate) where.borrowedAt.gte = new Date(query.startDate);
      if (query.endDate) where.borrowedAt.lte = new Date(query.endDate);
    }

    const [borrows, total] = await Promise.all([
      this.prisma.borrow.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              studentId: true,
              staffId: true,
            },
          },
          bookCopy: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  authors: true,
                  coverImageUrl: true,
                },
              },
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { borrowedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.borrow.count({ where }),
    ]);

    const now = new Date();

    return {
      data: borrows.map((borrow) => {
        const dueDate = new Date(borrow.dueAt);
        const isOverdue =
          borrow.status === BorrowStatus.ACTIVE && dueDate < now;
        const overdueDays = isOverdue
          ? Math.ceil(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;

        return {
          id: borrow.id,
          borrowedAt: borrow.borrowedAt,
          dueAt: borrow.dueAt,
          returnedAt: borrow.returnedAt,
          status: borrow.status,
          notes: borrow.notes,
          extensionCount: borrow.extensionCount,
          user: borrow.user,
          book: borrow.bookCopy.book,
          branch: borrow.bookCopy.branch,
          isOverdue,
          overdueDays,
          estimatedFine: overdueDays * FINE_RATE_PER_DAY,
        };
      }),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // Admin: Get most borrowed books
  async getMostBorrowedBooks(limit: number = 10) {
    // Get all borrows grouped by book copy
    const borrows = await this.prisma.borrow.groupBy({
      by: ["bookCopyId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit * 3, // handle duplicates after aggregation by book
    });

    const bookCopyIds = borrows.map((b) => b.bookCopyId);
    const bookCopies = await this.prisma.bookCopy.findMany({
      where: { id: { in: bookCopyIds } },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            authors: true,
            coverImageUrl: true,
            category: true,
          },
        },
      },
    });

    // Aggregate counts by book id
    const bookBorrowCounts = new Map<string, { book: any; count: number }>();

    for (const borrow of borrows) {
      const bookCopy = bookCopies.find((bc) => bc.id === borrow.bookCopyId);
      if (!bookCopy) continue;

      const existing = bookBorrowCounts.get(bookCopy.book.id);
      if (existing) {
        existing.count += borrow._count.id;
      } else {
        bookBorrowCounts.set(bookCopy.book.id, {
          book: bookCopy.book,
          count: borrow._count.id,
        });
      }
    }

    return Array.from(bookBorrowCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  // Admin: Get borrow trends (monthly)
  async getBorrowTrends(months: number = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const borrows = await this.prisma.borrow.findMany({
      where: {
        borrowedAt: { gte: startDate },
      },
      select: {
        borrowedAt: true,
        status: true,
      },
    });

    const monthlyData = new Map<
      string,
      { borrowed: number; returned: number }
    >();

    for (let i = 0; i <= months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      monthlyData.set(key, { borrowed: 0, returned: 0 });
    }

    for (const borrow of borrows) {
      const date = new Date(borrow.borrowedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const entry = monthlyData.get(key);
      if (!entry) continue;

      entry.borrowed++;
      if (borrow.status === BorrowStatus.RETURNED) {
        entry.returned++;
      }
    }

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // Admin: Get statistics summary
  async getStatisticsSummary() {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalBorrows,
      activeBorrows,
      overdueBorrows,
      thisMonthBorrows,
      lastMonthBorrows,
      mostBorrowed,
      trends,
    ] = await Promise.all([
      this.prisma.borrow.count(),
      this.prisma.borrow.count({ where: { status: BorrowStatus.ACTIVE } }),
      this.prisma.borrow.count({
        where: { status: BorrowStatus.ACTIVE, dueAt: { lt: now } },
      }),
      this.prisma.borrow.count({
        where: { borrowedAt: { gte: thisMonth } },
      }),
      this.prisma.borrow.count({
        where: { borrowedAt: { gte: lastMonth, lt: thisMonth } },
      }),
      this.getMostBorrowedBooks(5),
      this.getBorrowTrends(6),
    ]);

    const percentChange =
      lastMonthBorrows > 0
        ? Math.round(
            ((thisMonthBorrows - lastMonthBorrows) / lastMonthBorrows) * 100
          )
        : 0;

    return {
      totalBorrows,
      activeBorrows,
      overdueBorrows,
      thisMonthBorrows,
      lastMonthBorrows,
      percentChange,
      mostBorrowed,
      trends,
    };
  }
}
