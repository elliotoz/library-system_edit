import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BorrowStatus, BookCopyStatus, NotificationType, ReservationStatus } from '@prisma/client';

const FINE_RATE_PER_DAY = 5;
const DEDUP_WINDOW_HOURS = 22;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

@Injectable()
export class BorrowSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BorrowSchedulerService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Run once shortly after startup, then every hour
    setTimeout(() => this.runChecks(), 10_000);
    this.intervalHandle = setInterval(() => this.runChecks(), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  async runChecks() {
    try {
      await this.transitionOverdueBorrows();
    } catch (err) {
      this.logger.error(`Overdue transition error: ${err}`);
    }
    try {
      await this.expireReservations();
    } catch (err) {
      this.logger.error(`Reservation expiry error: ${err}`);
    }
    try {
      await this.sendOverdueAndDueSoonNotifications();
    } catch (err) {
      this.logger.error(`Notification error: ${err}`);
    }
  }

  private async transitionOverdueBorrows() {
    const now = new Date();
    const result = await this.prisma.borrow.updateMany({
      where: { status: BorrowStatus.ACTIVE, dueAt: { lt: now } },
      data: { status: BorrowStatus.OVERDUE },
    });
    if (result.count > 0) {
      this.logger.log(`Borrows transitioned to OVERDUE: ${result.count}`);
    }
  }

  private async expireReservations() {
    const now = new Date();

    // Expire PENDING and APPROVED reservations by expiresAt
    const staleByExpiry = await this.prisma.reservation.findMany({
      where: {
        status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED] },
        expiresAt: { lt: now },
      },
      include: {
        bookCopy: { include: { book: { select: { id: true, title: true } } } },
      },
    });

    // Expire READY_FOR_PICKUP reservations by pickupDeadline
    const staleByDeadline = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.READY_FOR_PICKUP,
        pickupDeadline: { lt: now },
      },
      include: {
        bookCopy: { include: { book: { select: { id: true, title: true } } } },
      },
    });

    const stale = [...staleByExpiry, ...staleByDeadline];
    let expired = 0;

    for (const reservation of stale) {
      await this.prisma.$transaction([
        this.prisma.reservation.updateMany({
          where: { id: reservation.id, status: { in: [ReservationStatus.PENDING, ReservationStatus.APPROVED, ReservationStatus.READY_FOR_PICKUP] } },
          data: { status: ReservationStatus.EXPIRED },
        }),
        this.prisma.bookCopy.updateMany({
          where: { id: reservation.bookCopyId, status: BookCopyStatus.RESERVED },
          data: { status: BookCopyStatus.AVAILABLE },
        }),
      ]);

      await this.notifications.create({
        userId: reservation.userId,
        type: NotificationType.RESERVATION_EXPIRED,
        title: 'Reservation Expired',
        message: `Your reservation for "${reservation.bookCopy.book.title}" has expired and the copy has been released.`,
        bookId: reservation.bookCopy.book.id,
      });

      expired++;
    }

    if (expired > 0) {
      this.logger.log(`Reservations expired: ${expired}`);
    }
  }

  private async sendOverdueAndDueSoonNotifications() {
    const now = new Date();
    const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

    // Include OVERDUE as well — transitionOverdueBorrows() runs first and moves
    // past-due borrows out of ACTIVE. Without this, overdue notifications would
    // stop being sent after the first scheduler tick.
    const activeBorrows = await this.prisma.borrow.findMany({
      where: { status: { in: [BorrowStatus.ACTIVE, BorrowStatus.OVERDUE] } },
      include: {
        bookCopy: { include: { book: { select: { id: true, title: true } } } },
      },
    });

    let overdueSent = 0;
    let dueSoonSent = 0;

    for (const borrow of activeBorrows) {
      const dueDate = new Date(borrow.dueAt);
      const msUntilDue = dueDate.getTime() - now.getTime();
      const daysUntilDue = msUntilDue / (1000 * 60 * 60 * 24);
      const isOverdue = daysUntilDue < 0;
      const overdueDays = isOverdue ? Math.ceil(-daysUntilDue) : 0;
      const bookId = borrow.bookCopy.book.id;
      const bookTitle = borrow.bookCopy.book.title;

      if (isOverdue) {
        const alreadySent = await this.prisma.notification.findFirst({
          where: {
            userId: borrow.userId,
            bookId,
            type: NotificationType.BORROW_OVERDUE,
            createdAt: { gte: dedupCutoff },
          },
        });
        if (!alreadySent) {
          const overduePrefs = await this.getNotifPrefs(borrow.userId);
          if (overduePrefs.dueDateReminders) {
            const fine = overdueDays * FINE_RATE_PER_DAY;
            await this.prisma.notification.create({
              data: {
                userId: borrow.userId,
                type: NotificationType.BORROW_OVERDUE,
                title: 'Book Overdue ⚠️',
                message: `"${bookTitle}" is ${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue. Estimated fine: ₺${fine}. Please return it as soon as possible.`,
                bookId,
              },
            });
            overdueSent++;
          }
        }
      } else if (daysUntilDue <= 3) {
        const daysLeft = Math.ceil(daysUntilDue);
        const alreadySent = await this.prisma.notification.findFirst({
          where: {
            userId: borrow.userId,
            bookId,
            type: NotificationType.BORROW_DUE_SOON,
            createdAt: { gte: dedupCutoff },
          },
        });
        if (!alreadySent) {
          const prefs = await this.getNotifPrefs(borrow.userId);
          if (prefs.dueDateReminders) {
            await this.notifications.notifyDueSoon(borrow.userId, bookTitle, daysLeft, bookId);
            dueSoonSent++;
          }
        }
      }
    }

    if (overdueSent > 0 || dueSoonSent > 0) {
      this.logger.log(`Notifications sent — overdue: ${overdueSent}, due soon: ${dueSoonSent}`);
    }
  }

  private async getNotifPrefs(userId: string): Promise<{ dueDateReminders: boolean; emailNotifications: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    });
    const prefs = (user?.notificationPrefs as Record<string, boolean>) ?? {};
    return {
      dueDateReminders: prefs.dueDateReminders !== false,
      emailNotifications: prefs.emailNotifications !== false,
    };
  }
}
