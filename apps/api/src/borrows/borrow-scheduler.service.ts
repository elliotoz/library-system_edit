import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BorrowStatus, NotificationType } from '@prisma/client';

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
      await this.sendOverdueAndDueSoonNotifications();
    } catch (err) {
      this.logger.error(`Scheduler error: ${err}`);
    }
  }

  private async sendOverdueAndDueSoonNotifications() {
    const now = new Date();
    const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

    const activeBorrows = await this.prisma.borrow.findMany({
      where: { status: BorrowStatus.ACTIVE },
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
          await this.notifications.notifyDueSoon(borrow.userId, bookTitle, daysLeft, bookId);
          dueSoonSent++;
        }
      }
    }

    if (overdueSent > 0 || dueSoonSent > 0) {
      this.logger.log(`Notifications sent — overdue: ${overdueSent}, due soon: ${dueSoonSent}`);
    }
  }
}
