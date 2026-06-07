import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BorrowStatus, IndexStatus, ReservationStatus, Role } from '@prisma/client';

const AI_USAGE_WINDOW_DAYS = 7;
const FAILED_BOOK_PREVIEW_LIMIT = 10;
const TOP_BOOK_LIMIT = 5;
const INDEX_STATUS_ORDER = [
  IndexStatus.INDEXED,
  IndexStatus.FAILED,
  IndexStatus.PENDING,
  IndexStatus.PROCESSING,
  IndexStatus.NOT_APPLICABLE,
] as const;

type CountByStatus = { status: string; count: number; percentage: number };

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getAdminSnapshot() {
    const now = new Date();
    const aiSince = new Date(now.getTime() - AI_USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [
      totalBooks,
      indexedBooks,
      failedIndexingBooks,
      pendingReservations,
      readyPickups,
      activeBorrows,
      overdueBorrows,
      pendingMaterials,
      activeUsers,
      bookStatusRows,
      totalChunks,
      zeroChunkIndexedBooks,
      failedBooksPreviewRaw,
      lastIndexed,
      facultyBooks,
      categoryRows,
      missingIsbn,
      missingDescription,
      missingCategory,
      missingSubjectTags,
      missingFaculty,
      missingCoverImage,
      metadataIssuesPreviewRaw,
      mostBorrowedRows,
      mostReservedRows,
      materialsTotal,
      materialsApproved,
      materialsPublished,
      materialsByIndexStatus,
      materialChunks,
      aiConversations,
    ] = await Promise.all([
      this.prisma.book.count({ where: { isActive: true } }),
      this.prisma.book.count({ where: { isActive: true, pdfIndexStatus: IndexStatus.INDEXED } }),
      this.prisma.book.count({ where: { isActive: true, pdfIndexStatus: IndexStatus.FAILED } }),
      this.prisma.reservation.count({ where: { status: ReservationStatus.PENDING } }),
      this.prisma.reservation.count({ where: { status: ReservationStatus.READY_FOR_PICKUP } }),
      this.prisma.borrow.count({ where: { status: BorrowStatus.ACTIVE } }),
      this.prisma.borrow.count({ where: { status: BorrowStatus.ACTIVE, dueAt: { lt: now } } }),
      this.prisma.material.count({ where: { isApproved: false } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.book.groupBy({
        by: ['pdfIndexStatus'],
        where: { isActive: true },
        _count: { _all: true },
      }),
      this.prisma.bookChunk.count({ where: { book: { isActive: true } } }),
      this.prisma.book.count({
        where: {
          isActive: true,
          pdfIndexStatus: IndexStatus.INDEXED,
          chunks: { none: {} },
        },
      }),
      this.prisma.book.findMany({
        where: { isActive: true, pdfIndexStatus: IndexStatus.FAILED },
        select: {
          id: true,
          title: true,
          authors: true,
          pdfIndexStatus: true,
          pdfPageCount: true,
          pdfUrl: true,
          ebookUrl: true,
          pdfIndexedAt: true,
          _count: { select: { chunks: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: FAILED_BOOK_PREVIEW_LIMIT,
      }),
      this.prisma.book.aggregate({
        where: { isActive: true, pdfIndexedAt: { not: null } },
        _max: { pdfIndexedAt: true },
      }),
      this.prisma.book.findMany({
        where: { isActive: true },
        select: {
          mainFacultyId: true,
          mainFaculty: { select: { name: true } },
        },
      }),
      this.prisma.book.groupBy({
        by: ['category'],
        where: { isActive: true, category: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
      }),
      this.prisma.book.count({ where: { isActive: true, isbn: null } }),
      this.prisma.book.count({ where: { isActive: true, description: null } }),
      this.prisma.book.count({ where: { isActive: true, category: null } }),
      this.prisma.book.count({ where: { isActive: true, subjectTags: { isEmpty: true } } }),
      this.prisma.book.count({ where: { isActive: true, mainFacultyId: null } }),
      this.prisma.book.count({ where: { isActive: true, coverImageUrl: null } }),
      this.prisma.book.findMany({
        where: {
          isActive: true,
          OR: [
            { isbn: null },
            { description: null },
            { category: null },
            { subjectTags: { isEmpty: true } },
            { mainFacultyId: null },
            { coverImageUrl: null },
          ],
        },
        select: {
          id: true,
          title: true,
          authors: true,
          isbn: true,
          description: true,
          category: true,
          subjectTags: true,
          mainFacultyId: true,
          coverImageUrl: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      this.getMostBorrowedBooksForSnapshot(),
      this.getMostReservedBooksForSnapshot(),
      this.prisma.material.count(),
      this.prisma.material.count({ where: { isApproved: true } }),
      this.prisma.material.count({ where: { isPublished: true } }),
      this.prisma.material.groupBy({
        by: ['indexStatus'],
        _count: { _all: true },
      }),
      this.prisma.materialChunk.count(),
      this.prisma.aiConversation.findMany({
        where: { createdAt: { gte: aiSince } },
        select: {
          userId: true,
          messages: { select: { role: true } },
        },
      }),
    ]);

    const byStatus = this.formatStatusDistribution(bookStatusRows, totalBooks);
    const totalMessages = aiConversations.reduce((sum, conversation) => sum + conversation.messages.length, 0);
    const conversationsWithAssistantReply = aiConversations.filter((conversation) =>
      conversation.messages.some((message) => message.role === 'assistant'),
    ).length;
    const uniqueAiUsers = new Set(aiConversations.map((conversation) => conversation.userId)).size;

    return {
      commandSummary: {
        totalBooks,
        indexedBooks,
        indexedBooksPercent: safePercentage(indexedBooks, totalBooks),
        failedIndexingBooks,
        pendingReservations,
        overdueBorrows,
        pendingMaterials,
        activeUsers,
      },
      indexingHealth: {
        byStatus,
        totalChunks,
        averageChunksPerIndexedBook: indexedBooks > 0 ? roundOne(totalChunks / indexedBooks) : 0,
        zeroChunkIndexedBooks,
        failedBooksPreview: failedBooksPreviewRaw.slice(0, FAILED_BOOK_PREVIEW_LIMIT).map((book) => ({
          id: book.id,
          title: book.title,
          authors: book.authors,
          pdfIndexStatus: book.pdfIndexStatus,
          pdfPageCount: book.pdfPageCount,
          chunks: book._count.chunks,
          hasPdfUrl: Boolean(book.pdfUrl),
          hasEbookUrl: Boolean(book.ebookUrl),
          pdfIndexedAt: book.pdfIndexedAt?.toISOString() ?? null,
        })),
        lastIndexedAt: lastIndexed._max.pdfIndexedAt?.toISOString() ?? null,
      },
      operationsQueue: {
        pendingReservations,
        readyPickups,
        activeBorrows,
        overdueBorrows,
        pendingMaterialApprovals: pendingMaterials,
        failedIndexingReview: failedIndexingBooks,
      },
      collectionInsights: {
        booksByFaculty: this.formatBooksByFaculty(facultyBooks),
        booksByCategory: categoryRows.map((row) => ({
          category: row.category ?? 'Uncategorized',
          count: row._count._all,
        })),
        missingMetadata: {
          missingIsbn,
          missingDescription,
          missingCategory,
          missingSubjectTags,
          missingFaculty,
          missingCoverImage,
        },
        metadataIssuesPreview: metadataIssuesPreviewRaw.slice(0, 10).map((book) => ({
          id: book.id,
          title: book.title,
          authors: book.authors,
          missingFields: this.getMissingMetadataFields(book),
          catalogUrl: `/dashboard/catalog/${book.id}`,
          adminEditUrl: `/dashboard/admin/books/${book.id}/edit`,
        })),
        mostBorrowedBooks: mostBorrowedRows,
        mostReservedBooks: mostReservedRows,
      },
      materialsOverview: {
        total: materialsTotal,
        pendingApproval: pendingMaterials,
        approved: materialsApproved,
        published: materialsPublished,
        byIndexStatus: materialsByIndexStatus.map((row) => ({
          status: row.indexStatus,
          count: row._count._all,
        })),
        totalChunks: materialChunks,
      },
      aiUsage: {
        conversations: aiConversations.length,
        messages: totalMessages,
        activeUsers: uniqueAiUsers,
        assistantResponseRate: safePercentage(conversationsWithAssistantReply, aiConversations.length),
        period: '7d' as const,
      },
      generatedAt: now.toISOString(),
    };
  }

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
    const [user, borrowedBooks, policy] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { interests: true } }),
      this.prisma.borrow.count({ where: { userId, status: BorrowStatus.ACTIVE } }),
      this.prisma.borrowPolicy.findUnique({ where: { role: Role.STAFF } }),
    ]);

    return {
      borrowedBooks,
      interests: user?.interests || [],
      interestCount: user?.interests?.length || 0,
      maxBorrowDays: policy?.maxBorrowDays || 14,
    };
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

  private formatStatusDistribution(
    rows: Array<{ pdfIndexStatus: IndexStatus; _count: { _all: number } }>,
    totalBooks: number,
  ): CountByStatus[] {
    const counts = new Map(rows.map((row) => [row.pdfIndexStatus, row._count._all]));
    return INDEX_STATUS_ORDER
      .map((status) => {
        const count = counts.get(status) ?? 0;
        return { status, count, percentage: safePercentage(count, totalBooks) };
      })
      .filter((row) => row.count > 0 || totalBooks === 0);
  }

  private formatBooksByFaculty(
    books: Array<{ mainFacultyId: string | null; mainFaculty: { name: string } | null }>,
  ) {
    const counts = new Map<string | null, { facultyId: string | null; facultyName: string; count: number }>();

    for (const book of books) {
      const facultyId = book.mainFacultyId;
      const facultyName = book.mainFaculty?.name ?? 'Unassigned';
      const existing = counts.get(facultyId);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(facultyId, { facultyId, facultyName, count: 1 });
      }
    }

    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.facultyName.localeCompare(b.facultyName));
  }

  private getMissingMetadataFields(book: {
    isbn: string | null;
    description: string | null;
    category: string | null;
    subjectTags: string[] | null;
    mainFacultyId: string | null;
    coverImageUrl: string | null;
  }): string[] {
    const fields: string[] = [];
    if (!book.isbn) fields.push('ISBN');
    if (!book.description) fields.push('description');
    if (!book.category) fields.push('category');
    if (!book.subjectTags || book.subjectTags.length === 0) fields.push('subject tags');
    if (!book.mainFacultyId) fields.push('faculty');
    if (!book.coverImageUrl) fields.push('cover image');
    return fields;
  }

  private async getMostBorrowedBooksForSnapshot() {
    const rows = await this.prisma.$queryRaw<Array<{ bookId: string; title: string; borrowCount: bigint | number }>>`
      SELECT b.id AS "bookId", b.title, COUNT(br.id) AS "borrowCount"
      FROM borrows br
      JOIN book_copies bc ON bc.id = br."bookCopyId"
      JOIN books b ON b.id = bc."bookId"
      WHERE b."isActive" = true
      GROUP BY b.id, b.title
      ORDER BY "borrowCount" DESC, b.title ASC
      LIMIT ${TOP_BOOK_LIMIT}
    `;

    return rows.map((row) => ({
      bookId: row.bookId,
      title: row.title,
      borrowCount: Number(row.borrowCount),
    }));
  }

  private async getMostReservedBooksForSnapshot() {
    const rows = await this.prisma.$queryRaw<Array<{ bookId: string; title: string; reservationCount: bigint | number }>>`
      SELECT b.id AS "bookId", b.title, COUNT(r.id) AS "reservationCount"
      FROM reservations r
      JOIN books b ON b.id = r."bookId"
      WHERE b."isActive" = true
      GROUP BY b.id, b.title
      ORDER BY "reservationCount" DESC, b.title ASC
      LIMIT ${TOP_BOOK_LIMIT}
    `;

    return rows.map((row) => ({
      bookId: row.bookId,
      title: row.title,
      reservationCount: Number(row.reservationCount),
    }));
  }
}

function safePercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}


